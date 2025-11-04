import { useMemo, useState, useEffect } from 'react'
import type { Pos, Side, GameState } from './types'
import { createInitialBoard, cloneBoard } from './types'
import { generateLegalMoves, movePiece, checkGameOver, isInCheck } from './rules'
import './board.css'

// Board metrics are defined in CSS (board.css). Keep TS constants removed.

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

export default function Board() {
    const [state, setState] = useState<GameState>({
        board: createInitialBoard(),
        turn: 'red',
        selected: undefined,
        history: [],
    })
    const [showGameOver, setShowGameOver] = useState(false)

    // 检查当前方是否被将军
    const inCheck = useMemo(() => {
        return isInCheck(state.board, state.turn)
    }, [state.board, state.turn])

    // 获取被将军的将帅位置（用于高亮）
    const kingInCheckPos = useMemo(() => {
        if (!inCheck) return null
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 9; x++) {
                const p = state.board[y][x]
                if (p && p.type === 'general' && p.side === state.turn) {
                    return { x, y }
                }
            }
        }
        return null
    }, [inCheck, state.board, state.turn])

    // 检查游戏是否结束
    useEffect(() => {
        if (state.winner) {
            setShowGameOver(true)
        }
    }, [state.winner])

    const legal = useMemo(() => {
        if (!state.selected) return [] as Pos[]
        const { x, y } = state.selected
        const p = state.board[y][x]
        if (!p || p.side !== state.turn) return []
        return generateLegalMoves(state.board, { x, y }, state.turn)
    }, [state])

    function onCellClick(x: number, y: number) {
        // 游戏结束后不允许继续走子
        if (state.winner) return

        const piece = state.board[y][x]
        // 若当前有选中且点击到合法落点，则走子
        const isLegal = legal.some(m => m.x === x && m.y === y)
        if (state.selected && isLegal) {
            const nb = movePiece(state.board, state.selected, { x, y })
            const nextTurn: Side = state.turn === 'red' ? 'black' : 'red'

            // 检查游戏是否结束
            const gameResult = checkGameOver(nb, nextTurn)

            setState(s => ({
                board: nb,
                turn: nextTurn,
                selected: undefined,
                history: [...s.history, { board: cloneBoard(s.board), turn: s.turn }],
                winner: gameResult || undefined,
            }))
            return
        }
        // 否则：若该格有当前行棋方的棋子，则选中
        if (piece && piece.side === state.turn) { setState(s => ({ ...s, selected: { x, y } })) }
    }

    function undo() {
        setState(s => {
            if (s.history.length === 0) return s
            const last = s.history[s.history.length - 1]
            return { ...s, board: cloneBoard(last.board), turn: last.turn, selected: undefined, history: s.history.slice(0, -1) }
        })
    }

    function restart() {
        setState({ board: createInitialBoard(), turn: 'red', selected: undefined, history: [], winner: undefined })
        setShowGameOver(false)
    }

    function getWinnerText() {
        if (!state.winner) return ''
        if (state.winner === 'draw') return '和棋'
        return state.winner === 'red' ? '🎉 红方获胜！' : '🎉 黑方获胜！'
    }

    return (
        <div>
            <div className="board-toolbar">
                <div className="board-toolbar__left">
                    <div>
                        当前手：<b className={state.turn === 'red' ? 'turn-red' : 'turn-black'}>{state.turn === 'red' ? '红' : '黑'}</b>
                    </div>
                    {inCheck && !state.winner && (
                        <div className="incheck-banner pulse">⚠️ 将军！</div>
                    )}
                </div>
                <div className="board-toolbar__actions">
                    <button className="btn-ghost" onClick={undo}>悔棋</button>
                    <button className="btn-primary" onClick={restart}>重新开始</button>
                </div>
            </div>

            <div className="board">
                {/* 网格线（加内边距，使交叉点处于容器内部）*/}
                {Array.from({ length: 10 }).map((_, row) => (
                    <div key={'h' + row} className={`grid-h row-${row}`} />
                ))}
                {Array.from({ length: 9 }).map((_, col) => (
                    <div key={'v' + col} className={`grid-v col-${col}`} />
                ))}
                {/* 楚河汉界 */}
                <div className="river-line" />
                <div className="river-text">楚河        漢界</div>
                {/* 宫线（简化：只画边框） */}
                <div className="palace-top" />
                <div className="palace-bottom" />

                {/* 落点高亮（仅空位） */}
                {state.selected && legal.filter(m => !state.board[m.y][m.x]).map((m, i) => (
                    <div key={i} className={`dot dot-x-${m.x} dot-y-${m.y}`} />
                ))}

                {/* 棋子 */}
                {state.board.map((row, y) => row.map((p, x) => {
                    // 检查该位置是否是可吃子的目标
                    const canCapture = state.selected && legal.some(m => m.x === x && m.y === y) && p && p.side !== state.turn

                    return p && (
                        <div key={p.id}
                            onClick={() => onCellClick(x, y)}
                            className={`piece-wrap piece-x-${x} piece-y-${y}`}>
                            <PieceGlyph type={p.type} side={p.side} />
                            {state.selected && state.selected.x === x && state.selected.y === y && (
                                <div className="piece-selected" />
                            )}
                            {/* 将军高亮 */}
                            {kingInCheckPos && kingInCheckPos.x === x && kingInCheckPos.y === y && (
                                <div className="king-check pulse" />
                            )}
                            {/* 可吃子高亮 */}
                            {canCapture && (
                                <div className="capture-ring" />
                            )}
                        </div>
                    )
                }))}
                {/* 点击区域：以交叉点为中心的正方形，便于点选 */}
                {state.board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} onClick={() => onCellClick(x, y)} className={`click-area cell-x-${x} cell-y-${y}`} />
                )))}
            </div>

            {/* 游戏结束提示 */}
            {showGameOver && state.winner && (
                <div className="gameover-mask">
                    <div className="paper-card gameover-card">
                        <div className={`gameover-title ${state.winner === 'red' ? 'turn-red' : state.winner === 'black' ? 'turn-black' : 'turn-draw'}`}>
                            {getWinnerText()}
                        </div>

                        {state.winner !== 'draw' && (
                            <div className="gameover-sub">
                                {state.winner === 'red' ? '黑方' : '红方'}已无法继续对局
                            </div>
                        )}

                        <div className="gameover-actions">
                            <button
                                className="btn-ghost btn-wide"
                                onClick={() => setShowGameOver(false)}
                            >
                                查看棋局
                            </button>
                            <button
                                className="btn-primary btn-wide"
                                onClick={restart}
                            >
                                重新开始
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
