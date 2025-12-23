#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="/tmp/backend-src.zip"
APP_DIR="/srv/app/chess-backend"
PGDATA_DIR="/srv/app/pgdata"
NETWORK="appnet"

echo "[deploy] Ensuring dependencies (docker, unzip)..."
if ! command -v unzip >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y unzip
fi
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-plugin
  sudo systemctl enable --now docker
fi

echo "[deploy] Preparing directories..."
sudo mkdir -p "$APP_DIR" "$PGDATA_DIR"
sudo rm -rf "$APP_DIR"/*

echo "[deploy] Unzipping sources to $APP_DIR ..."
sudo unzip -o "$ZIP_PATH" -d "$APP_DIR"

cd "$APP_DIR"

echo "[deploy] Creating docker network if missing..."
sudo docker network inspect "$NETWORK" >/dev/null 2>&1 || sudo docker network create "$NETWORK"

echo "[deploy] Installing and starting Postgres via apt (fallback to avoid Hub pull limits)..."
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" || true
sudo -u postgres psql -c "CREATE DATABASE mydb OWNER postgres;" || true

echo "[deploy] Building backend image..."
sudo docker build \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  -t chess-backend:latest .

echo "[deploy] Starting backend container..."
JWT_SECRET="${JWT_SECRET:-}"
if [ -z "$JWT_SECRET" ]; then
  if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET="$(openssl rand -hex 32)"
  else
    JWT_SECRET="$(head -c 32 /dev/urandom | od -A none -t x1 | tr -d ' \n')"
  fi
fi

sudo docker rm -f chess-backend >/dev/null 2>&1 || true
sudo docker run -d \
  --name chess-backend \
  --restart unless-stopped \
  --network host \
  -e DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public" \
  -e JWT_SECRET="$JWT_SECRET" \
  chess-backend:latest

echo "[deploy] Done. Containers:"
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

echo "[deploy] Health check (port 3000):"
sleep 2
if command -v curl >/dev/null 2>&1; then
  curl -sS http://127.0.0.1:3000/ | head -c 200 || true
else
  echo "curl not installed; skip health check"
fi
echo