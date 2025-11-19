/**
 * 条件规则系统使用示例
 * 演示如何在实际游戏中集成条件规则
 */

import type { Board, Pos, Piece, Side } from './types'
import { 
  generateMovesWithConditionalRules,
  STANDARD_CONDITIONAL_RULES,
  SUPER_SOLDIER,
  FLYING_GENERAL,
  mergeConditionalRuleSets,
  createConditionalRule
} from './conditionalRulesAdapter'
import type { ConditionalRuleSet } from './conditionalRules'

// ==================== 示例1: 基础集成 ====================

/**
 * 在getLegalMoves中集成条件规则
 * 这是最常见的使用场景
 */
export function getLegalMovesWithConditional(
  board: Board,
  from: Pos,
  piece: Piece,
  conditionalRules?: ConditionalRuleSet
): Pos[] {
  // 如果没有提供条件规则,使用标准规则
  const rules = conditionalRules || STANDARD_CONDITIONAL_RULES
  
  // 尝试使用条件规则生成走法
  const moves = generateMovesWithConditionalRules(
    board,
    from,
    piece.type,
    piece.side,
    rules
  )
  
  if (moves !== null) {
    // 条件规则生成成功,返回结果
    // (在实际应用中需要加上"不留将"过滤)
    return moves
  }
  
  // 如果条件规则不适用,降级到标准规则
  // (这里需要调用你现有的规则引擎)
  return getStandardMoves(board, from, piece)
}

// 占位函数(需要替换为实际的标准规则引擎)
function getStandardMoves(_board: Board, _from: Pos, _piece: Piece): Pos[] {
  // TODO: 调用现有的 rules.ts 或 ruleEngine.ts
  return []
}

// ==================== 示例2: 自定义规则集 ====================

/**
 * 创建带有超级兵的自定义规则集
 */
export function createSuperSoldierGame(): ConditionalRuleSet {
  return mergeConditionalRuleSets(
    STANDARD_CONDITIONAL_RULES,
    {
      soldier: SUPER_SOLDIER  // 替换标准兵规则
    }
  )
}

/**
 * 创建飞将模式
 */
export function createFlyingGeneralGame(): ConditionalRuleSet {
  return mergeConditionalRuleSets(
    STANDARD_CONDITIONAL_RULES,
    {
      general: FLYING_GENERAL
    }
  )
}

/**
 * 创建完全自定义的规则集
 */
export function createCustomGame(): ConditionalRuleSet {
  return {
    // 超级兵: 未过河前进2步,过河后八方移动
    soldier: {
      base: {
        forward: { max: 2 }
      },
      afterRiver: {
        pattern: 'cross1+diag1'
      }
    },
    
    // 飞将: 出宫后可直线飞行
    general: {
      base: {
        pattern: 'cross1'
      },
      outPalace: {
        pattern: 'row+col'
      }
    },
    
    // 超级炮: 过河后变车
    cannon: {
      base: {
        special: 'cannon'
      },
      afterRiver: {
        pattern: 'row+col'
      }
    },
    
    // 标准车(保持不变)
    rook: {
      base: {
        pattern: 'row+col'
      }
    }
  }
}

// ==================== 示例3: 动态规则构建 ====================

/**
 * 根据用户输入动态创建条件规则
 */
export function buildConditionalRuleFromUI(config: {
  // 基础配置
  basePattern?: string
  baseForward?: number
  baseOffsets?: Array<{ dr: number; dc: number }>
  
  // 过河后配置
  afterRiverPattern?: string
  afterRiverForward?: number
  afterRiverOffsets?: Array<{ dr: number; dc: number }>
  
  // 九宫配置
  inPalacePattern?: string
  outPalacePattern?: string
}) {
  return createConditionalRule({
    base: {
      pattern: config.basePattern,
      forward: config.baseForward ? { max: config.baseForward } : undefined,
      offsets: config.baseOffsets
    },
    afterRiver: config.afterRiverPattern || config.afterRiverForward || config.afterRiverOffsets
      ? {
          pattern: config.afterRiverPattern,
          forward: config.afterRiverForward ? { max: config.afterRiverForward } : undefined,
          offsets: config.afterRiverOffsets
        }
      : undefined,
    inPalace: config.inPalacePattern ? { pattern: config.inPalacePattern } : undefined,
    outPalace: config.outPalacePattern ? { pattern: config.outPalacePattern } : undefined
  })
}

// ==================== 示例4: 规则预览 ====================

/**
 * 预览某个棋子在特定位置的所有可能走法
 * 用于规则编辑器的实时预览
 */
export function previewConditionalRule(
  pieceType: string,
  position: Pos,
  side: Side,
  rule: ConditionalRuleSet,
  mockBoard?: Board
): {
  moves: Pos[]
  conditions: {
    isAfterRiver: boolean
    isInPalace: boolean
    appliedConditions: string[]
  }
} {
  // 创建测试棋盘(空板 + 一个棋子)
  const board = mockBoard || createEmptyBoardWithPiece(pieceType, position, side)
  
  // 生成走法
  const moves = generateMovesWithConditionalRules(
    board,
    position,
    pieceType as any,
    side,
    rule
  ) || []
  
  // 分析条件
  const isRed = side === 'red'
  const isAfterRiver = isRed ? position.y <= 4 : position.y >= 5
  const isInPalace = 
    position.x >= 3 && position.x <= 5 &&
    (isRed ? position.y >= 7 && position.y <= 9 : position.y >= 0 && position.y <= 2)
  
  const appliedConditions: string[] = ['base']
  if (isAfterRiver) appliedConditions.push('afterRiver')
  else appliedConditions.push('beforeRiver')
  if (isInPalace) appliedConditions.push('inPalace')
  else appliedConditions.push('outPalace')
  
  return {
    moves,
    conditions: {
      isAfterRiver,
      isInPalace,
      appliedConditions
    }
  }
}

function createEmptyBoardWithPiece(
  pieceType: string,
  position: Pos,
  side: Side
): Board {
  const board: Board = Array.from({ length: 10 }, () => 
    Array.from({ length: 9 }, () => null)
  )
  
  board[position.y][position.x] = {
    id: 'preview-piece',
    type: pieceType as any,
    side
  }
  
  return board
}

// ==================== 示例5: React组件集成 ====================

/**
 * React组件示例: 条件规则选择器
 */
export function ConditionalRuleSelector() {
  // 这是伪代码,展示如何在React中使用
  
  /*
  const [ruleSet, setRuleSet] = useState<ConditionalRuleSet>(STANDARD_CONDITIONAL_RULES)
  const [selectedMode, setSelectedMode] = useState<'standard' | 'custom'>('standard')
  
  const handleModeChange = (mode: 'standard' | 'super-soldier' | 'flying-general' | 'custom') => {
    switch (mode) {
      case 'standard':
        setRuleSet(STANDARD_CONDITIONAL_RULES)
        break
      case 'super-soldier':
        setRuleSet(createSuperSoldierGame())
        break
      case 'flying-general':
        setRuleSet(createFlyingGeneralGame())
        break
      case 'custom':
        setRuleSet(createCustomGame())
        break
    }
  }
  
  return (
    <div>
      <select onChange={e => handleModeChange(e.target.value as any)}>
        <option value="standard">标准规则</option>
        <option value="super-soldier">超级兵</option>
        <option value="flying-general">飞将</option>
        <option value="custom">自定义</option>
      </select>
      
      <Board 
        gameState={gameState} 
        conditionalRules={ruleSet}
      />
    </div>
  )
  */
}

// ==================== 示例6: 规则测试 ====================

/**
 * 测试条件规则是否正确应用
 */
export function testConditionalRules() {
  const testCases = [
    {
      name: '红兵未过河',
      pieceType: 'soldier' as const,
      position: { x: 4, y: 6 },
      side: 'red' as const,
      expected: { moveCount: 1, canMoveLeft: false, canMoveRight: false }
    },
    {
      name: '红兵过河后',
      pieceType: 'soldier' as const,
      position: { x: 4, y: 4 },
      side: 'red' as const,
      expected: { moveCount: 3, canMoveLeft: true, canMoveRight: true }
    },
    {
      name: '黑卒未过河',
      pieceType: 'soldier' as const,
      position: { x: 4, y: 3 },
      side: 'black' as const,
      expected: { moveCount: 1, canMoveLeft: false, canMoveRight: false }
    },
    {
      name: '黑卒过河后',
      pieceType: 'soldier' as const,
      position: { x: 4, y: 5 },
      side: 'black' as const,
      expected: { moveCount: 3, canMoveLeft: true, canMoveRight: true }
    }
  ]
  
  const results = testCases.map(test => {
    const board = createEmptyBoardWithPiece(test.pieceType, test.position, test.side)
    const moves = generateMovesWithConditionalRules(
      board,
      test.position,
      test.pieceType,
      test.side,
      STANDARD_CONDITIONAL_RULES
    ) || []
    
    const canMoveLeft = moves.some(m => m.x === test.position.x - 1)
    const canMoveRight = moves.some(m => m.x === test.position.x + 1)
    
    const passed = 
      moves.length === test.expected.moveCount &&
      canMoveLeft === test.expected.canMoveLeft &&
      canMoveRight === test.expected.canMoveRight
    
    return {
      name: test.name,
      passed,
      actual: { moveCount: moves.length, canMoveLeft, canMoveRight },
      expected: test.expected
    }
  })
  
  console.table(results)
  return results
}

// ==================== 使用说明 ====================

/**
 * 快速开始:
 * 
 * 1. 在Board.tsx中集成:
 *    import { getLegalMovesWithConditional } from './conditionalRulesExample'
 *    const moves = getLegalMovesWithConditional(board, from, piece, customRules)
 * 
 * 2. 创建自定义规则集:
 *    const myRules = createSuperSoldierGame()
 *    或
 *    const myRules = buildConditionalRuleFromUI({ ... })
 * 
 * 3. 预览规则效果:
 *    const preview = previewConditionalRule('soldier', {x:4,y:6}, 'red', myRules)
 *    console.log('可走位置:', preview.moves)
 *    console.log('应用条件:', preview.conditions.appliedConditions)
 * 
 * 4. 测试规则:
 *    testConditionalRules()
 */
