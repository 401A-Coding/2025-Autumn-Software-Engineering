import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PieceType } from '../../features/chess/types'
import type { CustomRuleSet, PieceRuleConfig } from '../../features/chess/ruleEngine'
import { standardChessRules, superChessRules, modernChessRules, crazyChessRules } from '../../features/chess/rulePresets'
import { moveTemplates, getDefaultTemplateForPiece, type MoveTemplateType } from '../../features/chess/moveTemplates'

export default function CustomRuleEditor() {
    const navigate = useNavigate()

    // 不再从 localStorage 加载规则；使用内存状态，默认标准规则
    const [ruleSet, setRuleSet] = useState<CustomRuleSet>(standardChessRules)
    const [selectedPiece, setSelectedPiece] = useState<PieceType>('rook')
    const [selectedTemplate, setSelectedTemplate] = useState<MoveTemplateType>('line-unlimited')

    const pieceNames: Record<PieceType, string> = {
        general: '将/帅',
        advisor: '士/仕',
        elephant: '象/相',
        horse: '马',
        rook: '车',
        cannon: '炮',
        soldier: '兵/卒',
    }

    const handleLoadPreset = (preset: 'standard' | 'super' | 'modern' | 'crazy') => {
        const presets = {
            standard: standardChessRules,
            super: superChessRules,
            modern: modernChessRules,
            crazy: crazyChessRules,
        }
        setRuleSet(presets[preset])
    }

    const handleSelectPiece = (piece: PieceType) => {
        setSelectedPiece(piece)
        // 根据当前棋子的规则推断模板
        const currentRule = ruleSet.pieceRules[piece]
        if (currentRule) {
            // 这里可以根据 movePatterns 推断使用的模板
            setSelectedTemplate(getDefaultTemplateForPiece(piece))
        }
    }

    const handleApplyTemplate = (templateId: MoveTemplateType) => {
        setSelectedTemplate(templateId)
        const template = moveTemplates[templateId]

        setRuleSet(prev => ({
            ...prev,
            pieceRules: {
                ...prev.pieceRules,
                [selectedPiece]: {
                    ...(prev.pieceRules[selectedPiece] || {
                        name: pieceNames[selectedPiece],
                        restrictions: {},
                    }),
                    movePatterns: template.patterns,
                },
            },
        }))
    }

    const handleToggleRestriction = (key: keyof PieceRuleConfig['restrictions']) => {
        setRuleSet(prev => {
            const currentRule = prev.pieceRules[selectedPiece]
            if (!currentRule) return prev

            return {
                ...prev,
                pieceRules: {
                    ...prev.pieceRules,
                    [selectedPiece]: {
                        ...currentRule,
                        restrictions: {
                            ...currentRule.restrictions,
                            [key]: !currentRule.restrictions[key],
                        },
                    },
                },
            }
        })
    }

    // 处理特殊规则：蹩马腿/塞象眼
    const handleToggleObstacleCheck = () => {
        setRuleSet(prev => {
            const currentRule = prev.pieceRules[selectedPiece]
            if (!currentRule) return prev

            // 切换移动模式中的 conditions
            const newPatterns = currentRule.movePatterns.map(pattern => {
                if (pattern.conditions && pattern.conditions.length > 0) {
                    // 移除条件（取消蹩马腿/塞象眼）
                    return { ...pattern, conditions: undefined }
                } else {
                    // 添加条件（启用蹩马腿/塞象眼）
                    return {
                        ...pattern,
                        conditions: [{ type: 'path' as const, hasNoObstacle: true }]
                    }
                }
            })

            return {
                ...prev,
                pieceRules: {
                    ...prev.pieceRules,
                    [selectedPiece]: {
                        ...currentRule,
                        movePatterns: newPatterns,
                    },
                },
            }
        })
    }

    // 检查是否有障碍检查条件
    const hasObstacleCheck = () => {
        const currentRule = ruleSet.pieceRules[selectedPiece]
        if (!currentRule || !currentRule.movePatterns[0]) return true
        return currentRule.movePatterns[0].conditions &&
            currentRule.movePatterns[0].conditions.length > 0
    }

    const handleStartGame = () => {
        // 通过路由 state 传递规则到对局页面（不在前端持久化）
        navigate('/app/custom-battle', { state: { rules: ruleSet } })
    }

    const currentRule = ruleSet.pieceRules[selectedPiece]

    // 根据棋子类型过滤可用的模板
    const getAvailableTemplates = () => {
        const allTemplates = Object.values(moveTemplates)

        // 兵专用的模板
        const soldierTemplates: MoveTemplateType[] = ['pawn-forward', 'pawn-cross']

        if (selectedPiece === 'soldier') {
            return allTemplates.filter(t => soldierTemplates.includes(t.id))
        }

        // 其他棋子排除兵的专用模板
        return allTemplates.filter(t => !soldierTemplates.includes(t.id))
    }

    return (
        <div className="pad-20 mw-1200 mx-auto">
            {/* 顶部导航 */}
            <div className="row-between align-center mb-24">
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>
                    ← 返回首页
                </button>
                <h2 className="mt-0 text-24 fw-700">自定义规则编辑器</h2>
                <button className="btn-primary" onClick={handleStartGame}>
                    开始对战 →
                </button>
            </div>

            {/* 预设规则 */}
            <div className="paper-card pad-20 mb-20">
                <h3 className="mt-0 mb-16">快速加载预设规则</h3>
                <div className="row justify-center wrap gap-12">
                    <button className="btn-ghost" onClick={() => handleLoadPreset('standard')}>
                        📋 标准规则
                    </button>
                    <button className="btn-ghost" onClick={() => handleLoadPreset('super')}>
                        ⚡ 超级象棋
                    </button>
                    <button className="btn-ghost" onClick={() => handleLoadPreset('modern')}>
                        🎯 现代象棋
                    </button>
                    <button className="btn-ghost" onClick={() => handleLoadPreset('crazy')}>
                        🔥 疯狂象棋
                    </button>
                </div>
            </div>

            {/* 主编辑区域 */}
            <div className="grid-1-2 gap-20">
                {/* 左侧：棋子选择 */}
                <div className="paper-card pad-20">
                    <h3 className="mt-0 mb-16">选择棋子</h3>
                    <div className="col gap-8">
                        {(Object.keys(pieceNames) as PieceType[]).map(piece => (
                            <button
                                key={piece}
                                className={`${selectedPiece === piece ? 'btn-primary' : 'btn-ghost'} justify-start pad-12 text-16`}
                                onClick={() => handleSelectPiece(piece)}
                            >
                                {pieceNames[piece]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 右侧：规则编辑 */}
                <div className="col gap-20">
                    {/* 移动模板 */}
                    <div className="paper-card pad-20">
                        <h3 className="mt-0 mb-16">
                            {pieceNames[selectedPiece]} 的移动模板
                        </h3>
                        <div className="grid-auto-150 gap-12">
                            {getAvailableTemplates().map(template => (
                                <button
                                    key={template.id}
                                    className={`opt-btn col align-center ${selectedTemplate === template.id ? 'opt-btn--active' : ''}`}
                                    onClick={() => handleApplyTemplate(template.id)}
                                    title={template.description}
                                >
                                    <span className="text-24 mb-4">{template.icon}</span>
                                    <span className="text-14">{template.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* 模板预览 */}
                        {selectedTemplate && (
                            <div className="mt-16 pad-16 bg-muted rounded-8">
                                <div className="text-14 muted mb-8">
                                    <strong>{moveTemplates[selectedTemplate].name}</strong>
                                </div>
                                <div className="text-13 mb-8">
                                    {moveTemplates[selectedTemplate].description}
                                </div>
                                <pre className="pre-code">
                                    {moveTemplates[selectedTemplate].preview}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* 限制条件 */}
                    <div className="paper-card pad-20">
                        <h3 className="mt-0 mb-16">限制条件</h3>
                        {currentRule ? (
                            <div className="col gap-12">
                                {/* 通用限制 */}
                                <label className="row align-center gap-12 pad-12 bg-muted rounded-6 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentRule.restrictions.canJump || false}
                                        onChange={() => handleToggleRestriction('canJump')}
                                        className="input-18"
                                    />
                                    <span>可以跳过其他棋子</span>
                                </label>

                                <label className="row align-center gap-12 pad-12 bg-muted rounded-6 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentRule.restrictions.canCrossRiver || false}
                                        onChange={() => handleToggleRestriction('canCrossRiver')}
                                        className="input-18"
                                    />
                                    <span>可以过河</span>
                                </label>

                                {/* 将/士专属：九宫限制 */}
                                {(selectedPiece === 'general' || selectedPiece === 'advisor') && (
                                    <label className="row align-center gap-12 pad-12 bg-muted rounded-6 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={currentRule.restrictions.mustStayInPalace || false}
                                            onChange={() => handleToggleRestriction('mustStayInPalace')}
                                            className="input-18"
                                        />
                                        <span>必须待在九宫内</span>
                                    </label>
                                )}

                                {/* 马专属：蹩马腿 */}
                                {selectedPiece === 'horse' && (
                                    <label className="row align-center gap-12 pad-12 rounded-6 cursor-pointer bg-warn-soft">
                                        <input
                                            type="checkbox"
                                            checked={hasObstacleCheck()}
                                            onChange={handleToggleObstacleCheck}
                                            className="input-18"
                                        />
                                        <div className="col">
                                            <span>🐴 启用蹩马腿规则</span>
                                            <span className="text-12 text-orange-700">
                                                （勾选后，马在移动时会被阻挡）
                                            </span>
                                        </div>
                                    </label>
                                )}

                                {/* 象专属：塞象眼 */}
                                {selectedPiece === 'elephant' && (
                                    <label className="row align-center gap-12 pad-12 rounded-6 cursor-pointer bg-info-soft">
                                        <input
                                            type="checkbox"
                                            checked={hasObstacleCheck()}
                                            onChange={handleToggleObstacleCheck}
                                            className="input-18"
                                        />
                                        <div className="col">
                                            <span>🐘 启用塞象眼规则</span>
                                            <span className="text-12 text-sky-700">
                                                （勾选后，象在移动时会被阻挡）
                                            </span>
                                        </div>
                                    </label>
                                )}
                            </div>
                        ) : (
                            <p className="muted text-14">
                                该棋子暂无规则配置
                            </p>
                        )}
                    </div>

                    {/* 当前配置摘要 */}
                    <div className="paper-card pad-20 bg-info-soft">
                        <h4 className="mt-0 mb-12">📝 当前配置</h4>
                        <div className="text-14">
                            <div><strong>棋子：</strong>{pieceNames[selectedPiece]}</div>
                            <div><strong>模板：</strong>{moveTemplates[selectedTemplate].name}</div>
                            {currentRule && (
                                <>
                                    <div><strong>移动方式：</strong>{currentRule.movePatterns.length} 种</div>
                                    <div>
                                        <strong>限制：</strong>
                                        {currentRule.restrictions.canJump && ' 可跳跃'}
                                        {currentRule.restrictions.canCrossRiver && ' 可过河'}
                                        {currentRule.restrictions.mustStayInPalace && ' 限九宫'}
                                        {!currentRule.restrictions.canJump &&
                                            !currentRule.restrictions.canCrossRiver &&
                                            !currentRule.restrictions.mustStayInPalace && ' 无'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
