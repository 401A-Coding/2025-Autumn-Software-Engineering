import { useMemo, useState } from 'react'
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket'
import type { Board, Pos, Side } from './types'
import { createInitialBoard } from './types'
import { generateLegalMoves, movePiece, checkGameOver, isInCheck } from './rules'
import './board.css'

function PieceGlyph({ type, side }: { type: string; side: Side }) {
    const textMap: Record<string, string> = {
        general: side === 'red' ? '帥' : '將',
        advisor: side === 'red' ? '仕' : '士',
        elephant: side === 'red' ? '相' : '象',
        horse: '馬',
        rook: '車',
        cannon: '炮',
        soldier: side === 'red' ? '兵' : '卒',
    }
    return (
        <div className={`piece ${side === 'red' ? 'piece--red' : 'piece--black'}`}>
            {textMap[type] || '?'}
        </div>
    )
}

export type OnlineBoardProps = {
    moves: BattleMove[]
    turnIndex: 0 | 1
    players: number[]
    myUserId?: number | null
    onAttemptMove: (from: Pos, to: Pos) => void
    winnerId?: number | null
    // 来自权威快照的棋盘与轮次
    authoritativeBoard?: Board
    authoritativeTurn?: Side
    // 用于与本地 moves 对齐的快照 moves（可为空）
    snapshotMoves?: BattleSnapshot['moves']
}

export default function OnlineBoard({ moves, turnIndex, players, myUserId, onAttemptMove, winnerId, authoritativeBoard, authoritativeTurn, snapshotMoves }: OnlineBoardProps) {
    // 优先使用权威快照棋盘；若快照落后，则在其基础上补推增量 moves；再不行退回全量 moves 推演
    const board = useMemo(() => {
        // 无权威棋盘：从初始局面 + 全量 moves 推演
        if (!authoritativeBoard) {
            let b = createInitialBoard()
            for (const m of moves) {
                b = movePiece(b, m.from as Pos, m.to as Pos)
            }
            return b
        }

        const snapMoves = snapshotMoves ?? []
        const snapLast = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0
        const localLast = moves.length ? moves[moves.length - 1].seq : 0

        // 若快照至少不比本地落后，直接使用快照棋盘
        if (snapLast >= localLast) {
            return authoritativeBoard
        }

        // 快照落后：从快照棋盘起步，用新增 moves 补齐
        let b = authoritativeBoard
        for (const m of moves) {
            if (m.seq > snapLast) {
                b = movePiece(b, m.from as Pos, m.to as Pos)
            }
        }
        return b
    }, [authoritativeBoard, moves, snapshotMoves])

    // 当前手：优先使用权威 turn；否则使用 turnIndex 推断
    const turn: Side = authoritativeTurn ?? (turnIndex === 0 ? 'red' : 'black')

    // 判定我方阵营与观战
    const redUser = players?.[0]
    const blackUser = players?.[1]
    const mySide: Side | 'spectator' = myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator'

    // 本地 UI 选择与合法落点提示
    const [selected, setSelected] = useState<Pos | undefined>(undefined)
    const legal = useMemo(() => {
        if (!selected) return [] as Pos[]
        const { x, y } = selected
        const p = board[y][x]
        if (!p) return []
        return generateLegalMoves(board, { x, y }, p.side)
    }, [board, selected])

    // 将军提示
    const inCheck = useMemo(() => isInCheck(board, turn), [board, turn])
    const kingInCheckPos = useMemo(() => {
        if (!inCheck) return null
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 9; x++) {
                const p = board[y][x]
                if (p && p.type === 'general' && p.side === turn) return { x, y }
            }
        }
        return null
    }, [inCheck, board, turn])

    const gameOver = useMemo(() => {
        // UI 层简单判断：若后端给 winnerId 则优先生效；否则按本地规则检测（仅参考）
        if (winnerId) return true
        const nextTurn: Side = turn === 'red' ? 'black' : 'red'
        const r = checkGameOver(board, nextTurn)
        return r !== null
    }, [board, turn, winnerId])

    function onCellClick(x: number, y: number) {
        if (gameOver) return
        if (mySide === 'spectator') return
        if (turn !== mySide) return // 只允许当前手玩家操作

        const piece = board[y][x]
        // 只能选中自己阵营的棋子
        if (!selected) {
            if (piece && piece.side === mySide) setSelected({ x, y })
            return
        }

        // 若点击到合法落点，则发起走子请求；交由服务器广播来驱动状态
        const isLegal = legal.some(m => m.x === x && m.y === y)
        if (isLegal) {
            onAttemptMove(selected, { x, y })
            setSelected(undefined)
            return
        }

        // 重选
        if (piece && piece.side === mySide) setSelected({ x, y })
        else setSelected(undefined)
    }

    const isFlipped = mySide === 'black'

    return (
        <div>
            <div className="board-toolbar">
                <div className="board-toolbar__left">
                    <div>
                        我方：<b className={mySide === 'red' ? 'turn-red' : mySide === 'black' ? 'turn-black' : 'turn-draw'}>
                            {mySide === 'spectator' ? '观战' : mySide === 'red' ? '红' : '黑'}
                        </b>
                        <span className="ml-12">
                            当前手：<b className={turn === 'red' ? 'turn-red' : 'turn-black'}>{turn === 'red' ? '红' : '黑'}</b>
                        </span>
                    </div>
                    {inCheck && !gameOver && (
                        <div className="incheck-banner pulse">⚠️ 将军！</div>
                    )}
                </div>
                <div className="board-toolbar__actions">
                    {/* 在线对战暂不支持重新开始；悔棋按钮保留占位（禁用） */}
                    <button className="btn-ghost" disabled>悔棋</button>
                </div>
            </div>

            <div className={`board ${isFlipped ? 'board--flip' : ''}`}>
                {Array.from({ length: 10 }).map((_, row) => (
                    <div key={'h' + row} className={`grid-h row-${row}`} />
                ))}
                {Array.from({ length: 9 }).map((_, col) => (
                    <div key={'v' + col} className={`grid-v col-${col}`} />
                ))}
                <div className="river-line" />
                <div className="river-text">楚河        漢界</div>
                <div className="palace-top" />
                <div className="palace-bottom" />

                {/* 落点高亮（仅空位） */}
                {selected && legal.filter(m => !board[m.y][m.x]).map((m, i) => (
                    <div key={i} className={`dot dot-x-${m.x} dot-y-${m.y}`} />
                ))}

                {/* 棋子 */}
                {board.map((row, y) => row.map((p, x) => {
                    const canCapture = selected && legal.some(m => m.x === x && m.y === y) && p
                    return p && (
                        <div key={p.id}
                            onClick={() => onCellClick(x, y)}
                            className={`piece-wrap piece-x-${x} piece-y-${y}`}>
                            <PieceGlyph type={p.type} side={p.side} />
                            {selected && selected.x === x && selected.y === y && (
                                <div className="piece-selected" />
                            )}
                            {kingInCheckPos && kingInCheckPos.x === x && kingInCheckPos.y === y && (
                                <div className="king-check pulse" />
                            )}
                            {canCapture && (
                                <div className="capture-ring" />
                            )}
                        </div>
                    )
                }))}

                {/* 点击区域 */}
                {board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} onClick={() => onCellClick(x, y)} className={`click-area cell-x-${x} cell-y-${y}`} />
                )))}
            </div>

        </div>
    )
}
