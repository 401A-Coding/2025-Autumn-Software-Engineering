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
| 获取模板列表 | GET    | `/api/v1/boards/templates` | ❌  | 获取系统预设棋局模板  |
| 创建棋局   | POST   | `/api/v1/boards`           | ✅  | 用户自定义棋局     |
| 查询我的棋局 | GET    | `/api/v1/boards/mine`      | ✅  | 获取自己创建的所有棋局 |
| 查看棋局详情 | GET    | `/api/v1/boards/:boardId`  | ✅  | 读取棋局布局与规则   |
| 更新棋局   | PATCH  | `/api/v1/boards/:boardId`  | ✅  | 更新布局或规则     |
| 删除棋局   | DELETE | `/api/v1/boards/:boardId`  | ✅  | 删除自定义棋局     |

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

| 事件                 | 方向    | 描述             |
| ------------------ | ----- | -------------- |
| `battle.join`      | C → S | 加入房间（带 userId） |
| `battle.start`     | S → C | 对战开始（同步初始棋盘）   |
| `battle.move`      | 双向    | 走棋事件           |
| `battle.chat`      | 双向    | 房间内消息          |
| `battle.result`    | S → C | 结束结果（胜/负/和）    |
| `battle.reconnect` | 双向    | 网络重连恢复状态       |

走棋事件示例

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

加入房间事件

```json
{
  "event": "battle.join",
  "data": { "battleId": 501, "userId": 1024 }
}
```

对战开始事件

```json
{
  "event": "battle.start",
  "data": { "battleId": 501, "initialBoard": { "pieces": [] } }
}
```

---

## 四、对局记录与分享模块（Record / Share）

| 接口     | 方法     | 路径                             | 鉴权 | 描述        |
| ------ | ------ | ------------------------------ | -- | --------- |
| 获取我的对局 | GET    | `/api/v1/records`              | ✅  | 分页查询      |
| 获取对局详情 | GET    | `/api/v1/records/:id`          | ✅  | 查看单局数据    |
| 上传对局分享 | POST   | `/api/v1/records/:id/share`    | ✅  | 上传至公共平台   |
| 收藏对局   | POST   | `/api/v1/records/:id/favorite` | ✅  | 收藏        |
| 取消收藏   | DELETE | `/api/v1/records/:id/favorite` | ✅  | 取消收藏      |
| 评论对局   | POST   | `/api/v1/records/:id/comments` | ✅  | 添加静态/弹幕评论 |
| 获取评论   | GET    | `/api/v1/records/:id/comments` | ❌  | 查看评论      |
| 导出残局   | GET    | `/api/v1/records/:id/export`   | ✅  | 导出指定步残局   |

获取我的对局示例

```json
GET /api/v1/records?page=1&pageSize=10
Authorization: Bearer <token>
```

响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ { "id": 501, "result": "win", "createdAt": "2025-10-31T12:00:00.000Z" } ],
    "page": 1,
    "pageSize": 10,
    "total": 12
  }
}
```

获取对局详情示例

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
    "battleId": 501,
    "data": { "moves": [] },
    "shared": false
  }
}
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
  id        Int      @id @default(autoincrement())
  battleId  Int
  data      Json
  shared    Boolean
  tags      String[]
  comments  Comment[]
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
