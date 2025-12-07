**社区模块 API 规范（草案）**

- **目标**: 为象棋应用提供发帖驱动的社区，允许用户发布文本/图片，分享对局记录、自定义棋局或片段，并支持评论、点赞、收藏、举报与搜索。

- **前缀**: 所有社区接口均使用 `/api/v1/community/...`。

- **主要资源**:
  - `Post`：社区帖子（可包含 `shareReference` 指向 record/board/clip，保存 snapshot）
  - `Comment`：评论，支持父子回复
  - `Like`：点赞（对帖子/评论）
  - `Bookmark`：收藏帖子
  - `Report`：用户举报

---

主要接口一览（简要）

- 列表/时间线
  - `GET /api/v1/community/posts` — 查询分页帖子（支持 `q`, `tag`, `type`, `authorId`, `sort`）

- 帖子操作
  - `POST /api/v1/community/posts` — 创建帖子（需要登录）
  - `GET /api/v1/community/posts/{postId}` — 帖子详情（返回 `Post`，含 attachments 与 shareSnapshot）
  - `PATCH /api/v1/community/posts/{postId}` — 更新帖子（仅作者或管理员）
  - `DELETE /api/v1/community/posts/{postId}` — 删除帖子（软删除）

- 评论
  - `GET /api/v1/community/posts/{postId}/comments` — 帖子评论分页
  - `POST /api/v1/community/posts/{postId}/comments` — 添加评论（登录）
  - `DELETE /api/v1/community/comments/{commentId}` — 删除评论（作者或管理员）

- 互动
  - `POST/DELETE /api/v1/community/posts/{postId}/like` — 点赞/取消
  - `POST/DELETE /api/v1/community/posts/{postId}/bookmark` — 收藏/取消

- 举报与搜索
  - `POST /api/v1/community/reports` — 举报帖子或评论
  - `GET /api/v1/community/search` — 搜索帖子/记录（支持过滤/分页）

---

实现建议与注意事项

- 发帖时强制保存引用资源快照（`PostShareReference.snapshot`），避免原资源变更后断链。
- 对图片附件限制大小与数量（例如每图 ≤ 5MB，最多 10 张），并在前端做压缩。
- 支持草稿（`status: draft`）或由前端临时保存草稿到 localStorage。
- 审核策略：初期以人工/简单规则审核为主（关键词/频率），后期可接入自动检测与速率限制。
- 搜索：先使用 Postgres full-text，实现后可迁移到 ElasticSearch。

---

下一步（我可以帮你做）

- 生成 `openapi.yaml` 的完整社区路径与 schema（已完成基础草案）。
- 生成 `backend` 的 Prisma schema 草案与迁移脚本。
- 生成 `backend/src/modules/community` 的 NestJS 控制器/服务/DTO 模板。

请选择要我继续的下一步（例如“生成 Prisma schema 草案”或“生成后端控制器模板”）。

# 🎯 趣玩象棋统一接口文档（v1.0）

**架构**：NestJS + Prisma + PostgreSQL + Redis + WebSocket  
**风格**：RESTful 为主，部分 GraphQL / WebSocket 支持  
**认证**：JWT（Bearer Token）

> 说明：当前仓库已实现的接口为用户注册/登录（路径为 `/user/register`、`/user/login`）。本文档以 `/api/v1/...` 为规划版本，以下请求/响应示例用于对齐未来实现（人机可读）。

---

## 📖 响应格式统一

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

### 登录示例

---

## 一、用户与认证模块（User & Auth）

| 接口     | 方法    | 路径                        | 鉴权 | 描述                  |
| ------ | ----- | ------------------------- | -- | ------------------- |
| 注册账号   | POST  | `/api/v1/auth/register`   | ❌  | 支持手机号 / 微信 / QQ 注册  |
| 登录账号   | POST  | `/api/v1/auth/login`      | ❌  | 登录并返回 JWT           |
| 获取验证码  | POST  | `/api/v1/auth/sms`        | ❌  | 发送短信验证码             |
| 获取当前用户 | GET   | `/api/v1/users/me`        | ✅  | 获取自己的用户信息           |
| 修改个人信息 | PATCH | `/api/v1/users/me`        | ✅  | 修改昵称 / 密码 / 头像      |
| 上传头像   | POST  | `/api/v1/users/me/avatar` | ✅  | 上传文件（Multer + OSS）  |
| 查询他人主页 | GET   | `/api/v1/users/:userId`   | ✅  | 查看他人主页信息            |
| 登出     | POST  | `/api/v1/auth/logout`     | ✅  | 清除 Redis 中 token 状态 |

注册示例（手机号）

```json
POST /api/v1/auth/register
{
  "type": "phone",
  "phone": "13800000000",
  "code": "8523",
  "password": "Abc12345"
}
```

响应

```json
{
  "code": 0,
  "message": "注册成功",
  "data": { "userId": 1024, "accessToken": "<JWT_TOKEN>", "refreshToken": "<REFRESH_TOKEN>", "expiresIn": 1800 }
}
```

登录示例

```json
POST /api/v1/auth/login
{
  "type": "phone",
  "phone": "13800000000",
  "password": "Abc12345"
}
```

响应

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "userId": 1024,
    "accessToken": "<JWT_TOKEN>",
    "refreshToken": "<REFRESH_TOKEN>",
    "expiresIn": 1800
  }
}
```

获取验证码示例

```json
POST /api/v1/auth/sms
{
  "phone": "13800000000"
}
```

响应

```json
{
  "code": 0,
  "message": "短信已发送",
  "data": { "requestId": "sms_9f3a2", "expireIn": 300 }
}
```

获取当前用户示例

```json
GET /api/v1/users/me
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1024,
    "nickname": "棋友A",
    "phone": "13800000000",
    "avatarUrl": null,
    "role": "USER",
    "createdAt": "2025-10-31T12:00:00.000Z"
  }
}
```

修改个人信息示例

```json
PATCH /api/v1/users/me
Authorization: Bearer <token>
{
  "nickname": "新的昵称",
  "password": "NewPass123",
  "avatarUrl": "https://cdn.example.com/avatars/1024.png"
}
```

响应

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "id": 1024,
    "nickname": "新的昵称",
    "avatarUrl": "https://cdn.example.com/avatars/1024.png"
  }
}
```

上传头像示例（multipart/form-data）

```text
POST /api/v1/users/me/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

form-data:
- file: <binary image>
```

响应

```json
{
  "code": 0,
  "message": "上传成功",
  "data": { "url": "https://cdn.example.com/avatars/1024.png" }
}
```

提示

- 开发环境当前实现返回 Data URL（与 OpenAPI 文档一致）：

```json
{
  "code": 0,
  "message": "上传成功",
  "data": { "url": "data:image/png;base64,iVBORw0KGgoAAA..." }
}
```

- 生产可切换为静态存储/OSS/CDN，保持字段名不变（url）。

查询他人主页示例

```json
GET /api/v1/users/2048
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 2048,
    "nickname": "对手B",
    "avatarUrl": null,
    "rating": 1250
  }
}
```

登出示例

```json
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "登出成功",
  "data": {}
}
```

---

## 二、自定义棋局模块（Board Editor）

| 接口     | 方法     | 路径                         | 鉴权 | 描述          |
| ------ | ------ | -------------------------- | -- | ----------- |
| 获取标准棋盘 | GET    | `/api/v1/boards/standard` | ❌  | 返回中国象棋标准开局 |
| 获取模板列表 | GET    | `/api/v1/boards/templates` | ❌  | 获取系统预设棋局模板  |
| 创建棋局   | POST   | `/api/v1/boards`           | ✅  | 用户自定义棋局     |
| 查询我的棋局 | GET    | `/api/v1/boards/mine`      | ✅  | 获取自己创建的所有棋局 |
| 查看棋局详情 | GET    | `/api/v1/boards/:boardId`  | ✅  | 读取棋局布局与规则   |
| 更新棋局   | PATCH  | `/api/v1/boards/:boardId`  | ✅  | 更新布局或规则     |
| 删除棋局   | DELETE | `/api/v1/boards/:boardId`  | ✅  | 删除自定义棋局     |
获取标准棋盘示例

```json
GET /api/v1/boards/standard
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "标准开局",
    "description": "中国象棋标准开局布局",
    "layout": {
      "pieces": [
        { "type": "chariot", "side": "black", "x": 0, "y": 0 },
        { "type": "chariot", "side": "black", "x": 8, "y": 0 },
        { "type": "horse", "side": "black", "x": 1, "y": 0 },
        { "type": "horse", "side": "black", "x": 7, "y": 0 },
        { "type": "elephant", "side": "black", "x": 2, "y": 0 },
        { "type": "elephant", "side": "black", "x": 6, "y": 0 },
        { "type": "advisor", "side": "black", "x": 3, "y": 0 },
        { "type": "advisor", "side": "black", "x": 5, "y": 0 },
        { "type": "general", "side": "black", "x": 4, "y": 0 },
        { "type": "cannon", "side": "black", "x": 1, "y": 2 },
        { "type": "cannon", "side": "black", "x": 7, "y": 2 },
        { "type": "soldier", "side": "black", "x": 0, "y": 3 },
        { "type": "soldier", "side": "black", "x": 2, "y": 3 },
        { "type": "soldier", "side": "black", "x": 4, "y": 3 },
        { "type": "soldier", "side": "black", "x": 6, "y": 3 },
        { "type": "soldier", "side": "black", "x": 8, "y": 3 },
        { "type": "chariot", "side": "red", "x": 0, "y": 9 },
        { "type": "chariot", "side": "red", "x": 8, "y": 9 },
        { "type": "horse", "side": "red", "x": 1, "y": 9 },
        { "type": "horse", "side": "red", "x": 7, "y": 9 },
        { "type": "elephant", "side": "red", "x": 2, "y": 9 },
        { "type": "elephant", "side": "red", "x": 6, "y": 9 },
        { "type": "advisor", "side": "red", "x": 3, "y": 9 },
        { "type": "advisor", "side": "red", "x": 5, "y": 9 },
        { "type": "general", "side": "red", "x": 4, "y": 9 },
        { "type": "cannon", "side": "red", "x": 1, "y": 7 },
        { "type": "cannon", "side": "red", "x": 7, "y": 7 },
        { "type": "soldier", "side": "red", "x": 0, "y": 6 },
        { "type": "soldier", "side": "red", "x": 2, "y": 6 },
        { "type": "soldier", "side": "red", "x": 4, "y": 6 },
        { "type": "soldier", "side": "red", "x": 6, "y": 6 },
        { "type": "soldier", "side": "red", "x": 8, "y": 6 }
      ]
    },
    "rules": { "id": 1 },
    "preview": "",
    "isTemplate": true
  }
}
```

获取模板列表示例

```json
GET /api/v1/boards/templates
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    { "id": 1, "name": "中炮对屏风马", "preview": "/img/t1.png" },
    { "id": 2, "name": "反宫马", "preview": "/img/t2.png" }
  ]
}
```

创建棋局示例

```json
POST /api/v1/boards
{
  "name": "中炮对屏风马",
  "description": "经典布局",
  "layout": {
    "pieces": [
      { "type": "car", "x": 0, "y": 0, "side": "red" }
    ]
  },
  "rules": {
    "horse": "日字",
    "cannon": "跳吃"
  }
}
```

响应

```json
{
  "code": 0,
  "message": "创建成功",
  "data": { "boardId": 301, "name": "中炮对屏风马" }
}
```

查询我的棋局示例（分页）

```json
GET /api/v1/boards/mine?page=1&pageSize=10
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ { "id": 301, "name": "中炮对屏风马" } ],
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

查看棋局详情示例

```json
GET /api/v1/boards/301
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 301,
    "name": "中炮对屏风马",
    "layout": { "pieces": [] },
    "rules": { "horse": "日字" }
  }
}
```

更新棋局示例

```json
PATCH /api/v1/boards/301
Authorization: Bearer <token>
{
  "name": "中炮对屏风马（改）"
}
```

响应

```json
{
  "code": 0,
  "message": "更新成功",
  "data": { "id": 301, "name": "中炮对屏风马（改）" }
}
```

删除棋局示例

```json
DELETE /api/v1/boards/301
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "删除成功",
  "data": {}
}
```

---

## 三、对战模块（Battle / Match）

### REST 接口

| 接口     | 方法   | 路径                          | 鉴权 | 描述     |
| ------ | ---- | --------------------------- | -- | ------ |
| 创建房间   | POST | `/api/v1/battles`           | ✅  | 创建对战房间 |
| 加入房间   | POST | `/api/v1/battles/join`      | ✅  | 加入指定房间 |
| 快速匹配   | POST | `/api/v1/battles/match`     | ✅  | 自动匹配对手 |
| 查询对战历史 | GET  | `/api/v1/battles/history`   | ✅  | 我的对战记录 |
| 获取房间信息 | GET  | `/api/v1/battles/:battleId` | ✅  | 当前对战状态 |

创建房间

```json
POST /api/v1/battles
{
  "mode": "pvp",
  "initialBoardId": 123,
  "fogMode": true,
  "password": "abcd"
}
```

响应

```json
{
  "code": 0,
  "message": "房间创建成功",
  "data": { "battleId": 501, "status": "waiting" }
}

```

加入房间

```json
POST /api/v1/battles/join
Authorization: Bearer <token>
{
  "battleId": 501,
  "password": "abcd"
}
```

响应

```json
{
  "code": 0,
  "message": "加入成功",
  "data": {
    "battleId": 501,
    "players": [ { "id": 1024 }, { "id": 2048 } ],
    "status": "waiting"
  }
}
```

快速匹配

```json
POST /api/v1/battles/match
Authorization: Bearer <token>
{
  "mode": "pvp"
}
```

响应

```json
{
  "code": 0,
  "message": "匹配成功",
  "data": { "battleId": 777 }
}
```

查询对战历史（分页）

```json
GET /api/v1/battles/history?page=1&pageSize=10
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ { "battleId": 501, "result": "win" } ],
    "page": 1,
    "pageSize": 10,
    "total": 23
  }
}
```

获取房间信息

```json
GET /api/v1/battles/501
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "battleId": 501,
    "status": "playing",
    "players": [ { "id": 1024 }, { "id": 2048 } ],
    "moves": [ { "from": {"x":0,"y":6}, "to": {"x":0,"y":4} } ]
  }
}
```

---

### WebSocket 实时事件

说明：前端通过 Socket.IO 连接命名空间 `${VITE_API_BASE}/battle`，携带 `Authorization: Bearer <token>`（Socket auth 传递 `token`）。当前已用事件如下：

| 事件                 | 方向    | 描述                                 |
| ------------------ | ----- | ------------------------------------ |
| `battle.join`      | C → S | 加入房间（参数包含 `battleId`）             |
| `battle.snapshot`  | 双向    | 请求/推送权威快照（包含棋盘、轮次、玩家、走子列表） |
| `battle.move`      | 双向    | 走棋事件（客户端发起、服务端广播）              |
| `battle.player_join` | S → C | 有玩家进入房间时的通知，用于触发拉取快照              |

走棋事件示例（双向）

```json
{
  "event": "battle.move",
  "data": {
    "from": { "x": 0, "y": 6 },
    "to": { "x": 0, "y": 4 },
    "piece": "cannon",
    "timestamp": 1730456822
  }
}
```

加入房间事件（C → S）

```json
{
  "event": "battle.join",
  "data": { "battleId": 501, "userId": 1024 }
}
```

快照事件（请求与推送）

请求当前快照（C → S）

```json
{
  "event": "battle.snapshot",
  "data": { "battleId": 501 }
}
```

推送权威快照（S → C）

```json
{
  "event": "battle.snapshot",
  "data": {
    "battleId": 501,
    "status": "waiting",
    "mode": "pvp",
    "players": [1024, 2048],
    "moves": [ { "seq": 1, "from": {"x":0,"y":6}, "to": {"x":0,"y":4}, "by": 1024, "ts": 1730456822 } ],
    "turnIndex": 0,
    "board": { /* 略 */ },
    "turn": "red",
    "createdAt": 1730456000,
    "winnerId": null
  }
}
```

玩家加入通知（S → C）

```json
{
  "event": "battle.player_join",
  "data": { "userId": 2048 }
}
```

---

## 四、对局记录与分享模块（Record / Share）

说明：

- 本模块覆盖“本地对战保存、列表、详情、收藏、复盘书签/笔记”等需求。
- 新增记录时，后端会在“当前用户范围”内自动清理非收藏记录，仅保留最近 30 条；收藏记录不受影响。

| 接口         | 方法     | 路径                                  | 鉴权 | 描述                     |
| ------------ | -------- | ------------------------------------- | ---- | ------------------------ |
| 创建对局记录 | POST     | `/api/v1/records`                     | ✅    | 新增一条对局记录（含 moves） |
| 获取我的对局 | GET      | `/api/v1/records`                     | ✅    | 分页查询；支持 `favorite` 过滤 |
| 获取对局详情 | GET      | `/api/v1/records/:id`                 | ✅    | 查看单局数据（含 moves、bookmarks） |
| 更新对局信息 | PATCH    | `/api/v1/records/:id`                 | ✅    | 更新元信息（对手、标签、结果等） |
| 收藏对局     | POST     | `/api/v1/records/:id/favorite`        | ✅    | 收藏                       |
| 取消收藏     | DELETE   | `/api/v1/records/:id/favorite`        | ✅    | 取消收藏                   |
| 新增书签/笔记 | POST     | `/api/v1/records/:id/bookmarks`       | ✅    | 在复盘某步添加书签/笔记         |
| 修改书签/笔记 | PATCH    | `/api/v1/records/:id/bookmarks/:bid`  | ✅    | 编辑书签/笔记                |
| 删除书签/笔记 | DELETE   | `/api/v1/records/:id/bookmarks/:bid`  | ✅    | 删除书签/笔记                |
| 上传对局分享 | POST     | `/api/v1/records/:id/share`           | ✅    | 上传至公共平台                |
| 获取评论     | GET      | `/api/v1/records/:id/comments`        | ❌    | 查看评论                    |
| 评论对局     | POST     | `/api/v1/records/:id/comments`        | ✅    | 添加静态/弹幕评论              |
| 导出残局     | GET      | `/api/v1/records/:id/export`          | ✅    | 导出指定步残局                |

创建对局记录示例

```json
POST /api/v1/records
Authorization: Bearer <token>
{
  "opponent": "本地玩家",
  "startedAt": "2025-11-11T10:00:00.000Z",
  "endedAt": "2025-11-11T10:18:25.000Z",
  "result": "red",
  "endReason": "checkmate",
  "keyTags": ["中局反击", "双车压制"],
  "moves": [
    {"moveIndex":0, "from":{"x":4,"y":9}, "to":{"x":4,"y":8}, "piece":{"type":"general","side":"red"}},
    {"moveIndex":1, "from":{"x":4,"y":0}, "to":{"x":4,"y":1}, "piece":{"type":"general","side":"black"}}
  ],
  "bookmarks": [
    {"step":12, "label":"妙手", "note":"这一手很关键"}
  ]
}
```

响应

```json
{
  "code": 0,
  "message": "创建成功",
  "data": { "id": 601, "createdAt": "2025-11-11T10:18:26.000Z" }
}
```

获取我的对局示例（支持收藏筛选）

```json
GET /api/v1/records?page=1&pageSize=10&favorite=false
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 501,
        "opponent": "本地玩家",
        "result": "win",
        "keyTags": ["中局反击"],
        "favorite": false,
        "createdAt": "2025-10-31T12:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 12
  }
}
```

获取对局详情示例（含 moves、bookmarks）

```json
GET /api/v1/records/501
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 501,
    "opponent": "本地玩家",
    "startedAt": "2025-11-11T10:00:00.000Z",
    "endedAt": "2025-11-11T10:18:25.000Z",
    "result": "red",
    "endReason": "checkmate",
    "keyTags": ["中局反击"],
    "favorite": false,
    "moves": [ { "moveIndex": 0 }, { "moveIndex": 1 } ],
    "bookmarks": [ { "id": 1, "step": 12, "label": "妙手" } ]
  }
}
```

更新对局信息示例

```json
PATCH /api/v1/records/501
Authorization: Bearer <token>
{
  "opponent": "AI Lv.3",
  "keyTags": ["残局逆转"],
  "result": "black",
  "endReason": "resign"
}
```

响应

```json
{ "code": 0, "message": "success", "data": {} }
```

新增书签/笔记示例

```json
POST /api/v1/records/501/bookmarks
Authorization: Bearer <token>
{ "step": 25, "label": "机会", "note": "这里应该先手弃炮" }
```

响应

```json
{ "code": 0, "message": "success", "data": { "id": 2 } }
```

上传对局分享示例

```json
POST /api/v1/records/501/share
Authorization: Bearer <token>
{
  "title": "这一局很精彩",
  "tags": ["经典", "进攻"]
}
```

响应

```json
{
  "code": 0,
  "message": "分享成功",
  "data": { "shareId": 9001 }
}
```

收藏/取消收藏示例

```json
POST /api/v1/records/501/favorite
Authorization: Bearer <token>
```

```json
DELETE /api/v1/records/501/favorite
Authorization: Bearer <token>
```

响应（均返回）

```json
{ "code": 0, "message": "success", "data": {} }
```

评论示例

```json
POST /api/v1/records/501/comments
{
  "type": "danmu",
  "step": 36,
  "content": "这一手太妙了！"
}
```

响应

```json
{ "code": 0, "message": "success", "data": { "commentId": 7001 } }
```

获取评论示例

```json
GET /api/v1/records/501/comments
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": [ { "id": 7001, "type": "danmu", "content": "这一手太妙了！" } ]
}
```

导出残局示例

```text
GET /api/v1/records/501/export
Accept: application/octet-stream
```

响应（文件下载）

```text
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="record-501.pgn"
Content-Type: application/octet-stream

<binary content>
```

---

### 记录偏好（Retention Preferences）

说明：用于控制“只保留最近 N 条非收藏对局”的用户级偏好。后端在创建新对局记录时，将依据该偏好自动清理超出上限的“非收藏”记录（收藏与置顶不受清理影响）。

| 接口           | 方法   | 路径                         | 鉴权 | 描述                  |
| -------------- | ------ | ---------------------------- | ---- | --------------------- |
| 获取记录偏好   | GET    | `/api/v1/records/prefs`      | ✅    | 获取当前用户的记录保留偏好 |
| 更新记录偏好   | PATCH  | `/api/v1/records/prefs`      | ✅    | 更新保留上限、是否自动清理 |

字段定义

- keepLimit: number，保留的“非收藏”记录上限；默认 30；建议范围 1–500（超范围按边界裁剪）。
- autoCleanEnabled: boolean，是否在新建记录后自动清理；默认 true。
- updatedAt: ISO Date，服务端维护的更新时间。

获取记录偏好示例

```json
GET /api/v1/records/prefs
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keepLimit": 30,
    "autoCleanEnabled": true,
    "updatedAt": "2025-10-31T12:00:00.000Z"
  }
}
```

更新记录偏好示例

```json
PATCH /api/v1/records/prefs
Authorization: Bearer <token>
{
  "keepLimit": 50,
  "autoCleanEnabled": true
}
```

响应

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "keepLimit": 50,
    "autoCleanEnabled": true,
    "updatedAt": "2025-10-31T12:05:00.000Z"
  }
}
```

后端清理规则

- 当 autoCleanEnabled=true 时，成功创建记录后执行清理：按 createdAt 倒序，仅保留非收藏记录的最近 keepLimit 条；收藏记录不参与清理。
- 为降低写放大，清理可延迟到“创建后异步任务”或“列表读取前惰性清理”，但对外行为一致。
- 强制边界：keepLimit<1 记为 1；keepLimit>500 记为 500。

---

## 五、社区模块（Community）

| 接口     | 方法     | 路径                                  | 鉴权 | 描述       |
| ------ | ------ | ----------------------------------- | -- | -------- |
| 获取分享广场 | GET    | `/api/v1/community/shares`          | ❌  | 热门对局流    |
| 点赞对局   | POST   | `/api/v1/community/shares/:id/like` | ✅  | 点赞       |
| 取消点赞   | DELETE | `/api/v1/community/shares/:id/like` | ✅  | 取消点赞     |
| 举报内容   | POST   | `/api/v1/community/reports`         | ✅  | 举报违规内容   |
| 搜索对局   | GET    | `/api/v1/community/search`          | ❌  | 按标签/作者搜索 |

获取分享广场示例

```json
GET /api/v1/community/shares?page=1&pageSize=20
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ { "shareId": 9001, "title": "名局回顾", "likes": 42 } ],
    "page": 1,
    "pageSize": 20,
    "total": 200
  }
}
```

点赞/取消点赞示例

```json
POST /api/v1/community/shares/9001/like
Authorization: Bearer <token>
```

```json
DELETE /api/v1/community/shares/9001/like
Authorization: Bearer <token>
```

响应（均返回）

```json
{ "code": 0, "message": "success", "data": {} }
```

举报内容示例

```json
POST /api/v1/community/reports
Authorization: Bearer <token>
{
  "targetType": "share",
  "targetId": 9001,
  "reason": "涉嫌违规"
}
```

响应

```json
{ "code": 0, "message": "已受理", "data": { "reportId": 8001 } }
```

搜索对局示例

```json
GET /api/v1/community/search?q=经典&tag=进攻&page=1&pageSize=10
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ { "recordId": 501, "title": "经典进攻对局" } ],
    "page": 1,
    "pageSize": 10,
    "total": 3
  }
}
```

## 六、GraphQL 接口（复盘与统计）

路径： `/api/v1/graphql`

示例查询

```graphql
query {
  userStats(userId: 1024) {
    totalBattles
    winRate
    favoriteCount
    recentRecords(limit: 3) {
      id
      opponent { nickname }
      result
      createdAt
    }
  }
}
```

响应

```json
{
  "data": {
    "userStats": {
      "totalBattles": 21,
      "winRate": 0.67,
      "favoriteCount": 5,
      "recentRecords": [
        { "id": 501, "opponent": { "nickname": "张三" }, "result": "win" }
      ]
    }
  }
}
```

---

## 七、数据模型（Prisma Schema 摘要）

```prisma
model User {
  id        Int      @id @default(autoincrement())
  nickname  String
  phone     String?  @unique
  password  String
  avatarUrl String?
  provider  String
  createdAt DateTime @default(now())
  battles   Battle[]
  favorites Favorite[]
}

model Battle {
  id        Int      @id @default(autoincrement())
  mode      String
  fogMode   Boolean
  boardId   Int
  status    String
  moves     Json
  winnerId  Int?
  createdAt DateTime @default(now())
}

model Record {
  id           Int        @id @default(autoincrement())
  userId       Int
  opponent     String?
  startedAt    DateTime
  endedAt      DateTime?
  result       String
  endReason    String?
  keyTags      String[]
  favorite     Boolean    @default(false)
  moves        Move[]
  bookmarks    Bookmark[]
  shared       Boolean    @default(false)
  comments     Comment[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model Move {
  id           Int      @id @default(autoincrement())
  recordId     Int
  moveIndex    Int
  fromX        Int
  fromY        Int
  toX          Int
  toY          Int
  pieceType    String
  pieceSide    String
  capturedType String?
  capturedSide String?
  timeSpentMs  Int?
  record       Record   @relation(fields: [recordId], references: [id])
  @@unique([recordId, moveIndex])
}

model Bookmark {
  id        Int      @id @default(autoincrement())
  recordId  Int
  step      Int
  label     String?
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  record    Record   @relation(fields: [recordId], references: [id])
}

model Comment {
  id        Int      @id @default(autoincrement())
  recordId  Int
  userId    Int
  content   String
  type      String
  step      Int
  createdAt DateTime @default(now())
}

// 用户记录保留偏好（仅摘要展示）
model UserPreference {
  userId            Int       @id
  keepLimit         Int       @default(30)
  autoCleanEnabled  Boolean   @default(true)
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id])
}
```

---

## 八、错误码对照表

| code | 含义                              |
| ---- | --------------------------------- |
| 0    | 成功                              |
| 1001 | 参数错误（含：手机号格式不正确、缺少文件等） |
| 1002 | 手机号已被注册                      |
| 1003 | 密码过于简单                        |
| 1004 | 请求过于频繁（短信防刷）              |
| 2001 | 用户不存在                          |
| 3001 | 棋局不存在                          |
| 4001 | 房间已满或密码错误                    |
| 5001 | 服务器内部错误                        |
| 401  | 未认证或令牌无效（部分错误示例采用 HTTP 状态码） |

说明

- 为与 OpenAPI 示例对齐，部分鉴权错误示例使用了 HTTP 401 作为 code；其余业务/校验错误使用 1xxx 域内错误码。
- 如需完全统一为域内错误码，可将 401 归并为 1002（鉴权失败/令牌过期），但需同步更新 OpenAPI examples 与前端提示文案。

---

## 九、附录：接口鉴权规则

- `Authorization: Bearer <token>`
- Redis 存储黑名单，用于登出/失效 token 管理。

---
