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

# Generate API types once from OpenAPI
Write-Host "[start-frontend] Generating OpenAPI types..."
npm run gen:api-types

# Start OpenAPI types watch in background (keeps api.d.ts up-to-date)
try {
    $frontendPath = Get-Location
    Write-Host "[start-frontend] Starting OpenAPI types watch in background..."
    Start-Job -ScriptBlock { Set-Location -Path $using:frontendPath; npm run gen:api-types:watch } | Out-Null
}
catch {
    Write-Warning "[start-frontend] Failed to start types watch job: $($_.Exception.Message)"
}

Write-Host "[start-frontend] Starting Vite dev server..."
npm run dev
