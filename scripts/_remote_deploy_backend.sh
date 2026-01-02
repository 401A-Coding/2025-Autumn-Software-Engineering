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

# Networking options
NETWORK_MODE=${NETWORK_MODE:-host}
NETWORK_NAME=${NETWORK_NAME:-}

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

# Ensure openapi file is present in build context and show it for logs
echo "[remote] build context ./docs listing:" 
ls -la ./docs || echo "[remote] ./docs missing or empty"

# Build image without cache to ensure any Dockerfile changes (e.g. CRLF normalization) take effect
# Enable plain progress to make Docker output easy to read in logs when supported
echo "[remote] starting docker build (no-cache)..."
DOCKER_BUILDKIT=1 docker build --no-cache --progress=plain -t "$BACKEND_IMAGE" .
old_image=$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)

docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true

if [ "$NETWORK_MODE" = "bridge" ]; then
  if [ -z "$NETWORK_NAME" ]; then
    echo "[remote] NETWORK_MODE=bridge requires NETWORK_NAME" >&2
    exit 1
  fi
  echo "[remote] starting container on bridge network '$NETWORK_NAME' and publishing port 3000"
  docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network "$NETWORK_NAME" -p 3000:3000 \
    -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$BACKEND_IMAGE"
else
  echo "[remote] starting container on host network"
  docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host \
    -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$BACKEND_IMAGE"
fi

sleep 5

# Verify that the running container has the openapi file; if missing, try to copy from build context and restart
echo "[remote] verifying /docs/openapi.yaml inside container $BACKEND_CONTAINER"
if docker exec "$BACKEND_CONTAINER" sh -c 'test -f /docs/openapi.yaml' >/dev/null 2>&1; then
  echo "[remote] /docs/openapi.yaml exists in container"
else
  echo "[remote] /docs/openapi.yaml missing in container; attempting docker cp from build context"
  if [ -f ./docs/openapi.yaml ]; then
    echo "[remote] creating /docs in container"
    docker exec "$BACKEND_CONTAINER" sh -c 'mkdir -p /docs' || true
    docker cp ./docs/openapi.yaml "$BACKEND_CONTAINER":/docs/openapi.yaml || true
    echo "[remote] copied openapi.yaml into container, restarting container"
    docker restart "$BACKEND_CONTAINER" || true
    sleep 3
  else
    echo "[remote] openapi.yaml not present in extracted build context; cannot repair in-container file" >&2
  fi
fi

# Re-check after attempted repair
if docker exec "$BACKEND_CONTAINER" sh -c 'test -f /docs/openapi.yaml' >/dev/null 2>&1; then
  echo "[remote] /docs/openapi.yaml available after repair (or was present)"
else
  echo "New backend container missing /docs/openapi.yaml after repair, rolling back..." >&2
  if [ -n "$old_image" ]; then
    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
    if [ "$NETWORK_MODE" = "bridge" ]; then
      docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network "$NETWORK_NAME" -p 3000:3000 -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    else
      docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    fi
  fi
  exit 1
fi

if [ -z "$(docker ps --filter name=$BACKEND_CONTAINER --filter status=running -q)" ]; then
  echo 'New backend container not running, rolling back...' >&2
  if [ -n "$old_image" ]; then
    docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
    if [ "$NETWORK_MODE" = "bridge" ]; then
      docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network "$NETWORK_NAME" -p 3000:3000 -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    else
      docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    fi
  fi
  exit 1
fi

echo "[remote] backend deploy finished"
