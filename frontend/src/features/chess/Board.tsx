import { useMemo, useState, useEffect } from 'react'
import type { Pos, Side, GameState, CustomRules } from './types'
import { createInitialBoard, cloneBoard } from './types'
import { generateLegalMoves, movePiece, checkGameOver, isInCheckWithCustomRules } from './rules'
import { generateCustomMoves } from './customRules'
import type { CustomRuleSet } from './ruleEngine'
import { isCustomRuleSet, ruleSetToCustomRules } from './ruleAdapter'
import { generateMovesFromRules } from './ruleEngine'
import './board.css'

// 样式由 board.css 提供（网格线、棋子定位、标注等）

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

interface BoardProps {
    customRules?: CustomRules | CustomRuleSet
    initialBoard?: any
    initialTurn?: Side
    onMove?: (payload: { from: Pos; to: Pos; turn: Side; ts: number }) => void
    onGameOver?: (winner: NonNullable<GameState['winner']>) => void
}

export default function Board({ customRules: customRulesProp, initialBoard, initialTurn, onMove, onGameOver }: BoardProps) {
    const customRules = useMemo(() => {
        if (!customRulesProp) return undefined
        if (isCustomRuleSet(customRulesProp)) {
            return ruleSetToCustomRules(customRulesProp)
        }
        return customRulesProp
    }, [customRulesProp])

    const [state, setState] = useState<GameState>({
        board: initialBoard || createInitialBoard(),
        turn: initialTurn || 'red',
        selected: undefined,
        history: [],
        customRules,
    })
    const [showGameOver, setShowGameOver] = useState(false)

    useEffect(() => {
        setState(prev => ({ ...prev, customRules }))
    }, [customRules])

    const inCheck = useMemo(() => {
        return isInCheckWithCustomRules(state.board, state.turn, state.customRules)
    }, [state.board, state.turn, state.customRules])

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

    useEffect(() => {
        if (state.winner) setShowGameOver(true)
    }, [state.winner])

    const legal = useMemo(() => {
        if (!state.selected) return [] as Pos[]
        const { x, y } = state.selected
        const p = state.board[y][x]
        if (!p || p.side !== state.turn) return []

        if (customRulesProp && isCustomRuleSet(customRulesProp)) {
            const ruleSet = customRulesProp as CustomRuleSet
            const pieceRule = ruleSet.pieceRules[p.type]
            if (pieceRule) {
                const moves = generateMovesFromRules(state.board, { x, y }, pieceRule, state.turn)
                return moves.filter(m => {
                    const target = state.board[m.y]?.[m.x]
                    return !target || target.side !== state.turn
                })
            }
        }

        if (state.customRules) {
            const customMoves = generateCustomMoves(state.board, { x, y }, state.customRules)
            return customMoves.filter(m => {
                const target = state.board[m.y]?.[m.x]
                return !target || target.side !== state.turn
            })
        }

        return generateLegalMoves(state.board, { x, y }, state.turn)
    }, [state, customRulesProp])

    function onCellClick(x: number, y: number) {
        if (state.winner) return
        const piece = state.board[y][x]
        const isLegal = legal.some(m => m.x === x && m.y === y)
        if (state.selected && isLegal) {
            const nb = movePiece(state.board, state.selected, { x, y })
            const nextTurn: Side = state.turn === 'red' ? 'black' : 'red'
            const gameResult = checkGameOver(nb, nextTurn, state.customRules)

            setState(s => ({
                board: nb,
                turn: nextTurn,
                selected: undefined,
                history: [...s.history, { board: cloneBoard(s.board), turn: s.turn }],
                winner: gameResult || undefined,
                customRules: s.customRules,
            }))
            onMove?.({ from: state.selected!, to: { x, y }, turn: state.turn, ts: Date.now() })
            if (gameResult) onGameOver?.(gameResult)
            return
        }
        if (piece && piece.side === state.turn) { setState(s => ({ ...s, selected: { x, y } })) }
    }

    function undo() {
        setState(s => {
            if (s.history.length === 0) return s
            const last = s.history[s.history.length - 1]
            return {
                ...s,
                board: cloneBoard(last.board),
                turn: last.turn,
                selected: undefined,
                history: s.history.slice(0, -1),
                customRules: s.customRules,
            }
        })
    }

    function restart() {
        setState(s => ({
            board: initialBoard || createInitialBoard(),
            turn: initialTurn || 'red',
            selected: undefined,
            history: [],
            winner: undefined,
            customRules: s.customRules,
        }))
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

            <div className="board board-center">
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

                {state.selected && legal.filter(m => !state.board[m.y][m.x]).map((m, i) => (
                    <div key={i} className={`dot dot-x-${m.x} dot-y-${m.y}`} />
                ))}

                {state.board.map((row, y) => row.map((p, x) => {
                    const canCapture = !!(state.selected && legal.some(m => m.x === x && m.y === y) && p && p.side !== state.turn)
                    return p && (
                        <div
                            key={p.id}
                            className={`piece-wrap piece-x-${x} piece-y-${y}`}
                            onClick={() => onCellClick(x, y)}
                        >
                            <PieceGlyph type={p.type} side={p.side} />
                            {state.selected && state.selected.x === x && state.selected.y === y && (
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

                {state.board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} className={`click-area cell-x-${x} cell-y-${y}`} onClick={() => onCellClick(x, y)} />
                )))}
            </div>

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
