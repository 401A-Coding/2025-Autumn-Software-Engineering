export type Side = 'red' | 'black'

export type Pos = { x: number; y: number }

export type MoveRecord = {
    from: Pos
    to: Pos
    turn: Side
    ts: number
}

export type Bookmark = {
    id: string
    step: number // 第几步后（应用完该步）
    label?: string
    note?: string
}

export type Note = {
    id: string
    step: number
    text: string
    ts: number
}

export type GameResult = 'red' | 'black' | 'draw' | undefined

export type ChessRecord = {
    id: string
    startedAt: string // ISO
    endedAt?: string // ISO
    opponent?: string // 本地对战可为空或"本地"
    result?: GameResult
    keyTags?: string[]
    favorite?: boolean
    moves: MoveRecord[]
    bookmarks?: Bookmark[]
    notes?: Note[]
}
