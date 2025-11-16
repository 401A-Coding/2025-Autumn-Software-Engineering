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
            <div style={{ padding: 20, textAlign: 'center' }}>
                <p>加载规则中...</p>
            </div>
        )
    }

    return (
        <div style={{ padding: 16 }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-ghost" onClick={handleBackToHome} style={{ padding: '8px 12px' }}>← 返回首页</button>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>自定义对局</div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ padding: '6px 12px', background: '#eef2ff', borderRadius: 8, fontWeight: 600 }}>{ruleSet!.name || '自定义规则'}</div>
                    <button className="btn-outline" onClick={handleEndGame} style={{ background: '#ef4444', color: 'white', padding: '8px 12px', borderRadius: 8 }}>结束对局</button>
                </div>
            </div>

            {/* tips */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexDirection: 'column' }}>
                <div style={{ padding: 10, background: '#fff7ed', borderRadius: 8, color: '#92400e' }}>
                    💡 "重新开始"将保留当前规则和棋盘，"结束对局"将清除所有自定义设置
                </div>
                {ruleSet!.description && (
                    <div style={{ padding: 10, background: '#f0f9ff', borderRadius: 8, color: '#075985' }}>{ruleSet!.description}</div>
                )}
            </div>

            {/* 主体：棋盘 + 侧栏（在窄屏隐藏） */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 1 520px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <div>
                        <Board customRules={ruleSet!} initialBoard={customBoard} />
                    </div>
                </div>

                <aside style={{ flex: '1 1 260px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, background: 'var(--muted-bg)', borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>规则摘要</div>
                        <div style={{ fontSize: 13, color: '#374151' }}>{ruleSet!.name || '自定义规则'}</div>
                    </div>

                    <details style={{ padding: 12, background: 'var(--muted-bg)', borderRadius: 8 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>📋 详细规则配置</summary>
                        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                            {Object.entries(ruleSet!.pieceRules).map(([pieceType, rule]) => {
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
                                return (
                                    <div key={pieceType} style={{ padding: 8, background: 'white', borderRadius: 6, fontSize: 12 }}>
                                        <div style={{ fontWeight: 600 }}>{pieceNames[pieceType] || rule.name}</div>
                                        <div style={{ fontSize: 11, color: '#6b7280' }}>{(rule as any).movePatterns ? `${(rule as any).movePatterns.length} 种走法` : ''}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </details>
                </aside>
            </div>

            {/* 操作栏 */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
                <button className="btn-ghost" onClick={() => window.location.reload()} style={{ padding: '10px 14px' }}>重新开始</button>
                <button className="btn-primary" onClick={handleBackToHome} style={{ padding: '10px 14px' }}>返回首页</button>
            </div>
        </div>
    )
}
