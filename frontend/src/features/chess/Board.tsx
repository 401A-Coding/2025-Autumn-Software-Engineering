import { useMemo, useState, useEffect } from 'react'
import type { Pos, Side, GameState } from './types'
import { createInitialBoard, cloneBoard } from './types'
import { generateLegalMoves, movePiece, checkGameOver, isInCheck } from './rules'

const cellSize = 40 // px
const margin = cellSize / 2 // 让棋子落在格线交叉点（居中），避免靠边溢出

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
        <div style={{
            width: cellSize - 6,
            height: cellSize - 6,
            borderRadius: '50%',
            border: `2px solid ${side === 'red' ? '#a62337' : '#333'}`,
            color: side === 'red' ? '#a62337' : '#333',
            background: '#fffdf7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700
        }}>
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
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                        当前手：<b style={{ color: state.turn === 'red' ? '#a62337' : '#333' }}>{state.turn === 'red' ? '红' : '黑'}</b>
                    </div>
                    {inCheck && !state.winner && (
                        <div style={{
                            padding: '4px 12px',
                            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                            color: 'white',
                            borderRadius: 4,
                            fontSize: 14,
                            fontWeight: 700,
                            animation: 'pulse 1.5s ease-in-out infinite',
                            boxShadow: '0 2px 8px rgba(255,107,107,0.4)',
                        }}>
                            ⚠️ 将军！
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" onClick={undo}>悔棋</button>
                    <button className="btn-primary" onClick={restart}>重新开始</button>
                </div>
            </div>

            <div style={{
                position: 'relative',
                width: cellSize * 9,
                height: cellSize * 10,
                background: '#f7e6c4',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 0 0 2px #e7d8b1',
            }}>
                {/* 网格线（加内边距，使交叉点处于容器内部）*/}
                {Array.from({ length: 10 }).map((_, row) => (
                    <div key={'h' + row} style={{ position: 'absolute', left: margin, right: margin, top: margin + row * cellSize, height: 1, background: '#c9b37e' }} />
                ))}
                {Array.from({ length: 9 }).map((_, col) => (
                    <div key={'v' + col} style={{ position: 'absolute', top: margin, bottom: margin, left: margin + col * cellSize, width: 1, background: '#c9b37e' }} />
                ))}
                {/* 楚河汉界 */}
                <div style={{ position: 'absolute', left: margin, right: margin, top: margin + cellSize * 4.5, height: 1, background: '#7f6a3c' }} />
                <div style={{ position: 'absolute', left: margin, right: margin, top: margin + cellSize * 4.5 - 8, textAlign: 'center', color: '#7f3b2f', fontWeight: 700, opacity: .3 }}>
                    楚河        漢界
                </div>
                {/* 宫线（简化：只画边框） */}
                <div style={{ position: 'absolute', left: margin + cellSize * 3, top: margin + 0, width: cellSize * 3, height: cellSize * 3, boxShadow: 'inset 0 0 0 1px #c9b37e' }} />
                <div style={{ position: 'absolute', left: margin + cellSize * 3, top: margin + cellSize * 7, width: cellSize * 3, height: cellSize * 3, boxShadow: 'inset 0 0 0 1px #c9b37e' }} />

                {/* 落点高亮（仅空位） */}
                {state.selected && legal.filter(m => !state.board[m.y][m.x]).map((m, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: margin + m.x * cellSize - 6, top: margin + m.y * cellSize - 6, width: 12, height: 12,
                        borderRadius: '50%', background: 'rgba(166,35,55,0.5)'
                    }} />
                ))}

                {/* 棋子 */}
                {state.board.map((row, y) => row.map((p, x) => {
                    // 检查该位置是否是可吃子的目标
                    const canCapture = state.selected && legal.some(m => m.x === x && m.y === y) && p && p.side !== state.turn
                    
                    return p && (
                        <div key={p.id}
                            onClick={() => onCellClick(x, y)}
                            style={{ position: 'absolute', left: margin + x * cellSize - (cellSize - 6) / 2, top: margin + y * cellSize - (cellSize - 6) / 2, cursor: 'pointer' }}>
                            <PieceGlyph type={p.type} side={p.side} />
                            {state.selected && state.selected.x === x && state.selected.y === y && (
                                <div style={{ position: 'absolute', inset: 0, border: '2px solid #a62337', borderRadius: '50%' }} />
                            )}
                            {/* 将军高亮 */}
                            {kingInCheckPos && kingInCheckPos.x === x && kingInCheckPos.y === y && (
                                <div style={{ 
                                    position: 'absolute', 
                                    inset: -4, 
                                    border: '3px solid #ff6b6b', 
                                    borderRadius: '50%',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                    boxShadow: '0 0 12px rgba(255,107,107,0.6)',
                                }} />
                            )}
                            {/* 可吃子高亮 */}
                            {canCapture && (
                                <div style={{ 
                                    position: 'absolute', 
                                    inset: -3, 
                                    border: '3px solid #ff9800', 
                                    borderRadius: '50%',
                                    boxShadow: '0 0 8px rgba(255,152,0,0.6), inset 0 0 8px rgba(255,152,0,0.3)',
                                }} />
                            )}
                        </div>
                    )
                }))}
                {/* 点击区域：以交叉点为中心的正方形，便于点选 */}
                {state.board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} onClick={() => onCellClick(x, y)} style={{ position: 'absolute', left: margin + x * cellSize - cellSize / 2, top: margin + y * cellSize - cellSize / 2, width: cellSize, height: cellSize }} />
                )))}
            </div>

            {/* 游戏结束提示 */}
            {showGameOver && state.winner && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div className="paper-card" style={{ 
                        padding: 32, 
                        minWidth: 300,
                        textAlign: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ 
                            fontSize: 32, 
                            fontWeight: 700,
                            marginBottom: 16,
                            color: state.winner === 'red' ? '#a62337' : state.winner === 'black' ? '#333' : '#666',
                        }}>
                            {getWinnerText()}
                        </div>
                        
                        {state.winner !== 'draw' && (
                            <div style={{ 
                                fontSize: 14, 
                                color: 'var(--muted)', 
                                marginBottom: 24 
                            }}>
                                {state.winner === 'red' ? '黑方' : '红方'}已无法继续对局
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button 
                                className="btn-ghost" 
                                onClick={() => setShowGameOver(false)}
                                style={{ minWidth: 100 }}
                            >
                                查看棋局
                            </button>
                            <button 
                                className="btn-primary" 
                                onClick={restart}
                                style={{ minWidth: 100 }}
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
