import React, { useMemo } from 'react'
import { createInitialBoard } from './types'
import { movePiece } from './rules'
import type { Side } from './types'
import type { MoveRecord } from '../records/types'
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
    return <div className={`piece ${side === 'red' ? 'piece--red' : 'piece--black'}`}>{textMap[type] || '?'}</div>
}

export default function BoardViewer({ moves, step }: { moves: MoveRecord[]; step: number }) {
    const { board, last } = useMemo(() => {
        const b = createInitialBoard()
        let last: { x: number; y: number } | null = null
        for (let i = 0; i < Math.min(step, moves.length); i++) {
            const m = moves[i]
            const nb = movePiece(b, m.from, m.to)
            // mutate b in place (movePiece returns new board or mutated? In our impl it returns new board)
            for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) b[y][x] = nb[y][x]
            last = m.to
        }
        return { board: b, last }
    }, [moves, step])

    return (
        <div className="board">
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

            {board.map((row, y) =>
                row.map((p, x) =>
                    p ? (
                        <div key={p.id} className={`piece-wrap piece-x-${x} piece-y-${y}`}>
                            <PieceGlyph type={p.type} side={p.side} />
                            {last && last.x === x && last.y === y && <div className="piece-selected" />}
                        </div>
                    ) : null
                )
            )}
        </div>
    )
}
