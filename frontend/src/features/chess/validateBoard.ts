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
