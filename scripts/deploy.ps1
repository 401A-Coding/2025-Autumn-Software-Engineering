param(
    [ValidateSet('frontend', 'backend', 'all')]
    [string]$Target = 'all',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

# Load config
$ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
. $ConfigPath

function Write-Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Run($cmd, $desc) {
    Write-Host "`n> $desc" -ForegroundColor Yellow
    Write-Host "$cmd" -ForegroundColor DarkGray
    powershell -NoProfile -Command $cmd
}

# Resolve repo root
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

# ---------- Frontend ----------
function Invoke-FrontendDeploy {
    Write-Section 'Frontend: build & upload'
    $feDir = Join-Path $RepoRoot 'frontend'
    Push-Location $feDir
    try {
        if (-not (Test-Path '.env')) {
            "VITE_API_BASE=$ViteApiBase" | Out-File -Encoding utf8 -NoNewline '.env'
            Write-Host "Wrote frontend/.env with VITE_API_BASE=$ViteApiBase"
        }
        if (-not $SkipInstall) {
            if (Test-Path 'package-lock.json') { Run 'npm ci --no-audit --no-fund' 'npm ci' }
            else { Run 'npm install --no-audit --no-fund' 'npm install' }
        }
        Run 'npm run build' 'vite build'

        $distLocal = Join-Path $feDir 'dist'
        if (-not (Test-Path $distLocal)) { throw 'frontend/dist not found after build' }

        $remoteTmp = $RemoteTemp + '/chess-dist'

        # write remote script locally to avoid complex quoting/escaping
        $localScript = Join-Path $PSScriptRoot '_remote_deploy_frontend.sh'
        $scriptContent = @"
    #!/usr/bin/env bash
    set -euo pipefail

    ts=$(date +%Y%m%d-%H%M%S)
    backup=\"$RemoteTemp/chess-backup-$ts.tar.gz\"

    sudo mkdir -p $RemoteWebRoot
    sudo tar -czf "$backup" -C "$RemoteWebRoot" . 2>/dev/null || true
    sudo rm -rf $RemoteWebRoot/*
    sudo mkdir -p $RemoteWebRoot
    sudo cp -r $remoteTmp/dist/* $RemoteWebRoot/
    sudo chown -R www-data:www-data $RemoteWebRoot
    if ! sudo nginx -t; then
      echo 'nginx -t failed, restoring backup' >&2
      sudo rm -rf $RemoteWebRoot/*
      sudo mkdir -p $RemoteWebRoot
      sudo tar -xzf "$backup" -C $RemoteWebRoot 2>/dev/null || true
      exit 1
    fi
    sudo systemctl reload nginx
    "@

        Set-Content -Path $localScript -Value $scriptContent -Encoding UTF8

        # upload dist and script
        $scpDist = 'scp ' + $ScpExtraArgs + ' -r "' + $distLocal + '" ' + $SshTarget + ':' + $remoteTmp
        Run $scpDist 'upload dist to server'

        $scpScript = 'scp ' + $ScpExtraArgs + ' "' + $localScript + '" ' + $SshTarget + ':' + $RemoteTemp + '/_remote_deploy_frontend.sh'
        Run $scpScript 'upload remote deploy script'

        # execute remote script (no inline remote variable expansion needed)
        $sshRun = 'ssh ' + $SshExtraArgs + ' ' + $SshTarget + ' bash ' + $RemoteTemp + '/_remote_deploy_frontend.sh'
        Run $sshRun 'publish to nginx root and reload'
    }
    finally { Pop-Location }
}

# ---------- Backend ----------
function Invoke-BackendDeploy {
    Write-Section 'Backend: package, remote build & run'
    $beDir = Join-Path $RepoRoot 'backend'

    # 打包源码（排除 node_modules/.git/dist）到本地临时 tgz
    $archive = Join-Path $LocalTemp ("backend-src-" + [Guid]::NewGuid().ToString() + ".tar.gz")
    $tarCmd = "tar -czf `"$archive`" --exclude=node_modules --exclude=.git --exclude=dist -C `"$beDir`" ."
    Run $tarCmd "archive backend to $archive"

    # 上传到远程
    $remoteTgz = $RemoteTemp + '/' + (Split-Path -Leaf $archive)
    $scpCmd = 'scp ' + $ScpExtraArgs + ' "' + $archive + '" ' + $SshTarget + ':"' + $remoteTgz + '"'
    Run $scpCmd 'upload backend archive'

        # 远端解压、docker build、替换容器并启动
        $remoteWork = $RemoteTemp + '/chess-backend-src'

        $localScript = Join-Path $PSScriptRoot '_remote_deploy_backend.sh'
        $scriptContent = @"
#!/usr/bin/env bash
set -euo pipefail

REMOTE_WORK=$remoteWork
ZIP_PATH=$remoteTgz
BACKEND_IMAGE=$BackendImageName
BACKEND_CONTAINER=$BackendContainer
DATABASE_URL="$DatabaseUrl"
JWT_SECRET="$JwtSecret"

rm -rf "$REMOTE_WORK" && mkdir -p "$REMOTE_WORK"
tar -xzf "$ZIP_PATH" -C "$REMOTE_WORK"
cd "$REMOTE_WORK"
docker build -t "$BACKEND_IMAGE" .
old_image=$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)
docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host \
    -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$BACKEND_IMAGE"
sleep 2
if [ -z "$(docker ps --filter name=$BACKEND_CONTAINER --filter status=running -q)" ]; then
    echo 'New backend container not running, rolling back...' >&2
    if [ -n "$old_image" ]; then
        docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
        docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped --network host -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    fi
    exit 1
fi
"@

        Set-Content -Path $localScript -Value $scriptContent -Encoding UTF8

        # upload archive and script
        $scpCmd = 'scp ' + $ScpExtraArgs + ' "' + $archive + '" ' + $SshTarget + ':' + $remoteTgz
        Run $scpCmd 'upload backend archive'

        $scpScript = 'scp ' + $ScpExtraArgs + ' "' + $localScript + '" ' + $SshTarget + ':' + $RemoteTemp + '/_remote_deploy_backend.sh'
        Run $scpScript 'upload remote backend deploy script'

        $sshCmd = 'ssh ' + $SshExtraArgs + ' ' + $SshTarget + ' bash ' + $RemoteTemp + '/_remote_deploy_backend.sh'
        Run $sshCmd 'remote build image and restart container'
    }

    switch ($Target) {
        'frontend' { Invoke-FrontendDeploy }
        'backend' { Invoke-BackendDeploy }
        'all' { Invoke-FrontendDeploy; Invoke-BackendDeploy }
    }

    Write-Host "`nDone." -ForegroundColor Green
