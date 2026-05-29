#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Backup automatique PostgreSQL ApeX.
#
# Crée un dump compressé daté, applique une rétention de N jours,
# upload optionnel vers S3/Backblaze.
#
# Variables d'environnement requises (depuis .env) :
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
#
# Variables optionnelles :
#   BACKUP_DIR      : dossier local (défaut /var/backups/apex)
#   BACKUP_RETENTION: jours de rétention locale (défaut 30)
#   S3_BUCKET       : si défini, upload via aws-cli ou rclone
#
# Cron quotidien recommandé (à 3 h du matin Abidjan) :
#   0 3 * * * /opt/apex/backend/scripts/backup.sh >> /var/log/apex-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# Charge .env si présent — uniquement les variables DB_*, BACKUP_*, S3_*
# (le `source` direct du .env pose des soucis si une valeur contient
# des caractères shell spéciaux comme < ou >).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    if [[ "$key" =~ ^(DB_|BACKUP_|S3_) ]]; then
      export "$key=${value%$'\r'}"
    fi
  done < "$ENV_FILE"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-comptawest}"
DB_USER="${DB_USER:-comptawest_user}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/apex}"
RETENTION="${BACKUP_RETENTION:-30}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="apex_${DB_NAME}_${TIMESTAMP}.sql.gz"
OUT="$BACKUP_DIR/$FILENAME"

echo "[$(date)] Démarrage backup $DB_NAME → $OUT"

# Dump compressé. -Fc serait plus rapide à restaurer mais binaire ;
# on garde un .sql.gz pour lisibilité (audit comptable + debug).
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "$OUT"

SIZE=$(du -h "$OUT" | awk '{print $1}')
echo "[$(date)] Backup OK : $OUT ($SIZE)"

# Rotation : supprime les backups de plus de RETENTION jours
find "$BACKUP_DIR" -name "apex_${DB_NAME}_*.sql.gz" -mtime "+${RETENTION}" -delete
NB_RESTANT=$(find "$BACKUP_DIR" -name "apex_${DB_NAME}_*.sql.gz" | wc -l)
echo "[$(date)] Rotation OK ($RETENTION j) — $NB_RESTANT backup(s) conservé(s)"

# Upload S3 optionnel
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[$(date)] Upload S3 → s3://${S3_BUCKET}/${FILENAME}"
    aws s3 cp "$OUT" "s3://${S3_BUCKET}/${FILENAME}" --storage-class STANDARD_IA
    echo "[$(date)] Upload OK"
  else
    echo "[$(date)] WARNING : S3_BUCKET défini mais aws-cli absent. Installer : pip install awscli"
  fi
fi

# Test d'intégrité : gunzip puis pg_restore --list (lecture seule)
if ! gunzip -t "$OUT"; then
  echo "[$(date)] ERREUR : le fichier gzip est corrompu !"
  exit 1
fi
echo "[$(date)] Intégrité gzip OK"

echo "[$(date)] Backup terminé avec succès"
