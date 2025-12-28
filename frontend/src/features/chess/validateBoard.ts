type Side = 'red' | 'black'
type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'soldier'
type Piece = { type: PieceType; side: Side; x: number; y: number }

const MAX_COUNTS: Record<PieceType, number> = {
    general: 1,
    advisor: 2,
    elephant: 2,
    horse: 2,
    rook: 2,
    cannon: 2,
    soldier: 5,
}

export type ValidationResult = {
    valid: boolean
    errors: string[]
    highlights?: { x: number; y: number }[]
}

function inRange(x: number, y: number) {
    return x >= 0 && x < 9 && y >= 0 && y < 10
}

function kingFacing(pieces: Piece[]) {
    // detect if two generals are on same file (x) and no piece between them
    const generals = pieces.filter(p => p.type === 'general')
    if (generals.length !== 2) return null
    const [g1, g2] = generals
    if (g1.x !== g2.x) return null
    const x = g1.x
    const minY = Math.min(g1.y, g2.y)
    const maxY = Math.max(g1.y, g2.y)
    const between = pieces.some(p => p.x === x && p.y > minY && p.y < maxY)
    return between ? null : { x }
}

function isElephantSquare(side: Side, x: number, y: number) {
    // Elephant moves two points diagonally; parity constraint + own-half
    // For red initial elephants y parity is odd (9), x even; red half y>=5
    // For black initial elephants y parity is even (0), x even; black half y<=4
    if (x % 2 !== 0) return false
    if (side === 'red') return (y % 2 === 1) && y >= 5
    return (y % 2 === 0) && y <= 4
}

function isSoldierPositionLegal(side: Side, y: number) {
    // Prevent placing soldier behind its initial row (soldiers cannot move backward)
    // Red soldiers initial row y=6, so legal y <= 6
    // Black soldiers initial row y=3, so legal y >= 3
    return side === 'red' ? y <= 6 : y >= 3
}

export default function validateBoard(pieces: Piece[] | undefined): ValidationResult {
    const errors: string[] = []
    const highlights: { x: number; y: number }[] = []
    if (!Array.isArray(pieces)) return { valid: true, errors: [] }

    // bounds and overlap
    const seen = new Set<string>()
    for (const p of pieces) {
        if (!inRange(p.x, p.y)) {
            errors.push(`越界：格 (${p.x},${p.y}) 不在 9x10 棋盘范围内`)
            highlights.push({ x: p.x, y: p.y })
            continue
        }
        const key = `${p.x},${p.y}`
        if (seen.has(key)) {
            errors.push(`重叠：多个棋子占据格 (${p.x},${p.y})`)
            highlights.push({ x: p.x, y: p.y })
        } else {
            seen.add(key)
        }
    }

    // counts per side
    const bySideType: Record<string, number> = {}
    for (const p of pieces) {
        const k = `${p.side}:${p.type}`
        bySideType[k] = (bySideType[k] || 0) + 1
        const max = MAX_COUNTS[p.type]
        if (bySideType[k] > max) {
            errors.push(`超出数量限制：${p.side === 'red' ? '红' : '黑'} 方 ${p.type} 超过 ${max} 个`)
        }
    }

    // piece-specific static rules: elephant reachable squares and soldier position legality
    for (const p of pieces) {
        if (p.type === 'elephant') {
            if (!isElephantSquare(p.side, p.x, p.y)) {
                errors.push(`象放置位置不合法：(${p.x},${p.y})`)
                highlights.push({ x: p.x, y: p.y })
            }
        }
        if (p.type === 'soldier') {
            if (!isSoldierPositionLegal(p.side, p.y)) {
                errors.push(`兵放置位置不合法：${p.side === 'red' ? '红' : '黑'} 方 兵 不应置于后方行 (${p.x},${p.y})`)
                highlights.push({ x: p.x, y: p.y })
            }
        }
    }

    // each side must have exactly one general
    const redGenerals = pieces.filter(p => p.side === 'red' && p.type === 'general').length
    const blackGenerals = pieces.filter(p => p.side === 'black' && p.type === 'general').length
    if (redGenerals !== 1) errors.push(`红方应有且仅有 1 个帅，当前：${redGenerals}`)
    if (blackGenerals !== 1) errors.push(`黑方应有且仅有 1 个将，当前：${blackGenerals}`)

    // king facing rule (将帅不能相对直视)
    const facing = kingFacing(pieces)
    if (facing) {
        errors.push('规则限制：将帅相对直视（同一列且中间无子），这是不合法的局面')
        // highlight the column where they face; for UX we highlight both generals
        const gens = pieces.filter(p => p.type === 'general' && p.x === facing.x)
        for (const g of gens) highlights.push({ x: g.x, y: g.y })
    }

    return { valid: errors.length === 0, errors, highlights }
}

// per-piece placement validator (used by BoardEditor when placing a single piece)
export function validatePlacement(candidate: Piece, pool: Piece[]): string | null {
    // count current of this type on this side
    const current = pool.filter(p => p.side === candidate.side && p.type === candidate.type).length
    if (current >= MAX_COUNTS[candidate.type]) {
        const label = candidate.type === 'general' ? (candidate.side === 'red' ? '帅' : '将')
            : candidate.type === 'advisor' ? (candidate.side === 'red' ? '仕' : '士')
                : candidate.type === 'elephant' ? (candidate.side === 'red' ? '相' : '象')
                    : candidate.type === 'horse' ? '马'
                        : candidate.type === 'rook' ? '车'
                            : candidate.type === 'cannon' ? '炮' : (candidate.side === 'red' ? '兵' : '卒')
        return `超出数量限制：${candidate.side === 'red' ? '红' : '黑'}方 ${label}`
    }

    // general must be in palace
    const inPalace = (side: Side, x: number, y: number) => {
        if (side === 'black') return x >= 3 && x <= 5 && y >= 0 && y <= 2
        return x >= 3 && x <= 5 && y >= 7 && y <= 9
    }
    const inAdvisorPoints = (side: Side, x: number, y: number) => {
        if (side === 'black') {
            const pts = [[3, 0], [5, 0], [4, 1], [3, 2], [5, 2]]
            return pts.some(([px, py]) => px === x && py === y)
        } else {
            const pts = [[3, 7], [5, 7], [4, 8], [3, 9], [5, 9]]
            return pts.some(([px, py]) => px === x && py === y)
        }
    }
    const elephantInOwnHalf = (side: Side, y: number) => (side === 'red' ? y >= 5 : y <= 4)

    if (candidate.type === 'general' && !inPalace(candidate.side, candidate.x, candidate.y)) {
        return '规则限制：将/帅不可出九宫'
    }
    if (candidate.type === 'advisor') {
        if (!inPalace(candidate.side, candidate.x, candidate.y)) return '规则限制：士不可出九宫'
        if (!inAdvisorPoints(candidate.side, candidate.x, candidate.y)) return '规则限制：士仅能在九宫斜点'
    }
    if (candidate.type === 'elephant') {
        if (!elephantInOwnHalf(candidate.side, candidate.y)) return '规则限制：象不可过河'
        if (!isElephantSquare(candidate.side, candidate.x, candidate.y)) return '规则限制：象不可放在此格（象走田字，位置不合法）'
    }
    if (candidate.type === 'soldier') {
        if (!isSoldierPositionLegal(candidate.side, candidate.y)) return '规则限制：兵不可位于本方后方行（静态摆子限制）'
    }

    return null
}
