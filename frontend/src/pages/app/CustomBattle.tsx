import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import Board from '../../features/chess/Board'
import MobileFrame from '../../components/MobileFrame'
import type { CustomRuleSet } from '../../features/chess/ruleEngine'
import { standardChessRules } from '../../features/chess/rulePresets'
import { boardApi } from '../../services/api'
import { apiBoardToLocalFormat } from '../../features/chess/boardAdapter'
import { recordStore } from '../../features/records/recordStore'
import type { MoveRecord, ChessRecord } from '../../features/records/types'
import { cloneBoard } from '../../features/chess/types'
import { movePiece } from '../../features/chess/rules'

export default function CustomBattle() {
    const navigate = useNavigate()
    const [ruleSet, setRuleSet] = useState<CustomRuleSet | null>(null)
    const [customBoard, setCustomBoard] = useState<any>(null)
    const currentBoardRef = useRef<any>(null)

    const location: any = useLocation()
    useEffect(() => {
        const state = location?.state || {}
        
        // 优先使用路由 state 传入的布局与规则（来自模板管理或编辑器）
        if (state.rules) {
            try {
                const rules = state.rules as any
                // 检查是否是完整的 CustomRuleSet 格式（有 pieceRules 字段）
                if (rules && typeof rules === 'object' && rules.pieceRules && Object.keys(rules.pieceRules).length > 0) {
                    // 验证每个 pieceRule 都有 movePatterns
                    const hasValidMovePatterns = Object.values(rules.pieceRules).every((pr: any) =>
                        pr && pr.movePatterns && Array.isArray(pr.movePatterns) && pr.movePatterns.length > 0
                    )
                    if (hasValidMovePatterns) {
                        setRuleSet(rules as CustomRuleSet)
                    } else {
                        console.warn('Incomplete or unrecognized rules format, using standard chess rules', rules)
                        setRuleSet(standardChessRules)
                    }
                } else {
                    console.warn('Incomplete or unrecognized rules format, using standard chess rules', rules)
                    setRuleSet(standardChessRules)
                }
            } catch (e) {
                console.error('Invalid rules in navigation state', e)
                setRuleSet(standardChessRules)
            }
        } else {
            setRuleSet(standardChessRules)
        }

        // 设置布局（不管规则是否设置）
        if (state.layout) {
            setCustomBoard(state.layout)
        }

        // 如果没有通过路由 state 提供布局，尝试从查询参数读取 boardId 并从后端拉取
        const params = new URLSearchParams(location.search || '')
        const boardIdStr = params.get('boardId')
        if (boardIdStr) {
            const id = Number(boardIdStr)
            if (!Number.isNaN(id)) {
                ; (async () => {
                    try {
                        const apiBoard = await boardApi.get(id)
                        // 将 API 格式转换为本地二维数组
                        setCustomBoard(apiBoardToLocalFormat(apiBoard as any))
                        // 如果 apiBoard 有 rules，尝试使用它
                        if (apiBoard.rules && typeof apiBoard.rules === 'object' && (apiBoard.rules as any).pieceRules) {
                            const rules = apiBoard.rules as any
                            const hasValidMovePatterns = Object.values(rules.pieceRules).every((pr: any) =>
                                pr && pr.movePatterns && Array.isArray(pr.movePatterns) && pr.movePatterns.length > 0
                            )
                            if (hasValidMovePatterns) {
                                setRuleSet(rules as CustomRuleSet)
                            }
                        }
                    } catch (e) {
                        console.error('Failed to load board from server', e)
                    }
                })()
            }
        }
    }, [location])

    // 用于保存对局的临时记录
    const [moves, setMoves] = useState<MoveRecord[]>([])
    const [startedAt] = useState<string>(new Date().toISOString())
    
    // 初始化当前棋盘引用
    useEffect(() => {
        if (customBoard) {
            currentBoardRef.current = cloneBoard(customBoard)
        }
    }, [customBoard])

    const persistRecord = async (result?: 'red' | 'black' | 'draw') => {
        console.log('[CustomBattle] persistRecord called, moves:', moves.length)
        const boardToSave = currentBoardRef.current || customBoard
        
        try {
            const rec: Omit<ChessRecord, 'id'> = {
                startedAt,
                endedAt: new Date().toISOString(),
                opponent: '本地',
                result,
                keyTags: ['自定义对战', '本地对战'],
                favorite: false,
                moves,
                bookmarks: [],
                notes: [],
                mode: 'custom',
                // 保存初始布局，回放时叠加 moves 还原最终局面
                customLayout: customBoard ?? boardToSave,
                customRules: ruleSet, // 直接保存规则
            }

            const { savedToServer } = await recordStore.saveNew(rec)
            if (savedToServer) {
                alert('对局已保存到服务器')
            } else {
                alert('对局已保存在本地（未登录或服务器不可用）')
            }
        } catch (e) {
            console.error('[CustomBattle] failed to save record', e)
            alert('保存对局失败，请查看控制台')
        }
    }

    const handleBackToHome = () => {
        // 直接返回主页（不再清理 localStorage，因为不再使用）
        navigate('/app/home')
    }

    const handleEndGame = () => {
        // 直接返回主页
        navigate('/app/home')
    }

    if (!ruleSet) {
        return (
            <div className="pad-20 text-center">
                <p>加载规则中...</p>
            </div>
        )
    }

    return (
        <MobileFrame>
            <div className="pad-16">
                {/* header */}
                <div className="row-between gap-12 wrap mb-12">
                    <div className="row align-center gap-12">
                        <button className="btn-ghost" onClick={handleBackToHome}>← 返回首页</button>
                        <div className="text-18 fw-700">自定义对局</div>
                    </div>

                    <div className="row align-center gap-8">
                        <div className="chip chip-info">{ruleSet.name || '自定义规则'}</div>
                        <button className="btn-danger" onClick={handleEndGame}>结束对局</button>
                    </div>
                </div>

            {/* 主体：棋盘 + 侧栏（在窄屏隐藏） */}
            <div className="row gap-16 align-start wrap">
                <div className="board-area">
                    <div className="board-area__inner">
                        <Board
                            customRules={ruleSet}
                            initialBoard={customBoard}
                            onMove={(m) => {
                                setMoves(prev => [...prev, m])
                                // 更新当前棋盘状态
                                if (currentBoardRef.current) {
                                    currentBoardRef.current = movePiece(currentBoardRef.current, m.from, m.to)
                                }
                            }}
                            onGameOver={(winner) => persistRecord(winner || undefined)}
                        />
                    </div>
                    {ruleSet.description && (
                        <div className="note-info">{ruleSet.description}</div>
                    )}
                </div>

                {/* 主体：棋盘 + 侧栏（在窄屏隐藏） */}
                <div className="row gap-16 align-start wrap">
                    <div className="board-area">
                        <div className="board-area__inner">
                            <Board
                                customRules={ruleSet}
                                initialBoard={customBoard}
                                onMove={(m) => setMoves(prev => [...prev, m])}
                                onGameOver={(winner) => persistRecord(winner || undefined)}
                            />
                        </div>
                    </div>

                    <aside className="col gap-12 flex-1 minw-260 hide-on-mobile">
                        <div className="pad-12 bg-muted rounded-8">
                            <div className="fw-700 mb-8">规则摘要</div>
                            <div className="text-13 text-gray">{ruleSet.name || '自定义规则'}</div>
                        </div>

                        <details className="pad-12 bg-muted rounded-8">
                            <summary className="cursor-pointer fw-600">📋 详细规则配置</summary>
                            <div className="grid-auto-120 gap-8 mt-8">
                                {Object.entries(ruleSet.pieceRules).map(([pieceType, rule]) => {
                                    if (!rule) return null
                                    const pieceNames: Record<string, string> = {
                                        general: '将/帅',
                                        advisor: '士/仕',
                                        elephant: '象/相',
                                        horse: '马/马',
                                        rook: '车/车',
                                        cannon: '炮/炮',
                                        soldier: '兵/卒',
                                    }
                                    const movePatterns = rule?.movePatterns
                                    return (
                                        <div key={pieceType} className="pad-8 bg-white rounded-6 text-12">
                                            <div className="fw-600">{pieceNames[pieceType] || rule.name}</div>
                                            <div className="text-12 muted">{movePatterns ? `${movePatterns.length} 种走法` : ''}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </details>
                    </aside>
                </div>

                {/* 操作栏 */}
                <div className="row justify-center gap-12 mt-16">
                    <button className="btn-ghost btn-compact" onClick={() => window.location.reload()}>重新开始</button>
                    <button className="btn-secondary btn-compact" onClick={() => persistRecord()}>💾 保存对局</button>
                    <button className="btn-primary btn-compact" onClick={handleBackToHome}>返回首页</button>
                </div>
                <div className="text-center text-12 muted mt-8">动作数: {moves.length}</div>
            </div>
        </MobileFrame>
    )
}
