import { useMemo, useState, useEffect } from 'react'
import type { Pos, Side, GameState, CustomRules } from './types'
import { createInitialBoard, cloneBoard } from './types'
import { generateLegalMoves, movePiece, checkGameOver, isInCheckWithCustomRules } from './rules'
import { generateCustomMoves } from './customRules'
import type { CustomRuleSet } from './ruleEngine'
import { isCustomRuleSet, ruleSetToCustomRules } from './ruleAdapter'
import { generateMovesFromRules } from './ruleEngine'
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

interface BoardProps {
    customRules?: CustomRules | CustomRuleSet
    initialBoard?: any // 自定义初始棋盘
}

export default function Board({ customRules: customRulesProp, initialBoard }: BoardProps) {
    // 转换新格式规则到旧格式（用于兼容现有代码）
    const customRules = useMemo(() => {
        if (!customRulesProp) return undefined
        if (isCustomRuleSet(customRulesProp)) {
            return ruleSetToCustomRules(customRulesProp)
        }
        return customRulesProp
    }, [customRulesProp])

    const [state, setState] = useState<GameState>({
        board: initialBoard || createInitialBoard(),
        turn: 'red',
        selected: undefined,
        history: [],
        customRules,
    })
    const [showGameOver, setShowGameOver] = useState(false)

    // 当自定义规则改变时更新状态
    useEffect(() => {
        setState(prev => ({ ...prev, customRules }))
    }, [customRules])

    // 检查当前方是否被将军
    const inCheck = useMemo(() => {
        return isInCheckWithCustomRules(state.board, state.turn, state.customRules)
    }, [state.board, state.turn, state.customRules])

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
        
        // 如果有自定义规则，使用自定义规则生成走法
        // 如果传入的是新的 CustomRuleSet（编辑器/设置格式），直接使用新版 ruleEngine 的生成器，避免 adapter 丢失字段
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
            // 过滤掉己方棋子的位置
            return customMoves.filter(m => {
                const target = state.board[m.y]?.[m.x]
                return !target || target.side !== state.turn
            })
        }
        
        return generateLegalMoves(state.board, { x, y }, state.turn)
    }, [state, customRulesProp])

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
            // 若当前使用自定义规则，传入 customRules 以便它按照自定义规则判定（自定义规则下仅将被吃判输）
            const gameResult = checkGameOver(nb, nextTurn, state.customRules)
            
            setState(s => ({
                board: nb,
                turn: nextTurn,
                selected: undefined,
                history: [...s.history, { board: cloneBoard(s.board), turn: s.turn }],
                winner: gameResult || undefined,
                customRules: s.customRules, // 保留自定义规则
            }))
            // 回调：记录一步
            onMove?.({ from: state.selected!, to: { x, y }, turn: state.turn, ts: Date.now() })
            if (gameResult) {
                onGameOver?.(gameResult)
            }
            return
        }
        // 否则：若该格有当前行棋方的棋子，则选中
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
                customRules: s.customRules, // 保留自定义规则
            }
        })
    }

    function restart() {
        setState(s => ({ 
            board: initialBoard || createInitialBoard(), // 使用自定义初始棋盘或标准棋盘
            turn: 'red', 
            selected: undefined, 
            history: [], 
            winner: undefined,
            customRules: s.customRules, // 保留自定义规则
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

            <div style={{
                position: 'relative',
                width: cellSize * 9,
                height: cellSize * 10,
                background: '#f7e6c4',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 0 0 2px #e7d8b1',
                boxSizing: 'border-box',
                padding: margin,
                overflow: 'hidden',
                borderRadius: 8,
                margin: '0 auto', /* 居中显示，避免超过背景 */
            }}>
                {/* 网格线（加内边距，使交叉点处于容器内部）*/}
                {Array.from({ length: 10 }).map((_, row) => (
                    <div key={'h' + row} style={{ position: 'absolute', left: margin, right: margin, top: margin + row * cellSize, height: 1, background: '#c9b37e', transform: 'translateY(-0.5px)', zIndex: 1 }} />
                ))}
                {Array.from({ length: 9 }).map((_, col) => (
                    <div key={'v' + col} style={{ position: 'absolute', top: margin, bottom: margin, left: margin + col * cellSize, width: 1, background: '#c9b37e', transform: 'translateX(-0.5px)', zIndex: 1 }} />
                ))}
                {/* 楚河汉界 */}
                <div className="river-line" />
                <div className="river-text">楚河        漢界</div>
                {/* 宫线（简化：只画边框） */}
                <div style={{ position: 'absolute', left: margin + cellSize * 3, top: margin + 0, width: cellSize * 3, height: cellSize * 3, border: '1px solid #c9b37e', boxSizing: 'border-box', zIndex: 1 }} />
                <div style={{ position: 'absolute', left: margin + cellSize * 3, top: margin + cellSize * 7, width: cellSize * 3, height: cellSize * 3, border: '1px solid #c9b37e', boxSizing: 'border-box', zIndex: 1 }} />

                {/* 落点高亮（仅空位） */}
                {state.selected && legal.filter(m => !state.board[m.y][m.x]).map((m, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: margin + m.x * cellSize - 6, top: margin + m.y * cellSize - 6, width: 12, height: 12,
                        borderRadius: '50%', background: 'rgba(166,35,55,0.5)', zIndex: 2
                    }} />
                ))}

                {/* 棋子 */}
                {state.board.map((row, y) => row.map((p, x) => {
                    // 检查该位置是否是可吃子的目标
                    const canCapture = state.selected && legal.some(m => m.x === x && m.y === y) && p && p.side !== state.turn

                    return p && (
                        <div key={p.id}
                            onClick={() => onCellClick(x, y)}
                            style={{ position: 'absolute', left: margin + x * cellSize - (cellSize - 6) / 2, top: margin + y * cellSize - (cellSize - 6) / 2, cursor: 'pointer', zIndex: 3 }}>
                            <PieceGlyph type={p.type} side={p.side} />
                            {state.selected && state.selected.x === x && state.selected.y === y && (
                                <div className="piece-selected" />
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
                                zIndex: 4 }} />
                            )}
                            {/* 可吃子高亮 */}
                            {canCapture && (
                                <div style={{ 
                                    position: 'absolute', 
                                    inset: -3, 
                                    border: '3px solid #ff9800', 
                                    borderRadius: '50%',
                                    boxShadow: '0 0 8px rgba(255,152,0,0.6), inset 0 0 8px rgba(255,152,0,0.3)',
                                zIndex: 4 }} />
                            )}
                        </div>
                    )
                }))}
                {/* 点击区域：以交叉点为中心的正方形，便于点选 */}
                {state.board.map((row, y) => row.map((_, x) => (
                    <div key={`c-${x}-${y}`} onClick={() => onCellClick(x, y)} style={{ position: 'absolute', left: margin + x * cellSize - cellSize / 2, top: margin + y * cellSize - cellSize / 2, width: cellSize, height: cellSize, zIndex: 2 }} />
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
