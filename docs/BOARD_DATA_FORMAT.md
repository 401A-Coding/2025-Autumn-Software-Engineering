# 本地对局数据格式说明

## 概述

本文档说明了前端棋盘格式与 API 定义格式之间的转换关系。

## 前端内部格式 (types.ts)

前端使用**二维数组**表示棋盘,便于快速访问和渲染:

```typescript
type Board = (Piece | null)[][]  // [y][x], 10行9列

interface Piece {
  id: string              // 唯一标识,如 "red-rook-0"
  type: PieceType         // 棋子类型
  side: 'red' | 'black'   // 所属方
}

// 使用示例
const piece = board[3][4]  // 获取第4行第5列的棋子
```

## API 格式 (api.d.ts)

后端 API 使用**扁平数组 + 坐标**的格式,便于存储和传输:

```typescript
interface Board {
  id?: number
  name?: string           // 棋局名称,如 "中炮对屏风马"
  description?: string    // 描述
  layout?: {
    pieces?: {
      type: string      // 棋子类型,如 "rook"
      x: number         // X坐标 (0-8)
      y: number         // Y坐标 (0-9)
      side: 'red' | 'black'
    }[]
  }
  rules?: Record<string, never>
}
```

## 格式转换 (boardAdapter.ts)

提供了双向转换函数:

### 前端 → API

```typescript
import { boardToApiFormat } from '@/features/chess/boardAdapter'
import { createInitialBoard } from '@/features/chess/types'

const board = createInitialBoard()
const apiBoard = boardToApiFormat(board, '标准开局', '象棋标准初始布局')
```

### API → 前端

```typescript
import { apiBoardToLocalFormat } from '@/features/chess/boardAdapter'

const apiBoard = await boardApi.get(123)
const localBoard = apiBoardToLocalFormat(apiBoard)
```

## API 服务 (services/api.ts)

提供了完整的 Board 和 Battle 相关接口:

### 棋盘 API

```typescript
import { boardApi } from '@/services/api'

// 获取模板列表
const templates = await boardApi.getTemplates()

// 创建自定义棋盘
const result = await boardApi.create({
  name: '残局练习-1',
  description: '车马炮残局',
  layout: {
    pieces: [
      { type: 'general', x: 4, y: 9, side: 'red' },
      { type: 'rook', x: 0, y: 9, side: 'red' },
      // ...
    ]
  },
  rules: {}
})

// 获取我的棋盘
const myBoards = await boardApi.getMine(1, 20)

// 删除棋盘
await boardApi.delete(123)
```

### 对局 API

```typescript
import { battleApi } from '@/services/api'

// 创建对局房间
const battle = await battleApi.create({
  mode: 'pvp',
  initialBoardId: 301,  // 可选:使用自定义棋盘
  fogMode: false,
  password: null
})

// 快速匹配
const match = await battleApi.match('pvp')

// 加入对局
const joined = await battleApi.join(501, 'password')

// 获取对局历史
const history = await battleApi.getHistory(1, 20)
```

## 数据流示例

### 保存当前棋局

```typescript
// 1. 获取当前棋盘状态 (前端格式)
const currentBoard: Board = getCurrentBoardState()

// 2. 转换为 API 格式
const apiBoard = boardToApiFormat(currentBoard, '我的残局', '练习用')

// 3. 调用 API 保存
const result = await boardApi.create({
  name: apiBoard.name!,
  description: apiBoard.description,
  layout: apiBoard.layout!,
  rules: apiBoard.rules || null
})

console.log(`已保存,ID: ${result.boardId}`)
```

### 加载自定义棋局

```typescript
// 1. 从 API 获取棋盘
const apiBoard = await boardApi.get(301)

// 2. 转换为前端格式
const localBoard = apiBoardToLocalFormat(apiBoard)

// 3. 应用到游戏状态
setState({ board: localBoard, turn: 'red', ... })
```

## 注意事项

1. **坐标系统**: 
   - 前端: `board[y][x]` (行列索引)
   - API: `{ x, y }` (直角坐标)
   - 均为 0-based: x ∈ [0,8], y ∈ [0,9]

2. **棋子类型映射**:
   ```
   general  → 将/帅
   advisor  → 士/仕
   elephant → 象/相
   horse    → 马
   rook     → 车
   cannon   → 炮
   soldier  → 兵/卒
   ```

3. **后端实现状态**:
   - ✅ 已定义 API 接口规范 (api.d.ts)
   - ✅ 已实现前端转换器和服务层
   - ❌ 后端 Board/Battle 模块尚未实现
   - 需要创建: `backend/src/modules/board/`, `backend/src/modules/battle/`

4. **类型安全**:
   - api.d.ts 由 openapi-typescript 自动生成
   - 修改 docs/openapi.yaml 后重新生成类型
