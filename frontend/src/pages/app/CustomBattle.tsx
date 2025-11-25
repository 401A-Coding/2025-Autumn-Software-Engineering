import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Board from '../../features/chess/Board'
import type { CustomRuleSet } from '../../features/chess/ruleEngine'
import { standardChessRules } from '../../features/chess/rulePresets'

export default function CustomBattle() {
    const navigate = useNavigate()
    const [ruleSet, setRuleSet] = useState<CustomRuleSet | null>(null)
    const [customBoard, setCustomBoard] = useState<any>(null)

    useEffect(() => {
        // 从 localStorage 加载自定义规则
        const savedRules = localStorage.getItem('customRuleSet')
        if (savedRules) {
            try {
                const loadedRules = JSON.parse(savedRules) as CustomRuleSet
                // 深度合并每个棋子的规则：以标准规则为基础，逐个棋子合并用户配置，
                // 这样可以确保像炮的 captureRules.capturePattern 等子字段不会被整块覆盖而丢失。
                const mergedPieceRules: CustomRuleSet['pieceRules'] = { ...standardChessRules.pieceRules }
                if (loadedRules.pieceRules) {
                    for (const [ptype, prule] of Object.entries(loadedRules.pieceRules)) {
                        const std = standardChessRules.pieceRules[ptype as keyof typeof standardChessRules.pieceRules]
                        mergedPieceRules[ptype as keyof typeof mergedPieceRules] = {
                            // 若标准存在，先拷贝标准的字段
                            ...(std || {}),
                            // 再在同层级覆盖用户提供的字段
                            ...(prule || {}),
                        } as any
                    }
                }
                const mergedRules: CustomRuleSet = {
                    ...loadedRules,
                    pieceRules: mergedPieceRules,
                }
                setRuleSet(mergedRules)
            } catch (e) {
                console.error('Failed to load custom rules:', e)
                setRuleSet(standardChessRules)
            }
        } else {
            setRuleSet(standardChessRules)
        }

        // 从 localStorage 加载自定义棋盘布局
        const savedBoard = localStorage.getItem('placementBoard')
        if (savedBoard) {
            try {
                const loadedBoard = JSON.parse(savedBoard)
                setCustomBoard(loadedBoard)
            } catch (e) {
                console.error('Failed to load custom board:', e)
            }
        }
    }, [])

    const handleBackToHome = () => {
        // 在离开对局时清理本地的自定义设置，避免下一次进入时保留上次修改
        localStorage.removeItem('customRuleSet')
        localStorage.removeItem('placementBoard')
        navigate('/app/home')
    }

    const handleEndGame = () => {
        // 清除自定义规则和棋盘配置
        localStorage.removeItem('customRuleSet')
        localStorage.removeItem('placementBoard')
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

            {/* tips */}
            <div className="col gap-12 mb-12">
                <div className="note-warn">
                    💡 "重新开始"将保留当前规则和棋盘，"结束对局"将清除所有自定义设置
                </div>
                {ruleSet.description && (
                    <div className="note-info">{ruleSet.description}</div>
                )}
            </div>

            {/* 主体：棋盘 + 侧栏（在窄屏隐藏） */}
            <div className="row gap-16 align-start wrap">
                <div className="board-area">
                    <div className="board-area__inner">
                        <Board customRules={ruleSet} initialBoard={customBoard} />
                    </div>
                </div>

                <aside className="col gap-12 flex-1 minw-260">
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
                <button className="btn-primary btn-compact" onClick={handleBackToHome}>返回首页</button>
            </div>
        </div>
    )
}
