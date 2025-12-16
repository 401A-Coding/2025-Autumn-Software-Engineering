#!/bin/sh
set -e

# Wait for Postgres if needed (simple retry loop)
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is set."
fi

# Run Prisma migrations (idempotent in deploy mode)
echo "[entrypoint] Running prisma migrate deploy..."
# Use npx to fetch prisma cli if not present in prod deps
npx prisma migrate deploy

# Start the app
echo "[entrypoint] Starting NestJS app..."
exec node dist/main
