#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Restauration d'un backup PostgreSQL ApeX.
#
# Usage :
#   ./restore.sh /var/backups/apex/apex_comptawest_20260615_030000.sql.gz
#   ./restore.sh --dry-run /chemin/vers/dump.sql.gz   # vérif seulement
#   ./restore.sh --latest                              # dernier backup local
#
# ⚠ DESTRUCTIF en production : le dump contient des DROP TABLE IF EXISTS
#   (option --clean de pg_dump). Toute la base courante sera écrasée.
#   Toujours tester sur un clone d'abord.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    if [[ "$key" =~ ^(DB_|BACKUP_) ]]; then
      export "$key=${value%$'\r'}"
    fi
  done < "$ENV_FILE"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-comptawest}"
DB_USER="${DB_USER:-comptawest_user}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/apex}"

DRY_RUN=false
DUMP=""

# Parse arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --latest)
      DUMP=$(find "$BACKUP_DIR" -name "apex_${DB_NAME}_*.sql.gz" -type f | sort | tail -1)
      [ -z "$DUMP" ] && { echo "Aucun backup trouvé dans $BACKUP_DIR"; exit 1; }
      shift ;;
    -*) echo "Option inconnue : $1"; exit 1 ;;
    *) DUMP="$1"; shift ;;
  esac
done

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage : $0 [--dry-run] [--latest|/chemin/vers/dump.sql.gz]"
  exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo "  RESTAURATION ApeX"
echo "════════════════════════════════════════════════════════════════"
echo "  Fichier  : $DUMP ($(du -h "$DUMP" | awk '{print $1}'))"
echo "  Cible    : $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "  Mode     : $([ "$DRY_RUN" = true ] && echo 'DRY-RUN' || echo 'RESTAURATION EFFECTIVE')"
echo "════════════════════════════════════════════════════════════════"

# Vérif intégrité
if ! gunzip -t "$DUMP"; then
  echo "❌ Le fichier gzip est corrompu"
  exit 1
fi
echo "  ✓ Intégrité gzip OK"

# Compte les statements SQL du dump
NB_STATEMENTS=$(gunzip -c "$DUMP" | grep -cE "^(CREATE|INSERT|ALTER|COPY)")
echo "  ✓ $NB_STATEMENTS statements SQL détectés"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "  Mode dry-run : aucune modification appliquée."
  exit 0
fi

echo ""
read -p "  ⚠ Confirmer la restauration (la base $DB_NAME sera ÉCRASÉE) ? [oui/non] " CONFIRM
[ "$CONFIRM" != "oui" ] && { echo "  Annulé."; exit 0; }

# Restauration effective
echo ""
echo "  [$(date)] Démarrage restauration…"
gunzip -c "$DUMP" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet

# Vérifs post-restauration
NB_ENT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tA -c "SELECT COUNT(*) FROM entreprises;")
NB_USR=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tA -c "SELECT COUNT(*) FROM utilisateurs;")

echo "  [$(date)] Restauration terminée."
echo "  ✓ $NB_ENT entreprise(s) et $NB_USR utilisateur(s) restaurés."
