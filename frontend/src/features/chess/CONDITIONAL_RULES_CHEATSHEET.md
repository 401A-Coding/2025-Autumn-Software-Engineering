# 条件规则系统 - 快速参考

## 📦 导入

```typescript
import {
  // 类型
  ConditionalRules,
  RuleDefinition,
  ConditionalRuleSet,
  
  // 核心函数
  generateConditionalMoves,
  resolveRule
} from './conditionalRules'

import {
  // 预设规则集
  STANDARD_CONDITIONAL_RULES,
  SUPER_SOLDIER,
  FLYING_GENERAL,
  CONDITIONAL_CANNON,
  
  // 工具函数
  generateMovesWithConditionalRules,
  hasConditionalRule,
  getConditionalRule,
  mergeConditionalRuleSets,
  createConditionalRule
} from './conditionalRulesAdapter'
```

## 🎯 核心API

### `generateMovesWithConditionalRules()`
**用途**: 主集成函数,根据条件规则生成走法

```typescript
const moves = generateMovesWithConditionalRules(
  board,      // Board: 当前棋盘
  from,       // Pos: 棋子位置
  pieceType,  // PieceType: 棋子类型
  side,       // Side: 'red' | 'black'
  ruleSet     // ConditionalRuleSet: 规则集
)
// 返回: Pos[] | null  (null表示无条件规则)
```

### `resolveRule()`
**用途**: 调试工具,查看某位置实际应用的规则

```typescript
const effectiveRule = resolveRule(
  rule,   // ConditionalRules: 条件规则
  row,    // number: 行坐标(0-9)
  col,    // number: 列坐标(0-8)
  isRed   // boolean: 是否红方
)
// 返回: RuleDefinition (解析后的规则)
```

## 📝 规则定义速查

### Pattern模式

| 模式 | 说明 | 示例棋子 |
|-----|------|---------|
| `row` | 同行射线 | - |
| `col` | 同列射线 | - |
| `row+col` | 直线射线 | 车 |
| `cross1` | 四邻(上下左右1步) | 将/帅 |
| `diag1` | 斜走(四对角1步) | 士/仕 |
| `cross1+diag1` | 八方移动 | - |
| `forward` | 向前N步 | 兵/卒 |

### 特殊模式

| 模式 | 说明 |
|-----|------|
| `special: 'cannon'` | 炮的跳吃逻辑 |

### 条件字段

| 字段 | 触发条件 | 红方 | 黑方 |
|-----|---------|------|------|
| `base` | 总是应用 | - | - |
| `beforeRiver` | 未过河 | y > 4 | y < 5 |
| `afterRiver` | 已过河 | y ≤ 4 | y ≥ 5 |
| `inPalace` | 九宫内 | x:3-5, y:7-9 | x:3-5, y:0-2 |
| `outPalace` | 九宫外 | 其他位置 | 其他位置 |

## 🔧 常用模式

### 模式1: 标准兵

```typescript
{
  base: { forward: { max: 1 } },
  afterRiver: {
    forward: { max: 1 },
    offsets: [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
  }
}
```

### 模式2: 直线移动(车)

```typescript
{
  base: { pattern: 'row+col' }
}
```

### 模式3: 炮

```typescript
{
  base: { special: 'cannon' }
}
```

### 模式4: 马(日字)

```typescript
{
  base: {
    offsets: [
      { dr: -2, dc: -1 }, { dr: -2, dc: 1 },
      { dr: 2, dc: -1 }, { dr: 2, dc: 1 },
      { dr: -1, dc: -2 }, { dr: 1, dc: -2 },
      { dr: -1, dc: 2 }, { dr: 1, dc: 2 }
    ]
  }
}
```

### 模式5: 将帅

```typescript
{
  base: { pattern: 'cross1' }
}
```

### 模式6: 士仕

```typescript
{
  base: { pattern: 'diag1' }
}
```

## 🎨 快速示例

### 创建规则集

```typescript
// 使用预设
const rules1 = STANDARD_CONDITIONAL_RULES

// 合并预设
const rules2 = mergeConditionalRuleSets(
  STANDARD_CONDITIONAL_RULES,
  { soldier: SUPER_SOLDIER }
)

// 完全自定义
const rules3: ConditionalRuleSet = {
  soldier: {
    base: { forward: { max: 1 } },
    afterRiver: { pattern: 'cross1' }
  }
}
```

### 生成走法

```typescript
const moves = generateMovesWithConditionalRules(
  board,
  { x: 4, y: 6 },
  'soldier',
  'red',
  STANDARD_CONDITIONAL_RULES
)

if (moves) {
  console.log('走法数量:', moves.length)
  moves.forEach(m => console.log(`可走到 (${m.x}, ${m.y})`))
}
```

### 调试规则

```typescript
const rule = STANDARD_CONDITIONAL_RULES.soldier!
const effective = resolveRule(rule, 6, 4, true)

console.log('实际应用的规则:', effective)
// 如果在 y=6 (未过河): { forward: {max:1} }
// 如果在 y=4 (过河): { forward: {max:1}, offsets: [...] }
```

## 🚨 常见问题

### Q: 为什么返回null?
A: 该棋子没有定义条件规则,需要降级到标准规则

```typescript
const moves = generateMovesWithConditionalRules(...)
if (moves === null) {
  // 使用标准规则引擎
  moves = getStandardMoves(...)
}
```

### Q: 坐标系是什么?
A: `{ dr, dc }` = (行偏移, 列偏移)
- dr > 0: 向下
- dr < 0: 向上
- dc > 0: 向右
- dc < 0: 向左

### Q: 如何判断是否过河?
A: 红方 `y ≤ 4` 过河, 黑方 `y ≥ 5` 过河

### Q: 如何组合多个pattern?
A: 使用 `+` 连接: `"row+col"`, `"cross1+diag1"`

### Q: 条件优先级?
A: base → river条件 → palace条件 (后面覆盖前面)

## 📚 完整文档

- **完整指南**: `CONDITIONAL_RULES_GUIDE.md`
- **提取报告**: `LEGACY_EXTRACTION_REPORT.md`
- **示例代码**: `conditionalRulesExample.ts`

## 🔗 相关文件

| 文件 | 用途 |
|-----|------|
| `conditionalRules.ts` | 核心引擎 |
| `conditionalRulesAdapter.ts` | 集成适配器+预设 |
| `conditionalRulesExample.ts` | 使用示例 |

---

**提示**: 复制这个文件作为快速参考,编码时随时查阅!
