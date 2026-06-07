#!/bin/sh

PRISMA="node node_modules/prisma/build/index.js"

# ─── Validate required environment ─────────────────────────────────────────
if [ -z "$AUTH_SECRET" ]; then
  echo "[Startup] FATAL: AUTH_SECRET is not set."
  echo "[Startup] Generate one with: openssl rand -base64 32"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[Startup] FATAL: DATABASE_URL is not set."
  exit 1
fi

# ─── Run database migrations ───────────────────────────────────────────────
echo "[Startup] Running database migrations..."
if $PRISMA migrate deploy; then
  echo "[Startup] Migrations complete."
else
  echo "[Startup] FATAL: Migration failed. The app will not start with a mismatched schema."
  exit 1
fi

# ─── Ensure uploads directory exists ───────────────────────────────────────
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
  mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH/uploads" 2>/dev/null
  if touch "$RAILWAY_VOLUME_MOUNT_PATH/uploads/.write-test" 2>/dev/null; then
    rm -f "$RAILWAY_VOLUME_MOUNT_PATH/uploads/.write-test"
    echo "[Startup] Uploads directory OK: $RAILWAY_VOLUME_MOUNT_PATH/uploads"
  else
    echo "[Startup] WARNING: Cannot write to $RAILWAY_VOLUME_MOUNT_PATH/uploads"
    echo "[Startup] Check volume permissions. Current user: $(whoami), id: $(id)"
    ls -la "$RAILWAY_VOLUME_MOUNT_PATH/" 2>/dev/null || true
  fi
fi

# ─── Durable upload storage guardrail ──────────────────────────────────────
# Uploads MUST persist across redeploys. With neither a persistent volume nor
# R2 configured, files land on the container's EPHEMERAL disk and are wiped on
# the next deploy — this silently destroyed a customer's media. We don't hard-
# exit (that would take the whole site down), but we scream in the logs, and the
# app itself refuses uploads in this state (see lib/uploads getStorageDurability).
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$RAILWAY_VOLUME_MOUNT_PATH" ] && [ -z "$UPLOADS_DIR" ] && [ -z "$BACKUP_S3_BUCKET" ]; then
    echo "[Startup] ============================================================"
    echo "[Startup] !!! WARNING: NO DURABLE UPLOAD STORAGE CONFIGURED !!!"
    echo "[Startup] Uploaded files would be written to EPHEMERAL disk and LOST"
    echo "[Startup] on the next redeploy. Uploads are DISABLED until you either:"
    echo "[Startup]   - attach a Railway volume (sets RAILWAY_VOLUME_MOUNT_PATH),"
    echo "[Startup]   - set UPLOADS_DIR to a persistent path, and/or"
    echo "[Startup]   - set BACKUP_S3_BUCKET/_ACCESS_KEY/_SECRET_KEY for R2."
    echo "[Startup] ============================================================"
  else
    echo "[Startup] Durable upload storage OK (volume/UPLOADS_DIR/R2 present)."
  fi
fi

# ─── Start the application ────────────────────────────────────────────────
echo "[Startup] Starting application..."
exec node server.js
