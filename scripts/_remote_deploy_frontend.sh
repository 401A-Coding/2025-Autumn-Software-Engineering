#!/usr/bin/env bash
set -euo pipefail

# Remote frontend deploy script template
# Uses environment variables (optional defaults):
#  REMOTE_TMP, REMOTE_WEBROOT

REMOTE_TMP=${REMOTE_TMP:-/tmp}
REMOTE_WEBROOT=${REMOTE_WEBROOT:-/var/www/chess}
REMOTE_DIST_DIR="$REMOTE_TMP/chess-dist"

ts=$(date +%Y%m%d-%H%M%S)
backup="$REMOTE_TMP/chess-backup-$ts.tar.gz"

sudo mkdir -p "$REMOTE_WEBROOT"
# backup current site (ignore failure)
sudo tar -czf "$backup" -C "$REMOTE_WEBROOT" . 2>/dev/null || true

# replace site contents
sudo rm -rf "$REMOTE_WEBROOT"/*
sudo mkdir -p "$REMOTE_WEBROOT"
sudo cp -r "$REMOTE_DIST_DIR"/dist/* "$REMOTE_WEBROOT"/
sudo chown -R www-data:www-data "$REMOTE_WEBROOT"

# validate nginx config, rollback on failure
if ! sudo nginx -t; then
  echo 'nginx -t failed, restoring backup' >&2
  sudo rm -rf "$REMOTE_WEBROOT"/*
  sudo mkdir -p "$REMOTE_WEBROOT"
  sudo tar -xzf "$backup" -C "$REMOTE_WEBROOT" 2>/dev/null || true
  exit 1
fi

sudo systemctl reload nginx

echo "[remote] frontend deploy finished"
