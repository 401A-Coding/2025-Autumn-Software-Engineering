import { useMemo, useState } from 'react'
import type { Pos, Side, GameState } from './types'
import { createInitialBoard, cloneBoard } from './types'
import { generateLegalMoves, movePiece } from './rules'

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

    const legal = useMemo(() => {
        if (!state.selected) return [] as Pos[]
        const { x, y } = state.selected
        const p = state.board[y][x]
        if (!p || p.side !== state.turn) return []
        return generateLegalMoves(state.board, { x, y }, state.turn)
    }, [state])

    function onCellClick(x: number, y: number) {
        const piece = state.board[y][x]
        // 若当前有选中且点击到合法落点，则走子
        const isLegal = legal.some(m => m.x === x && m.y === y)
        if (state.selected && isLegal) {
            const nb = movePiece(state.board, state.selected, { x, y })
            const nextTurn: Side = state.turn === 'red' ? 'black' : 'red'
            setState(s => ({
                board: nb,
                turn: nextTurn,
                selected: undefined,
                history: [...s.history, { board: cloneBoard(s.board), turn: s.turn }]
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
        setState({ board: createInitialBoard(), turn: 'red', selected: undefined, history: [] })
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>当前手：<b style={{ color: state.turn === 'red' ? '#a62337' : '#333' }}>{state.turn === 'red' ? '红' : '黑'}</b></div>
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

                {/* 落点高亮 */}
                {state.selected && legal.map((m, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: margin + m.x * cellSize - 6, top: margin + m.y * cellSize - 6, width: 12, height: 12,
                        borderRadius: '50%', background: 'rgba(166,35,55,0.5)'
                    }} />
                ))}

                {/* 棋子 */}
                {state.board.map((row, y) => row.map((p, x) => p && (
                    <div key={p.id}
                        onClick={() => onCellClick(x, y)}
                        style={{ position: 'absolute', left: margin + x * cellSize - (cellSize - 6) / 2, top: margin + y * cellSize - (cellSize - 6) / 2, cursor: 'pointer' }}>
                        <PieceGlyph type={p.type} side={p.side} />
                        {state.selected && state.selected.x === x && state.selected.y === y && (
                            <div style={{ position: 'absolute', inset: 0, border: '2px solid #a62337', borderRadius: '50%' }} />
                        )}
                    </div>
                )))}
                {/* 点击区域：以交叉点为中心的正方形，便于点选 */}
                {state.board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} onClick={() => onCellClick(x, y)} style={{ position: 'absolute', left: margin + x * cellSize - cellSize / 2, top: margin + y * cellSize - cellSize / 2, width: cellSize, height: cellSize }} />
                )))}
            </div>
        </div>
    )
}
