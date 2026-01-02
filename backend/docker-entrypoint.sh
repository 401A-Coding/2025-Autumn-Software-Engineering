#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] Running prisma migrate deploy..."
# Use npx to fetch prisma cli in runtime image
# Prefer container env DATABASE_URL over prisma/.env to avoid wrong host (127.0.0.1) inside container
if [ -f "prisma/.env" ]; then
  echo "[entrypoint] Detected prisma/.env; temporarily disabling to use container DATABASE_URL"
  mv prisma/.env prisma/.env.disabled 2>/dev/null || true
fi
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS app..."

# Try common build output locations in order
if [ -f "dist/main.js" ]; then
  exec node dist/main.js
elif [ -f "dist/src/main.js" ]; then
  echo "[entrypoint] dist/main.js not found; using dist/src/main.js"
  exec node dist/src/main.js
elif [ -f "dist/main" ]; then
  echo "[entrypoint] dist/main.js not found; falling back to dist/main"
  exec node dist/main
else
  echo "[entrypoint] ERROR: dist entry not found (dist/main.js, dist/src/main.js, or dist/main)."
  ls -la /app || true
  ls -la /app/dist || true
  # Show tree of dist for debugging (may not be available in Alpine by default)
  find /app/dist -maxdepth 2 -type f -print 2>/dev/null || true
  exit 1
fi
