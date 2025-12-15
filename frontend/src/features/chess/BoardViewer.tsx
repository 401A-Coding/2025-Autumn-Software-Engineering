import { useMemo } from 'react'
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

type InitialLayout = { pieces?: { type: string; side: Side; x: number; y: number }[] }

export default function BoardViewer({ moves, step, initialLayout }: { moves: MoveRecord[]; step: number; initialLayout?: InitialLayout }) {
    const { board, last } = useMemo(() => {
        // 从初始布局构建棋盘（若无则使用标准开局）
        const b = (() => {
            if (initialLayout && Array.isArray(initialLayout.pieces)) {
                const base = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null as any))
                let id = 0
                for (const p of initialLayout.pieces) {
                    const x = Math.max(0, Math.min(8, p.x))
                    const y = Math.max(0, Math.min(9, p.y))
                    base[y][x] = { id: `init-${id++}`, type: p.type, side: p.side }
                }
                return base as any
            }
            return createInitialBoard()
        })()
        let last: { x: number; y: number } | null = null
        for (let i = 0; i < Math.min(step, moves.length); i++) {
            const m = moves[i]
            const nb = movePiece(b, m.from, m.to)
            // mutate b in place (movePiece returns new board or mutated? In our impl it returns new board)
            for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) b[y][x] = nb[y][x]
            last = m.to
        }
        return { board: b, last }
    }, [moves, step, initialLayout])

    return (
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

            {board.map((row: any, y: number) =>
                row.map((p: any, x: number) =>
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
