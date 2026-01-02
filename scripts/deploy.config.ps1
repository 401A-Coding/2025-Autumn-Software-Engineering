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
# 若数据库运行在 Docker 桥接网络（如 compose 的 postgres 服务），请使用服务名
# 例如：postgresql://postgres:postgres@postgres:5432/mydb?schema=public
# 若使用 --network host 并连接宿主机数据库，则用 127.0.0.1
$DatabaseUrl = "postgresql://postgres:postgres@postgres:5432/mydb?schema=public"
# 使用强随机秘钥；如需替换，可直接修改此值或通过环境变量传入
# 说明：deploy.ps1 会将该值作为容器环境 JWT_SECRET 传入
$JwtSecret = "a5c2f3d8e9b4c7a1f0d2e3b5c6a7d8e9f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

# Optional: 自定义临时目录（本地/远程）
$LocalTemp = "$env:TEMP"
$RemoteTemp = "/tmp"

# SSH/SCP 额外参数（例如 -i 密钥，或 -o StrictHostKeyChecking=no）
$SshExtraArgs = ""
$ScpExtraArgs = ""

# Backend 网络模式：'host' 或 'bridge'
# - host：容器共享宿主网络，DATABASE_URL 通常指 127.0.0.1
# - bridge：容器加入指定 Docker 网络，需发布端口并使用服务名连接数据库
$BackendNetworkMode = "bridge"
# 当 BackendNetworkMode 为 bridge 时生效：指定 Docker 网络名（例如 compose 创建的 appnet）
$BackendDockerNetworkName = "appnet"
