#!/bin/sh
set -e

echo "[Startup] Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy
echo "[Startup] Migrations complete."

echo "[Startup] Starting application..."
exec node server.js
