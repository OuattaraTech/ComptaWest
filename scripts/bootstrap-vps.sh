#!/usr/bin/env bash
# =====================================================================
# ApeX — bootstrap d'un VPS Debian 13 (Trixie) vierge.
# =====================================================================
#
# À LANCER UNE SEULE FOIS, en root (ou via sudo), sur le VPS de prod.
# Idempotent : peut être relancé sans casser ce qui est déjà installé.
#
# Cible : Hetzner Cloud / OVH / Scaleway, Debian 13 cloud-amd64.
# Prérequis : un utilisateur `apex` avec accès sudo et SSH key déjà posée.
#
# Que fait ce script :
#   1. apt update + upgrade
#   2. Timezone Africa/Abidjan
#   3. Installation : Node 20 LTS, PostgreSQL 17, Caddy, git, ufw, fail2ban
#   4. pm2 global
#   5. Swap 2 Go si absent
#   6. UFW : 22/80/443 only
#   7. fail2ban actif (sshd jail)
#   8. PostgreSQL : user `apex` + base `apex` + timezone Africa/Abidjan
#   9. Dossiers /opt/apex, /var/www/{apex-front,apex-landing,apex-docs}
#  10. Affichage de la checklist post-install (étapes manuelles restantes)
#
# Usage :
#   sudo bash scripts/bootstrap-vps.sh
#   # ou, depuis le poste local :
#   scp scripts/bootstrap-vps.sh apex@<IP>:~/ && \
#     ssh apex@<IP> 'sudo bash ~/bootstrap-vps.sh'
# =====================================================================
set -euo pipefail

# ---------- Helpers ----------
log()  { printf "\033[1;34m[bootstrap]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Lance ce script en root (sudo bash scripts/bootstrap-vps.sh)."

APEX_USER="${APEX_USER:-apex}"
APEX_DB_NAME="${APEX_DB_NAME:-apex}"
APEX_DB_USER="${APEX_DB_USER:-apex}"
APEX_TIMEZONE="${APEX_TIMEZONE:-Africa/Abidjan}"

# ---------- 1. Système de base ----------
log "apt update + upgrade…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl ca-certificates gnupg lsb-release \
  git unzip rsync \
  ufw fail2ban \
  build-essential \
  postgresql postgresql-contrib \
  debian-keyring debian-archive-keyring apt-transport-https
ok "Paquets de base installés."

# ---------- 2. Timezone ----------
log "Timezone → $APEX_TIMEZONE"
timedatectl set-timezone "$APEX_TIMEZONE"
ok "Timezone configurée."

# ---------- 3. Node 20 LTS (NodeSource) ----------
if ! command -v node >/dev/null || ! node --version | grep -q "^v2[0-9]"; then
  log "Installation Node.js 20 LTS via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ok "Node $(node --version) installé."
else
  ok "Node déjà présent : $(node --version)"
fi

# ---------- 4. Caddy ----------
if ! command -v caddy >/dev/null; then
  log "Installation Caddy (repo officiel)…"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
  ok "Caddy $(caddy version | head -1) installé."
else
  ok "Caddy déjà présent."
fi

# ---------- 5. pm2 global ----------
if ! command -v pm2 >/dev/null; then
  log "Installation pm2 (global)…"
  npm install -g pm2@latest
  ok "pm2 $(pm2 --version) installé."
else
  ok "pm2 déjà présent : $(pm2 --version)"
fi

# ---------- 6. Swap 2 Go si absent ----------
if ! swapon --show | grep -q .; then
  log "Création swap 2 Go…"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "Swap 2 Go activé."
else
  ok "Swap déjà actif."
fi

# ---------- 7. UFW ----------
log "Configuration ufw (22/80/443 only)…"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ok "UFW actif : $(ufw status | head -1)"

# ---------- 8. fail2ban ----------
log "Activation fail2ban (jail sshd)…"
systemctl enable --now fail2ban
ok "fail2ban actif."

# ---------- 9. PostgreSQL : user + base ----------
log "Création utilisateur $APEX_DB_USER + base $APEX_DB_NAME (si absents)…"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APEX_DB_USER'" | grep -q 1; then
  PG_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=')"
  sudo -u postgres psql -c "CREATE USER $APEX_DB_USER WITH PASSWORD '$PG_PASSWORD';"
  echo "$PG_PASSWORD" > "/home/$APEX_USER/.apex-db-password"
  chown "$APEX_USER:$APEX_USER" "/home/$APEX_USER/.apex-db-password"
  chmod 600 "/home/$APEX_USER/.apex-db-password"
  warn "Mot de passe PG généré et écrit dans /home/$APEX_USER/.apex-db-password"
  warn "À copier dans backend/.env (DB_PASSWORD=) puis SUPPRIMER ce fichier."
else
  ok "User PG $APEX_DB_USER existe déjà."
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$APEX_DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE $APEX_DB_NAME OWNER $APEX_DB_USER ENCODING 'UTF8';"
  sudo -u postgres psql -c "ALTER DATABASE $APEX_DB_NAME SET timezone TO '$APEX_TIMEZONE';"
  ok "Base $APEX_DB_NAME créée (timezone $APEX_TIMEZONE)."
else
  ok "Base $APEX_DB_NAME existe déjà."
fi

# ---------- 10. Dossiers applicatifs ----------
log "Création des dossiers applicatifs…"
mkdir -p /opt/apex /var/www/apex-front /var/www/apex-landing /var/www/apex-docs
chown -R "$APEX_USER:$APEX_USER" /opt/apex /var/www/apex-front /var/www/apex-landing /var/www/apex-docs
ok "Dossiers prêts (owner $APEX_USER)."

# ---------- 11. Journaux Caddy ----------
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true

# ---------- 12. Checklist post-install ----------
cat <<EOF

==============================================================================
  ApeX — bootstrap VPS terminé.
==============================================================================

  Prochaines étapes (à exécuter en tant qu'utilisateur '$APEX_USER') :

  1. Récupérer le mot de passe PG généré :
       cat ~/.apex-db-password
       # → noter le mot de passe, puis :
       shred -u ~/.apex-db-password

  2. Cloner le repo :
       git clone https://github.com/OuattaraTech/ComptaWest.git /opt/apex
       cd /opt/apex/backend
       cp .env.example .env
       nano .env   # remplir DB_PASSWORD, JWT_SECRET, RESEND_API_KEY…
       # générer un JWT_SECRET costaud :
       node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

  3. Vérifier l'environnement avant lancement :
       cd /opt/apex/backend
       node scripts/check-prod-ready.js

  4. Migrations + démarrage :
       npm ci --omit=dev
       npm run migrate
       pm2 start ecosystem.config.js --env production
       pm2 save
       sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $APEX_USER --hp /home/$APEX_USER

  5. Build front (depuis ton poste local, puis rsync), ou directement ici :
       cd /opt/apex/frontend && npm ci && npm run build
       sudo cp -r dist/* /var/www/apex-front/

  6. Activer Caddy :
       sudo cp /opt/apex/deploy/Caddyfile /etc/caddy/Caddyfile
       sudo systemctl reload caddy

  7. Smoke test :
       bash /opt/apex/scripts/smoke-prod.sh

==============================================================================
EOF
