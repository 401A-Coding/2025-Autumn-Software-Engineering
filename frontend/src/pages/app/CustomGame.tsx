import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Board from '../../features/chess/Board'
import { getDefaultRules, getSuperRules } from '../../features/chess/customRules'
import type { CustomRules, PieceType } from '../../features/chess/types'
import MobileFrame from '../../components/MobileFrame'

export default function CustomGame() {
    const navigate = useNavigate()
    const [customRules, setCustomRules] = useState<CustomRules>(getDefaultRules())
    const [showRuleEditor, setShowRuleEditor] = useState(false)
    const [selectedPiece, setSelectedPiece] = useState<PieceType>('rook')

    const pieceNames: Record<PieceType, string> = {
        general: '将/帅',
        advisor: '士/仕',
        elephant: '象/相',
        horse: '马',
        rook: '车',
        cannon: '炮',
        soldier: '兵/卒',
    }

    const handleLoadPreset = (preset: 'default' | 'super') => {
        if (preset === 'default') {
            setCustomRules(getDefaultRules())
        } else {
            setCustomRules(getSuperRules())
        }
    }

    const handleToggleRule = (piece: PieceType, key: 'canJump' | 'canCrossBorder' | 'palaceOnly') => {
        setCustomRules(prev => ({
            ...prev,
            [piece]: {
                ...prev[piece],
                [key]: !prev[piece]?.[key],
            },
        }))
    }

    const handleMaxRangeChange = (piece: PieceType, value: number) => {
        setCustomRules(prev => ({
            ...prev,
            [piece]: {
                ...prev[piece],
                maxRange: value,
            },
        }))
    }

    const selectedRule = customRules[selectedPiece]
    const moveCount = selectedRule?.moves.length ?? 0

    return (
        <MobileFrame>
            <div className="pad-16">
                <div className="row-between mb-8">
                    <button className="btn-ghost" onClick={() => navigate('/app/home')}>
                        返回首页
                    </button>
                    <div className="row gap-8">
                        <button className="btn-ghost" onClick={() => setShowRuleEditor(!showRuleEditor)}>
                            {showRuleEditor ? '隐藏' : '显示'}规则设置
                        </button>
                    </div>
                </div>

                {showRuleEditor && (
                    <div className="paper-card pad-16 mb-12">
                        <h3 className="mt-0">自定义规则</h3>

                        <div className="mb-16">
                            <p className="fw-600 mb-8">预设规则：</p>
                            <div className="row gap-8">
                                <button className="btn-ghost" onClick={() => handleLoadPreset('default')}>
                                    标准规则
                                </button>
                                <button className="btn-primary" onClick={() => handleLoadPreset('super')}>
                                    超级象棋
                                </button>
                            </div>
                        </div>

                        <div className="mb-16">
                            <p className="fw-600 mb-8">选择棋子：</p>
                            <div className="row gap-8 wrap">
                                {(Object.keys(pieceNames) as PieceType[]).map(piece => (
                                    <button
                                        key={piece}
                                        className={`${selectedPiece === piece ? 'btn-primary' : 'btn-ghost'} minw-80`}
                                        onClick={() => setSelectedPiece(piece)}
                                    >
                                        {pieceNames[piece]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedPiece && selectedRule && (
                            <div className="paper-card pad-12 bg-muted rounded-8">
                                <h4 className="mt-0">{pieceNames[selectedPiece]} 的规则</h4>

                                <div className="col gap-12">
                                    <label className="row align-center gap-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedRule.canJump || false}
                                            onChange={() => handleToggleRule(selectedPiece, 'canJump')}
                                        />
                                        可以跳过其他棋子
                                    </label>

                                    {(selectedPiece === 'elephant' || selectedPiece === 'soldier') && (
                                        <label className="row align-center gap-8">
                                            <input
                                                type="checkbox"
                                                checked={selectedRule.canCrossBorder || false}
                                                onChange={() => handleToggleRule(selectedPiece, 'canCrossBorder')}
                                            />
                                            可以过河
                                        </label>
                                    )}

                                    {(selectedPiece === 'general' || selectedPiece === 'advisor') && (
                                        <label className="row align-center gap-8">
                                            <input
                                                type="checkbox"
                                                checked={selectedRule.palaceOnly || false}
                                                onChange={() => handleToggleRule(selectedPiece, 'palaceOnly')}
                                            />
                                            限制在九宫内
                                        </label>
                                    )}

                                    <label className="row align-center gap-8">
                                        最大移动距离：
                                        <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            value={selectedRule.maxRange || 0}
                                            onChange={(e) => handleMaxRangeChange(selectedPiece, parseInt(e.target.value) || 0)}
                                            className="w-60 pad-4"
                                        />
                                        <span className="text-14 muted">
                                            (0 = 无限制)
                                        </span>
                                    </label>

                                    <div className="text-14 muted mt-8">
                                        <strong>当前移动模式：</strong>
                                        <ul className="list-plain">
                                            {selectedRule.moves.slice(0, 4).map((move, i) => (
                                                <li key={i}>
                                                    ({move.dx > 0 ? '+' : ''}{move.dx}, {move.dy > 0 ? '+' : ''}{move.dy})
                                                    {move.repeat && ' (可重复)'}
                                                    {move.condition && ` (${move.condition})`}
                                                </li>
                                            ))}
                                            {moveCount > 4 && (
                                                <li>...共 {moveCount} 种走法</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <Board customRules={customRules} />
            </div>
        </MobileFrame>
    )
}
