# Deployment configuration for 2025-Autumn-Software-Engineering

# Remote server
$ServerUser = "ubuntu"
$ServerHost = "101.42.118.61"
$SshTarget = "$ServerUser@$ServerHost"

# Frontend
$ViteApiBase = "http://101.42.118.61"   # 用于前端构建时写入 VITE_API_BASE
$RemoteWebRoot = "/var/www/chess"       # Nginx 静态站点路径

# Backend
$BackendImageName = "chess-backend:latest"
$BackendContainer = "chess-backend"
$BackendPort = 3000
$DatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public"
$JwtSecret = "your-strong-secret"

# Optional: 自定义临时目录（本地/远程）
$LocalTemp = "$env:TEMP"
$RemoteTemp = "/tmp"

# SSH/SCP 额外参数（例如 -i 密钥，或 -o StrictHostKeyChecking=no）
$SshExtraArgs = ""
$ScpExtraArgs = ""
