import type { Board, Pos, Side } from './types'
import { cloneBoard, inBounds } from './types'

export function findKing(board: Board, side: Side): Pos | null {
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = board[y][x]
        if (p && p.side === side && p.type === 'general') return { x, y }
    }
    return null
}

function isPalace(x: number, y: number, side: Side): boolean {
    if (side === 'red') return x >= 3 && x <= 5 && y >= 7 && y <= 9
    return x >= 3 && x <= 5 && y >= 0 && y <= 2
}

// helper (保留以备扩展)
// function samePos(a: Pos, b: Pos) { return a.x===b.x && a.y===b.y }

function pathClear(board: Board, from: Pos, to: Pos): boolean {
    if (from.x === to.x) {
        const step = from.y < to.y ? 1 : -1
        for (let y = from.y + step; y !== to.y; y += step) if (board[y][from.x]) return false
        return true
    }
    if (from.y === to.y) {
        const step = from.x < to.x ? 1 : -1
        for (let x = from.x + step; x !== to.x; x += step) if (board[from.y][x]) return false
        return true
    }
    return false
}

export function generatePseudoMoves(board: Board, from: Pos): Pos[] {
    const piece = board[from.y][from.x]
    if (!piece) return []
    const res: Pos[] = []
    const push = (x: number, y: number) => { if (inBounds(x, y)) res.push({ x, y }) }
    const occ = (x: number, y: number) => board[y][x]

    switch (piece.type) {
        case 'rook': {
            // 四个方向直到阻挡
            for (let x = from.x + 1; x < 9; x++) { if (occ(x, from.y)) { res.push({ x, y: from.y }); break; } res.push({ x, y: from.y }) }
            for (let x = from.x - 1; x >= 0; x--) { if (occ(x, from.y)) { res.push({ x, y: from.y }); break; } res.push({ x, y: from.y }) }
            for (let y = from.y + 1; y < 10; y++) { if (occ(from.x, y)) { res.push({ x: from.x, y }); break; } res.push({ x: from.x, y }) }
            for (let y = from.y - 1; y >= 0; y--) { if (occ(from.x, y)) { res.push({ x: from.x, y }); break; } res.push({ x: from.x, y }) }
            break
        }
        case 'cannon': {
            // 非吃子：与车相同；吃子：隔一个子
            // 非吃子部分
            for (let x = from.x + 1; x < 9 && !occ(x, from.y); x++) res.push({ x, y: from.y })
            for (let x = from.x - 1; x >= 0 && !occ(x, from.y); x--) res.push({ x, y: from.y })
            for (let y = from.y + 1; y < 10 && !occ(from.x, y); y++) res.push({ x: from.x, y })
            for (let y = from.y - 1; y >= 0 && !occ(from.x, y); y--) res.push({ x: from.x, y })
            // 吃子部分
            const scan = (dx: number, dy: number) => {
                let x = from.x + dx, y = from.y + dy, jumped = false
                while (inBounds(x, y)) {
                    if (!jumped) { if (occ(x, y)) { jumped = true; x += dx; y += dy; continue } }
                    else { if (occ(x, y)) { res.push({ x, y }); break } }
                    x += dx; y += dy
                }
            }
            scan(1, 0); scan(-1, 0); scan(0, 1); scan(0, -1)
            break
        }
        case 'horse': {
            const legs = [
                { leg: { x: from.x + 1, y: from.y }, moves: [{ x: from.x + 2, y: from.y + 1 }, { x: from.x + 2, y: from.y - 1 }] },
                { leg: { x: from.x - 1, y: from.y }, moves: [{ x: from.x - 2, y: from.y + 1 }, { x: from.x - 2, y: from.y - 1 }] },
                { leg: { x: from.x, y: from.y + 1 }, moves: [{ x: from.x + 1, y: from.y + 2 }, { x: from.x - 1, y: from.y + 2 }] },
                { leg: { x: from.x, y: from.y - 1 }, moves: [{ x: from.x + 1, y: from.y - 2 }, { x: from.x - 1, y: from.y - 2 }] },
            ]
            for (const l of legs) {
                if (inBounds(l.leg.x, l.leg.y) && !occ(l.leg.x, l.leg.y)) {
                    for (const m of l.moves) if (inBounds(m.x, m.y)) res.push(m)
                }
            }
            break
        }
        case 'elephant': {
            const ds = [[2, 2], [2, -2], [-2, 2], [-2, -2]]
            for (const [dx, dy] of ds) {
                const mx = from.x + dx / 2, my = from.y + dy / 2
                const tx = from.x + dx, ty = from.y + dy
                if (!inBounds(tx, ty)) continue
                // 不能过河
                if (piece.side === 'red' && ty < 5) continue
                if (piece.side === 'black' && ty > 4) continue
                if (occ(mx, my)) continue
                res.push({ x: tx, y: ty })
            }
            break
        }
        case 'advisor': {
            const ds = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
            for (const [dx, dy] of ds) {
                const tx = from.x + dx, ty = from.y + dy
                if (!inBounds(tx, ty)) continue
                if (!isPalace(tx, ty, piece.side)) continue
                res.push({ x: tx, y: ty })
            }
            break
        }
        case 'general': {
            const ds = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            for (const [dx, dy] of ds) {
                const tx = from.x + dx, ty = from.y + dy
                if (!inBounds(tx, ty)) continue
                if (!isPalace(tx, ty, piece.side)) continue
                res.push({ x: tx, y: ty })
            }
            // 飞将：若同列无子阻挡，可直接吃对方将
            // 在合法过滤阶段统一处理是否面对面，这里仅提供目标格便于校验
            break
        }
        case 'soldier': {
            const dir = piece.side === 'red' ? -1 : 1 // 红向上(-y)，黑向下(+y)
            push(from.x, from.y + dir)
            // 过河可左右平移
            if ((piece.side === 'red' && from.y <= 4) || (piece.side === 'black' && from.y >= 5)) {
                push(from.x + 1, from.y)
                push(from.x - 1, from.y)
            }
            break
        }
    }
    return res
}

// function occupiedBySide(board: Board, x:number, y:number, side: Side): boolean {
//   const p = board[y][x]
//   return !!p && p.side === side
// }

function flyingGeneralsIllegal(board: Board): boolean {
    const rk = findKing(board, 'red'), bk = findKing(board, 'black')
    if (!rk || !bk) return false
    if (rk.x !== bk.x) return false
    const x = rk.x
    const y1 = rk.y < bk.y ? rk.y : bk.y
    const y2 = rk.y < bk.y ? bk.y : rk.y
    for (let y = y1 + 1; y < y2; y++) if (board[y][x]) return false
    return true // 面对面
}

export function isInCheck(board: Board, side: Side): boolean {
    // 扫描对方所有走法，看是否能吃到本方将
    const king = findKing(board, side)
    if (!king) return false
    const opp: Side = side === 'red' ? 'black' : 'red'
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
        const p = board[y][x]
        if (!p || p.side !== opp) continue
        const moves = generatePseudoMoves(board, { x, y })
        for (const m of moves) {
            // 炮与车等需要按规则判断吃子合法性（炮隔一子/路径清空），这里做精化：
            if (p.type === 'rook') {
                if ((x === m.x || y === m.y) && pathClear(board, { x, y }, m)) {
                    if (m.x === king.x && m.y === king.y) return true
                }
            } else if (p.type === 'cannon') {
                // 炮吃子：必须隔一个子，且目标有子
                if (board[m.y][m.x]) {
                    if ((x === m.x || y === m.y)) {
                        let cnt = 0
                        if (x === m.x) { const step = y < m.y ? 1 : -1; for (let yy = y + step; yy !== m.y; yy += step) if (board[yy][x]) cnt++ }
                        else { const step = x < m.x ? 1 : -1; for (let xx = x + step; xx !== m.x; xx += step) if (board[y][xx]) cnt++ }
                        if (cnt === 1 && m.x === king.x && m.y === king.y) return true
                    }
                }
            } else {
                if (m.x === king.x && m.y === king.y) return true
            }
        }
    }
    return false
}

export function generateLegalMoves(board: Board, from: Pos, side: Side): Pos[] {
    const pseudo = generatePseudoMoves(board, from)
    const piece = board[from.y][from.x]
    if (!piece) return []
    return pseudo.filter(to => {
        // 不能落到己方子
        if (inBounds(to.x, to.y) && board[to.y][to.x]?.side === side) return false
        // 直线子路径需无阻（车/将平移已在 pathClear 中处理；马/象阻挡已在生成时判）
        if ((piece.type === 'rook' || piece.type === 'general') && (from.x === to.x || from.y === to.y)) {
            if (!pathClear(board, from, to)) return false
        }
        // 炮非吃子必须无阻；吃子需隔一个
        if (piece.type === 'cannon') {
            const target = board[to.y][to.x]
            if (!target) { if (!pathClear(board, from, to)) return false }
            else {
                let cnt = 0
                if (from.x === to.x) { const step = from.y < to.y ? 1 : -1; for (let y = from.y + step; y !== to.y; y += step) if (board[y][from.x]) cnt++ }
                else if (from.y === to.y) { const step = from.x < to.x ? 1 : -1; for (let x = from.x + step; x !== to.x; x += step) if (board[from.y][x]) cnt++ }
                else return false
                if (cnt !== 1) return false
            }
        }
        // 兵不后退
        if (piece.type === 'soldier') {
            const dir = piece.side === 'red' ? -1 : 1
            const dy = to.y - from.y
            if (dy === -dir) return false // 后退
            if (dy === 0 && Math.abs(to.x - from.x) !== 1) return false // 横移仅一步
            if (dy !== 0 && to.x !== from.x) return false // 纵向移动不横移
        }
        // 将在九宫内，士在九宫内，象不过河（已在生成时处理）
        if (piece.type === 'general' && !isPalace(to.x, to.y, piece.side)) return false
        if (piece.type === 'advisor' && !isPalace(to.x, to.y, piece.side)) return false

        // 模拟走子，检查是否自将被将军或“飞将”
        const next = cloneBoard(board)
        next[to.y][to.x] = next[from.y][from.x]
        next[from.y][from.x] = null
        if (flyingGeneralsIllegal(next)) return false
        if (isInCheck(next, side)) return false
        return true
    })
}

export function movePiece(board: Board, from: Pos, to: Pos): Board {
    const nb = cloneBoard(board)
    nb[to.y][to.x] = nb[from.y][from.x]
    nb[from.y][from.x] = null
    return nb
}
