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

type InitialLayout = { pieces?: { type: string; side: Side; x: number; y: number }[] } | any[][]

export default function BoardViewer({ moves, step, initialLayout, flip }: { moves: MoveRecord[]; step: number; initialLayout?: InitialLayout; flip?: boolean }) {
    const { board, last } = useMemo(() => {
        // 从初始布局构建棋盘（若无则使用标准开局），务必深拷贝避免在回放中污染原始布局
        const base = (() => {
            // 支持二维数组格式（自定义对战使用）
            if (Array.isArray(initialLayout)) {
                return initialLayout.map((row, ry) =>
                    row.map((cell, rx) => {
                        if (!cell) return null
                        const c = { ...cell } as any
                        // 确保每个棋子都有稳定的 id，避免 React key 冲突导致渲染异常
                        if (!c.id) c.id = `init-${ry}-${rx}-${c.type || 'unknown'}-${c.side || 'unknown'}`
                        return c
                    })
                ) as any
            }
            // 支持 pieces 格式（标准对战/残局使用）
            if (initialLayout && Array.isArray((initialLayout as any).pieces)) {
                const b = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null as any))
                let id = 0
                for (const p of (initialLayout as any).pieces) {
                    const x = Math.max(0, Math.min(8, p.x))
                    const y = Math.max(0, Math.min(9, p.y))
                    const type = (p.type === 'chariot' ? 'rook' : p.type)
                    b[y][x] = { id: `init-${id++}`, type, side: p.side }
                }
                return b as any
            }
            return createInitialBoard()
        })()

        let board = base
        let last: { x: number; y: number } | null = null
        for (let i = 0; i < Math.min(step, moves.length); i++) {
            const m = moves[i]
            board = movePiece(board, m.from, m.to)
            last = m.to
        }
        return { board, last }
    }, [moves, step, initialLayout])

    return (
        <div className={`board board-center ${flip ? 'board--flip' : ''}`}>
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
