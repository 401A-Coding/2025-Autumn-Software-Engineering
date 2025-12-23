#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set" >&2
  exit 1
fi

echo "[entrypoint] Running prisma migrate deploy..."
# Use npx to fetch prisma cli in runtime image
npx prisma migrate deploy

echo "[entrypoint] Starting NestJS app..."
exec node dist/main
