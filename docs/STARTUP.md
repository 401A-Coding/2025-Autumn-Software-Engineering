# 启动说明（本地开发）

本文档介绍如何在本地启动 Postgres、后端（NestJS）、前端（Vite）。已针对 Windows + PowerShell 做了脚本。

## 先决条件

- Node.js 20 LTS（推荐 20.18.x）
- npm 10+
- Docker（可选，用于本地启动 Postgres）

## 一键启动数据库（可选）

如果你本地还没有 Postgres，可用仓库里的 docker-compose 快速起一个：

```powershell
cd infra/docker
# 后台运行 Postgres（端口 5432，用户/密码 postgres，数据库 mydb）
docker compose up -d
```

数据库连接串与后端默认一致：

```text
postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public
```

## 启动后端（NestJS）

后端的环境变量放在 `backend/prisma/.env`，已提供示例：

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public"
JWT_SECRET="your-strong-secret"
```

推荐使用仓库内脚本一键启动：

```powershell
# 正常启动（不清库）
./scripts/start-backend.ps1

# 如需重置开发库（会清空数据）
./scripts/start-backend.ps1 -ResetDb
```

脚本会完成：

- 安装依赖（如缺失）
- 读取 backend/prisma/.env 并导出环境变量
- 生成 Prisma Client
- 应用数据库迁移
- 以 watch 模式启动 NestJS（默认端口 3000）

如需手动执行：

```powershell
cd backend
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public"
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

备注：本项目已在 `src/main.ts` 启用 CORS，允许来自 Vite 开发服务器（5173）的跨域请求。

## 启动前端（Vite + React）

推荐使用脚本一键启动：

```powershell
./scripts/start-frontend.ps1
```

脚本会：

- 安装依赖（如缺失）
- 在 `frontend/.env` 写入 `VITE_API_BASE=http://localhost:3000`（如不存在 .env）
- 启动 Vite 开发服务器（默认端口 5173）

手动方式：

```powershell
cd frontend
npm install
# 确保 .env 里存在：VITE_API_BASE=http://localhost:3000
npm run dev
```

## 一键全栈开发（数据库 + 后端 + 前端）

使用脚本一次性拉起 Postgres、后端与前端：

```powershell
./scripts/start-all.ps1
```

参数：

-ResetDb  可选，先重置开发库（会清空数据）后再启动。

说明：

- 若本机已安装并运行了 Postgres，脚本中的 docker compose 步骤会被忽略（不会影响）。
- 脚本会打开两个新的 PowerShell 窗口分别启动后端与前端，便于查看日志。

### macOS 下的一键脚本

首次赋权（使脚本可执行）：

```bash
chmod +x scripts/*.sh
```

一键全栈启动（可选 --reset-db 或 -r 重置开发库）：

```bash
./scripts/start-all-macos.sh        # 正常
./scripts/start-all-macos.sh -r     # 重置开发库后启动
```

单独启动后端/前端：

```bash
./scripts/start-backend-macos.sh        # 后端
./scripts/start-backend-macos.sh -r     # 重置开发库后启动后端
./scripts/start-frontend-macos.sh       # 前端
```

## 前后端接口契约（当前版本）

- 注册：POST `${VITE_API_BASE}/user/register`
  - 请求体：`{ phone: string, password: string, email?: string }`
  - 返回：`{ accessToken: string, refreshToken: string }`
- 登录：POST `${VITE_API_BASE}/user/login`
  - 请求体：`{ phone: string, password: string }`
  - 返回：`{ accessToken: string, refreshToken: string }`

前端会将 `accessToken` 存入 `localStorage.token`。

## 接口文档（Swagger）

- 浏览器打开：Swagger UI 文档 `http://localhost:3000/docs`，原始规范 `http://localhost:3000/api-json`
- 更新方式：编辑并保存 `docs/openapi.yaml`，重启后端即可在 `/docs` 看到最新接口

## 从 OpenAPI 生成前端 TypeScript 类型

前端已内置从 `docs/openapi.yaml` 生成类型声明（`.d.ts`）的脚本，便于在调用接口时获得静态类型提示。

- 生成命令（在 `frontend/` 目录执行）：

```powershell
cd frontend
npm run gen:api-types
```

- 生成结果：`frontend/src/types/api.d.ts`
- 何时需要重新生成：当 `docs/openapi.yaml` 发生变更（例如新增/修改接口、模型）后。
- 监听模式（开发期推荐）：

```powershell
cd frontend
npm run gen:api-types:watch
```

- 可选：一次性试用 `--watch`（无需脚本）

```powershell
cd frontend
npx openapi-typescript ../docs/openapi.yaml --output src/types/api.d.ts --watch
```

简单用法示例：

```ts
// 示例：引用 OpenAPI 组件类型
import type { components, paths } from '@/types/api';

type AuthTokens = components['schemas']['AuthTokens'];
type LoginOk = paths['/api/v1/auth/login']['post']['responses']['200']['content']['application/json'];
```

## 常见问题（FAQ）

- 报错：`Cannot find module '#main-entry-point'`
  - 这是 Prisma Client 在某些环境下对 package.json imports 解析不生效导致。解决：
    1) 切换 Node 到 20 LTS；
    2) 删除 `backend/node_modules` 并 `npm install`；
    3) 重新生成 Prisma Client：`npx prisma generate`；
    4) 重新启动：`npm run start:dev`。

- 报错：数据库漂移（Drift detected）
  - 开发环境建议直接清库：`npx prisma migrate reset --force`，然后 `npx prisma migrate dev --name init`。

- 前端调用 3000 端口被浏览器拦截
  - 已在后端开启 CORS；确保前端 `.env` 里的 `VITE_API_BASE` 指向 `http://localhost:3000`。

---

祝开发顺利。如需补充一键脚本（例如一键启动全栈、数据种子脚本），可以在 `scripts/` 目录继续扩展。
