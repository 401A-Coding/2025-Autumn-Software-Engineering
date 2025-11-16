/**
 * 条件规则集成适配器
 * 将legacy的条件规则系统与当前规则引擎桥接
 */

import type { Board, Pos, Side, PieceType } from './types'
import type { 
  ConditionalRules, 
  RuleDefinition, 
  ConditionalRuleSet 
} from './conditionalRules'
import { generateConditionalMoves } from './conditionalRules'

// ==================== 条件规则预设 ====================

/**
 * 标准棋子的条件规则定义
 * 从legacy代码风格提取并适配
 */
export const STANDARD_CONDITIONAL_RULES: ConditionalRuleSet = {
  // 兵/卒: 过河前只能前进,过河后可横移
  soldier: {
    base: {
      forward: { max: 1 }
    },
    afterRiver: {
      forward: { max: 1 },
      offsets: [
        { dr: 0, dc: -1 }, // 左
        { dr: 0, dc: 1 }   // 右
      ]
    }
  },

  // 将/帅: 九宫内四邻
  general: {
    base: {
      pattern: 'cross1'
    },
    outPalace: {
      pattern: 'cross1' // 出宫也只能四邻(实际上不会出宫,这里仅作示例)
    }
  },

  // 士/仕: 九宫内斜走
  advisor: {
    base: {
      pattern: 'diag1'
    }
  },

  // 车: 直线移动
  rook: {
    base: {
      pattern: 'row+col'
    }
  },

  // 炮: 特殊炮逻辑
  cannon: {
    base: {
      special: 'cannon'
    }
  },

  // 马: 日字跳(需要在条件规则中用offsets表示)
  horse: {
    base: {
      offsets: [
        { dr: -2, dc: -1 }, { dr: -2, dc: 1 },
        { dr: 2, dc: -1 }, { dr: 2, dc: 1 },
        { dr: -1, dc: -2 }, { dr: 1, dc: -2 },
        { dr: -1, dc: 2 }, { dr: 1, dc: 2 }
      ]
    }
  },

  // 象/相: 田字走,不过河
  elephant: {
    base: {
      offsets: [
        { dr: -2, dc: -2 }, { dr: -2, dc: 2 },
        { dr: 2, dc: -2 }, { dr: 2, dc: 2 }
      ]
    }
  }
}

/**
 * 示例: 超级兵
 * 过河前可前进2步,过河后可八方走
 */
export const SUPER_SOLDIER: ConditionalRules = {
  base: {
    forward: { max: 2 }
  },
  afterRiver: {
    pattern: 'cross1+diag1' // 八方移动
  }
}

/**
 * 示例: 飞将
 * 宫内正常,宫外可以直线移动
 */
export const FLYING_GENERAL: ConditionalRules = {
  base: {
    pattern: 'cross1'
  },
  inPalace: {
    pattern: 'cross1'
  },
  outPalace: {
    pattern: 'row+col' // 出宫后可直线飞
  }
}

/**
 * 示例: 条件炮
 * 过河前正常炮,过河后可以不隔子吃(变车)
 */
export const CONDITIONAL_CANNON: ConditionalRules = {
  base: {
    special: 'cannon'
  },
  afterRiver: {
    pattern: 'row+col' // 过河后变车
  }
}

// ==================== 工具函数 ====================

/**
 * 棋子类型映射到条件规则键
 */
function pieceTypeToKey(type: PieceType): string {
  return type
}

/**
 * 检查是否定义了条件规则
 */
export function hasConditionalRule(
  ruleSet: ConditionalRuleSet,
  pieceType: PieceType
): boolean {
  const key = pieceTypeToKey(pieceType)
  return !!ruleSet[key]
}

/**
 * 获取棋子的条件规则
 */
export function getConditionalRule(
  ruleSet: ConditionalRuleSet,
  pieceType: PieceType
): ConditionalRules | undefined {
  const key = pieceTypeToKey(pieceType)
  return ruleSet[key]
}

/**
 * 使用条件规则生成走法
 * 这是主要的集成点
 */
export function generateMovesWithConditionalRules(
  board: Board,
  from: Pos,
  pieceType: PieceType,
  side: Side,
  ruleSet: ConditionalRuleSet
): Pos[] | null {
  const rule = getConditionalRule(ruleSet, pieceType)
  
  if (!rule) {
    return null // 没有条件规则,使用标准规则
  }

  return generateConditionalMoves(board, from, rule, side)
}

/**
 * 合并条件规则集
 * 用于扩展或覆盖预设规则
 */
export function mergeConditionalRuleSets(
  base: ConditionalRuleSet,
  override: Partial<ConditionalRuleSet>
): ConditionalRuleSet {
  const result: ConditionalRuleSet = { ...base }
  
  // 只复制非undefined的值
  Object.keys(override).forEach((key) => {
    const value = override[key]
    if (value !== undefined) {
      result[key] = value
    }
  })
  
  return result
}

/**
 * 创建自定义条件规则
 * 辅助函数,简化条件规则创建
 */
export function createConditionalRule(config: {
  // 基础配置
  base: Partial<RuleDefinition>
  
  // 可选条件
  beforeRiver?: Partial<RuleDefinition>
  afterRiver?: Partial<RuleDefinition>
  inPalace?: Partial<RuleDefinition>
  outPalace?: Partial<RuleDefinition>
}): ConditionalRules {
  return {
    base: config.base as RuleDefinition,
    beforeRiver: config.beforeRiver,
    afterRiver: config.afterRiver,
    inPalace: config.inPalace,
    outPalace: config.outPalace
  }
}

// ==================== 使用示例 ====================

/**
 * 示例1: 在游戏中使用条件规则
 * 
 * ```typescript
 * import { generateMovesWithConditionalRules, STANDARD_CONDITIONAL_RULES } from './conditionalRulesAdapter'
 * 
 * function getLegalMoves(board: Board, from: Pos, piece: Piece): Pos[] {
 *   // 尝试使用条件规则
 *   const conditionalMoves = generateMovesWithConditionalRules(
 *     board, from, piece.type, piece.side, STANDARD_CONDITIONAL_RULES
 *   )
 *   
 *   if (conditionalMoves) {
 *     return conditionalMoves // 使用条件规则结果
 *   }
 *   
 *   // 降级到标准规则
 *   return generateStandardMoves(board, from, piece)
 * }
 * ```
 */

/**
 * 示例2: 创建自定义规则集
 * 
 * ```typescript
 * const myCustomRules = mergeConditionalRuleSets(
 *   STANDARD_CONDITIONAL_RULES,
 *   {
 *     soldier: SUPER_SOLDIER,
 *     general: FLYING_GENERAL
 *   }
 * )
 * ```
 */

/**
 * 示例3: 动态创建条件规则
 * 
 * ```typescript
 * const dynamicRule = createConditionalRule({
 *   base: { forward: { max: 1 } },
 *   afterRiver: { pattern: 'cross1' }
 * })
 * ```
 */
