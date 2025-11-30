# 对战模块功能现状与规划

## 一、当前已实现功能概览

### 1. 房间与匹配流程

- 支持三种入口：创建房间、加入房间、快速匹配（`OnlineLobby` + `LiveBattle`）。
- 创建好友房：调用 `battleApi.create` 创建 `source='room'` 的对局，自动进入房间。
- 加入房间：输入房间号 → `battleApi.join` 入座 → WebSocket `battle.join` 加入房间并拉取快照。
- 快速匹配：调用 `battleApi.match('pvp')` 进行匹配，成功后进入对应对局。
- 未开局房间支持取消：
  - 匹配中的房间可取消匹配（`battleApi.cancel`）。
  - 好友房房主可取消房间（`battleApi.cancel`）。

### 2. 实时对局与同步

- 使用 Socket.IO 命名空间 `${VITE_API_BASE}/battle`：
  - `battle.join`：加入对局，支持 `lastSeq` 增量补发。
  - `battle.move`：客户端发起走子请求，服务端裁判并广播，附带 clientRequestId 与 3s ack 超时保护。
  - `battle.snapshot`：请求/推送权威快照（棋盘、轮次、玩家、走子列表等）。
  - `battle.player_join`：有玩家进入房间时触发，用于前端主动刷新快照。
- 前端 `LiveBattle`：
  - 使用 `snapshot` + `movesRef` 维护权威棋盘与本地走子列表。
  - 对 WS move 做乱序与缺步防护：seq 不连续时主动拉 `snapshot` 对齐；600ms 内没收到包含该步的权威快照也会兜底拉一次。
  - 棋盘渲染由 `OnlineBoard` 完成，对局控制逻辑集中在 `LiveBattle`。

### 3. 对局状态与结束逻辑

- 后端 `BattleState` / `snapshot()`：
  - 维护 `status: 'waiting' | 'playing' | 'finished'`、`winnerId`、`finishReason`、`onlineUserIds`、`stateHash`、`source`、`visibility`、`ownerId` 等字段。
  - `finish()` 统一封装所有结束路径（将死、超时、断线 TTL、认输、和棋等），并触发事件给 Gateway 广播最新快照。
- 认输：
  - `BattlesService.resign(userId, battleId)`：只允许在当前对局中的玩家主动认输，判对手获胜，`finishReason='resign'`。
  - 前端对齐业务语义：
    - 对局未开始：`status='waiting'` 且玩家 < 2，"退出" = 取消房间（`battleApi.leave`），不会记作认输。
    - 对局已开始："退出" = 认输，弹出确认框，后发 `battleApi.resign` 并在本地给出判负提示与倒计时。
- 结束 UI：
  - 顶部 `livebattle-end-banner` 显示结束横幅，依据 `finishReason + winnerId + myUserId` 映射为：
    - 对手认输、自己认输。
    - 将死胜/负。
    - 超时胜/负/双超平局。
    - 断线 TTL 胜/负/平局。
    - 和棋（双方同意）。
  - 横幅区分 win/lose/draw/info 四种视觉风格，带淡入动画。
  - 默认文本始终提示「对局记录可在『历史对局』中查看」，并提供 3 秒自动返回大厅 + "立即返回大厅" 按钮。
  - 若是观战或尚未拿到当前用户信息（`myUserId` 为空），也会至少展示通用的「对局已结束」提示，避免完全无反馈。

### 4. 在线状态与心跳

- 后端在线状态：
  - `setOnline(battleId, userId, online)` 基于连接与心跳维护 `onlineUserIds`。
  - `evaluateDisconnectTtl` 在所有玩家长时间离线时触发 `disconnect_ttl` 判局。
- 前端心跳与展示：
  - 在 `inRoom && connected` 时每 20 秒发送一次心跳，保持在线状态。
  - 玩家列表高亮在线玩家，对当前用户加 "(我)" 标记。
  - Socket 断线时在对局页展示黄色横幅，提示正在尝试重连并提供手动重试按钮。

### 5. 生命周期与容错

- 退出逻辑：
  - 未入房时直接返回大厅。
  - 未开局房间退出 → 取消房间（或离开），带确认提示，成功后清理本地状态并返回大厅。
  - 已开局退出 → 认输，调用 `battleApi.resign`，无论接口是否异常，本地都会显示认输提示与倒计时。
- 状态兜底：
  - 在 `inRoom && !finished` 时前端每 10 秒通过 REST `battleApi.snapshot` 拉一次快照：
    - 仅当服务端 `stateHash` 不同且 moves 更“新”时才覆盖本地，防止回退。
  - 统一的 `status` 三态展示：等待中 / 对局中 / 已结束。
- React 状态同步：
  - 通过 `useMemo([myUserId])` 保证 `connectBattle` 内部闭包拿到最新的 `myUserId`，修复了赢家端看不到正确结束提示的问题。

---

## 二、可扩展的新功能方向

> 本节是“可以做”的功能池，可以按优先级逐步实现。

### 1. 对局内聊天 / 预设短语

- 动机：增强对战过程中的社交感（特别是好友房）。
- 思路：
  - 在 WebSocket 命名空间中新增 `battle.chat` 事件（带 `userId`、内容、时间戳）。
  - Gateway 接收信息后进行权限校验（必须在该房间），再广播到房间内所有连接。
  - 前端在 `LiveBattle` 右侧增加简易聊天栏或若干预设短语按钮（如“加油”“好棋”“再来一局？”）。

### 2. 和棋/悔棋请求（双边确认）

- 动机：更贴近真实象棋礼仪，给玩家更多选择。
- 思路：
  - 新增 WebSocket 事件：
    - `battle.offer_draw` / `battle.respond_draw(accept: boolean)`；
    - `battle.request_undo` / `battle.respond_undo(accept: boolean)`。
  - 服务端在 `BattleState` 中记录当前挂起的请求（发起方、类型、时间），超时自动作废。
  - 若对方接受和棋 → 调用 `finish`，`finishReason='draw_agreed'`；
  - 若对方接受悔棋 → 回滚最近一步或几步，并广播新的 snapshot。
  - 前端展示为轻量的“对方向你发起和棋/悔棋请求”提示条，带接受/拒绝按钮。

### 3. 对局计时（棋钟 / 步时）

- 动机：防止无限拖延，增加紧张感与竞技性。
- 思路：
  - 在 `BattleState` 中扩展每方剩余时间与最后计时起点（如 `timeLeftRed/timeLeftBlack/lastTickAt`）。
  - 每次 `move` 时由后端统一结算上一方耗时并减少其剩余时间。
  - 超时后由后端判负（沿用现有 `finishReason='timeout'`）。
  - snapshot 携带剩余时间；前端使用 `setInterval` 进行 UI 级别倒计时展示。

### 4. 历史对局与复盘增强

- 动机：让玩家能在赛后复盘、查看战绩。
- 现状：后端已有 `history(userId, page, pageSize)` 和 `BattleSnapshot` 的基础结构。
- 思路：
  - 前端新建“历史对局”列表页：展示对手 ID、结果（胜/负/和）、结束原因、时长、模式等。
  - 单局详情页：复用 `OnlineBoard`，基于 `moves` 做“下一步/上一步/自动播放”复盘功能。
  - 顶部复用当前结束横幅文案逻辑，展示终局原因与输赢。

### 5. 观战模式 / 分享观战链接

- 动机：支持围观和教学场景。
- 思路：
  - 扩展对局访问权限，允许非 `players` 用户通过某个链接 `battle.join` 进入“观战席”。
  - 观战者不出现在 `players` 数组，只会体现在 `onlineUserIds` 或单独的 `spectators` 列表中。
  - Gateway 的 `onMove` 拒绝非玩家身份的走子请求。
  - 前端：房间条增加“复制观战链接”，并在玩家区域下方展示观战人数或观战者列表。

### 6. 匹配分段 / 段位系统（中长期）

- 动机：提高匹配公平性与游戏黏性。
- 思路：
  - 在 `User` 模型中维护 rating / 段位，简单起步可使用 Elo：记录 `rating` 与 K 系数常量。
  - `quickMatch` 时优先在 rating 接近的玩家间配对。
  - 历史对战与个人主页显示 rating 走势、胜率等基础统计。

---

## 三、工程与体验层面的优化点

### 1. 前端代码结构与复用

- `LiveBattle.tsx` 职责较多，可做适度拆分：
  - 拆出：
    - `LiveBattleEndBanner`（结束横幅组件）；
    - `LiveBattleRoomBar`（房间号 + 退出/取消按钮区域）；
    - `LiveBattlePlayers`（玩家与在线状态展示）；
    - 甚至将 WS 连接与状态管理抽成 `useBattleConnection` 自定义 Hook。
  - 将结束文案映射从组件中抽离到纯函数（例如 `mapBattleEndMessage(snapshot, myUserId)`），便于单元测试与在复盘页重用。

### 2. 日志与调试信息

- 当前存在大量 `console.log` 与 `window.battleDebug`：
  - 建议只在开发模式下启用：使用 `if (import.meta.env.DEV) { ... }` 包裹；
  - 或者统一引入轻量日志工具，支持根据环境开关日志级别；
  - 避免在生产环境暴露过多内部结构。

### 3. 类型安全与前后端对齐

- 现在前端 `finishReason` 类型是 `string | null`，而实际只有有限几种：`'resign' | 'checkmate' | 'timeout' | 'disconnect_ttl' | 'draw_agreed' | ...`。
- 可以：
  - 在前后端都定义 `type FinishReason = 'resign' | 'checkmate' | 'timeout' | 'disconnect_ttl' | 'draw_agreed' | 'other';`；
  - 前端 `BattleSnapshot.finishReason` 使用该 union 类型，减少魔法字符串；
  - 未来如在 `API_SPEC` 里扩展结束原因时只需更新一个地方。

### 4. 错误提示与交互体验

- 目前主要使用 `alert` 弹窗提示错误：
  - 可以替换为统一的 toast/snackbar 组件，支持队列与自动消失；
  - 区分可重试（网络波动）与业务错误（房间不存在、无权限、已结束等），给出更清晰指导文案。
- 认输确认弹窗可以强化视觉提醒（如加粗“将直接判负”），防止误触。

### 5. 断线与自动重连策略

- 现有逻辑偏向“提示 + 手动重试”：
  - 可以增加指数退避的自动重连策略（1s、2s、4s、8s 上限），在数次失败后再提示用户；
  - 重连成功后自动 `join + snapshot` 的逻辑已经有，可以再加一条轻量提示“已为你恢复对局”。

### 6. 后端可观测性与监控

- `BattlesService` 已预留可选的 `MetricsService` 注入：
  - 可统计：总对局数、按结束原因分布（resign/checkmate/timeout/disconnect_ttl/draw 等）、平均对局时长、平均步数等；
  - 日志中增加 requestId/clientRequestId，有助于排查走子乱序或重复 ack 问题。

---

## 四、后续迭代建议（优先级草案）

1. **短期（体验提升大、改动集中在前端）**
   - 抽离结束横幅文案逻辑为工具函数，并在历史对局页面重用。
   - 增加“历史对局列表 + 单局复盘”基础版本（只读回放，不含棋钟）。
   - 清理调试日志，在开发模式下用 `battleDebug` 调试工具替代生产日志。

2. **中期（需要前后端协同）**
   - 对局内聊天或预设短语。
   - 和棋/悔棋双边确认流程。
   - 自动重连策略优化 + 更完善的断线提示。

3. **长期（偏架构/竞技向）**
   - 对局计时（棋钟/步时）与超时规则完善。
   - 观战模式与分享链接。
   - 匹配分段 / 段位系统，结合战绩与 rating。

> 本文档可以作为对战模块的“路线图”，后续每次实现一个新功能或优化点时，建议在对应小节下补充“已完成/剩余工作”简短说明，便于团队协作与演进追踪。
