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
        if (Test-Path $localScript) {
            Write-Host "Using existing script: $localScript"
        }
        else {
            $scriptContent = @'
#!/usr/bin/env bash
set -euo pipefail

ts=$(date +%Y%m%d-%H%M%S)
backup="$RemoteTemp/chess-backup-$ts.tar.gz"

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
'@

            Set-Content -Path $localScript -Value $scriptContent -Encoding UTF8
        }

        # upload dist and script
        $scpDist = 'scp ' + $ScpExtraArgs + ' -r "' + $distLocal + '" ' + $SshTarget + ':' + $remoteTmp
        Run $scpDist 'upload dist to server'

        $scpScript = 'scp ' + $ScpExtraArgs + ' "' + $localScript + '" ' + $SshTarget + ':' + $RemoteTemp + '/_remote_deploy_frontend.sh'
        Run $scpScript 'upload remote deploy script'

        # execute remote script by passing required env vars to avoid quoting issues
        # Upload a small wrapper that normalizes CRLF and runs the target script under /bin/bash, then invoke it
        $localWrapper = Join-Path $PSScriptRoot 'remote-run-bash.sh'
        if (-not (Test-Path $localWrapper)) {
            throw "Local wrapper $localWrapper not found; ensure scripts/remote-run-bash.sh exists in the repo"
        }
        $scpWrapper = 'scp ' + $ScpExtraArgs + ' "' + $localWrapper + '" ' + $SshTarget + ':' + $RemoteTemp + '/remote-run-bash.sh'
        Run $scpWrapper 'upload remote-run-bash wrapper'
        $sshCmd = "ssh $SshExtraArgs $SshTarget 'sudo chmod +x $RemoteTemp/remote-run-bash.sh; sudo $RemoteTemp/remote-run-bash.sh $RemoteTemp/_remote_deploy_frontend.sh'"
        Run $sshCmd 'publish to nginx root and reload (via remote-run-bash)'
    }
    finally { Pop-Location }
}

# ---------- Backend ----------
function Invoke-BackendDeploy {
    Write-Section 'Backend: package, remote build & run'
    $beDir = Join-Path $RepoRoot 'backend'

    # 打包源码（排除 node_modules/.git/dist）到本地临时 tgz
    $archive = Join-Path $LocalTemp ("backend-src-" + [Guid]::NewGuid().ToString() + ".tar.gz")

    # 如果仓库根目录存在 docs/openapi.yaml，临时拷贝到 backend/docs/openapi.yaml
    $openapiSrc = Join-Path $RepoRoot 'docs\openapi.yaml'
    $copiedOpenapi = $false
    if (Test-Path $openapiSrc) {
        $destDocs = Join-Path $beDir 'docs'
        if (-not (Test-Path $destDocs)) { New-Item -ItemType Directory -Path $destDocs | Out-Null }
        Copy-Item -Path $openapiSrc -Destination (Join-Path $destDocs 'openapi.yaml') -Force
        $copiedOpenapi = $true
    }

    $tarCmd = "tar -czf `"$archive`" --exclude=node_modules --exclude=.git --exclude=dist -C `"$beDir`" ."
    Run $tarCmd "archive backend to $archive"

    # 上传到远程
    $remoteTgz = $RemoteTemp + '/' + (Split-Path -Leaf $archive)
    $scpCmd = 'scp ' + $ScpExtraArgs + ' "' + $archive + '" ' + $SshTarget + ':"' + $remoteTgz + '"'
    Run $scpCmd 'upload backend archive'

    # 远端解压、docker build、替换容器并启动
    $remoteWork = $RemoteTemp + '/chess-backend-src'

    $localScript = Join-Path $PSScriptRoot '_remote_deploy_backend.sh'
    if (Test-Path $localScript) {
        Write-Host "Using existing script: $localScript"
    }
    else {
        $scriptContent = @'
#!/usr/bin/env bash
set -euo pipefail

REMOTE_WORK=$remoteWork
ZIP_PATH=$remoteTgz
BACKEND_IMAGE=$BackendImageName
BACKEND_CONTAINER=$BackendContainer
DATABASE_URL="$DatabaseUrl"
JWT_SECRET="$JwtSecret"
NETWORK_MODE="${NETWORK_MODE:-host}"
NETWORK_NAME="${NETWORK_NAME:-}"

rm -rf "$REMOTE_WORK" && mkdir -p "$REMOTE_WORK"
tar -xzf "$ZIP_PATH" -C "$REMOTE_WORK"
cd "$REMOTE_WORK"
docker build -t "$BACKEND_IMAGE" .
old_image=$(docker inspect -f '{{.Image}}' "$BACKEND_CONTAINER" 2>/dev/null || true)
docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
RUN_NET_ARGS="--network host"
RUN_PORT_ARGS=""
if [ "$NETWORK_MODE" = "bridge" ]; then
    if [ -n "$NETWORK_NAME" ]; then
        RUN_NET_ARGS="--network $NETWORK_NAME"
    else
        RUN_NET_ARGS="--network bridge"
    fi
    # Publish backend HTTP port when using bridge mode
    RUN_PORT_ARGS="-p 3000:3000"
fi
docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped $RUN_NET_ARGS $RUN_PORT_ARGS \
        -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$BACKEND_IMAGE"
sleep 2
if [ -z "$(docker ps --filter name=$BACKEND_CONTAINER --filter status=running -q)" ]; then
    echo 'New backend container not running, rolling back...' >&2
    if [ -n "$old_image" ]; then
        docker rm -f "$BACKEND_CONTAINER" 2>/dev/null || true
                docker run -d --name "$BACKEND_CONTAINER" --restart unless-stopped $RUN_NET_ARGS $RUN_PORT_ARGS -e DATABASE_URL="$DATABASE_URL" -e JWT_SECRET="$JWT_SECRET" "$old_image"
    fi
    exit 1
fi
'@

        Set-Content -Path $localScript -Value $scriptContent -Encoding UTF8
    }

    # upload archive and script
    $scpCmd = 'scp ' + $ScpExtraArgs + ' "' + $archive + '" ' + $SshTarget + ':' + $remoteTgz
    Run $scpCmd 'upload backend archive'

    $scpScript = 'scp ' + $ScpExtraArgs + ' "' + $localScript + '" ' + $SshTarget + ':' + $RemoteTemp + '/_remote_deploy_backend.sh'
    Run $scpScript 'upload remote backend deploy script'

    # If local docs/openapi.yaml exists, upload it separately so remote script can inject it into build context
    $openapiLocal = Join-Path $RepoRoot 'docs\openapi.yaml'
    if (Test-Path $openapiLocal) {
        $scpOpenapi = 'scp ' + $ScpExtraArgs + ' "' + $openapiLocal + '" ' + $SshTarget + ':/tmp/backend-openapi.yaml'
        Run $scpOpenapi 'upload openapi.yaml to remote /tmp'
    }

    # cleanup temporary openapi copy if created
    if ($copiedOpenapi) {
        try {
            $tmpOpenapi = Join-Path (Join-Path $beDir 'docs') 'openapi.yaml'
            if (Test-Path $tmpOpenapi) { Remove-Item -Path $tmpOpenapi -Force }
            # remove docs folder if empty
            $docsDir = Join-Path $beDir 'docs'
            if ((Get-ChildItem -Path $docsDir -Force -ErrorAction SilentlyContinue) -eq $null) { Remove-Item -Path $docsDir -Force -Recurse -ErrorAction SilentlyContinue }
        }
        catch {
            Write-Host "Warning: failed to cleanup temporary openapi copy: $_" -ForegroundColor Yellow
        }
    }

    # escape possible double-quotes in sensitive vars before embedding (preserve quotes for remote env)
    $escapedDb = $DatabaseUrl -replace '"', '\"'
    $escapedJwt = $JwtSecret -replace '"', '\"'
    $envPart = 'DATABASE_URL="' + $escapedDb + '" JWT_SECRET="' + $escapedJwt + '" REMOTE_TMP=' + $RemoteTemp + ' REMOTE_WORK=' + $remoteWork
    $remoteScriptPath = $RemoteTemp + '/_remote_deploy_backend.sh'
    # run the remote backend deploy script as root so it can write to /tmp and manage containers
    # Upload wrapper and invoke it to normalize and run the remote backend deploy script
    $localWrapper = Join-Path $PSScriptRoot 'remote-run-bash.sh'
    if (-not (Test-Path $localWrapper)) {
        throw "Local wrapper $localWrapper not found; ensure scripts/remote-run-bash.sh exists in the repo"
    }
    $scpWrapper = 'scp ' + $ScpExtraArgs + ' "' + $localWrapper + '" ' + $SshTarget + ':' + $RemoteTemp + '/remote-run-bash.sh'
    Run $scpWrapper 'upload remote-run-bash wrapper'
    # Pass the actual uploaded archive and envs to the remote wrapper so it uses the correct ZIP_PATH
    $execEnv = 'ZIP_PATH="' + $remoteTgz + '" '
    $execEnv += 'REMOTE_WORK="' + $remoteWork + '" '
    $execEnv += 'BACKEND_IMAGE="' + $BackendImageName + '" '
    $execEnv += 'BACKEND_CONTAINER="' + $BackendContainer + '" '
    $execEnv += 'DATABASE_URL="' + $escapedDb + '" '
    $execEnv += 'JWT_SECRET="' + $escapedJwt + '" '
    $execEnv += 'NETWORK_MODE="' + $BackendNetworkMode + '" '
    if ($BackendNetworkMode -eq 'bridge') {
        $execEnv += 'NETWORK_NAME="' + $BackendDockerNetworkName + '" '
    }

    $sshCmd = "ssh $SshExtraArgs $SshTarget 'sudo chmod +x $RemoteTemp/remote-run-bash.sh; sudo $execEnv $RemoteTemp/remote-run-bash.sh $remoteScriptPath'"
    Run $sshCmd 'remote build image and restart container (via remote-run-bash)'
}

switch ($Target) {
    'frontend' { Invoke-FrontendDeploy }
    'backend' { Invoke-BackendDeploy }
    'all' { Invoke-FrontendDeploy; Invoke-BackendDeploy }
}

Write-Host "`nDone." -ForegroundColor Green
