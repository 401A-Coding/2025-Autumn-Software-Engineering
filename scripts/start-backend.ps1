param(
    [switch]$ResetDb
)

# Move to backend directory
Set-Location -Path "$PSScriptRoot\..\backend"

Write-Host "[start-backend] Node version:" -NoNewline; node -v

# Read prisma/.env if present and export DATABASE_URL, JWT_SECRET
$prismaEnvPath = Join-Path (Get-Location) "prisma\.env"
if (Test-Path $prismaEnvPath) {
    Get-Content $prismaEnvPath | ForEach-Object {
        if ($_ -match '^(?<k>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<v>.*)$') {
            $k = $Matches['k']
            # 去掉包裹引号与首尾空白，避免诸如 schema=public" 的尾随引号污染
            $v = $Matches['v'].Trim().Trim('"')
            if ($k -eq 'DATABASE_URL') { $env:DATABASE_URL = $v }
            if ($k -eq 'JWT_SECRET') { $env:JWT_SECRET = $v }
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Warning "DATABASE_URL not set. Set it in backend/prisma/.env or this session."
}

# Install deps if node_modules not found
if (-not (Test-Path "node_modules")) {
    Write-Host "[start-backend] Installing dependencies..."
    npm install
}

# Generate Prisma Client
Write-Host "[start-backend] Generating Prisma Client..."
npm run prisma:generate

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Optional reset
if ($ResetDb) {
    Write-Warning "[start-backend] Resetting database (ALL DATA WILL BE LOST)..."
    npm run prisma:reset
}

# Migrate database
Write-Host "[start-backend] Applying migrations..."
npm run prisma:migrate

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Start backend in watch mode
Write-Host "[start-backend] Starting NestJS (watch)..."
npm run start:dev
