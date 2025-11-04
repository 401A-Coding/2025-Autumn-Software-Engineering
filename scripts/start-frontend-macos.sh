#!/usr/bin/env bash
set -euo pipefail

# Move to frontend directory
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR/../frontend"

# Ensure deps
if [[ ! -d node_modules ]]; then
  echo "[start-frontend-macos] Installing dependencies..."
  npm install
fi

# Ensure VITE_API_BASE exists
if [[ ! -f .env ]]; then
  echo "VITE_API_BASE=http://localhost:3000" > .env
  echo "[start-frontend-macos] Created .env with default VITE_API_BASE=http://localhost:3000"
fi

echo "[start-frontend-macos] Starting Vite dev server..."
npm run dev
