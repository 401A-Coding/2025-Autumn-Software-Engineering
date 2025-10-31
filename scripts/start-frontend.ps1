# Move to frontend directory
Set-Location -Path "$PSScriptRoot\..\frontend"

# Ensure deps
if (-not (Test-Path "node_modules")) {
    Write-Host "[start-frontend] Installing dependencies..."
    npm install
}

# Ensure VITE_API_BASE is set; if .env not found, create with default
$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) {
    "VITE_API_BASE=http://localhost:3000" | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "[start-frontend] Created .env with default VITE_API_BASE=http://localhost:3000"
}

Write-Host "[start-frontend] Starting Vite dev server..."
npm run dev
