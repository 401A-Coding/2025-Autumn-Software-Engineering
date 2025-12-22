#!/usr/bin/env bash
set -euo pipefail

# Simple script to generate/sync Capacitor Android project
# Run from repo root: ./scripts/generate-android.sh
FRONTEND_DIR="$(dirname "$0")/../frontend"
cd "$FRONTEND_DIR"

echo "Installing dependencies..."
npm ci

echo "Building frontend..."
npm run build

echo "Adding Android platform if missing..."
# npx cap add android exits non-zero if already exists; ignore failures
npx cap add android || true

echo "Copying web assets and syncing..."
npx cap copy android
npx cap sync android

echo "Done. Open Android Studio with: npx cap open android"