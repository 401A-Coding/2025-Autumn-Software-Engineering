# 自定义棋局数据结构快速参考

## 📚 核心结构层次

```
CustomRuleSet (规则集)
├── pieceRules (棋子规则)
│   └── PieceRuleConfig (单个棋子配置)
│       ├── movePatterns (移动模式数组)
│       │   └── MovePattern (单个走法)
│       │       └── conditions (条件数组)
│       │           └── MoveCondition (单个条件)
│       ├── restrictions (全局限制)
│       ├── specialAbilities (特殊能力)
│       └── captureRules (吃子规则)
├── globalRules (全局规则)
└── winConditions (获胜条件)
```

## 🎯 MovePattern（走法定义）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `dx` | `number` | X方向偏移 | `1`, `-1`, `0` |
| `dy` | `number` | Y方向偏移 | `1`, `-1`, `0` |
| `repeat` | `boolean?` | 是否可重复 | `true`（车），`false`（将） |
| `maxSteps` | `number?` | 最大步数 | `3`（限制3步） |
| `jumpObstacle` | `boolean?` | 可跳过障碍 | `true`（马跳） |
| `captureOnly` | `boolean?` | 仅吃子用 | `true`（炮吃） |
| `moveOnly` | `boolean?` | 仅移动用 | `true`（炮移） |
| `conditions` | `MoveCondition[]?` | 条件列表 | 见下表 |

## ⚙️ MoveCondition（条件限制）

| 条件 | 类型 | 说明 |
|------|------|------|
| **位置条件** |||
| `inPalace` | `boolean?` | 必须在九宫内 |
| `crossedRiver` | `boolean?` | 是否已过河 |
| `notCrossedRiver` | `boolean?` | 是否未过河 |
| **目标条件** |||
| `targetEmpty` | `boolean?` | 目标必须为空 |
| `targetEnemy` | `boolean?` | 目标必须是敌方 |
| **路径条件** |||
| `hasNoObstacle` | `boolean?` | 路径无阻碍（象、马） |
| `obstacleCount` | `number?` | 路径障碍物数量（炮=1） |

## 🛡️ Restrictions（全局限制）

| 限制 | 类型 | 说明 |
|------|------|------|
| `canJump` | `boolean?` | 可以跳过其他棋子 |
| `canCrossRiver` | `boolean?` | 可以过河 |
| `mustStayInPalace` | `boolean?` | 必须待在九宫 |
| `maxMoveDistance` | `number?` | 最大移动距离 |
| `minMoveDistance` | `number?` | 最小移动距离 |

## ⭐ SpecialAbilities（特殊能力）

| 能力 | 类型 | 说明 |
|------|------|------|
| `canCaptureMultiple` | `boolean?` | 一次吃多个子 |
| `canPromote` | `boolean?` | 可以升变 |
| `hasCooldown` | `boolean?` | 有冷却时间 |
| `canTeleport` | `boolean?` | 可以瞬移 |

## 🎯 常用模式速查

### 直线移动（车）
```typescript
{ dx: 0, dy: 1, repeat: true }   // 向前无限
{ dx: 0, dy: -1, repeat: true }  // 向后无限
{ dx: -1, dy: 0, repeat: true }  // 向左无限
{ dx: 1, dy: 0, repeat: true }   // 向右无限
```

### 一步移动（将）
```typescript
{ dx: 0, dy: 1 }    // 前
{ dx: 0, dy: -1 }   // 后
{ dx: -1, dy: 0 }   // 左
{ dx: 1, dy: 0 }    // 右
```

### 斜线移动（士）
```typescript
{ dx: 1, dy: 1 }    // 右前
{ dx: 1, dy: -1 }   // 右后
{ dx: -1, dy: 1 }   // 左前
{ dx: -1, dy: -1 }  // 左后
```

### 马的日字
```typescript
{ dx: 1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: 1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: -1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: -1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: 2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: 2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: -2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] }
{ dx: -2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] }
```

### 象的田字
```typescript
{ dx: 2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] }
{ dx: 2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] }
{ dx: -2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] }
{ dx: -2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] }
```

### 兵的过河规则
```typescript
// 未过河：只能前进
{ dx: 0, dy: 1, conditions: [{ type: 'position', notCrossedRiver: true }] }

// 过河后：可以前进和左右
{ dx: 0, dy: 1, conditions: [{ type: 'position', crossedRiver: true }] }
{ dx: -1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] }
{ dx: 1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] }
```

### 炮的移动和吃子
```typescript
// 移动（不吃子）
{ dx: 0, dy: 1, repeat: true, moveOnly: true }

// 吃子（需要炮架）
{ 
    dx: 0, 
    dy: 1, 
    repeat: true, 
    captureOnly: true, 
    conditions: [{ type: 'path', obstacleCount: 1 }] 
}
```

## 🔧 完整示例

### 标准将帅
```typescript
const kingRule: PieceRuleConfig = {
    name: '将/帅',
    description: '只能在九宫内移动，每次走一格',
    movePatterns: [
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
    ],
    restrictions: {
        mustStayInPalace: true,
        canJump: false,
        canCrossRiver: false,
    },
}
```

### 超级将帅
```typescript
const superKingRule: PieceRuleConfig = {
    name: '超级将帅',
    description: '可以在整个棋盘移动',
    movePatterns: [
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
    ],
    restrictions: {
        mustStayInPalace: false,  // 可以出九宫
        canJump: false,
        canCrossRiver: true,      // 可以过河
    },
}
```

### 疯狂车（可跳跃）
```typescript
const crazyRookRule: PieceRuleConfig = {
    name: '疯狂车',
    description: '可以跳过其他棋子',
    movePatterns: [
        { dx: 0, dy: 1, repeat: true },
        { dx: 0, dy: -1, repeat: true },
        { dx: -1, dy: 0, repeat: true },
        { dx: 1, dy: 0, repeat: true },
    ],
    restrictions: {
        canJump: true,           // 可以跳跃
        canCrossRiver: true,
    },
}
```

## 📋 预设规则速览

| 预设 | 特点 | 适用场景 |
|------|------|----------|
| `standardChessRules` | 完全遵循传统规则 | 正式对弈 |
| `superChessRules` | 所有棋子增强 | 趣味对战 |
| `modernChessRules` | 简化规则 | 新手学习 |
| `crazyChessRules` | 无限制极限模式 | 娱乐模式 |

## 🚀 快速上手

```typescript
import { standardChessRules, superChessRules } from './rulePresets'
import { generateMovesFromRules } from './ruleEngine'

// 1. 使用预设规则
const rule = standardChessRules.pieceRules.general
const moves = generateMovesFromRules(board, pos, rule, 'red')

// 2. 创建自定义规则
const myRule: PieceRuleConfig = {
    name: '我的棋子',
    movePatterns: [{ dx: 0, dy: 1 }],
    restrictions: { canJump: false }
}

// 3. 组合成规则集
const myRuleSet: CustomRuleSet = {
    name: '我的规则',
    pieceRules: {
        general: myRule,
        // ... 其他棋子
    }
}
```

## 💡 设计原则

1. **组合优于继承** - 通过组合 `MovePattern` 构建复杂规则
2. **明确优于隐式** - 所有限制都明确声明
3. **扩展性优先** - 易于添加新功能
4. **类型安全** - 完整的 TypeScript 类型支持
