#!/usr/bin/env bash
# =============================================================================
# ApeX — vérification mensuelle automatique d'un backup.
# =============================================================================
#
# Restaure le backup le plus récent sur une base de test temporaire,
# exécute une série de SELECT de vérification, puis détruit la base.
#
# Exit codes :
#   0  → backup OK et restaurable
#   1  → fichier de backup introuvable ou corrompu
#   2  → erreur SQL pendant la restauration
#   3  → contenu inattendu (table manquante, compteurs anormaux)
#
# Doit être lancé en tant que user système ayant accès à postgres et au
# fichier .env :
#   sudo -u apex /opt/apex/backend/scripts/verify-backup.sh
#
# Cron mensuel suggéré (1er de chaque mois à 4h) :
#   0 4 1 * * apex /opt/apex/backend/scripts/verify-backup.sh >> /var/log/apex-backup-verify.log 2>&1
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/apex}"
TEST_DB="apex_verify_$(date +%Y%m%d_%H%M%S)"

# Couleurs (suppr en env non-tty)
if [[ -t 1 ]]; then
  G='\033[1;32m'; R='\033[1;31m'; Y='\033[1;33m'; B='\033[1;34m'; N='\033[0m'
else
  G=''; R=''; Y=''; B=''; N=''
fi
ok()   { printf "${G}✓${N} %s\n" "$*"; }
ko()   { printf "${R}✗${N} %s\n" "$*" >&2; }
warn() { printf "${Y}⚠${N} %s\n" "$*"; }
log()  { printf "${B}→${N} %s\n" "$*"; }

log "ApeX — vérification automatique d'un backup ($(date -Iseconds))"

# ---------- Charger les credentials PG ----------
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  ko "Fichier .env introuvable dans $BACKEND_DIR"
  exit 1
fi
set -a
# shellcheck disable=SC1091
source <(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD)=' "$BACKEND_DIR/.env")
set +a
export PGPASSWORD="$DB_PASSWORD"

# ---------- Trouver le backup le plus récent ----------
LATEST=$(ls -1t "$BACKUP_DIR"/apex_*.sql.gz 2>/dev/null | head -1 || true)
if [[ -z "$LATEST" ]]; then
  ko "Aucun backup trouvé dans $BACKUP_DIR"
  exit 1
fi
SIZE=$(stat -c%s "$LATEST")
log "Backup ciblé : $LATEST ($((SIZE / 1024)) Ko)"

if [[ "$SIZE" -lt 10240 ]]; then
  ko "Backup trop petit (<10 Ko) — probablement corrompu ou vide"
  exit 1
fi

# ---------- Vérifier l'intégrité gzip ----------
log "Vérification de l'intégrité gzip…"
if ! gunzip -t "$LATEST" 2>/dev/null; then
  ko "Archive gzip corrompue : $LATEST"
  exit 1
fi
ok "Archive gzip intègre"

# ---------- Créer la base de test ----------
log "Création de la base de test : $TEST_DB"
if ! psql -h "$DB_HOST" -U postgres -d postgres -c "CREATE DATABASE \"$TEST_DB\" OWNER \"$DB_USER\";" >/dev/null 2>&1; then
  # Le user apex n'a sans doute pas le droit CREATEDB — bascule via sudo postgres
  if ! sudo -u postgres psql -c "CREATE DATABASE \"$TEST_DB\" OWNER \"$DB_USER\";" >/dev/null 2>&1; then
    ko "Impossible de créer la base de test (ni en $DB_USER, ni en postgres)"
    exit 2
  fi
fi

cleanup() {
  log "Suppression de la base de test : $TEST_DB"
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 \
    || psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 \
    || warn "Base de test $TEST_DB non supprimée — à nettoyer manuellement"
}
trap cleanup EXIT

# ---------- Restaurer le backup dans la base de test ----------
log "Restauration en cours…"
if ! gunzip -c "$LATEST" | psql -h "$DB_HOST" -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 >/dev/null 2>/tmp/verify-restore.err; then
  ko "Restauration KO. Détail :"
  head -20 /tmp/verify-restore.err >&2
  exit 2
fi
ok "Restauration terminée"

# ---------- Vérifications de contenu ----------
PSQL="psql -h $DB_HOST -U $DB_USER -d $TEST_DB -tAc"

TBL=$($PSQL "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
if [[ "$TBL" -lt 40 ]]; then
  ko "Base restaurée incomplète : seulement $TBL tables (attendu ≥ 40)"
  exit 3
fi
ok "Tables : $TBL"

NB_USERS=$($PSQL "SELECT COUNT(*) FROM utilisateurs;")
NB_ENT=$($PSQL "SELECT COUNT(*) FROM entreprises;")
ok "Utilisateurs : $NB_USERS — Entreprises : $NB_ENT"

# Test SQL : vérif qu'une table-clé répond
if ! $PSQL "SELECT 1 FROM schema_migrations LIMIT 1;" >/dev/null 2>&1; then
  ko "Table schema_migrations introuvable ou inaccessible"
  exit 3
fi

NB_MIG=$($PSQL "SELECT COUNT(*) FROM schema_migrations;")
ok "Migrations dans schema_migrations : $NB_MIG"

# ---------- Rapport ----------
printf "\n${G}╔══════════════════════════════════════════════╗${N}\n"
printf "${G}║  Backup OK — restaurable et cohérent.        ║${N}\n"
printf "${G}║  Fichier : $(basename "$LATEST" | head -c 40)${N}\n"
printf "${G}║  Date    : $(date '+%Y-%m-%d %H:%M:%S %Z')${N}\n"
printf "${G}╚══════════════════════════════════════════════╝${N}\n"

exit 0
