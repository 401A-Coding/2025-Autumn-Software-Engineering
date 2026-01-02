import { useMemo, useState } from 'react'
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket'
import type { Board, Pos, Side } from './types'
import { createInitialBoard } from './types'
import { generateLegalMoves, movePiece, isInCheck } from './rules'
import type { CustomRules, PieceType } from './types'
import { generateCustomMoves } from './customRules'
import type { CustomRuleSet } from './ruleEngine'
import { isCustomRuleSet, ruleSetToCustomRules } from './ruleAdapter'
import { generateMovesFromRules } from './ruleEngine'
import { isInCheckWithCustomRules } from './rules'
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
    // 可选：自定义规则（支持 CustomRules 或 CustomRuleSet；存在则按自定义规则计算走子、将军与胜负）
    customRules?: CustomRules | CustomRuleSet
    // 可选：强制我方阵营（优先于通过 players/myUserId 推断），用于自定义在线局将黑方固定给加入方
    forcedMySide?: Side | 'spectator'
}

export default function OnlineBoard({ moves, turnIndex, players, myUserId, onAttemptMove, winnerId, authoritativeBoard, authoritativeTurn, snapshotMoves, customRules, forcedMySide }: OnlineBoardProps) {
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
    const mySide: Side | 'spectator' = forcedMySide ?? (myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator')

    // 本地 UI 选择与合法落点提示
    const [selected, setSelected] = useState<Pos | undefined>(undefined)
    const legal = useMemo(() => {
        if (!selected) return [] as Pos[]
        const { x, y } = selected
        const p = board[y][x]
        if (!p) return []
        // 若提供自定义规则：
        // - 如果为 CustomRuleSet，则使用 ruleEngine 的 generateMovesFromRules 保持与编辑器一致
        // - 否则使用 legacy customRules 生成
        if (customRules) {
            if (isCustomRuleSet(customRules as any)) {
                const rs = customRules as CustomRuleSet
                const pieceRule = rs.pieceRules[p.type as PieceType]
                if (pieceRule && Array.isArray(pieceRule.movePatterns) && pieceRule.movePatterns.length > 0) {
                    const lm = generateMovesFromRules(board, { x, y }, pieceRule, p.side)
                    console.debug('[OnlineBoard] legal (RuleSet)', { type: p.type, side: p.side, from: { x, y }, moves: lm })
                    return lm
                }
                // 若未定义该棋子规则，降级到简化版
                const lm = generateCustomMoves(board, { x, y }, undefined)
                console.debug('[OnlineBoard] legal (fallback default)', { type: p.type, side: p.side, from: { x, y }, moves: lm })
                return lm
            }
            const lm = generateCustomMoves(board, { x, y }, customRules as CustomRules)
            console.debug('[OnlineBoard] legal (CustomRules)', { type: p.type, side: p.side, from: { x, y }, moves: lm })
            return lm
        }
        const lm = generateLegalMoves(board, { x, y }, p.side)
        console.debug('[OnlineBoard] legal (standard)', { type: p.type, side: p.side, from: { x, y }, moves: lm })
        return lm
    }, [board, selected, customRules])

    // 将军提示
    const inCheck = useMemo(() => {
        if (customRules) {
            if (isCustomRuleSet(customRules as any)) {
                try {
                    const cr = ruleSetToCustomRules(customRules as CustomRuleSet)
                    return isInCheckWithCustomRules(board, turn, cr)
                } catch {
                    return isInCheck(board, turn)
                }
            }
            return isInCheckWithCustomRules(board, turn, customRules as CustomRules)
        }
        return isInCheck(board, turn)
    }, [board, turn, customRules])
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
        // 仅依赖后端的 winnerId，避免本地误判（尤其在自定义规则下）导致点击被拦截
        return !!winnerId
    }, [winnerId])

    function onCellClick(x: number, y: number) {
        if (gameOver) {
            console.debug('[OnlineBoard] click ignored: game over')
            return
        }
        if (mySide === 'spectator') {
            console.debug('[OnlineBoard] click ignored: spectator')
            return
        }
        if (turn !== mySide) {
            console.debug('[OnlineBoard] click ignored: not my turn', { turn, mySide })
            return // 只允许当前手玩家操作
        }

        const piece = board[y][x]
        // 只能选中自己阵营的棋子
        if (!selected) {
            if (piece && piece.side === mySide) setSelected({ x, y })
            return
        }

        // 若点击到合法落点，则发起走子请求；交由服务器广播来驱动状态
        const isLegal = legal.some(m => m.x === x && m.y === y)
        if (isLegal) {
            console.debug('[OnlineBoard] send move', { from: selected, to: { x, y } })
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
        <div className="livebattle-board">
            {inCheck && !gameOver && (
                <div className="incheck-banner pulse" style={{ marginBottom: 8, textAlign: 'center' }}>⚠️ 将军！</div>
            )}

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
