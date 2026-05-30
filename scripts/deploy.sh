#!/usr/bin/env bash
# =====================================================================
# ApeX — script de déploiement vers le VPS de production (useapex.ci).
# =====================================================================
#
# Idempotent. À lancer DEPUIS TON POSTE (pas depuis le VPS).
#
# Étapes :
#   1. Build du frontend en local (vite build → frontend/dist)
#   2. Tests backend (NODE_ENV=test) — bloque le déploiement si KO
#   3. rsync du backend (sans node_modules, sans logs, sans backups)
#   4. rsync du frontend/dist vers /var/www/apex-front
#   5. SSH : npm ci --omit=dev, migrations BD, pm2 reload zero-downtime
#   6. Healthcheck HTTPS sur api.useapex.ci/api/health
#
# Pré-requis sur le VPS (à faire UNE seule fois, cf. deploy/README.md) :
#   - utilisateur `apex` avec accès sudo
#   - dossiers /opt/apex et /var/www/apex-front, /var/www/apex-landing créés
#   - /opt/apex/backend/.env complété avec les vraies valeurs prod
#   - pm2 installé globalement + ecosystem.config.js déjà démarré une fois
#   - Caddy en service (reverse proxy + TLS)
#
# Variables surchargables :
#   VPS_HOST=apex@vps.useapex.ci   # défaut
#   VPS_PORT=22                    # défaut
#   APEX_ROOT=/opt/apex            # défaut côté VPS
#   FRONT_DIST=/var/www/apex-front # défaut côté VPS
#   SKIP_TESTS=1                   # saute les tests (hotfix urgent)
#   SKIP_BUILD=1                   # saute le build front (déjà fait)
#
# Usage :
#   ./scripts/deploy.sh
#   VPS_HOST=apex@1.2.3.4 ./scripts/deploy.sh
#   SKIP_TESTS=1 ./scripts/deploy.sh   # ⚠️ uniquement en urgence
# =====================================================================
set -euo pipefail

# ---------- Configuration ----------
VPS_HOST="${VPS_HOST:-apex@vps.useapex.ci}"
VPS_PORT="${VPS_PORT:-22}"
APEX_ROOT="${APEX_ROOT:-/opt/apex}"
FRONT_DIST="${FRONT_DIST:-/var/www/apex-front}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://api.useapex.ci/health}"

PROJET_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJET_ROOT"

# ---------- Helpers ----------
log()  { printf "\033[1;34m[deploy]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

ssh_vps() { ssh -p "$VPS_PORT" "$VPS_HOST" "$@"; }

# ---------- 0. Garde-fous ----------
log "Cible : $VPS_HOST  →  $APEX_ROOT (back) + $FRONT_DIST (front)"

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Working tree git non propre. Les modifs locales ne sont PAS commitées,"
  warn "mais elles seront déployées (rsync du dossier de travail)."
  read -r -p "Continuer ? [y/N] " confirm
  [[ "$confirm" =~ ^[yY]$ ]] || fail "Annulé par l'utilisateur."
fi

command -v rsync >/dev/null || fail "rsync manquant. apt install rsync."
command -v ssh   >/dev/null || fail "ssh manquant."

# ---------- 1. Build frontend ----------
if [[ -z "${SKIP_BUILD:-}" ]]; then
  log "Build frontend (vite build)…"
  ( cd frontend && npm ci --silent && npm run build )
  ok "Frontend buildé → frontend/dist/"
else
  warn "SKIP_BUILD=1 — build frontend ignoré, on déploie frontend/dist/ tel quel."
  [[ -d frontend/dist ]] || fail "frontend/dist/ inexistant. Lance d'abord 'npm run build'."
fi

# ---------- 2. Tests backend ----------
if [[ -z "${SKIP_TESTS:-}" ]]; then
  log "Tests backend (npm test)…"
  ( cd backend && npm test ) || fail "Tests KO — déploiement annulé. (SKIP_TESTS=1 pour forcer)"
  ok "Tests OK."
else
  warn "SKIP_TESTS=1 — tests ignorés. À utiliser uniquement en hotfix."
fi

# ---------- 3. rsync backend ----------
log "Sync backend vers $VPS_HOST:$APEX_ROOT/backend …"
rsync -azh --delete --info=progress2 \
  -e "ssh -p $VPS_PORT" \
  --exclude 'node_modules' \
  --exclude 'logs' \
  --exclude 'backups' \
  --exclude '.env' \
  --exclude 'tests' \
  backend/ "$VPS_HOST:$APEX_ROOT/backend/"
ok "Backend synchronisé."

# Le Caddyfile et le README de déploiement
log "Sync deploy/ vers $VPS_HOST:$APEX_ROOT/deploy …"
rsync -azh --delete \
  -e "ssh -p $VPS_PORT" \
  deploy/ "$VPS_HOST:$APEX_ROOT/deploy/"

# ---------- 4. rsync frontend buildé ----------
log "Sync frontend/dist vers $VPS_HOST:$FRONT_DIST …"
rsync -azh --delete --info=progress2 \
  -e "ssh -p $VPS_PORT" \
  frontend/dist/ "$VPS_HOST:$FRONT_DIST/"
ok "Frontend déployé."

# ---------- 5. Étapes côté VPS ----------
log "Installation deps backend + migrations + pm2 reload …"
ssh_vps "bash -s" <<EOF
set -euo pipefail
cd "$APEX_ROOT/backend"

echo "[vps] npm ci --omit=dev …"
npm ci --omit=dev --silent

echo "[vps] migrations BD …"
npm run migrate

echo "[vps] pm2 reload zero-downtime …"
pm2 reload ecosystem.config.js --env production --update-env

echo "[vps] pm2 save (relance auto au reboot)"
pm2 save

echo "[vps] OK."
EOF
ok "Backend rechargé sur le VPS."

# ---------- 6. Healthcheck ----------
log "Healthcheck $HEALTHCHECK_URL …"
sleep 3
for i in 1 2 3 4 5; do
  code=$(curl -s -o /tmp/apex_health -w "%{http_code}" "$HEALTHCHECK_URL" || echo "000")
  if [[ "$code" == "200" ]]; then
    ok "Healthcheck OK (HTTP 200)."
    head -c 200 /tmp/apex_health; echo
    rm -f /tmp/apex_health
    exit 0
  fi
  warn "Tentative $i/5 : HTTP $code — nouvelle tentative dans 4s…"
  sleep 4
done

rm -f /tmp/apex_health
fail "Healthcheck KO après 5 tentatives. Lance: ssh $VPS_HOST 'pm2 logs apex-api --lines 100'"
