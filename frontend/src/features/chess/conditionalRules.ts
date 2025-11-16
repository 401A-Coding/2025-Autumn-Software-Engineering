/**
 * 条件规则系统 (从legacy代码提取)
 * 支持根据棋子位置动态应用不同规则
 */

import type { Board, Pos, Side } from './types'
import { inBounds } from './types'

// ==================== 条件规则类型定义 ====================

/**
 * 基础规则定义
 */
export interface RuleDefinition {
  // pattern模式组合: "row+col" | "cross1" | "diag1" | "forward"
  pattern?: string
  
  // 特殊模式: "cannon" (炮的跳吃逻辑)
  special?: 'cannon'
  
  // 前进限制
  forward?: { max: number }
  
  // 离散偏移量
  offsets?: { dr: number; dc: number }[]
  
  // 射线方向 [[dr,dc], ...]
  rays?: [number, number][]
}

/**
 * 条件规则配置
 * 根据棋子位置(过河前/后、宫内/外)动态应用不同规则
 */
export interface ConditionalRules {
  // 基础规则(必须)
  base: RuleDefinition
  
  // 过河前规则(可选覆盖)
  beforeRiver?: Partial<RuleDefinition>
  
  // 过河后规则(可选覆盖)
  afterRiver?: Partial<RuleDefinition>
  
  // 宫内规则(可选覆盖)
  inPalace?: Partial<RuleDefinition>
  
  // 宫外规则(可选覆盖)
  outPalace?: Partial<RuleDefinition>
}

/**
 * 完整的条件规则集
 */
export interface ConditionalRuleSet {
  [pieceKey: string]: ConditionalRules
}

// ==================== 辅助函数 ====================

/**
 * 判断是否在九宫内
 */
function inPalace(row: number, col: number, isRed: boolean): boolean {
  const palaceCols = col >= 3 && col <= 5
  if (isRed) {
    return palaceCols && row >= 7 && row <= 9
  } else {
    return palaceCols && row >= 0 && row <= 2
  }
}

/**
 * 解析条件并返回最终生效的规则
 * 核心逻辑: base + 条件覆盖
 */
export function resolveRule(
  rule: ConditionalRules | RuleDefinition,
  row: number,
  col: number,
  isRed: boolean
): RuleDefinition {
  // 旧格式直接返回(无条件块)
  if (!rule || !('base' in rule)) {
    return rule as RuleDefinition
  }

  // 计算位置状态
  const afterRiver = isRed ? row <= 4 : row >= 5
  const beforeRiver = !afterRiver
  const inPalaceNow = inPalace(row, col, isRed)

  // 从base开始,逐层应用条件覆盖
  let effective = { ...rule.base }

  // 河流条件
  if (beforeRiver && rule.beforeRiver) {
    Object.assign(effective, rule.beforeRiver)
  }
  if (afterRiver && rule.afterRiver) {
    Object.assign(effective, rule.afterRiver)
  }

  // 九宫条件
  if (inPalaceNow && rule.inPalace) {
    Object.assign(effective, rule.inPalace)
  }
  if (!inPalaceNow && rule.outPalace) {
    Object.assign(effective, rule.outPalace)
  }

  return effective
}

// ==================== 走法生成 ====================

/**
 * 根据条件规则生成走法
 * (从legacy engine.js的generateCustomMoves提取)
 */
export function generateConditionalMoves(
  board: Board,
  from: Pos,
  rule: ConditionalRules | RuleDefinition,
  side: Side
): Pos[] {
  const isRed = side === 'red'
  
  // 解析最终生效规则
  const effective = resolveRule(rule, from.y, from.x, isRed)
  
  const moves: Pos[] = []

  // 辅助函数: 添加单个位置(检查边界和敌我方)
  const add = (row: number, col: number) => {
    if (!inBounds(col, row)) return
    const target = board[row][col]
    
    if (!target) {
      // 空格可走
      moves.push({ x: col, y: row })
    } else {
      // 有子,检查是否敌方
      if (target.side !== side) {
        moves.push({ x: col, y: row })
      }
    }
  }

  // 辅助函数: 射线扩展
  const ray = (dr: number, dc: number) => {
    let row = from.y + dr
    let col = from.x + dc
    
    while (inBounds(col, row)) {
      const target = board[row][col]
      
      if (!target) {
        moves.push({ x: col, y: row })
      } else {
        // 遇到棋子
        if (target.side !== side) {
          moves.push({ x: col, y: row })
        }
        break // 射线终止
      }
      
      row += dr
      col += dc
    }
  }

  // 1) 特殊模式: 炮逻辑
  if (effective.special === 'cannon') {
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    
    for (const [dr, dc] of dirs) {
      let row = from.y + dr
      let col = from.x + dc
      let metFirst = false // 是否遇到第一个棋子
      
      while (inBounds(col, row)) {
        const target = board[row][col]
        
        if (!metFirst) {
          if (!target) {
            // 空格可走
            moves.push({ x: col, y: row })
          } else {
            // 遇到第一个棋子(炮架)
            metFirst = true
          }
        } else {
          // 已遇到炮架,寻找第二个棋子
          if (target) {
            if (target.side !== side) {
              moves.push({ x: col, y: row })
            }
            break // 无论能否吃,都终止
          }
        }
        
        row += dr
        col += dc
      }
    }
  }

  // 2) Pattern模式解析
  if (effective.pattern) {
    const parts = effective.pattern.split('+')

    // row: 同行射线
    if (parts.includes('row')) {
      // 向左
      for (let c = from.x - 1; c >= 0; c--) {
        const t = board[from.y][c]
        if (!t) {
          moves.push({ x: c, y: from.y })
        } else {
          if (t.side !== side) {
            moves.push({ x: c, y: from.y })
          }
          break
        }
      }
      // 向右
      for (let c = from.x + 1; c < 9; c++) {
        const t = board[from.y][c]
        if (!t) {
          moves.push({ x: c, y: from.y })
        } else {
          if (t.side !== side) {
            moves.push({ x: c, y: from.y })
          }
          break
        }
      }
    }

    // col: 同列射线
    if (parts.includes('col')) {
      // 向上
      for (let r = from.y - 1; r >= 0; r--) {
        const t = board[r][from.x]
        if (!t) {
          moves.push({ x: from.x, y: r })
        } else {
          if (t.side !== side) {
            moves.push({ x: from.x, y: r })
          }
          break
        }
      }
      // 向下
      for (let r = from.y + 1; r < 10; r++) {
        const t = board[r][from.x]
        if (!t) {
          moves.push({ x: from.x, y: r })
        } else {
          if (t.side !== side) {
            moves.push({ x: from.x, y: r })
          }
          break
        }
      }
    }

    // cross1: 将帅四邻(上下左右一步)
    if (parts.includes('cross1')) {
      const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (const [dr, dc] of dirs) {
        add(from.y + dr, from.x + dc)
      }
    }

    // diag1: 士四对角(斜一步)
    if (parts.includes('diag1')) {
      const dirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      for (const [dr, dc] of dirs) {
        add(from.y + dr, from.x + dc)
      }
    }
  }

  // 3) Forward: 前进格数限制
  if (effective.forward) {
    const dir = isRed ? -1 : 1 // 红向上(-1), 黑向下(+1)
    const max = effective.forward.max || 1
    
    for (let i = 1; i <= max; i++) {
      add(from.y + dir * i, from.x)
    }
  }

  // 4) Offsets: 手动指定离散坐标
  if (effective.offsets) {
    for (const { dr, dc } of effective.offsets) {
      add(from.y + dr, from.x + dc)
    }
  }

  // 5) Rays: 指定射线方向数组
  if (effective.rays) {
    for (const [dr, dc] of effective.rays) {
      ray(dr, dc)
    }
  }

  return moves
}

// ==================== 预设示例 ====================

/**
 * 示例: 兵的条件规则
 * 过河前只能前进,过河后可横移
 */
export const PAWN_CONDITIONAL: ConditionalRules = {
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
}

/**
 * 示例: 将帅条件规则
 * 宫内只能四邻,宫外可自由移动
 */
export const KING_CONDITIONAL: ConditionalRules = {
  base: {
    pattern: 'cross1'
  },
  outPalace: {
    pattern: 'row+col' // 假设出宫后可以自由移动(这是示例)
  }
}

/**
 * 示例: 炮的条件规则
 * 使用特殊炮逻辑
 */
export const CANNON_CONDITIONAL: ConditionalRules = {
  base: {
    special: 'cannon'
  }
}
