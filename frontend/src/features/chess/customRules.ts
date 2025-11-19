import type { Board, Pos, Side, CustomRules } from './types'
import { inBounds } from './types'

/**
 * 根据自定义规则生成伪合法走法
 */
export function generateCustomMoves(board: Board, from: Pos, customRules?: CustomRules): Pos[] {
    const piece = board[from.y][from.x]
    if (!piece) return []

    const rules = customRules ?? getDefaultRules()
    const rule = (rules as any)[piece.type]
    if (!rule) return []

    const res: Pos[] = []
    const side: Side = piece.side

    for (const pattern of rule.moves) {
        const dx = pattern.dx || 0
        const dy = pattern.dy || 0
        // displayDy: 编辑器中 dy 以编辑者视角为准，运行时根据棋子阵营翻转（red 方向相反）
        const displayDy = side === 'red' ? -dy : dy

        // 条件：位置型（过河/九宫）优先判断
        if (pattern.conditions && pattern.conditions.length) {
            let ok = true
            const crossedHere = side === 'red' ? from.y < 5 : from.y > 4
            for (const cond of pattern.conditions) {
                if (cond.type === 'position') {
                    if ((cond as any).crossedRiver !== undefined) {
                        if ((cond as any).crossedRiver !== crossedHere) { ok = false; break }
                    }
                    if ((cond as any).notCrossedRiver !== undefined) {
                        if ((cond as any).notCrossedRiver === crossedHere) { ok = false; break }
                    }
                    if ((cond as any).inPalace !== undefined) {
                        const pal = isPalace(from.x + dx, from.y + displayDy, side)
                        if ((cond as any).inPalace !== pal) { ok = false; break }
                    }
                }
            }
            if (!ok) continue
        }

        const canJump = !!rule.canJump

        // repeat 模式（直线、车/炮类）
        if (pattern.repeat) {
            let step = 1
            const maxStep = rule.maxRange && rule.maxRange > 0 ? rule.maxRange : 100
            while (step <= maxStep) {
                const tx = from.x + dx * step
                const ty = from.y + displayDy * step
                if (!inBounds(tx, ty)) break
                if (rule.palaceOnly && !isPalace(tx, ty, side)) break

                // 对于非跳跃规则，且没有特意声明 path.obstacleCount（例如炮的吃子模式），
                // 需要先检测路径中是否有阻挡以防止越子
                const pathCond = pattern.conditions?.find((c: any) => c.type === 'path' && (c as any).obstacleCount !== undefined) as any | undefined
                if (!canJump && !pathCond) {
                    const totalDx = dx * step
                    const totalDy = displayDy * step
                    const unitX = totalDx === 0 ? 0 : (totalDx > 0 ? 1 : -1)
                    const unitY = totalDy === 0 ? 0 : (totalDy > 0 ? 1 : -1)
                    const stepsCount = Math.max(Math.abs(totalDx), Math.abs(totalDy))
                    let blockedInPath = false
                    for (let j = 1; j < stepsCount; j++) {
                        const ix = from.x + unitX * j
                        const iy = from.y + unitY * j
                        if (!inBounds(ix, iy)) { blockedInPath = true; break }
                        if (board[iy][ix]) { blockedInPath = true; break }
                    }
                    if (blockedInPath) break
                }

                const target = board[ty][tx]
                const pathCondLocal = pathCond ?? pattern.conditions?.find((c: any) => c.type === 'path' && (c as any).obstacleCount !== undefined) as any | undefined
                if (pathCondLocal) console.debug('[CANNON-CHECK] from=', from, 'pattern=', pattern, 'displayDy=', displayDy)

                if (target) {
                    const isEnemy = target.side !== side

                    // 如果有 path.obstacleCount 要求（例如炮吃子），按障碍数判断
                    if (pathCondLocal) {
                        const need = pathCondLocal.obstacleCount
                        const cnt = countObstaclesInPath(board, from, { x: tx, y: ty })
                        console.debug('[CANNON-CHECK] target=', { x: tx, y: ty, target }, 'need=', need, 'count=', cnt)
                        if (cnt !== need) {
                            // 不满足障碍数要求，视作被阻挡
                            if (!canJump) break
                        } else {
                            if (pattern.captureOnly) {
                                if (isEnemy) {
                                    console.debug('[CANNON-CHECK] ALLOW CAPTURE', from, '->', { x: tx, y: ty })
                                    res.push({ x: tx, y: ty })
                                }
                            } else if (pattern.moveOnly) {
                                // moveOnly 与遇子冲突，视为阻挡
                                if (!canJump) break
                            } else {
                                if (isEnemy) {
                                    console.debug('[CANNON-CHECK] ALLOW DEFAULT CAPTURE', from, '->', { x: tx, y: ty })
                                    res.push({ x: tx, y: ty })
                                }
                            }
                        }
                    } else {
                        if (pattern.captureOnly) {
                            if (isEnemy) res.push({ x: tx, y: ty })
                        } else if (pattern.moveOnly) {
                            if (!canJump) break
                        } else {
                            if (isEnemy) res.push({ x: tx, y: ty })
                        }
                    }
                } else {
                    // 空位：非 captureOnly 才能走
                    if (!pattern.captureOnly) res.push({ x: tx, y: ty })
                }

                if (!canJump && target) break
                step++
            }
        } else {
            // 单步移动
            const tx = from.x + dx
            const ty = from.y + displayDy
            if (!inBounds(tx, ty)) continue
            if (rule.palaceOnly && !isPalace(tx, ty, side)) continue

            // 处理别马脚 / path.hasNoObstacle
            const pathNoObstacleCond = pattern.conditions?.find((c: any) => c.type === 'path' && (c as any).hasNoObstacle) as any | undefined
            if (pathNoObstacleCond) {
                const absDx = Math.abs(dx)
                const absDy = Math.abs(displayDy)
                let legX = from.x, legY = from.y
                if (absDx === 2 && absDy === 1) {
                    legX = from.x + (dx > 0 ? 1 : -1)
                    legY = from.y
                } else if (absDx === 1 && absDy === 2) {
                    legX = from.x
                    legY = from.y + (displayDy > 0 ? 1 : -1)
                }
                if (!inBounds(legX, legY)) continue
                if (board[legY][legX]) continue
            }

            // 过河限制
            if (!rule.canCrossBorder) {
                if (side === 'red' && ty < 5) continue
                if (side === 'black' && ty > 4) continue
            }

            const target = board[ty][tx]
            const isEnemy = !!target && target.side !== side

            if (pattern.captureOnly) {
                if (isEnemy) res.push({ x: tx, y: ty })
            } else if (pattern.moveOnly) {
                if (!target) res.push({ x: tx, y: ty })
            } else {
                if (!target || isEnemy) res.push({ x: tx, y: ty })
            }
        }
    }

    return res
}

// 计算路径上的障碍物数量（用于判断炮的隔子吃）
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

function isPalace(x: number, y: number, side: Side): boolean {
    if (side === 'red') return x >= 3 && x <= 5 && y >= 7 && y <= 9
    return x >= 3 && x <= 5 && y >= 0 && y <= 2
}

/**
 * 获取默认规则（标准象棋规则）
 */
export function getDefaultRules(): CustomRules {
    return {
        rook: {
            moves: [
                { dx: 1, dy: 0, repeat: true },
                { dx: -1, dy: 0, repeat: true },
                { dx: 0, dy: 1, repeat: true },
                { dx: 0, dy: -1, repeat: true },
            ],
            canJump: false,
            maxRange: 0,
        },
        cannon: {
            moves: [
                // 普通移动：沿直线重复走，但仅限于空格（遇子即阻挡）
                { dx: 1, dy: 0, repeat: true, moveOnly: true },
                { dx: -1, dy: 0, repeat: true, moveOnly: true },
                { dx: 0, dy: 1, repeat: true, moveOnly: true },
                { dx: 0, dy: -1, repeat: true, moveOnly: true },
                // 吃子规则（炮）：沿直线捕吃时需要恰好有一个隔子（obstacleCount === 1）
                { dx: 1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: -1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: 0, dy: 1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: 0, dy: -1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
            ],
            canJump: false, // 炮不允许越子（通过 obstacleCount 控制吃）
            maxRange: 0,
        },
        horse: {
            moves: [
                { dx: 2, dy: 1 },
                { dx: 2, dy: -1 },
                { dx: -2, dy: 1 },
                { dx: -2, dy: -1 },
                { dx: 1, dy: 2 },
                { dx: 1, dy: -2 },
                { dx: -1, dy: 2 },
                { dx: -1, dy: -2 },
            ],
            canJump: false, // 马脚需要特殊处理
            maxRange: 0,
        },
        elephant: {
            moves: [
                { dx: 2, dy: 2 },
                { dx: 2, dy: -2 },
                { dx: -2, dy: 2 },
                { dx: -2, dy: -2 },
            ],
            canJump: false,
            canCrossBorder: false,
            maxRange: 0,
        },
        advisor: {
            moves: [
                { dx: 1, dy: 1 },
                { dx: 1, dy: -1 },
                { dx: -1, dy: 1 },
                { dx: -1, dy: -1 },
            ],
            canJump: true,
            palaceOnly: true,
            maxRange: 0,
        },
        general: {
            moves: [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
            ],
            canJump: true,
            palaceOnly: true,
            maxRange: 0,
        },
        soldier: {
            moves: [
                { dx: 0, dy: 1, condition: 'forward' as const },
                { dx: 1, dy: 0, condition: 'crossed' as const },
                { dx: -1, dy: 0, condition: 'crossed' as const },
            ],
            canJump: true,
            maxRange: 0,
        },
    }
}

/**
 * 预设规则：超级象棋（所有棋子能力增强）
 */
export function getSuperRules(): CustomRules {
    return {
        rook: {
            moves: [
                { dx: 1, dy: 0, repeat: true },
                { dx: -1, dy: 0, repeat: true },
                { dx: 0, dy: 1, repeat: true },
                { dx: 0, dy: -1, repeat: true },
                { dx: 1, dy: 1, repeat: true }, // 新增斜线
                { dx: -1, dy: -1, repeat: true },
            ],
            canJump: false,
            maxRange: 0,
        },
        horse: {
            moves: [
                { dx: 2, dy: 1 },
                { dx: 2, dy: -1 },
                { dx: -2, dy: 1 },
                { dx: -2, dy: -1 },
                { dx: 1, dy: 2 },
                { dx: 1, dy: -2 },
                { dx: -1, dy: 2 },
                { dx: -1, dy: -2 },
            ],
            canJump: true, // 马可以跳跃
            maxRange: 0,
        },
        elephant: {
            moves: [
                { dx: 2, dy: 2 },
                { dx: 2, dy: -2 },
                { dx: -2, dy: 2 },
                { dx: -2, dy: -2 },
            ],
            canJump: true, // 象可以跳跃
            canCrossBorder: true, // 象可以过河
            maxRange: 0,
        },
        soldier: {
            moves: [
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
            ],
            canJump: true,
            maxRange: 0, // 兵可以任意方向
        },
        cannon: {
            moves: [
                // 普通移动：沿直线重复走，但仅限于空格（遇子即阻挡）
                { dx: 1, dy: 0, repeat: true, moveOnly: true },
                { dx: -1, dy: 0, repeat: true, moveOnly: true },
                { dx: 0, dy: 1, repeat: true, moveOnly: true },
                { dx: 0, dy: -1, repeat: true, moveOnly: true },
                // 吃子规则（炮）：沿直线捕吃时需要恰好有一个隔子（obstacleCount === 1）
                { dx: 1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: -1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: 0, dy: 1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
                { dx: 0, dy: -1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
            ],
            canJump: false,
            maxRange: 0,
        },
        advisor: {
            moves: [
                { dx: 1, dy: 1 },
                { dx: 1, dy: -1 },
                { dx: -1, dy: 1 },
                { dx: -1, dy: -1 },
            ],
            canJump: true,
            palaceOnly: true,
            maxRange: 0,
        },
        general: {
            moves: [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
            ],
            canJump: true,
            palaceOnly: true,
            maxRange: 0,
        },
    }
}
