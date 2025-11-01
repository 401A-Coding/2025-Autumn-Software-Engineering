# 🎯 趣玩象棋统一接口文档（v1.0）

**架构**：NestJS + Prisma + PostgreSQL + Redis + WebSocket
**风格**：RESTful 为主，部分 GraphQL / WebSocket 支持
**认证**：JWT（Bearer Token）

---

## 📖 响应格式统一

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

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

注册示例

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
  "data": { "userId": 1024, "token": "<JWT_TOKEN>" }
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

评论示例

```json
POST /api/v1/records/501/comments
{
  "type": "danmu",
  "step": 36,
  "content": "这一手太妙了！"
}
```

---

## 五、社区模块（Community）

| 接口     | 方法     | 路径                                  | 鉴权 | 描述       |
| ------ | ------ | ----------------------------------- | -- | -------- |
| 获取分享广场 | GET    | `/api/v1/community/shares`          | ❌  | 热门对局流    |
| 点赞对局   | POST   | `/api/v1/community/shares/:id/like` | ✅  | 点赞       |
| 取消点赞   | DELETE | `/api/v1/community/shares/:id/like` | ✅  | 取消点赞     |
| 举报内容   | POST   | `/api/v1/community/reports`         | ✅  | 举报违规内容   |
| 搜索对局   | GET    | `/api/v1/community/search`          | ❌  | 按标签/作者搜索 |

---

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
```

---

## 八、错误码对照表

| code | 含义         |
| ---- | ---------- |
| 0    | 成功         |
| 1001 | 参数错误       |
| 1002 | 鉴权失败或JWT过期 |
| 1003 | 无权限访问      |
| 2001 | 用户不存在      |
| 3001 | 棋局不存在      |
| 4001 | 房间已满或密码错误  |
| 5001 | 服务器内部错误    |

---

## 九、附录：接口鉴权规则

* `Authorization: Bearer <token>`
* Redis 存储黑名单，用于登出/失效 token 管理。

---
