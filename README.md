# 2025-Autumn-Software-Engineering

2025秋软件学院软件工程课程401A小组项目

## 一、技术栈

### 前端

使用 React 框架开发网页端，再通过 React Native 打包为移动端应用，教程参考 [React 官方中文文档](https://react.docschina.org/) 和 [React Native 中文网 · 使用React来编写原生应用的框架](https://reactnative.cn/)。

### 后端

使用 NestJS 框架，教程参考 [NestJS 中文文档](https://docs.nestjs.cn/)。

### 数据库

使用 PostgreSQL（本地可通过 Docker Compose 快速启动，端口 5432，用户/密码 `postgres/postgres`，数据库 `mydb`）。示例连接串：

```text
postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public
```

### 部署

使用 docker。

### 设计工具

- 使用 **pixso** 进行 UI 设计，官网网址：[Pixso官网 - 新一代UI设计工具，替代Sketch，Figma，支持在线实时协作](https://pixso.cn/)。设计图转代码功能可以参考 [【不会写代码也能做网页？Pixso AI 5 分钟搞定！| AI 设计指南】](https://www.bilibili.com/video/BV1QEsuztEzP/?share_source=copy_web&vd_source=44759ea33f56b7a9846e4290e821662c)。

- 也可能会使用一些 antd 组件，可以参考 [Ant Design - 一套企业级 UI 设计语言和 React 组件库](https://ant.design/index-cn)。相关组件见 [组件总览 - Ant Design](https://ant.design/components/overview-cn/)。

## 二、环境配置

环境要求参考 [搭建开发环境 · React Native 中文网](https://reactnative.cn/docs/environment-setup) 和 [介绍 - NestJS 中文文档](https://docs.nestjs.cn/introduction)。

具体来说，对于前端开发，必须安装的依赖有：Node、JDK 和 Android Studio。

- Node 的版本应**大于等于 18**。
- 对于 JDK 版本，React Native 需要 **Java Development Kit [JDK] 17**。
- 编译 React Native 应用需要的是 **Android 15 (VanillaIceCream)** 版本的 SDK。

具体步骤较为繁琐，请严格参照 [搭建开发环境 · React Native 中文网](https://reactnative.cn/docs/environment-setup) 进行。

对于后端开发，在开始之前，请确保您的开发环境满足以下要求：

- Node.js：**版本 ≥20（推荐使用最新 LTS 版本）**
- 包管理器：npm（Node.js 自带）、yarn 或 pnpm

以上两份教程中的命令使用的包管理器分别为 `yarn` 和 `npm`，注意可以用 `yarn` 代替 `npm`，例如用 `yarn` 代替 `npm install` 命令，用 `yarn add 某第三方库名` 代替 `npm install 某第三方库名`。

数据库可以安装到本地，可以参考 [MySQL 安装 | 菜鸟教程](https://www.runoob.com/mysql/mysql-install.html)；也可以像上次大作业一样，不在本地安装只在 Docker 部署时直接使用镜像。

## 开发者须知

- 本项目数据库统一为 PostgreSQL（非 MySQL）。如需本地快速启动数据库，见 `infra/docker/docker-compose.yml` 或按 `docs/STARTUP.md` 操作（执行 `docker compose up -d`）。
- 后端环境变量放在 `backend/prisma/.env`：`DATABASE_URL`、`JWT_SECRET`。推荐使用脚本：
  - 全栈启动：`./scripts/start-all.ps1`（可加 `-ResetDb` 清空开发库）
  - 仅后端：`./scripts/start-backend.ps1`
  - 仅前端：`./scripts/start-frontend.ps1`
- 前端通过 `VITE_API_BASE` 调用后端（默认 `http://localhost:3000`）；登录后 `accessToken` 存入 `localStorage.token`，路由守卫见 `frontend/src/routes/ProtectedRoute.tsx`。
- CORS 已在 `backend/src/main.ts` 放开本地 Vite 开发域（5173）。
- 若遇到与 MySQL 相关的旧描述，请以本说明和 `docs/STARTUP.md` 为准（现已统一为 Postgres）。

## 三、项目架构

### 项目总体目录结构

```txt
quwan-chess/
├── frontend/                # 前端（React + TypeScript + Vite）
├── backend/                 # 后端（NestJS + Prisma + Redis）
├── ai-service/              # AI 教学与棋局分析子服务（FastAPI）
├── infra/                   # 基础设施层（Docker、Nginx、CI/CD）
├── docs/                    # 需求、设计、接口、部署文档
├── scripts/                 # 自动化脚本
└── README.md
```

---

**以下部分由 AI 生成，随项目推进随时更改。**

---

### 前端目录结构（frontend/）

```txt
frontend/
├── public/                  # 公共静态资源（favicon、manifest、logo等）
├── src/
│   ├── assets/              # 图片、图标、字体等静态资源
│   ├── components/          # 通用组件库（按钮、弹窗、棋盘UI等）
│   ├── hooks/               # 自定义Hooks（useAuth、useSocket等）
│   ├── pages/               # 页面级组件（Home、Play、Replay、Profile等）
│   ├── routes/              # 路由配置（React Router）
│   ├── store/               # 状态管理（Zustand / Redux Toolkit）
│   ├── services/            # 前端API接口封装（Axios + React Query）
│   ├── utils/               # 工具函数（格式化、节流、防抖等）
│   ├── types/               # TypeScript类型定义（API响应、棋局模型）
│   ├── theme/               # Tailwind / Ant Design 定制样式
│   ├── App.tsx              # 根组件
│   └── main.tsx             # 入口文件（Vite启动点）
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

**✅ 说明：**

- `store/` 管理玩家状态、棋局状态、WebSocket 实时同步；
- `services/` 统一封装 REST 与 GraphQL 请求；
- `hooks/` 实现与后端的实时通信逻辑；
- `theme/` 控制全局 UI 风格；
- `pages/Replay` 配合 `Immer` 实现棋局“时间旅行复盘”功能。

---

### 后端目录结构（backend/）

```txt
backend/
├── src/
│   ├── main.ts                      # 程序入口（NestFactory）
│   ├── app.module.ts                # 根模块
│   ├── common/                      # 公共模块（拦截器、管道、过滤器、装饰器）
│   ├── config/                      # 环境变量与配置模块（dotenv + ConfigModule）
│   ├── modules/
│   │   ├── user/                    # 用户模块（注册、登录、认证）
│   │   ├── game/                    # 对局模块（走棋、状态、回放）
│   │   ├── chat/                    # 聊天与观战频道（Socket.IO Gateway）
│   │   ├── match/                   # 匹配与大厅逻辑
│   │   ├── ai/                      # 调用 FastAPI 分析接口
│   │   ├── upload/                  # 文件上传（Cloud OSS）
│   │   └── rank/                    # 排行榜与战绩系统
│   ├── prisma/                      # Prisma ORM 配置与迁移
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── websocket/                   # WebSocket Gateway 实现
│   ├── guards/                      # 权限与JWT验证守卫
│   ├── filters/                     # 全局异常捕获
│   ├── logger/                      # Winston日志封装
│   └── main.gateway.ts              # Socket.IO 主网关
├── test/                            # Jest单元测试
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

**✅ 说明：**

- 每个功能模块独立成文件夹（符合 NestJS 模块化架构）；
- `game/` 与 `chat/` 模块通过 Gateway 实现实时通信；
- `ai/` 模块调用 Python FastAPI；
- `upload/` 模块负责文件上传至 Cloud OSS；
- `logger/` 集成 Winston + Logstash；
- `prisma/` 提供数据库模型与迁移命令；
- `filters/` 与 `guards/` 实现安全与错误控制。

---

### AI 子服务（ai-service/）

```txt
ai-service/
├── app/
│   ├── main.py                    # FastAPI 主入口
│   ├── routers/
│   │   ├── analyze.py             # 棋局AI分析接口
│   │   ├── suggest.py             # 下一步提示接口
│   │   └── train.py               # AI 模型训练接口
│   ├── services/
│   │   ├── engine.py              # 棋局分析核心逻辑
│   │   └── utils.py               # 通用工具函数
│   └── models/
│       └── request_response.py    # 请求/响应模型（Pydantic）
├── requirements.txt
├── Dockerfile
└── README.md
```

**✅ 说明：**

- 使用 **FastAPI + Uvicorn** 提供 REST 接口；
- 负责棋局分析、AI讲解、提示生成；
- 可通过 **HTTP 或 gRPC** 与主后端交互；
- 模块独立部署，便于扩展与并行训练。

---

### 运维与部署层（infra/）

```txt
infra/
├── nginx/
│   ├── default.conf               # Nginx 反向代理配置
│   └── ssl/                       # HTTPS 证书（.crt / .key）
├── docker/
│   ├── docker-compose.yml         # 全系统容器编排
│   ├── Dockerfile.frontend        # 前端构建镜像
│   ├── Dockerfile.backend         # 后端构建镜像
│   ├── Dockerfile.ai-service      # AI服务镜像
│   └── Dockerfile.log             # ELK 日志服务镜像
├── ci-cd/
│   └── github-actions.yml         # CI/CD 流水线定义
├── logs/
│   ├── logstash.conf              # 日志转发配置
│   ├── elasticsearch/             # 数据索引存储
│   └── kibana/                    # 日志可视化配置
└── monitoring/
    ├── prometheus.yml             # 性能监控指标
    └── grafana-dashboard.json     # Grafana 仪表盘模板
```

**✅ 说明：**

- `docker-compose.yml` 启动所有服务（frontend、backend、redis、mysql、log、nginx）；
- `ci-cd/` 存放 GitHub Actions 自动化脚本；
- `logs/` 集成 ELK Stack；
- `monitoring/` 用于性能监控。

---

### 文档与辅助工具（docs/ + scripts/）

```txt
docs/
├── SRS.md                        # 软件需求规格说明书
├── API_SPEC.md                   # 接口文档（Swagger 导出）
├── ARCHITECTURE.md               # 系统架构说明
├── DEPLOYMENT.md                 # 部署与运维说明
└── TEST_PLAN.md                  # 测试方案文档

scripts/
├── migrate.sh                    # 数据库迁移脚本
├── seed.sh                       # 初始化测试数据
└── deploy.sh                     # 一键部署脚本
```

---

## 四、项目现状

- 仓库已包含前端（Vite + React + TS）、后端（NestJS + Prisma + JWT）、AI 子服务（FastAPI 骨架）与基础设施（Docker Compose）的基础代码与脚手架，可在本地启动开发环境。
- 数据库统一为 PostgreSQL，本地通过 `infra/docker/docker-compose.yml` 启动；Prisma 模型与迁移已就绪（见 `backend/prisma/schema.prisma` 与 `backend/prisma/migrations/*`）。
- 后端（NestJS + Prisma）：
   - 已实现基于「手机号 + 密码」的注册与登录（JWT + 刷新令牌），`CORS` 放开本地 Vite 开发域（5173）。
   - 模块已包含 `user`、`board`、`battle`、`record`、`metrics` 等；统一响应封装与异常处理已启用，路由与契约参考 `docs/API_SPEC.md` 与模块内 `controller/service`。
   - 迁移记录完整，脚本支持快速启动与（开发环境）重置。
- 前端（Vite + React + TypeScript）：
   - 登录、注册已对接后端 `/user/login` 与 `/user/register`；登录后 `accessToken` 存入 `localStorage.token`，`/app/*` 路由由 `ProtectedRoute` 护航。
   - 棋盘、对战、记录等功能组件与页面位于 `src/features/*`；统一 API 封装见 `src/services/api.ts` 与 `src/lib/http.ts`，后端基地址由 `VITE_API_BASE` 控制。
- AI 子服务（FastAPI）：
   - 目录结构与入口 `ai-service/app/main.py` 已就绪；目前为占位与演示用途，尚未与后端形成稳定 HTTP 契约与集成。
- 运维与脚本：
   - 提供 macOS 与 Windows 启动脚本：`scripts/start-all.*`、`start-backend.*`、`start-frontend.*`；后端环境变量集中在 `backend/prisma/.env`，前端 `.env` 使用 `VITE_API_BASE`。

## 五、开发规范

### 一、分支命名规范

采用 类型/标识-描述 格式，使用小写字母，以短横线分隔。

1. 主分支 main：生产环境代码，保持稳定可部署状态
2. 功能分支：feature/Id-功能描述（从main创建，合并回main）
3. 修复分支：bugfix/Id-问题描述（从main创建，合并回main）
4. 临时分支（测试或实验用，完成后删除）：test/开发者标识-测试内容
5. 标识规范：后端使用BE，前端使用FE，人工智能接入使用AI

### 二、Commit提交规范

采用 类型(范围): 描述 格式，参考Conventional Commits规范

1. 提交类型定义：

   - feat：新功能（feature）
   - fix：bug 修复
   - style：代码格式调整（不影响代码逻辑）
   - refactor：代码重构（既非新功能也非修复 bug）
   - perf：性能优化
   - test：测试相关
   - docs：文档更新（仅修改文档）

2. 范围：指定修改涉及的模块，如user、game、ai等
3. 描述：简洁明了的修改说明（不超过 20 字），不用句号结尾
feat(user): 增加密码重置功能
docs: 更新某具体接口的对应API文档

### 三、Pull Request 提交规范

1. 标题格式：与 Commit 信息一致，如feat(game):实现在线对弈
2. PR内容模版：

    ```markdown
    ## 变更说明

    简要描述本次PR实现的功能或修复的问题

    ## 相关Issue

    关联的Issue编号，如#123

    ## 实现细节

    - 核心逻辑说明
    - 关键技术点
    - 未完成或需要注意的地方

    ## 测试情况

    - [ ] 单元测试已补充
    - [ ] 功能测试已通过
    - 测试步骤：...

    ## 截图（可选）

    相关功能截图或录屏
    ```

3. 合并要求

   - 必须通过 CI 自动检查（代码规范、测试用例）
   - 至少 1 名团队成员审核通过，根据 Review 反馈及时进行修改
   - 与目标分支（通常是develop）无冲突
   - 前端代码需注意兼容性（参考技术栈中 React Native 的适配要求）
   - 后端代码需包含对应的单元测试（参考backend/test/目录结构）

4. 合并方式
   1. 功能完成且稳定：使用 "Squash and merge"（压缩为一个 Commit）
