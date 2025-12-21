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
        $scpCmd = 'scp ' + $ScpExtraArgs + ' -r "' + $distLocal + '" ' + $SshTarget + ':"' + $remoteTmp + '"'
        Run $scpCmd 'upload dist to server'

        $remoteCmd = @(
            'set -e',
            'ts=$(date +%Y%m%d-%H%M%S)',
            'backup="' + $RemoteTemp + '/chess-backup-$ts.tar.gz"',
            # 备份当前线上静态资源（若为空则忽略失败）
            'sudo mkdir -p ' + $RemoteWebRoot,
            'sudo tar -czf "$backup" -C "' + $RemoteWebRoot + '" . 2>/dev/null || true',
            # 覆盖部署
            'sudo rm -rf ' + $RemoteWebRoot + '/*',
            'sudo mkdir -p ' + $RemoteWebRoot,
            'sudo cp -r ' + $remoteTmp + '/dist/* ' + $RemoteWebRoot + '/',
            'sudo chown -R www-data:www-data ' + $RemoteWebRoot,
            # Nginx 配置校验失败则回滚
            'if ! sudo nginx -t; then echo ''nginx -t failed, restoring backup'' >&2; sudo rm -rf ' + $RemoteWebRoot + '/*; sudo mkdir -p ' + $RemoteWebRoot + '; sudo tar -xzf "$backup" -C ' + $RemoteWebRoot + ' 2>/dev/null || true; exit 1; fi',
            # 通过后 reload
            'sudo systemctl reload nginx'
        ) -join '; '
        $sshCmd = 'ssh ' + $SshExtraArgs + ' ' + $SshTarget + ' "' + $remoteCmd + '"'
        Run $sshCmd 'publish to nginx root and reload'
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
    $remoteCmds = @(
        'set -e',
        'rm -rf ' + $remoteWork + ' && mkdir -p ' + $remoteWork,
        'tar -xzf ' + $remoteTgz + ' -C ' + $remoteWork,
        'cd ' + $remoteWork,
        'docker build -t ' + $BackendImageName + ' .',
        # 记录旧镜像ID（若容器存在）
        'old_image=$(docker inspect -f ''{{.Image}}'' ' + $BackendContainer + ' 2>/dev/null || true)',
        # 替换容器
        'docker rm -f ' + $BackendContainer + ' 2>/dev/null || true',
        (@(
            'docker run -d --name ' + $BackendContainer + ' --restart unless-stopped --network host',
            '-e DATABASE_URL=''' + $DatabaseUrl + '''',
            '-e JWT_SECRET=''' + $JwtSecret + '''',
            $BackendImageName
        ) -join ' '),
        # 健康性粗检：是否处于 running 状态，否则回滚旧镜像（若存在）
        'sleep 2',
        'if [ -z "$(docker ps --filter name=' + $BackendContainer + ' --filter status=running -q)" ]; then echo ''New backend container not running, rolling back...'' >&2; if [ -n "' + '$old_image' + '" ]; then docker rm -f ' + $BackendContainer + ' 2>/dev/null || true; docker run -d --name ' + $BackendContainer + ' --restart unless-stopped --network host -e DATABASE_URL=''' + $DatabaseUrl + ''' -e JWT_SECRET=''' + $JwtSecret + ''' "' + '$old_image' + '"; fi; exit 1; fi'
    ) -join '; '
    $sshCmd = 'ssh ' + $SshExtraArgs + ' ' + $SshTarget + ' "' + $remoteCmds + '"'
    Run $sshCmd 'remote build image and restart container'
}

switch ($Target) {
    'frontend' { Invoke-FrontendDeploy }
    'backend' { Invoke-BackendDeploy }
    'all' { Invoke-FrontendDeploy; Invoke-BackendDeploy }
}

Write-Host "`nDone." -ForegroundColor Green
