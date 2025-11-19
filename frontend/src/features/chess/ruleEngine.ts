/**
 * 自定义棋局规则系统
 * 提供完整的规则定义、验证和管理功能
 */

import type { Board, Pos, Side, PieceType } from './types'
import { inBounds } from './types'

// ==================== 核心数据结构 ====================

/**
 * 移动方向类型
 */
export type Direction = 'forward' | 'backward' | 'left' | 'right' | 'diagonal' | 'l-shape'

/**
 * 移动条件
 */
export interface MoveCondition {
    type: 'position' | 'state' | 'target' | 'path'
    
    // 位置条件
    inPalace?: boolean           // 必须在九宫内
    crossedRiver?: boolean       // 是否已过河
    notCrossedRiver?: boolean    // 是否未过河
    
    // 状态条件
    isFirstMove?: boolean        // 是否首次移动
    hasEnemyInPath?: boolean     // 路径上必须有敌方棋子
    hasNoObstacle?: boolean      // 路径必须无阻碍
    
    // 目标条件
    targetEmpty?: boolean        // 目标必须为空
    targetEnemy?: boolean        // 目标必须是敌方棋子
    
    // 路径条件
    obstacleCount?: number       // 路径上必须有N个障碍物（炮）
}

/**
 * 移动模式（单个走法）
 */
export interface MovePattern {
    // 基本移动向量
    dx: number                   // X方向偏移
    dy: number                   // Y方向偏移
    
    // 移动属性
    direction?: Direction        // 移动方向类型
    repeat?: boolean             // 是否可以重复（如车可以一直走）
    maxSteps?: number            // 最大步数（0 = 无限制）
    
    // 条件限制
    conditions?: MoveCondition[] // 移动条件列表
    
    // 特殊规则
    jumpObstacle?: boolean       // 是否可以跳过障碍物
    captureOnly?: boolean        // 仅用于吃子
    moveOnly?: boolean           // 仅用于移动（不吃子）
}

/**
 * 棋子规则配置
 */
export interface PieceRuleConfig {
    // 基本信息
    name: string                 // 棋子名称
    description?: string         // 规则描述
    
    // 移动规则
    movePatterns: MovePattern[]  // 所有可能的移动模式
    
    // 全局限制
    restrictions: {
        canJump?: boolean            // 是否可以跳过其他棋子
        canCrossRiver?: boolean      // 是否可以过河
        mustStayInPalace?: boolean   // 是否必须待在九宫
        maxMoveDistance?: number     // 最大移动距离（0 = 无限制）
        minMoveDistance?: number     // 最小移动距离
    }
    
    // 特殊能力
    specialAbilities?: {
        canCaptureMultiple?: boolean // 是否可以一次吃多个子
        canPromote?: boolean         // 是否可以升变
        hasCooldown?: boolean        // 是否有冷却时间
        canTeleport?: boolean        // 是否可以瞬移
    }
    
    // 吃子规则
    captureRules?: {
        capturePattern?: MovePattern[] // 特殊的吃子模式（如炮）
        canCaptureKing?: boolean       // 是否可以吃将
        protectedPieces?: PieceType[]  // 无法吃的棋子类型
    }
}

/**
 * 完整的自定义规则集
 */
export interface CustomRuleSet {
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
        moveTimeLimit?: number           // 每步时间限制（秒）
    }
    
    // 获胜条件
    winConditions?: {
        captureKing?: boolean           // 吃掉将帅获胜
        captureAllPieces?: boolean      // 吃光所有棋子获胜
        reachDestination?: boolean      // 到达特定位置获胜
        scoreThreshold?: number         // 积分达到阈值获胜
    }
}

// ==================== 规则生成器 ====================

/**
 * 根据规则配置生成所有合法走法
 */
export function generateMovesFromRules(
    board: Board,
    from: Pos,
    ruleConfig: PieceRuleConfig,
    side: Side
): Pos[] {
    const moves: Pos[] = []
    const piece = board[from.y][from.x]
    
    if (!piece) return moves

    // 合并普通 movePatterns 与 captureRules.capturePattern（如果存在），以确保
    // 像炮这样的吃子模式不会因为被放在 captureRules 中而被忽略。
    const allPatterns: MovePattern[] = []
    if (ruleConfig.movePatterns && ruleConfig.movePatterns.length) allPatterns.push(...ruleConfig.movePatterns)
    if (ruleConfig.captureRules && Array.isArray((ruleConfig as any).captureRules.capturePattern)) {
        allPatterns.push(...((ruleConfig as any).captureRules.capturePattern as MovePattern[]))
    }

    for (const pattern of allPatterns) {
        const patternMoves = generateMovesFromPattern(
            board,
            from,
            pattern,
            ruleConfig.restrictions,
            side
        )
        moves.push(...patternMoves)
    }

    // 应用全局距离限制
    return moves.filter(to => {
        const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
        const minDist = ruleConfig.restrictions.minMoveDistance || 0
        const maxDist = ruleConfig.restrictions.maxMoveDistance || Infinity
        return distance >= minDist && distance <= maxDist
    })
}

/**
 * 从单个移动模式生成走法
 */
function generateMovesFromPattern(
    board: Board,
    from: Pos,
    pattern: MovePattern,
    restrictions: PieceRuleConfig['restrictions'],
    side: Side
): Pos[] {
    const moves: Pos[] = []
    const maxSteps = pattern.maxSteps || (pattern.repeat ? 10 : 1)

    // 特判：炮类（或类似）模式 - captureOnly + repeat + path.obstacleCount
    const obstacleCond = pattern.conditions?.find((c: any) => c.type === 'path' && c.obstacleCount !== undefined) as any | undefined
    const isCannonLikeCapture = !!(pattern.repeat && pattern.captureOnly && obstacleCond)

    if (isCannonLikeCapture) {
        for (let step = 1; step <= maxSteps; step++) {
            const dx = pattern.dx * step
            const dy = adjustDyForSide(pattern.dy * step, side)
            const to: Pos = { x: from.x + dx, y: from.y + dy }
            if (!inBounds(to.x, to.y)) break

            // 全局限制（九宫/过河）
            if (!checkRestrictions(board, from, to, restrictions, side)) break

            const target = board[to.y][to.x]
            if (!target) {
                // captureOnly：空格不加入，继续扫描
                continue
            }

            // 有目标：根据路径障碍数决定
            const need = obstacleCond.obstacleCount as number
            const count = countObstaclesInPath(board, from, to)
            if (count < need) {
                // 未达到所需隔子数，继续扫描
                continue
            }
            if (count > need) {
                // 超过所需隔子数，停止扫描
                break
            }
            // 恰好等于所需隔子数：仅可吃到第一个敌子
            if (target.side !== side) moves.push(to)
            break
        }
        return moves
    }

    for (let step = 1; step <= maxSteps; step++) {
        const dx = pattern.dx * step
        const dy = adjustDyForSide(pattern.dy * step, side)
        const to: Pos = { x: from.x + dx, y: from.y + dy }

        if (!inBounds(to.x, to.y)) break

        // 检查条件（普通模式）
        if (!checkMoveConditions(board, from, to, pattern.conditions, side)) {
            if (!pattern.repeat) continue
            break
        }

        // 检查全局限制
        if (!checkRestrictions(board, from, to, restrictions, side)) {
            if (!pattern.repeat) continue
            break
        }

        const target = board[to.y][to.x]

        // 处理障碍物：moveOnly 遇子必阻挡（无论是否允许跳跃）
        if (target && pattern.moveOnly) {
            // moveOnly：不可吃子，且阻挡继续扫描
            break
        }
        // 碰到任意棋子：无论是否声明 jumpObstacle，都视为到此为止（绝对禁止越子）
        if (target) {
            if (target.side !== side && !pattern.moveOnly) moves.push(to)
            break
        }

        // 处理特殊规则
    if (pattern.captureOnly && !target) continue
    if (pattern.moveOnly && target) continue // 上面已 break 过，这里保持语义

        moves.push(to)

        // 如果遇到棋子且不可跳跃，停止
    if (target) break
    }

    return moves
}

/**
 * 调整dy方向（红方向上走为负，黑方向上走为正）
 */
function adjustDyForSide(dy: number, side: Side): number {
    return side === 'red' ? -dy : dy
}

/**
 * 检查移动条件
 */
function checkMoveConditions(
    board: Board,
    from: Pos,
    to: Pos,
    conditions?: MoveCondition[],
    side?: Side
): boolean {
    if (!conditions || conditions.length === 0) return true

    const baseOk = conditions.every(condition => {
        // 位置条件
        if (condition.inPalace !== undefined) {
            const inPalace = isPalace(to.x, to.y, side!)
            if (condition.inPalace !== inPalace) return false
        }

        if (condition.crossedRiver !== undefined) {
            const crossed = side === 'red' ? from.y <= 4 : from.y >= 5
            if (condition.crossedRiver !== crossed) return false
        }

        if (condition.notCrossedRiver !== undefined) {
            const notCrossed = side === 'red' ? from.y > 4 : from.y < 5
            if (condition.notCrossedRiver !== notCrossed) return false
        }

        // 目标条件
        const target = board[to.y][to.x]
        if (condition.targetEmpty && target) return false
        if (condition.targetEnemy && (!target || target.side === side)) return false

        // 路径/形状相关的“无阻碍”条件（别马脚、塞象眼、直线无阻挡）
        if (condition.hasNoObstacle !== undefined) {
            if (condition.hasNoObstacle) {
                if (!hasNoObstacleBetween(board, from, to)) return false
            }
        }

        if (condition.obstacleCount !== undefined) {
            const count = countObstaclesInPath(board, from, to)
            if (count !== condition.obstacleCount) return false
        }

        return true
    })

    if (!baseOk) return false

    // 绝对禁止越子：对于跨度超过1格的直线/对角/马步等形状，必须通过形状感知的无阻碍检查
    const dx = to.x - from.x
    const dy = to.y - from.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (Math.max(adx, ady) > 1) {
        if (!hasNoObstacleBetween(board, from, to)) return false
    }

    return true
}

/**
 * 检查全局限制
 */
function checkRestrictions(
    _board: Board,
    _from: Pos,
    to: Pos,
    restrictions: PieceRuleConfig['restrictions'],
    side: Side
): boolean {
    // 九宫限制
    if (restrictions.mustStayInPalace && !isPalace(to.x, to.y, side)) {
        return false
    }

    // 过河限制
    if (!restrictions.canCrossRiver) {
        if (side === 'red' && to.y < 5) return false
        if (side === 'black' && to.y > 4) return false
    }

    return true
}

/**
 * 判断是否在九宫内
 */
function isPalace(x: number, y: number, side: Side): boolean {
    if (side === 'red') return x >= 3 && x <= 5 && y >= 7 && y <= 9
    return x >= 3 && x <= 5 && y >= 0 && y <= 2
}

/**
 * 检查路径是否有障碍物
 */
function checkPathHasObstacle(board: Board, from: Pos, to: Pos): boolean {
    if (from.x === to.x) {
        const step = from.y < to.y ? 1 : -1
        for (let y = from.y + step; y !== to.y; y += step) {
            if (board[y][from.x]) return true
        }
    } else if (from.y === to.y) {
        const step = from.x < to.x ? 1 : -1
        for (let x = from.x + step; x !== to.x; x += step) {
            if (board[from.y][x]) return true
        }
    }
    return false
}

/**
 * 计算路径上的障碍物数量
 */
function countObstaclesInPath(board: Board, from: Pos, to: Pos): number {
    let count = 0
    if (from.x === to.x) {
        const step = from.y < to.y ? 1 : -1
        for (let y = from.y + step; y !== to.y; y += step) {
            if (board[y][from.x]) count++
        }
    } else if (from.y === to.y) {
        const step = from.x < to.x ? 1 : -1
        for (let x = from.x + step; x !== to.x; x += step) {
            if (board[from.y][x]) count++
        }
    }
    return count
}

/**
 * 形状感知的“无阻碍”检查：
 * - 直线：两点之间不得有子
 * - 马的日字：检查“马腿”格是否为空
 * - 象的田字：检查对角中点（象眼）是否为空
 * 其余形状：默认按直线无阻挡（对非常规形状通常不会设置该条件）
 */
function hasNoObstacleBetween(board: Board, from: Pos, to: Pos): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    // 直线
    if (dx === 0 || dy === 0) {
        return !checkPathHasObstacle(board, from, to)
    }

    // 马的日字：别马脚
    if ((adx === 2 && ady === 1) || (adx === 1 && ady === 2)) {
        let legX = from.x
        let legY = from.y
        if (adx === 2 && ady === 1) {
            legX = from.x + (dx > 0 ? 1 : -1)
            legY = from.y
        } else if (adx === 1 && ady === 2) {
            legX = from.x
            legY = from.y + (dy > 0 ? 1 : -1)
        }
        return !board[legY][legX]
    }

    // 对角线：任意距离均需确保路径中间无子（包含象眼规则的特例）
    if (adx === ady) {
        const stepX = dx > 0 ? 1 : -1
        const stepY = dy > 0 ? 1 : -1
        let x = from.x + stepX
        let y = from.y + stepY
        while (x !== to.x && y !== to.y) {
            if (board[y][x]) return false
            x += stepX
            y += stepY
        }
        return true
    }

    // 其他情况：默认放行（或按需要扩展更多形状）
    return true
}
