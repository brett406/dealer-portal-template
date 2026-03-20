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

# ─── Start the application ────────────────────────────────────────────────
echo "[Startup] Starting application..."
exec node server.js
