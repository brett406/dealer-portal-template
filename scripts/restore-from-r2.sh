#!/usr/bin/env bash
#
# Restore a Dealer Portal database backup from Cloudflare R2.
# Used both for disaster recovery and the quarterly test restore.
#
# Required env vars:
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
#
# Usage:
#   ./scripts/restore-from-r2.sh <object-key> <target-database-url>
#
# Examples:
#   # Restore yesterday's backup into a throwaway local DB for the
#   # quarterly restore test:
#   ./scripts/restore-from-r2.sh daily/2026-05-04.dump \
#     postgres://localhost:5432/portal_restore_test
#
#   # Disaster recovery — restore into a fresh Railway DB (requires override):
#   ALLOW_PROD_RESTORE=1 ./scripts/restore-from-r2.sh weekly/2026-W18.dump \
#     "$NEW_RAILWAY_DATABASE_URL"

set -euo pipefail

OBJECT_KEY="${1:-}"
TARGET_DB_URL="${2:-}"

if [ -z "$OBJECT_KEY" ] || [ -z "$TARGET_DB_URL" ]; then
  echo "Usage: $0 <object-key> <target-database-url>" >&2
  echo "" >&2
  echo "Notes:" >&2
  echo "  - This script is destructive: pg_restore --clean --if-exists drops" >&2
  echo "    every object in the target DB before recreating it." >&2
  echo "  - Refuses to run unless target host is local/test." >&2
  echo "  - For genuine disaster recovery, set ALLOW_PROD_RESTORE=1." >&2
  exit 64
fi

# ── Safety guard ──────────────────────────────────────────
# This script is destructive. By default, refuse unless the target host is
# local/test (localhost / 127.0.0.1 / *-test* / *_test*). For real disaster
# recovery into a fresh production DB, set ALLOW_PROD_RESTORE=1 and confirm
# the URL by printing the host first.
TARGET_HOST="$(printf '%s' "$TARGET_DB_URL" | sed -E 's|^[a-zA-Z][a-zA-Z0-9+.-]*://[^@]*@?([^:/?]+).*|\1|')"
echo "→ Target host: $TARGET_HOST"
case "$TARGET_HOST" in
  localhost|127.0.0.1|*-test*|*_test*)
    : # local/test — proceed
    ;;
  *)
    if [ "${ALLOW_PROD_RESTORE:-}" != "1" ]; then
      echo "" >&2
      echo "❌ Refusing to restore into non-local host \"$TARGET_HOST\"." >&2
      echo "   This script will pg_restore --clean --if-exists, which drops every" >&2
      echo "   object in the target DB. If this is genuine disaster recovery into a" >&2
      echo "   fresh production DB, re-run with ALLOW_PROD_RESTORE=1:" >&2
      echo "" >&2
      echo "     ALLOW_PROD_RESTORE=1 $0 \"$OBJECT_KEY\" \"<target-database-url>\"" >&2
      echo "" >&2
      exit 64
    fi
    echo "⚠ ALLOW_PROD_RESTORE=1 set — proceeding against non-local host." >&2
    ;;
esac

for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  if [ -z "${!var:-}" ]; then
    echo "Error: $var is not set in the environment." >&2
    exit 64
  fi
done

DUMP_PATH="$(mktemp -t portal-restore.XXXXXX.dump)"
trap 'rm -f "$DUMP_PATH"' EXIT

echo "→ Downloading $OBJECT_KEY from R2..."
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws s3 cp "s3://$R2_BUCKET/$OBJECT_KEY" "$DUMP_PATH" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  --no-progress

echo "→ Dump size: $(ls -lh "$DUMP_PATH" | awk '{print $5}')"
echo "→ Restoring into target database..."

# --clean + --if-exists drops existing objects before recreating, so this
# is safe to run against a non-empty target. --no-owner and --no-acl
# ignore the source's role/grant config (Railway and dev DBs use
# different roles).
pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --dbname "$TARGET_DB_URL" \
  "$DUMP_PATH"

echo "✔ Restore complete. Run a smoke test before relying on this DB."
