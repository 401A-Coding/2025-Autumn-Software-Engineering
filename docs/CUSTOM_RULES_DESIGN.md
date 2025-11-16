# 自定义棋局规则系统设计文档

## 📋 概述

这是一个灵活、可扩展的中国象棋自定义规则系统，允许玩家自定义棋子行为和游戏规则。

## 🏗️ 架构设计

### 文件结构

```
frontend/src/features/chess/
├── ruleEngine.ts      # 核心规则引擎（新建）
├── rulePresets.ts     # 预设规则库（新建）
├── types.ts           # 类型定义（已有）
├── rules.ts           # 标准规则（已有）
└── Board.tsx          # 棋盘组件（已有）
```

### 为什么新建专门的文件？

#### ✅ **答案：是的，应该新建专门文件**

**理由：**
1. **职责分离** - 自定义规则逻辑独立于标准规则
2. **可维护性** - 每个文件专注单一功能
3. **可扩展性** - 方便未来添加更多规则变体
4. **代码组织** - 避免单文件过于臃肿

## 📦 核心数据结构

### 1. MovePattern（移动模式）

定义单个棋子的一种走法：

```typescript
interface MovePattern {
    dx: number              // X方向偏移
    dy: number              // Y方向偏移
    direction?: Direction   // 移动方向类型
    repeat?: boolean        // 是否可以重复（如车）
    maxSteps?: number       // 最大步数
    conditions?: MoveCondition[]  // 移动条件
    jumpObstacle?: boolean  // 是否可以跳过障碍
    captureOnly?: boolean   // 仅用于吃子
    moveOnly?: boolean      // 仅用于移动
}
```

**示例：**
```typescript
// 车的前进走法
{ dx: 0, dy: 1, repeat: true }

// 马的日字走法
{ dx: 1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] }

// 炮的吃子走法
{ dx: 0, dy: 1, repeat: true, captureOnly: true, 
  conditions: [{ type: 'path', obstacleCount: 1 }] }
```

### 2. MoveCondition（移动条件）

定义走法的限制条件：

```typescript
interface MoveCondition {
    type: 'position' | 'state' | 'target' | 'path'
    
    // 位置条件
    inPalace?: boolean           // 必须在九宫内
    crossedRiver?: boolean       // 是否已过河
    notCrossedRiver?: boolean    // 是否未过河
    
    // 状态条件
    isFirstMove?: boolean        // 是否首次移动
    
    // 目标条件
    targetEmpty?: boolean        // 目标必须为空
    targetEnemy?: boolean        // 目标必须是敌方
    
    // 路径条件
    hasNoObstacle?: boolean      // 路径无阻碍
    obstacleCount?: number       // 路径障碍物数量
}
```

**应用场景：**
- 兵过河后才能左右移动：`crossedRiver: true`
- 象不能塞象眼：`hasNoObstacle: true`
- 炮吃子需要炮架：`obstacleCount: 1`

### 3. PieceRuleConfig（棋子规则配置）

定义单个棋子的完整规则：

```typescript
interface PieceRuleConfig {
    name: string                 // 棋子名称
    description?: string         // 规则描述
    movePatterns: MovePattern[]  // 所有移动模式
    
    // 全局限制
    restrictions: {
        canJump?: boolean            // 是否可以跳过其他棋子
        canCrossRiver?: boolean      // 是否可以过河
        mustStayInPalace?: boolean   // 是否必须待在九宫
        maxMoveDistance?: number     // 最大移动距离
        minMoveDistance?: number     // 最小移动距离
    }
    
    // 特殊能力
    specialAbilities?: {
        canCaptureMultiple?: boolean // 一次吃多个
        canPromote?: boolean         // 可以升变
        hasCooldown?: boolean        // 有冷却时间
        canTeleport?: boolean        // 可以瞬移
    }
    
    // 吃子规则
    captureRules?: {
        capturePattern?: MovePattern[]
        canCaptureKing?: boolean
        protectedPieces?: PieceType[]
    }
}
```

### 4. CustomRuleSet（自定义规则集）

定义完整的游戏规则：

```typescript
interface CustomRuleSet {
    // 规则集信息
    id?: string
    name: string
    description?: string
    author?: string
    version?: string
    createdAt?: Date
    
    // 棋子规则
    pieceRules: {
        [key in PieceType]?: PieceRuleConfig
    }
    
    // 全局规则
    globalRules?: {
        allowFlyingGeneral?: boolean    // 是否允许飞将
        checkRequired?: boolean          // 是否必须应将
        stalemateIsDraw?: boolean       // 困毙是否和棋
        repetitionLimit?: number         // 重复次数限制
        moveTimeLimit?: number           // 每步时间限制
    }
    
    // 获胜条件
    winConditions?: {
        captureKing?: boolean           // 吃掉将帅获胜
        captureAllPieces?: boolean      // 吃光所有棋子获胜
        reachDestination?: boolean      // 到达特定位置获胜
        scoreThreshold?: number         // 积分达到阈值获胜
    }
}
```

## 🎮 预设规则

### 1. 标准中国象棋（standardChessRules）
- 遵循传统规则
- 所有限制都开启
- 适合正式对弈

### 2. 超级象棋（superChessRules）
- 所有棋子能力增强
- 将帅可以出九宫
- 象可以过河和塞象眼
- 马可以蹩马腿
- 炮可以跳跃
- 兵从开局就可以左右移动

### 3. 现代象棋（modernChessRules）
- 简化规则，适合新手
- 象可以过河
- 马可以蹩马腿
- 兵从开局就可以全向移动

### 4. 疯狂象棋（crazyChessRules）
- 极限模式
- 所有限制解除
- 将帅可以八方移动
- 所有棋子都可以跳跃
- 兵可以八方移动

## 🔧 核心功能

### 规则生成器

```typescript
// 根据规则配置生成所有合法走法
generateMovesFromRules(
    board: Board,
    from: Pos,
    ruleConfig: PieceRuleConfig,
    side: Side
): Pos[]
```

**工作流程：**
1. 遍历所有 `movePatterns`
2. 对每个模式调用 `generateMovesFromPattern`
3. 检查移动条件 `checkMoveConditions`
4. 检查全局限制 `checkRestrictions`
5. 应用距离限制
6. 返回所有合法位置

### 辅助函数

```typescript
// 调整方向（红方向上为负，黑方向上为正）
adjustDyForSide(dy: number, side: Side): number

// 判断是否在九宫内
isPalace(x: number, y: number, side: Side): boolean

// 检查路径是否有障碍物
checkPathHasObstacle(board: Board, from: Pos, to: Pos): boolean

// 计算路径上的障碍物数量
countObstaclesInPath(board: Board, from: Pos, to: Pos): number
```

## 💡 使用示例

### 1. 使用预设规则

```typescript
import { standardChessRules, superChessRules } from './rulePresets'
import { generateMovesFromRules } from './ruleEngine'

// 获取标准规则下的将帅走法
const kingRule = standardChessRules.pieceRules.general
const moves = generateMovesFromRules(board, { x: 4, y: 9 }, kingRule, 'red')

// 使用超级规则
const superKingRule = superChessRules.pieceRules.general
const superMoves = generateMovesFromRules(board, { x: 4, y: 9 }, superKingRule, 'red')
```

### 2. 创建自定义规则

```typescript
// 创建一个可以瞬移的将帅
const teleportKingRule: PieceRuleConfig = {
    name: '瞬移将帅',
    description: '可以瞬移到任意位置',
    movePatterns: [
        // 正常移动
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
    ],
    restrictions: {
        mustStayInPalace: false,
        canJump: true,
        canCrossRiver: true,
    },
    specialAbilities: {
        canTeleport: true,
    },
}

// 创建一个超级兵
const superPawnRule: PieceRuleConfig = {
    name: '超级兵',
    description: '可以八方移动，过河后可以连走两步',
    movePatterns: [
        // 八方移动
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
        // 过河后可以走两步
        { dx: 0, dy: 2, conditions: [{ type: 'position', crossedRiver: true }] },
    ],
    restrictions: {
        canJump: false,
        canCrossRiver: true,
    },
}
```

### 3. 组合成完整规则集

```typescript
const myCustomRules: CustomRuleSet = {
    name: '我的自定义规则',
    description: '混合了多种变体',
    version: '1.0.0',
    pieceRules: {
        general: teleportKingRule,
        soldier: superPawnRule,
        // ... 其他棋子使用标准规则
        horse: standardChessRules.pieceRules.horse,
        rook: standardChessRules.pieceRules.rook,
    },
    globalRules: {
        allowFlyingGeneral: true,
        checkRequired: false,
    },
    winConditions: {
        captureKing: true,
        captureAllPieces: true,  // 吃掉将帅或所有棋子都获胜
    },
}
```

## 🔄 与现有系统集成

### 在 Board 组件中使用

```typescript
// Board.tsx
import { generateMovesFromRules } from './ruleEngine'
import type { CustomRuleSet } from './ruleEngine'

interface BoardProps {
    customRules?: CustomRuleSet
}

function Board({ customRules }: BoardProps) {
    // 如果有自定义规则，使用自定义规则生成走法
    if (customRules && piece) {
        const ruleConfig = customRules.pieceRules[piece.type]
        if (ruleConfig) {
            moves = generateMovesFromRules(board, selected, ruleConfig, piece.side)
        }
    } else {
        // 否则使用标准规则
        moves = generateLegalMoves(board, selected)
    }
}
```

## 🎯 扩展性设计

### 1. 添加新的移动条件

在 `MoveCondition` 中添加新字段：

```typescript
interface MoveCondition {
    // ... 现有字段
    
    // 新增：天气条件
    weatherDependent?: 'sunny' | 'rainy' | 'snowy'
    
    // 新增：时间条件
    timeOfDay?: 'day' | 'night'
}
```

### 2. 添加新的棋子能力

在 `specialAbilities` 中添加：

```typescript
specialAbilities?: {
    // ... 现有能力
    
    // 新增：可以交换位置
    canSwapPosition?: boolean
    
    // 新增：可以召唤援军
    canSummon?: boolean
}
```

### 3. 添加新的获胜条件

```typescript
winConditions?: {
    // ... 现有条件
    
    // 新增：收集宝物获胜
    collectTreasures?: number
    
    // 新增：坚守回合数获胜
    surviveRounds?: number
}
```

## 📊 性能考虑

1. **缓存规则** - 规则配置可以缓存，避免重复解析
2. **延迟计算** - 只在需要时计算走法
3. **剪枝优化** - 在生成走法时尽早终止不合法的分支

## 🧪 测试建议

```typescript
// 测试标准走法
test('标准将帅只能在九宫内移动', () => {
    const rule = standardChessRules.pieceRules.general
    const moves = generateMovesFromRules(board, { x: 4, y: 9 }, rule, 'red')
    // 验证所有走法都在九宫内
    moves.forEach(move => {
        expect(move.x).toBeGreaterThanOrEqual(3)
        expect(move.x).toBeLessThanOrEqual(5)
        expect(move.y).toBeGreaterThanOrEqual(7)
        expect(move.y).toBeLessThanOrEqual(9)
    })
})

// 测试自定义规则
test('超级将帅可以出九宫', () => {
    const rule = superChessRules.pieceRules.general
    const moves = generateMovesFromRules(board, { x: 4, y: 9 }, rule, 'red')
    // 验证可以有九宫外的走法
    const outsidePalace = moves.some(move => 
        move.x < 3 || move.x > 5 || move.y < 7 || move.y > 9
    )
    expect(outsidePalace).toBe(true)
})
```

## 📝 总结

这个系统提供了：

✅ **完整的数据结构** - 从单个走法到完整规则集  
✅ **灵活的配置** - 支持多种限制条件和特殊能力  
✅ **丰富的预设** - 4种预设规则供参考  
✅ **易于扩展** - 模块化设计，方便添加新功能  
✅ **类型安全** - 完整的 TypeScript 类型定义  

你可以基于这个系统创造无限多的象棋变体！🎮
