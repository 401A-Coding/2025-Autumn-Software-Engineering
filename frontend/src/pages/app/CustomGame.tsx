import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Board from '../../features/chess/Board'
import { getDefaultRules, getSuperRules } from '../../features/chess/customRules'
import type { CustomRules, PieceType } from '../../features/chess/types'

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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>
                    返回首页
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" onClick={() => setShowRuleEditor(!showRuleEditor)}>
                        {showRuleEditor ? '隐藏' : '显示'}规则设置
                    </button>
                </div>
            </div>

            {showRuleEditor && (
                <div className="paper-card" style={{ padding: 16, marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>自定义规则</h3>
                    
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            预设规则：
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-ghost" onClick={() => handleLoadPreset('default')}>
                                标准规则
                            </button>
                            <button className="btn-primary" onClick={() => handleLoadPreset('super')}>
                                超级象棋
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                            选择棋子：
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(Object.keys(pieceNames) as PieceType[]).map(piece => (
                                <button
                                    key={piece}
                                    className={selectedPiece === piece ? 'btn-primary' : 'btn-ghost'}
                                    onClick={() => setSelectedPiece(piece)}
                                    style={{ minWidth: 80 }}
                                >
                                    {pieceNames[piece]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedPiece && customRules[selectedPiece] && (
                        <div className="paper-card" style={{ padding: 12, background: 'var(--muted-bg)' }}>
                            <h4 style={{ marginTop: 0 }}>{pieceNames[selectedPiece]} 的规则</h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={customRules[selectedPiece]?.canJump || false}
                                        onChange={() => handleToggleRule(selectedPiece, 'canJump')}
                                    />
                                    可以跳过其他棋子
                                </label>

                                {(selectedPiece === 'elephant' || selectedPiece === 'soldier') && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={customRules[selectedPiece]?.canCrossBorder || false}
                                            onChange={() => handleToggleRule(selectedPiece, 'canCrossBorder')}
                                        />
                                        可以过河
                                    </label>
                                )}

                                {(selectedPiece === 'general' || selectedPiece === 'advisor') && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={customRules[selectedPiece]?.palaceOnly || false}
                                            onChange={() => handleToggleRule(selectedPiece, 'palaceOnly')}
                                        />
                                        限制在九宫内
                                    </label>
                                )}

                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    最大移动距离：
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={customRules[selectedPiece]?.maxRange || 0}
                                        onChange={(e) => handleMaxRangeChange(selectedPiece, parseInt(e.target.value) || 0)}
                                        style={{ width: 60, padding: 4 }}
                                    />
                                    <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                                        (0 = 无限制)
                                    </span>
                                </label>

                                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
                                    <strong>当前移动模式：</strong>
                                    <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
                                        {customRules[selectedPiece]?.moves.slice(0, 4).map((move, i) => (
                                            <li key={i}>
                                                ({move.dx > 0 ? '+' : ''}{move.dx}, {move.dy > 0 ? '+' : ''}{move.dy})
                                                {move.repeat && ' (可重复)'}
                                                {move.condition && ` (${move.condition})`}
                                            </li>
                                        ))}
                                        {customRules[selectedPiece]?.moves.length! > 4 && (
                                            <li>...共 {customRules[selectedPiece]?.moves.length} 种走法</li>
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
    )
}
