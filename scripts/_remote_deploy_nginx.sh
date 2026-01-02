#!/usr/bin/env bash
set -euo pipefail

TMP_CONF="$RemoteTemp/chess.conf"
TARGET_CONF="/etc/nginx/conf.d/chess.conf"

sudo cp "$TMP_CONF" "$TARGET_CONF"
if ! sudo nginx -t; then
    echo 'nginx -t failed after updating config' >&2
    exit 1
fi
sudo systemctl reload nginx
