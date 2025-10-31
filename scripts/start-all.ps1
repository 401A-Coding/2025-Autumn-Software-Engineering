param(
    [switch]$ResetDb
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host "[start-all] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Warning "[start-all] $msg" }
function Write-Err($msg)  { Write-Host "[start-all] ERROR: $msg" -ForegroundColor Red }

# Repo root
$repoRoot = Resolve-Path "$PSScriptRoot\.."
Write-Info "Repo root: $repoRoot"

# 1) Try to start Postgres via Docker Compose (optional)
$composeDir = Join-Path $repoRoot "infra\docker"
$composeFile = Join-Path $composeDir "docker-compose.yml"
$docker = Get-Command docker -ErrorAction SilentlyContinue

if (Test-Path $composeFile -PathType Leaf -and $docker) {
    Write-Info "Starting Postgres via docker compose..."
    Push-Location $composeDir
    try {
        docker compose up -d | Out-Null
    } catch {
        Write-Warn "Failed to run 'docker compose up -d': $($_.Exception.Message)"
    } finally { Pop-Location }
} else {
    if (-not (Test-Path $composeFile)) { Write-Warn "docker-compose.yml not found. Skipping DB container." }
    if (-not $docker) { Write-Warn "Docker CLI not found. Skipping DB container." }
}

# 2) Wait for Postgres on 127.0.0.1:5432 (best effort 60s)
function Wait-Port([string]$host, [int]$port, [int]$timeoutSec = 60) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        $ok = $false
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $iar = $tcp.BeginConnect($host, $port, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne(1000) -and $tcp.Connected
            $tcp.Close()
        } catch { }
        if ($ok) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

if (Wait-Port -host '127.0.0.1' -port 5432 -timeoutSec 60) {
    Write-Info "Postgres is reachable on 127.0.0.1:5432"
} else {
    Write-Warn "Postgres not reachable on 127.0.0.1:5432 after waiting. Proceeding anyway."
}

# 3) Start backend (new PowerShell window)
$backendScript = Join-Path $repoRoot "scripts\start-backend.ps1"
if (Test-Path $backendScript) {
    $backendArgs = @('-NoExit','-ExecutionPolicy','Bypass','-File',"$backendScript")
    if ($ResetDb) { $backendArgs += '-ResetDb' }
    Write-Info "Launching backend window..."
    Start-Process -FilePath "powershell.exe" -ArgumentList $backendArgs | Out-Null
} else {
    Write-Err "Backend script not found at $backendScript"
}

# 4) Start frontend (new PowerShell window)
$frontendScript = Join-Path $repoRoot "scripts\start-frontend.ps1"
if (Test-Path $frontendScript) {
    $frontendArgs = @('-NoExit','-ExecutionPolicy','Bypass','-File',"$frontendScript")
    Write-Info "Launching frontend window..."
    Start-Process -FilePath "powershell.exe" -ArgumentList $frontendArgs | Out-Null
} else {
    Write-Err "Frontend script not found at $frontendScript"
}

Write-Host ""; Write-Info "All launched. Open your browser:" -NoNewline
Write-Host "
  Backend:   http://localhost:3000
  Frontend:  http://localhost:5173
"