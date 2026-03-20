#!/bin/sh

PRISMA="node node_modules/prisma/build/index.js"

# Resolve any previously failed migrations so migrate deploy can proceed
echo "[Startup] Checking for failed migrations..."
$PRISMA migrate resolve --applied 20260319000000_add_search_indexes 2>/dev/null || true
$PRISMA migrate resolve --applied 20260319120000_add_product_tags 2>/dev/null || true

echo "[Startup] Running database migrations..."
if $PRISMA migrate deploy; then
  echo "[Startup] Migrations complete."
else
  echo "[Startup] WARNING: Migration had issues (non-fatal). The app will start anyway."
fi

# Ensure uploads directory exists and is writable
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

echo "[Startup] Starting application..."
exec node server.js
