#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════
# Dealer Portal — Database Backup
# Dumps PostgreSQL, compresses, uploads to S3/R2, rotates old backups
# ═══════════════════════════════════════════════════════════

# ─── Configuration ────────────────────────────────────────

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"
BACKUP_RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
BACKUP_RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
BACKUP_RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-3}"

TIMESTAMP="$(date -u +%Y-%m-%d_%H%M%S)"
DATE_STR="$(date -u +%Y-%m-%d)"
DAY_OF_WEEK="$(date -u +%u)"  # 7 = Sunday
DAY_OF_MONTH="$(date -u +%d)"
FILENAME="dealer-portal_${TIMESTAMP}.sql.gz"
TMPDIR="/tmp/backup"

# Normalize prefix: strip trailing slash, add it back if non-empty
if [ -n "$BACKUP_S3_PREFIX" ]; then
  BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX%/}/"
fi

# ─── AWS CLI Configuration ────────────────────────────────

export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"

S3_ARGS=""
if [ -n "$BACKUP_S3_ENDPOINT" ]; then
  S3_ARGS="--endpoint-url $BACKUP_S3_ENDPOINT"
fi

S3_BASE="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}"

# ─── Helpers ──────────────────────────────────────────────

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

send_alert() {
  local message="$1"
  if [ -n "${BACKUP_ALERT_EMAIL:-}" ] && [ -n "${RESEND_API_KEY:-}" ]; then
    log "Sending failure alert to ${BACKUP_ALERT_EMAIL}..."
    curl -s -X POST "https://api.resend.com/emails" \
      -H "Authorization: Bearer ${RESEND_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "{
        \"from\": \"${BACKUP_ALERT_FROM:-noreply@example.com}\",
        \"to\": \"${BACKUP_ALERT_EMAIL}\",
        \"subject\": \"Backup Failed — ${DATE_STR}\",
        \"html\": \"<h2>Backup Failed</h2><p>${message}</p><p>Timestamp: ${TIMESTAMP}</p><p>Database: ${BACKUP_DATABASE_URL%%@*}@***</p>\"
      }" || log "WARNING: Failed to send alert email"
  fi
}

s3() {
  # shellcheck disable=SC2086
  aws s3 $S3_ARGS "$@"
}

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

# ─── Main ─────────────────────────────────────────────────

log "Starting backup..."
log "Bucket: ${BACKUP_S3_BUCKET}"
log "Prefix: ${BACKUP_S3_PREFIX:-<root>}"

mkdir -p "$TMPDIR"

# Step 1: pg_dump
log "Dumping database..."
if ! pg_dump "$BACKUP_DATABASE_URL" --no-owner --no-privileges --clean --if-exists \
    | gzip > "${TMPDIR}/${FILENAME}"; then
  log "ERROR: pg_dump failed"
  send_alert "pg_dump failed. Check database connectivity and credentials."
  exit 1
fi

FILESIZE=$(du -h "${TMPDIR}/${FILENAME}" | cut -f1)
log "Dump complete: ${FILENAME} (${FILESIZE})"

# Step 2: Upload to daily/
log "Uploading to daily/..."
if ! s3 cp "${TMPDIR}/${FILENAME}" "${S3_BASE}daily/${FILENAME}" --quiet; then
  log "ERROR: S3 upload failed"
  send_alert "S3 upload to daily/ failed. Check bucket permissions and credentials."
  exit 1
fi
log "Uploaded to daily/${FILENAME}"

# Step 3: Weekly backup (Sunday = day 7)
if [ "$DAY_OF_WEEK" = "7" ]; then
  log "Sunday — copying to weekly/..."
  if s3 cp "${S3_BASE}daily/${FILENAME}" "${S3_BASE}weekly/${FILENAME}" --quiet; then
    log "Copied to weekly/${FILENAME}"
  else
    log "WARNING: Failed to copy weekly backup"
  fi
fi

# Step 4: Monthly backup (1st of month)
if [ "$DAY_OF_MONTH" = "01" ]; then
  log "First of month — copying to monthly/..."
  if s3 cp "${S3_BASE}daily/${FILENAME}" "${S3_BASE}monthly/${FILENAME}" --quiet; then
    log "Copied to monthly/${FILENAME}"
  else
    log "WARNING: Failed to copy monthly backup"
  fi
fi

# Step 5: Rotation — delete old backups
rotate() {
  local tier="$1"
  local keep="$2"
  local count

  log "Rotating ${tier}/ — keeping last ${keep}..."

  # List files, sort oldest first, count
  local files
  files=$(s3 ls "${S3_BASE}${tier}/" 2>/dev/null | grep '\.sql\.gz$' | awk '{print $NF}' | sort)
  count=$(echo "$files" | grep -c '.' || true)

  if [ "$count" -le "$keep" ]; then
    log "  ${tier}/: ${count} files, nothing to rotate"
    return
  fi

  local to_delete
  to_delete=$(echo "$files" | head -n $((count - keep)))

  echo "$to_delete" | while IFS= read -r file; do
    if [ -n "$file" ]; then
      log "  Deleting ${tier}/${file}"
      s3 rm "${S3_BASE}${tier}/${file}" --quiet || log "  WARNING: Failed to delete ${tier}/${file}"
    fi
  done
}

rotate "daily" "$BACKUP_RETENTION_DAILY"
rotate "weekly" "$BACKUP_RETENTION_WEEKLY"
rotate "monthly" "$BACKUP_RETENTION_MONTHLY"

log "Backup complete!"
log "  Daily:   ${S3_BASE}daily/${FILENAME}"
log "  Size:    ${FILESIZE}"
exit 0
