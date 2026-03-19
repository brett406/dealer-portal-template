#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════
# Dealer Portal — Database Restore
# Downloads a backup from S3/R2 and restores it to a database
# ═══════════════════════════════════════════════════════════

# ─── Usage ────────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-path>"
  echo ""
  echo "Examples:"
  echo "  $0 daily/dealer-portal_2026-03-18_020000.sql.gz"
  echo "  $0 weekly/dealer-portal_2026-03-17_020000.sql.gz"
  echo "  $0 monthly/dealer-portal_2026-03-01_020000.sql.gz"
  echo ""
  echo "List available backups:"
  echo "  $0 --list daily"
  echo "  $0 --list weekly"
  echo "  $0 --list monthly"
  exit 1
fi

# ─── Configuration ────────────────────────────────────────

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required — this is the target database}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

if [ -n "$BACKUP_S3_PREFIX" ]; then
  BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX%/}/"
fi

export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"

S3_ARGS=""
if [ -n "$BACKUP_S3_ENDPOINT" ]; then
  S3_ARGS="--endpoint-url $BACKUP_S3_ENDPOINT"
fi

S3_BASE="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}"

s3() {
  # shellcheck disable=SC2086
  aws s3 $S3_ARGS "$@"
}

TMPDIR="/tmp/restore"
trap 'rm -rf "$TMPDIR"' EXIT

# ─── List mode ────────────────────────────────────────────

if [ "$1" = "--list" ]; then
  TIER="${2:-daily}"
  echo "Backups in ${TIER}/:"
  echo ""
  s3 ls "${S3_BASE}${TIER}/" 2>/dev/null | grep '\.sql\.gz$' | awk '{printf "  %s  %s  %s\n", $1, $2, $NF}' | sort -r
  exit 0
fi

# ─── Restore ──────────────────────────────────────────────

BACKUP_PATH="$1"
REMOTE="${S3_BASE}${BACKUP_PATH}"
LOCAL_FILE="${TMPDIR}/$(basename "$BACKUP_PATH")"

echo "═══════════════════════════════════════════════════"
echo "  DATABASE RESTORE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Source:  ${REMOTE}"
echo "  Target:  ${BACKUP_DATABASE_URL%%@*}@***"
echo ""
echo "  ⚠  WARNING: This will OVERWRITE the target database."
echo "     The backup uses --clean which drops and recreates objects."
echo ""
read -r -p "  Continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
mkdir -p "$TMPDIR"

# Download
echo "[1/3] Downloading backup..."
if ! s3 cp "$REMOTE" "$LOCAL_FILE" --quiet; then
  echo "ERROR: Failed to download ${REMOTE}"
  echo "Check the path and run: $0 --list daily"
  exit 1
fi

FILESIZE=$(du -h "$LOCAL_FILE" | cut -f1)
echo "  Downloaded: $(basename "$LOCAL_FILE") (${FILESIZE})"

# Decompress and restore
echo "[2/3] Decompressing and restoring..."
if ! gunzip -c "$LOCAL_FILE" | psql "$BACKUP_DATABASE_URL" --quiet --no-psqlrc 2>&1; then
  echo ""
  echo "ERROR: Restore failed. The database may be in a partial state."
  echo "Check the error output above."
  exit 1
fi

echo "[3/3] Restore complete!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Restore finished successfully."
echo ""
echo "  Next steps:"
echo "  1. Verify the data: psql \$BACKUP_DATABASE_URL -c 'SELECT count(*) FROM \"User\"'"
echo "  2. If restoring to production, restart the app to clear any cached data"
echo "  3. Check that the admin can log in"
echo "═══════════════════════════════════════════════════"
