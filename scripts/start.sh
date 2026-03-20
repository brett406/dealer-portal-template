#!/bin/sh

PRISMA="node node_modules/prisma/build/index.js"

# Resolve any previously failed migrations so migrate deploy can proceed
echo "[Startup] Checking for failed migrations..."
$PRISMA migrate resolve --applied 20260319000000_add_search_indexes 2>/dev/null || true

echo "[Startup] Running database migrations..."
if $PRISMA migrate deploy; then
  echo "[Startup] Migrations complete."
else
  echo "[Startup] WARNING: Migration had issues (non-fatal). The app will start anyway."
fi

# Ensure uploads directory exists on volume (if mounted)
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
  mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH/uploads" 2>/dev/null || true
  echo "[Startup] Uploads directory: $RAILWAY_VOLUME_MOUNT_PATH/uploads"
fi

echo "[Startup] Starting application..."
exec node server.js
