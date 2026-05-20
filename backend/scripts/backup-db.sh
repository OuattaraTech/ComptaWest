#!/usr/bin/env bash
#
# Sauvegarde de la base ApeX
# -----------------------------------------------------------------------------
# Effectue un pg_dump compressé et horodaté, puis applique une rotation
# (conserve les N sauvegardes les plus récentes).
#
# Usage :
#   ./scripts/backup-db.sh                  # sauvegarde dans backend/backups/
#   BACKUP_DIR=/var/backups/comptawest ./scripts/backup-db.sh
#   BACKUP_KEEP=30 ./scripts/backup-db.sh   # conserve 30 sauvegardes
#
# Cron quotidien à 2h du matin (crontab -e) :
#   0 2 * * * cd /chemin/vers/backend && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Restauration :
#   gunzip -c backups/comptawest_2026-05-14_0200.sql.gz | psql -h HOST -U USER -d comptawest
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Charge les variables de connexion depuis backend/.env
if [[ -f "$BACKEND_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD)=' "$BACKEND_DIR/.env")
  set +a
else
  echo "❌ Fichier .env introuvable dans $BACKEND_DIR" >&2
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-comptawest}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-$BACKEND_DIR/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H%M)"
OUTFILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sauvegarde de '$DB_NAME' → $OUTFILE"

PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges \
  | gzip > "$OUTFILE"

SIZE="$(du -h "$OUTFILE" | cut -f1)"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Sauvegarde terminée ($SIZE)"

# Rotation : on ne garde que les BACKUP_KEEP plus récentes
COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.sql.gz" | wc -l)"
if (( COUNT > BACKUP_KEEP )); then
  find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.sql.gz" -printf '%T@ %p\n' \
    | sort -n | head -n "-$BACKUP_KEEP" | cut -d' ' -f2- \
    | while read -r old; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rotation : suppression de $(basename "$old")"
        rm -f "$old"
      done
fi
