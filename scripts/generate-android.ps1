Param()

# Simple PowerShell script to generate/sync Capacitor Android project
# Usage: run from repo root or call from frontend with ../scripts/generate-android.ps1

Set-StrictMode -Version Latest

$frontendDir = Join-Path $PSScriptRoot "..\frontend"
Push-Location $frontendDir

Write-Host "Installing dependencies..."
npm ci

Write-Host "Building frontend..."
npm run build

Write-Host "Adding Android platform if missing..."
# npx cap add android may fail if already exists; handle in PowerShell
try {
	npx cap add android -s
} catch {
	Write-Host "android platform may already exist or command failed with non-zero exit"
}

Write-Host "Copying web assets and syncing..."
npx cap copy android
npx cap sync android

Pop-Location
Write-Host "Done. Open Android Studio with: npx cap open android"