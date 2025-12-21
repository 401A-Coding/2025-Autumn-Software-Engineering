#!/usr/bin/env bash
set -euo pipefail

# Remote backend deploy script template
# Expects these environment variables (or uses defaults):
#  REMOTE_WORK, ZIP_PATH, BACKEND_IMAGE, BACKEND_CONTAINER, DATABASE_URL, JWT_SECRET

REMOTE_WORK=${REMOTE_WORK:-/tmp/chess-backend-src}
ZIP_PATH=${ZIP_PATH:-/tmp/backend-src.tar.gz}
BACKEND_IMAGE=${BACKEND_IMAGE:-chess-backend:latest}
BACKEND_CONTAINER=${BACKEND_CONTAINER:-chess-backend}
DATABASE_URL=${DATABASE_URL:-"postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public"}
JWT_SECRET=${JWT_SECRET:-}

rm -rf "$REMOTE_WORK" && mkdir -p "$REMOTE_WORK"

tar -xzf "$ZIP_PATH" -C "$REMOTE_WORK"
cd "$REMOTE_WORK"

# If maintainer uploaded an openapi spec separately, move it into build context
if [ -f "/tmp/backend-openapi.yaml" ]; then
  mkdir -p ./docs
  mv /tmp/backend-openapi.yaml ./docs/openapi.yaml || true
fi

# Normalize line endings of entrypoint in extracted source to avoid CRLF issues
if [ -f "./docker-entrypoint.sh" ]; then
  sed -i 's/\r$//' ./docker-entrypoint.sh || true
fi

# Build image without cache to ensure any Dockerfile changes (e.g. CRLF normalization) take effect
docker build --no-cache -t "$BACKEND_IMAGE" .
old_image=$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)

docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true

docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host \
  -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$BACKEND_IMAGE"

sleep 2

if [ -z "$(docker ps --filter name=$BACKEND_CONTAINER --filter status=running -q)" ]; then
  echo 'New backend container not running, rolling back...' >&2
  if [ -n "$old_image" ]; then
    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
    docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
  fi
  exit 1
fi

echo "[remote] backend deploy finished"
