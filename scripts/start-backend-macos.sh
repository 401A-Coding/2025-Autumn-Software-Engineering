#!/usr/bin/env bash
set -euo pipefail

RESET_DB=0
if [[ ${1-} == "-r" || ${1-} == "--reset-db" ]]; then
  RESET_DB=1
fi

# Move to backend directory
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR/../backend"

echo "[start-backend-macos] Node version: $(node -v)"

# Load prisma/.env if present (export variables)
if [[ -f prisma/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  . prisma/.env
  set +a
fi

if [[ -z "${DATABASE_URL-}" ]]; then
  echo "[start-backend-macos] WARN: DATABASE_URL not set. Set it in backend/prisma/.env or current session." >&2
fi

# Install deps if node_modules not found
if [[ ! -d node_modules ]]; then
  echo "[start-backend-macos] Installing dependencies..."
  npm install
fi

echo "[start-backend-macos] Generating Prisma Client..."
npm run prisma:generate

if [[ $RESET_DB -eq 1 ]]; then
  echo "[start-backend-macos] Resetting database (ALL DATA WILL BE LOST)..."
  npm run prisma:reset
fi

echo "[start-backend-macos] Applying migrations..."
npm run prisma:migrate

echo "[start-backend-macos] Starting NestJS (watch)..."
npm run start:dev
