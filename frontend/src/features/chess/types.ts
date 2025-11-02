export type Side = 'red' | 'black'

export type PieceType =
    | 'general'  // 将/帅
    | 'advisor'  // 士/仕
    | 'elephant' // 象/相
    | 'horse'    // 马
    | 'rook'     // 车
    | 'cannon'   // 炮
    | 'soldier'  // 兵/卒

export interface Piece {
    id: string
    type: PieceType
    side: Side
}

export interface Pos { x: number; y: number }

// 9x10 棋盘：x:0..8, y:0..9；y=9 为红方底线，红方先手
export type Board = (Piece | null)[][] // [y][x]

export interface GameState {
    board: Board
    turn: Side
    selected?: Pos
    history: { board: Board; turn: Side }[]
    winner?: Side | 'draw'
}

export function cloneBoard(b: Board): Board {
    return b.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

export function inBounds(x: number, y: number): boolean {
    return x >= 0 && x < 9 && y >= 0 && y < 10
}

export function createInitialBoard(): Board {
    const b: Board = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null))
    let id = 0
    const add = (x: number, y: number, type: PieceType, side: Side) => {
        b[y][x] = { id: `${side}-${type}-${id++}`, type, side }
    }
    // 黑方（上）
    add(0, 0, 'rook', 'black'); add(8, 0, 'rook', 'black')
    add(1, 0, 'horse', 'black'); add(7, 0, 'horse', 'black')
    add(2, 0, 'elephant', 'black'); add(6, 0, 'elephant', 'black')
    add(3, 0, 'advisor', 'black'); add(5, 0, 'advisor', 'black')
    add(4, 0, 'general', 'black')
    add(1, 2, 'cannon', 'black'); add(7, 2, 'cannon', 'black')
    for (let x = 0; x < 9; x += 2) add(x, 3, 'soldier', 'black')
    // 红方（下）
    add(0, 9, 'rook', 'red'); add(8, 9, 'rook', 'red')
    add(1, 9, 'horse', 'red'); add(7, 9, 'horse', 'red')
    add(2, 9, 'elephant', 'red'); add(6, 9, 'elephant', 'red')
    add(3, 9, 'advisor', 'red'); add(5, 9, 'advisor', 'red')
    add(4, 9, 'general', 'red')
    add(1, 7, 'cannon', 'red'); add(7, 7, 'cannon', 'red')
    for (let x = 0; x < 9; x += 2) add(x, 6, 'soldier', 'red')
    return b
}
