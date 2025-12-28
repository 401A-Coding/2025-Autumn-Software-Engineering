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
    // 对战模式：standard=标准对战，custom=自定义规则对战
    mode?: 'standard' | 'custom'
    // 起始布局（残局/自定义棋局），用于复盘重放起点 - 标准对战使用
    initialLayout?: { pieces: { type: string; side: Side; x: number; y: number }[] }
    // 自定义对战的完整棋盘布局（二维数组格式）
    customLayout?: any[][]
    // 自定义规则（CustomRuleSet 格式）
    customRules?: any
}
