# 条件规则系统使用指南

## 概述

条件规则系统允许棋子根据**位置状态**动态改变移动规则:
- **过河前/后** (beforeRiver / afterRiver)
- **九宫内/外** (inPalace / outPalace)

这是从你的legacy代码中提取的核心功能。

## 核心概念

### 1. 规则定义 (RuleDefinition)

```typescript
interface RuleDefinition {
  // Pattern模式组合
  pattern?: string  // "row+col" | "cross1" | "diag1" | "forward"
  
  // 特殊模式
  special?: 'cannon'  // 炮的跳吃逻辑
  
  // 前进限制
  forward?: { max: number }  // 最多前进N步
  
  // 离散偏移量
  offsets?: { dr: number; dc: number }[]
  
  // 射线方向
  rays?: [number, number][]  // [[dr,dc], ...]
}
```

### 2. 条件规则 (ConditionalRules)

```typescript
interface ConditionalRules {
  base: RuleDefinition           // 基础规则(必须)
  beforeRiver?: Partial<RuleDefinition>  // 过河前覆盖
  afterRiver?: Partial<RuleDefinition>   // 过河后覆盖
  inPalace?: Partial<RuleDefinition>     // 宫内覆盖
  outPalace?: Partial<RuleDefinition>    // 宫外覆盖
}
```

## Pattern模式说明

### 基础模式
- `row`: 同行射线移动
- `col`: 同列射线移动
- `cross1`: 四邻移动(上下左右各1步)
- `diag1`: 斜移动(四对角各1步)
- `forward`: 前进N步(需配合`forward.max`)

### 组合模式
- `row+col`: 车的移动(直线)
- `cross1+diag1`: 八方移动

### 特殊模式
- `special: 'cannon'`: 炮的跳吃逻辑

## 使用示例

### 示例1: 标准兵卒规则

```typescript
const SOLDIER_RULE: ConditionalRules = {
  base: {
    forward: { max: 1 }  // 基础:前进1步
  },
  afterRiver: {
    forward: { max: 1 },
    offsets: [
      { dr: 0, dc: -1 },  // 过河后增加左移
      { dr: 0, dc: 1 }    // 过河后增加右移
    ]
  }
}
```

### 示例2: 超级兵

```typescript
const SUPER_SOLDIER: ConditionalRules = {
  base: {
    forward: { max: 2 }  // 未过河可前进2步
  },
  afterRiver: {
    pattern: 'cross1+diag1'  // 过河后八方移动
  }
}
```

### 示例3: 飞将

```typescript
const FLYING_GENERAL: ConditionalRules = {
  base: {
    pattern: 'cross1'  // 基础四邻
  },
  inPalace: {
    pattern: 'cross1'  // 宫内四邻
  },
  outPalace: {
    pattern: 'row+col'  // 出宫后直线飞行
  }
}
```

### 示例4: 进化炮

```typescript
const EVOLVING_CANNON: ConditionalRules = {
  base: {
    special: 'cannon'  // 未过河:标准炮
  },
  afterRiver: {
    pattern: 'row+col'  // 过河后变车
  }
}
```

## 在CustomRuleEditor中集成

### 步骤1: 导入模块

```typescript
import { 
  ConditionalRules, 
  RuleDefinition 
} from '../features/chess/conditionalRules'

import { 
  STANDARD_CONDITIONAL_RULES,
  createConditionalRule,
  generateMovesWithConditionalRules
} from '../features/chess/conditionalRulesAdapter'
```

### 步骤2: 扩展状态

```typescript
interface EditorState {
  // ...现有字段
  
  // 新增条件规则配置
  conditionalRules: {
    [pieceType: string]: ConditionalRules
  }
  
  // 当前编辑的条件分支
  editingCondition: 'base' | 'beforeRiver' | 'afterRiver' | 'inPalace' | 'outPalace'
}
```

### 步骤3: UI组件结构

```tsx
<div className="conditional-rule-editor">
  {/* 条件选择器 */}
  <div className="condition-selector">
    <button onClick={() => setEditingCondition('base')}>基础</button>
    <button onClick={() => setEditingCondition('beforeRiver')}>过河前</button>
    <button onClick={() => setEditingCondition('afterRiver')}>过河后</button>
    <button onClick={() => setEditingCondition('inPalace')}>宫内</button>
    <button onClick={() => setEditingCondition('outPalace')}>宫外</button>
  </div>

  {/* 规则编辑器(针对当前条件) */}
  <div className="rule-editor">
    {/* Pattern选择 */}
    <select 
      value={currentRule.pattern} 
      onChange={e => updatePattern(e.target.value)}
    >
      <option value="">无Pattern</option>
      <option value="row">同行</option>
      <option value="col">同列</option>
      <option value="row+col">直线(车)</option>
      <option value="cross1">四邻(将)</option>
      <option value="diag1">斜走(士)</option>
      <option value="cross1+diag1">八方</option>
    </select>

    {/* 特殊模式 */}
    <label>
      <input 
        type="checkbox" 
        checked={currentRule.special === 'cannon'}
        onChange={e => updateSpecial(e.target.checked ? 'cannon' : undefined)}
      />
      炮跳吃
    </label>

    {/* 前进限制 */}
    <label>
      最大前进步数:
      <input 
        type="number" 
        value={currentRule.forward?.max || 0}
        onChange={e => updateForward(parseInt(e.target.value))}
      />
    </label>

    {/* 自定义偏移 */}
    <button onClick={addOffset}>添加偏移量</button>
    {currentRule.offsets?.map((offset, i) => (
      <div key={i}>
        <input 
          type="number" 
          value={offset.dr} 
          onChange={e => updateOffset(i, 'dr', e.target.value)}
        />
        <input 
          type="number" 
          value={offset.dc} 
          onChange={e => updateOffset(i, 'dc', e.target.value)}
        />
        <button onClick={() => removeOffset(i)}>删除</button>
      </div>
    ))}
  </div>
</div>
```

### 步骤4: 应用规则

```typescript
function handleApplyRule() {
  const pieceType = selectedPiece // 'soldier', 'general', etc.
  
  // 构建条件规则
  const conditionalRule: ConditionalRules = {
    base: baseRule,
    beforeRiver: beforeRiverRule,
    afterRiver: afterRiverRule,
    inPalace: inPalaceRule,
    outPalace: outPalaceRule
  }
  
  // 保存到规则集
  setConditionalRules(prev => ({
    ...prev,
    [pieceType]: conditionalRule
  }))
  
  // 转换为CustomRules格式(兼容现有Board组件)
  const customRules = convertToCustomRules(conditionalRules)
  setCustomRuleSet(customRules)
}
```

## 在Board组件中使用

### 修改getLegalMoves函数

```typescript
import { generateMovesWithConditionalRules } from './conditionalRulesAdapter'

function getLegalMoves(
  board: Board, 
  from: Pos, 
  piece: Piece,
  conditionalRules?: ConditionalRuleSet
): Pos[] {
  // 1. 尝试条件规则
  if (conditionalRules) {
    const moves = generateMovesWithConditionalRules(
      board, 
      from, 
      piece.type, 
      piece.side, 
      conditionalRules
    )
    
    if (moves !== null) {
      // 过滤不留将的走法
      return moves.filter(to => !leavesKingInCheck(board, from, to, piece.side))
    }
  }
  
  // 2. 降级到标准规则
  return getStandardMoves(board, from, piece)
}
```

## 规则优先级

条件规则的应用顺序:
1. **base** (基础规则)
2. **beforeRiver/afterRiver** (河流条件覆盖)
3. **inPalace/outPalace** (九宫条件覆盖)

后面的条件会**覆盖**前面的属性。

## 完整示例:条件兵

```typescript
// 定义规则
const conditionalSoldier: ConditionalRules = {
  base: {
    // 默认:前进1步
    forward: { max: 1 }
  },
  afterRiver: {
    // 过河后:前进1步 + 左右移动
    forward: { max: 1 },
    offsets: [
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 }
    ]
  }
}

// 应用到规则集
const ruleSet: ConditionalRuleSet = {
  soldier: conditionalSoldier
}

// 在游戏中使用
const moves = generateMovesWithConditionalRules(
  board,
  { x: 4, y: 6 },  // 兵的位置
  'soldier',
  'red',
  ruleSet
)
```

## 调试技巧

### 1. 查看解析后的规则

```typescript
import { resolveRule } from './conditionalRules'

const effectiveRule = resolveRule(
  conditionalRule,
  row,    // 棋子行
  col,    // 棋子列
  isRed   // 是否红方
)

console.log('当前生效规则:', effectiveRule)
```

### 2. 预览模式

在编辑器中添加预览功能:

```typescript
function previewMoves(pieceType: PieceType, position: Pos) {
  const mockBoard = createTestBoard()
  const moves = generateMovesWithConditionalRules(
    mockBoard,
    position,
    pieceType,
    'red',
    conditionalRules
  )
  
  highlightMoves(moves)
}
```

## 注意事项

1. **条件互斥**: 同一棋子不能同时满足 beforeRiver 和 afterRiver
2. **空规则**: 如果某个条件下不想覆盖,不要设置该字段
3. **完整性**: base规则必须存在
4. **坐标系**: dr/dc 使用行列坐标(row/col),不是x/y

## 更多示例

查看 `conditionalRulesAdapter.ts` 中的预设规则:
- `STANDARD_CONDITIONAL_RULES`: 标准规则
- `SUPER_SOLDIER`: 超级兵
- `FLYING_GENERAL`: 飞将
- `CONDITIONAL_CANNON`: 条件炮
