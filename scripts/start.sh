#!/bin/sh
set -e

echo "[Startup] Running database migrations..."
npx prisma migrate deploy
echo "[Startup] Migrations complete."

echo "[Startup] Starting application..."
exec node server.js
