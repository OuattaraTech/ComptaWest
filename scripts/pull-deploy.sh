#!/usr/bin/env bash
# =====================================================================
# ApeX — déploiement par git pull, à lancer SUR LE SERVEUR de prod.
# =====================================================================
#
# Modèle « push local / pull serveur » : tu fais `git push origin master`
# depuis ton poste, puis tu lances CE script sur le VPS. Il enchaîne :
#   1. git pull (fast-forward) de la branche
#   2. backend  : npm ci --omit=dev
#   3. migrations BD — UNIQUEMENT si réellement en attente (garde-fou)
#   4. frontend : npm ci + build, puis copie vers les dossiers Caddy
#   5. pm2 reload zero-downtime + pm2 save
#   6. healthcheck HTTPS
#
# Usage (sur le serveur) :
#   cd /opt/apex && ./scripts/pull-deploy.sh
#
# Options (variables d'env) :
#   APEX_ROOT=/opt/apex            racine du clone git
#   BRANCH=master                 branche à déployer
#   FRONT_DIST=/var/www/apex-front dossier servi par Caddy (app/landing)
#   COPY_LANDING=1                copie aussi vers /var/www/apex-landing (sudo)
#   LANDING_DIST=/var/www/apex-landing
#   PM2_APP=apex-api              nom pm2
#   HEALTHCHECK_URL=https://api.useapex.ci/health
#   FORCE_RESET=1                 git reset --hard origin/BRANCH avant pull
#                                 (à utiliser UNE fois si l'arbre est « sale »
#                                  suite à d'anciens rsync ; .env est préservé
#                                  car ignoré par git)
#   MIGRATE_MAX_AUTO=3            nb max de migrations appliquées sans confirmer
#   MIGRATE_FORCE=1               applique les migrations même au-delà du seuil
#   SKIP_FRONT=1                  ne rebuild pas le front (hotfix back only)
#   SKIP_BACK=1                   ne touche pas au back (changement front only)
# =====================================================================
set -euo pipefail

# Ré-exécution depuis une copie /tmp : le `git pull` peut réécrire CE
# script pendant qu'il tourne (bash lit le fichier au fil de l'eau).
# On se recopie dans /tmp et on relance, pour exécuter une copie stable.
if [[ "${PULL_DEPLOY_REEXEC:-}" != "1" ]]; then
  SELF="$(readlink -f "$0")"
  cp "$SELF" /tmp/apex-pull-deploy.run.sh
  PULL_DEPLOY_REEXEC=1 SELF_ORIG="$SELF" exec bash /tmp/apex-pull-deploy.run.sh "$@"
fi

# ---------- Configuration ----------
APEX_ROOT="${APEX_ROOT:-/opt/apex}"
BRANCH="${BRANCH:-master}"
FRONT_DIST="${FRONT_DIST:-/var/www/apex-front}"
LANDING_DIST="${LANDING_DIST:-/var/www/apex-landing}"
COPY_LANDING="${COPY_LANDING:-1}"
PM2_APP="${PM2_APP:-apex-api}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://api.useapex.ci/health}"
MIGRATE_MAX_AUTO="${MIGRATE_MAX_AUTO:-3}"

# ---------- Helpers ----------
log()  { printf "\033[1;34m[deploy]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

[[ -d "$APEX_ROOT/.git" ]] || fail "$APEX_ROOT n'est pas un dépôt git. (Modèle rsync ? alors utilise scripts/deploy.sh depuis ton poste.)"
cd "$APEX_ROOT"

# ---------- 1. git pull ----------
log "Récupération de origin/$BRANCH …"
git fetch origin "$BRANCH"

AVANT="$(git rev-parse HEAD)"
CIBLE="$(git rev-parse "origin/$BRANCH")"

if [[ "$AVANT" == "$CIBLE" ]]; then
  ok "Déjà à jour ($(git rev-parse --short HEAD)). Rien à puller."
else
  if [[ "${FORCE_RESET:-}" == "1" ]]; then
    warn "FORCE_RESET=1 → git reset --hard origin/$BRANCH (les fichiers suivis locaux seront écrasés ; .env préservé car gitignore)."
    git reset --hard "origin/$BRANCH"
  else
    if [[ -n "$(git status --porcelain)" ]]; then
      warn "Arbre de travail non propre (probablement d'anciens rsync) :"
      git status --short | sed 's/^/    /' | head -20
      fail "git pull --ff-only impossible. Lance UNE fois :  cd $APEX_ROOT && git reset --hard origin/$BRANCH  (ou relance avec FORCE_RESET=1). Vérifie d'abord que backend/.env est bien gitignore."
    fi
    git pull --ff-only origin "$BRANCH"
  fi
  ok "Mis à jour : $(git --no-pager log --oneline "$AVANT..HEAD" | wc -l) commit(s) → $(git rev-parse --short HEAD)"
fi

# ---------- 2-3. Backend : deps + migrations ----------
if [[ -z "${SKIP_BACK:-}" ]]; then
  log "Backend : npm ci --omit=dev …"
  ( cd backend && npm ci --omit=dev --silent )

  log "Vérification des migrations en attente …"
  PENDING="$(cd backend && npm run --silent migrate:status 2>/dev/null | grep -oE '[0-9]+ en attente' | grep -oE '[0-9]+' | tail -1 || echo 0)"
  PENDING="${PENDING:-0}"

  if [[ "$PENDING" -eq 0 ]]; then
    ok "Base à jour, aucune migration en attente."
  elif [[ "$PENDING" -le "$MIGRATE_MAX_AUTO" || "${MIGRATE_FORCE:-}" == "1" ]]; then
    log "$PENDING migration(s) en attente → application …"
    ( cd backend && npm run migrate )
    ok "Migrations appliquées."
  else
    warn "$PENDING migrations en attente — c'est anormalement élevé (base non baselinée ?)."
    warn "Par sécurité je ne les applique PAS automatiquement."
    fail "Vérifie 'cd $APEX_ROOT/backend && npm run migrate:status'. Pour forcer : relance avec MIGRATE_FORCE=1."
  fi
else
  warn "SKIP_BACK=1 — backend non touché."
fi

# ---------- 4. Frontend : build + copie ----------
if [[ -z "${SKIP_FRONT:-}" ]]; then
  log "Frontend : npm ci + build …"
  ( cd frontend && npm ci --silent && npm run build )

  log "Copie du build → $FRONT_DIST …"
  mkdir -p "$FRONT_DIST"
  rm -rf "${FRONT_DIST:?}/"* 2>/dev/null || true
  cp -r frontend/dist/* "$FRONT_DIST/"
  ok "Front déployé sur $FRONT_DIST."

  if [[ "$COPY_LANDING" == "1" ]]; then
    log "Copie du build → $LANDING_DIST (sudo) …"
    sudo mkdir -p "$LANDING_DIST"
    sudo rm -rf "${LANDING_DIST:?}/"* 2>/dev/null || true
    sudo cp -r frontend/dist/* "$LANDING_DIST/"
    ok "Landing déployée sur $LANDING_DIST."
  fi
else
  warn "SKIP_FRONT=1 — frontend non rebuild."
fi

# ---------- 5. pm2 reload ----------
if [[ -z "${SKIP_BACK:-}" ]]; then
  log "pm2 reload zero-downtime ($PM2_APP) …"
  ( cd backend && pm2 reload ecosystem.config.js --env production --update-env || pm2 reload "$PM2_APP" --update-env )
  pm2 save >/dev/null 2>&1 || true
  ok "Backend rechargé."
fi

# ---------- 6. Healthcheck ----------
log "Healthcheck $HEALTHCHECK_URL …"
sleep 3
for i in 1 2 3 4 5; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL" || echo 000)"
  if [[ "$code" == "200" ]]; then
    ok "Healthcheck OK (HTTP 200)."
    echo
    ok "Déploiement terminé → $(git rev-parse --short HEAD)"
    exit 0
  fi
  warn "Tentative $i/5 : HTTP $code — nouvelle tentative dans 4 s…"
  sleep 4
done

fail "Healthcheck KO. Inspecte :  pm2 logs $PM2_APP --lines 100"
