#!/bin/sh

echo "[Startup] Running database migrations..."
if node node_modules/prisma/build/index.js migrate deploy; then
  echo "[Startup] Migrations complete."
else
  echo "[Startup] WARNING: Migration had issues (non-fatal). The app will start anyway."
  echo "[Startup] Run 'prisma migrate status' to check migration state."
fi

echo "[Startup] Starting application..."
exec node server.js
