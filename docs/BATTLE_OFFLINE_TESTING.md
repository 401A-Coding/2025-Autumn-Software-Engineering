# 对局离线通知测试指南

## 功能概述

当玩家通过浏览器后退、刷新或关闭标签页离开对局时，系统会：

1. 立即向对方发送离线信号（通过 WebSocket 或 REST fallback）
2. 对手立即看到"对手掉线"的提示
3. 离开的玩家有 2 分钟的宽限期可以重新进入对局
4. 如果 2 分钟内没有重新进入，系统自动判负（或后端 15 分钟 TTL 自动裁定）

## 测试场景

### 场景 1: WebSocket 离线信号（正常情况）

**步骤**:

1. 打开浏览器，进入 <http://localhost:5173>
2. 登录两个不同的账号（用户 A 和 用户 B）
   - 在一个标签页：用户 A 登录
   - 在另一个标签页：用户 B 登录
3. A 发起对局（快速匹配或自定义）
4. B 加入对局
5. A 点击浏览器的后退按钮（或点击页面中的"返回大厅"按钮）
6. **期望结果**：
   - A 被导航回大厅
   - B 的页面上立即显示"对手掉线，等待重连…"的黄色横幅
   - B 的控制台中应有日志：`[offline_notice] received offline_notice`
   - A 的控制台中应有日志：`[popstate] firing offline signal`

### 场景 2: REST 离线信号（WebSocket 失败时）

**前置条件**：在浏览器开发者工具中禁用 WebSocket 或模拟网络延迟

**步骤**:

1. 打开浏览器开发者工具 (F12)
2. 在 Network 标签中，设置网络限流为"Slow 3G"或离线
3. 重复场景 1 的步骤 1-5
4. **期望结果**：
   - A 的控制台中应有日志：`[unmount] REST offline sent via fetch with keepalive`
   - B 仍然能收到离线通知（通过后端广播 REST 调用的结果）

### 场景 3: 自动认输（2 分钟后）

**步骤**:

1. 重复场景 1 的步骤 1-5
2. 观察 A 的日志，确认 grace resign timer 已启动：`[popstate] scheduling grace resign`
3. 等待 2 分钟
4. **期望结果**：
   - A 自动调用 resign API（可在后端日志中看到）
   - localStorage 中的 `livebattle.activeBattleId` 被清除
   - B 的对局如果已标记结束，会显示"对手长时间离线，本局判您获胜"

### 场景 4: 快速重连（2 分钟内）

**步骤**:

1. 重复场景 1 的步骤 1-5
2. 在 30 秒内，A 重新进入对局（刷新页面或打开新标签页进入 /app/live-battle?id=<battleId>）
3. **期望结果**：
   - A 成功恢复对局
   - grace resign timer 被清除（`clearGraceResign` 调用）
   - B 的"对手掉线"横幅消失（因为 A 重新上线）

## 日志检查清单

### 前端日志（浏览器控制台）

- A 离开时：

  ```
  [popstate] firing offline signal for id=...
  [popstate] scheduling grace resign for id=...
  [popstate] executing back immediately
  [unmount] cleanup: starting for battleId=...
  ```

- B 收到通知时：

  ```
  [offline_notice] received offline_notice: {...}
  ```

### 后端日志

- offline 端点调用：

  ```
  [offline event] broadcasting for userId=..., battleId=...
  ```

- EventEmitter 事件：

  ```
  POST /api/v1/battles/:battleId/offline - 201 OK
  ```

## 常见问题排查

### Q: B 没有收到离线通知

**检查**:

1. 确保两个用户已成功加入同一对局
2. 检查后端日志中是否有 `[offline event] broadcasting` 消息
3. 检查 CORS 是否已启用（开发环境应自动启用）
4. 检查 Socket.IO 连接是否正常（B 应该连接到 `/battles` gateway）

### Q: 自动认输没有执行

**检查**:

1. 检查 grace resign timer 是否成功启动（应有日志 `scheduling grace resign`）
2. 确认 2 分钟已过（或在控制台手动 `clearTimeout(window.graceResignTimerRef)`）
3. 检查后端 resign API 是否有错误日志
4. 注意：如果页面在 2 分钟内关闭，timer 不会继续运行（这是 JavaScript 的限制）

### Q: REST fallback 没有执行

**检查**:

1. 在浏览器开发者工具的 Network 标签中观察 POST `/api/v1/battles/:battleId/offline` 请求
2. 检查请求的 Payload 中是否包含 `userId`
3. 确认响应状态码为 201（如果是 400，可能是参数错误）
4. 检查前端日志中是否有 `[unmount] REST offline failed` 或 `[unmount] REST offline sent`

## 环境要求

- 后端：<http://localhost:3000（NestJS）>
- 前端：<http://localhost:5173（Vite）>
- 数据库：PostgreSQL（Docker）
- 浏览器：支持 WebSocket 和 Fetch API 的现代浏览器

## 性能指标

- WebSocket 离线通知延迟：< 100ms
- REST 离线通知延迟：< 500ms（keepalive）
- 对手收到通知延迟：< 200ms（WebSocket）或 < 1000ms（REST）
