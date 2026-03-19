#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════
# Dealer Portal — Restore Uploaded Files from S3/R2
# Syncs files from the S3 backup to a local uploads directory
# ═══════════════════════════════════════════════════════════

if [ $# -lt 1 ]; then
  echo "Usage: $0 <local-uploads-directory>"
  echo ""
  echo "Examples:"
  echo "  $0 ./public/uploads/"
  echo "  $0 /data/uploads/"
  echo ""
  echo "This downloads all uploaded files from the S3/R2 backup bucket"
  echo "to the specified local directory. Uses 'aws s3 sync' so only"
  echo "missing files are downloaded."
  exit 1
fi

# ─── Configuration ────────────────────────────────────────

: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"

BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

LOCAL_DIR="$1"

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

S3_SOURCE="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}uploads/"

# ─── Restore ──────────────────────────────────────────────

echo "Restoring uploads from S3..."
echo "  Source: ${S3_SOURCE}"
echo "  Target: ${LOCAL_DIR}"
echo ""

mkdir -p "$LOCAL_DIR"

# shellcheck disable=SC2086
aws s3 $S3_ARGS sync "$S3_SOURCE" "$LOCAL_DIR" --no-progress

COUNT=$(find "$LOCAL_DIR" -type f | wc -l | tr -d ' ')
echo ""
echo "Restore complete! ${COUNT} files in ${LOCAL_DIR}"
