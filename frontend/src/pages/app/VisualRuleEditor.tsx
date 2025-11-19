import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PieceType, Piece, Side } from '../../features/chess/types'
import { createInitialBoard } from '../../features/chess/types'
import type { CustomRuleSet, MovePattern } from '../../features/chess/ruleEngine'
import { standardChessRules } from '../../features/chess/rulePresets'
import { moveTemplates, getDefaultTemplateForPiece, type MoveTemplateType } from '../../features/chess/moveTemplates'

type EditorStep = 'choose-mode' | 'place-pieces' | 'select-piece' | 'edit-rules'
type PlacementBoard = (Piece | null)[][]

/**
 * 可视化规则编辑器 - 三步流程
 * 1. 选择模式（修改布局/修改规则）
 * 2. 摆放棋子 或 选择要编辑的棋子
 * 3. 编辑选中棋子的规则
 */
export default function VisualRuleEditor() {
    const navigate = useNavigate()
    
    // 三步流程状态
    const [currentStep, setCurrentStep] = useState<EditorStep>('choose-mode')
    
    // 步骤1: 摆放棋子
    const [placementBoard, setPlacementBoard] = useState<PlacementBoard>(() => {
        // 尝试从 localStorage 加载自定义棋盘
        const savedBoard = localStorage.getItem('placementBoard')
        if (savedBoard) {
            try {
                return JSON.parse(savedBoard)
            } catch (e) {
                console.error('Failed to load saved board:', e)
            }
        }
        // 如果没有保存的棋盘,使用标准象棋初始棋盘
        return createInitialBoard()
    })
    const [selectedPieceType, setSelectedPieceType] = useState<{ type: PieceType; side: Side } | null>(null)
    
    // 步骤2&3: 选中的棋子类型和阵营
    const [editingPieceType, setEditingPieceType] = useState<PieceType>('rook')
    const [editingSide, setEditingSide] = useState<Side>('black')
    
    // 步骤3: 规则编辑
    const [ruleSet, setRuleSet] = useState<CustomRuleSet>(() => {
        const savedRules = localStorage.getItem('customRuleSet')
        if (savedRules) {
            try {
                // 不再与 standardChessRules 合并 — 如果用户已保存规则，则保持原样加载
                const loadedRules = JSON.parse(savedRules) as CustomRuleSet
                return loadedRules
            } catch (e) {
                console.error('Failed to load saved rules:', e)
            }
        }
        return standardChessRules
    })
    
    // per-river-phase selections: pre / post
    const [editingRiverView, setEditingRiverView] = useState<'pre' | 'post'>('pre')
    const [selectedCellsPre, setSelectedCellsPre] = useState<Set<string>>(new Set())
    const [selectedCellsPost, setSelectedCellsPost] = useState<Set<string>>(new Set())
    // 存储每个被选中格子对应的模板 pattern（用于保留像过河、path 等条件），按阶段保存
    const [selectedCellPatternsPre, setSelectedCellPatternsPre] = useState<Record<string, MovePattern[]>>({})
    const [selectedCellPatternsPost, setSelectedCellPatternsPost] = useState<Record<string, MovePattern[]>>({})
    const [editMode, setEditMode] = useState<'add' | 'remove'>('add')
    const [moveType, setMoveType] = useState<'move' | 'capture' | 'both'>('both')
    const [isRepeatable, setIsRepeatable] = useState(false)
    // 过河阶段：用于编辑“过河前 / 过河后 / 同时”三种状态规则
    // 编辑器视图：过河前 or 过河后（UI 切换）
    // const [riverPhase, setRiverPhase] = useState<'pre' | 'post' | 'both'>('both')
    const [selectedTemplate, setSelectedTemplate] = useState<MoveTemplateType | null>(null)
    const [horseLegBlocked, setHorseLegBlocked] = useState(true)
    const [elephantEyeBlocked, setElephantEyeBlocked] = useState(true)
    // display base used when showing templates (soldier templates should use red as base)
    const [templateDisplayBase, setTemplateDisplayBase] = useState<Side>('black')

    const pieceNames: Record<PieceType, string> = {
        general: '帅/将',
        advisor: '仕/士',
        elephant: '相/象',
        horse: '马/马',
        rook: '车/车',
        cannon: '炮/炮',
        // 显示统一为“兵”，避免红/黑显示不一致
        soldier: '兵/兵',
    }

    const centerRow = 4
    const centerCol = 4

    // 步骤1: 处理棋盘点击（摆放棋子）
    const handlePlacementClick = (row: number, col: number) => {
        if (!selectedPieceType) {
            // 如果已有棋子，点击可清除
            if (placementBoard[row][col]) {
                const newBoard = placementBoard.map(r => [...r])
                newBoard[row][col] = null
                setPlacementBoard(newBoard)
            }
            return
        }
        
        const newBoard = placementBoard.map(r => [...r])
        newBoard[row][col] = {
            id: `${selectedPieceType.side}-${selectedPieceType.type}-${Date.now()}`,
            type: selectedPieceType.type,
            side: selectedPieceType.side,
        }
        setPlacementBoard(newBoard)
    }

    // 步骤2: 处理棋子选择（选择要编辑的棋子）
    const handlePieceSelect = (row: number, col: number) => {
        const piece = placementBoard[row][col]
        if (piece) {
            setEditingPieceType(piece.type)
            setEditingSide(piece.side)
            setCurrentStep('edit-rules')
            // 加载该棋子的默认模板（并按阵营显示）
            const defTpl = getDefaultTemplateForPiece(piece.type)
            // 立即以被点击的棋子类型/阵营为准计算 displayBase，避免 state 更新延迟导致显示错误
            const displayBase: Side = piece.type === 'soldier' ? 'red' : piece.side
            applyTemplateToBoard(defTpl, displayBase)
        }
    }

    

    // 模板应用
    // applyTemplateToBoard 接受可选的 displayBase 和 phase，用于避免在 handlePieceSelect 中出现 React state 更新延迟导致的显示不一致
    const applyTemplateToBoard = (tplId: MoveTemplateType, displayBase?: Side, phase?: 'pre' | 'post' | 'both') => {
        setSelectedTemplate(tplId)
        const tpl = moveTemplates[tplId]
        const next = new Set<string>()
        // 如果传入 displayBase，则使用传入值；否则按照原有逻辑：兵始终以红棋为模板显示；否则以当前编辑侧显示
        const effectiveDisplayBase: Side = displayBase ?? (editingPieceType === 'soldier' ? 'red' : editingSide)
        setTemplateDisplayBase(effectiveDisplayBase)

    const patternsMap: Record<string, MovePattern[]> = {}
    tpl.patterns.forEach(p => {
            // 根据 displayBase 调整 dy 的显示方向（内部 patterns 使用以黑方为“正向”的 dy）
            const displayDy = (effectiveDisplayBase === 'red') ? -p.dy : p.dy
            const stepX = p.dx === 0 ? 0 : (p.dx > 0 ? 1 : -1)
            const stepY = displayDy === 0 ? 0 : (displayDy > 0 ? 1 : -1)
            if (p.repeat) {
                let r = centerRow + stepY
                let c = centerCol + stepX
                // 编辑器网格行数 0..8, 列 0..8
                while (r >= 0 && r < 9 && c >= 0 && c < 9) {
                    const key = `${r}-${c}`
                    next.add(key)
                    // 保存每个格子对应的原模板 pattern（以便保留条件）
                    if (!patternsMap[key]) patternsMap[key] = []
                    patternsMap[key].push(p)
                    r += stepY
                    c += stepX
                }
            } else {
                const row = centerRow + displayDy
                const col = centerCol + p.dx
                if (row >= 0 && row < 9 && col >= 0 && col < 9 && !(row === centerRow && col === centerCol)) {
                    const key = `${row}-${col}`
                    next.add(key)
                    if (!patternsMap[key]) patternsMap[key] = []
                    patternsMap[key].push(p)
                }
            }
        })
    // 根据 phase 写入对应的 selectedCells/selectedCellPatterns（默认使用当前 editingRiverView）
    const effectivePhase = phase ?? editingRiverView
    if (effectivePhase === 'pre' || effectivePhase === 'both') {
        setSelectedCellsPre(next)
        setSelectedCellPatternsPre(patternsMap)
    }
    if (effectivePhase === 'post' || effectivePhase === 'both') {
        setSelectedCellsPost(next)
        setSelectedCellPatternsPost(patternsMap)
    }
        
    const hasMoveOnly = tpl.patterns.every(p => p.moveOnly)
        const hasCaptureOnly = tpl.patterns.every(p => p.captureOnly)
        if (hasMoveOnly) setMoveType('move')
        else if (hasCaptureOnly) setMoveType('capture')
        else setMoveType('both')
        setIsRepeatable(!!tpl.patterns.find(p => p.repeat))
        
    if (tplId === 'knight-l') setHorseLegBlocked(true)
    if (tplId === 'elephant-field') setElephantEyeBlocked(true)
    }

    // 生成移动模式
    const generateMovePatterns = (): MovePattern[] => {
        const patterns: MovePattern[] = []

        // helper to process a phase's selections
        const processPhase = (phase: 'pre' | 'post', cells: Set<string>, cellPats: Record<string, MovePattern[]>) => {
            const injectRiverCond = phase === 'pre' ? { type: 'position' as const, notCrossedRiver: true } : { type: 'position' as const, crossedRiver: true }
            cells.forEach(cellKey => {
                const [row, col] = cellKey.split('-').map(Number)
                const dx = col - centerCol
                const visualDy = row - centerRow
                const dy = editingSide === 'red' ? -visualDy : visualDy
                if (dx === 0 && dy === 0) return

                const tplPats = cellPats[cellKey]
                if (tplPats && tplPats.length) {
                    for (const tplPat of tplPats) {
                        const base: MovePattern = {
                            dx,
                            dy,
                            repeat: tplPat.repeat ?? isRepeatable,
                            maxSteps: (tplPat.repeat ?? isRepeatable) ? 0 : 1,
                            moveOnly: tplPat.moveOnly ?? (moveType === 'move'),
                            captureOnly: tplPat.captureOnly ?? (moveType === 'capture'),
                            conditions: tplPat.conditions ? [...tplPat.conditions] : undefined,
                        }

                        // ensure river condition exists for this phase only if template didn't specify it
                        const hasRiverCond = (base.conditions || []).some(c => c.type === 'position' && ((c as any).crossedRiver !== undefined || (c as any).notCrossedRiver !== undefined))
                        if (!hasRiverCond) {
                            base.conditions = [...(base.conditions || []), injectRiverCond]
                        }

                        patterns.push(base)
                    }
                    return
                }

                // fallback: manual selection without tpl patterns
                const base: MovePattern = {
                    dx,
                    dy,
                    repeat: isRepeatable,
                    maxSteps: isRepeatable ? 0 : 1,
                    moveOnly: moveType === 'move',
                    captureOnly: moveType === 'capture',
                    conditions: [injectRiverCond as any],
                }
                // 如果是马/象/炮等需要额外阻塞判断的棋子，自动注入相应条件（除非模板已指定）
                // 马的别马脚
                if (editingPieceType === 'horse' && horseLegBlocked) {
                    const absDx = Math.abs(dx), absDy = Math.abs(dy)
                    if ((absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2)) {
                        base.conditions = [...(base.conditions || []), { type: 'path' as const, hasNoObstacle: true } as any]
                    }
                }
                // 象的塞象眼（田字）
                if (editingPieceType === 'elephant' && elephantEyeBlocked) {
                    if (Math.abs(dx) === 2 && Math.abs(dy) === 2) {
                        base.conditions = [...(base.conditions || []), { type: 'position' as const, hasNoObstacle: true } as any]
                    }
                }
                // 注：炮是否需要炮架子改由模板本身的 conditions 决定，这里不再自动注入

                patterns.push(base)
            })
        }

        // process pre and post separately
        processPhase('pre', selectedCellsPre, selectedCellPatternsPre)
        processPhase('post', selectedCellsPost, selectedCellPatternsPost)

        return patterns
    }

    // 应用规则并返回选择棋子界面
    const handleApplyRule = () => {
        const patterns = generateMovePatterns()
        
        if (patterns.length === 0) {
            alert('请至少选择一个移动位置')
            return
        }
        
        // 保留已有 restrictions，但确保关键字段有安全默认值（例如 canJump 默认为 false）
        const prevRestrictions = ruleSet.pieceRules[editingPieceType]?.restrictions || {}
        const normalizedRestrictions = {
            ...prevRestrictions,
            canJump: prevRestrictions.canJump ?? false,
            canCrossRiver: prevRestrictions.canCrossRiver ?? (editingPieceType === 'soldier' ? true : prevRestrictions.canCrossRiver),
        }

        const updatedRuleSet = {
            ...ruleSet,
            pieceRules: {
                ...ruleSet.pieceRules,
                [editingPieceType]: {
                    name: pieceNames[editingPieceType],
                    movePatterns: patterns,
                    restrictions: normalizedRestrictions,
                },
            },
        }
        
        setRuleSet(updatedRuleSet)
        // 保存到 localStorage
        localStorage.setItem('customRuleSet', JSON.stringify(updatedRuleSet))
        
        // 返回选择棋子界面,清空当前选择（清空 pre/post 两侧）
        setSelectedCellsPre(new Set())
        setSelectedCellsPost(new Set())
        setSelectedCellPatternsPre({})
        setSelectedCellPatternsPost({})
        setCurrentStep('select-piece')
    }

    // 保存并开始对局
    const handleSaveAndStart = () => {
        localStorage.setItem('customRuleSet', JSON.stringify(ruleSet))
        navigate('/app/custom-battle')
    }

    // 处理规则编辑棋盘点击（根据当前编辑视图 pre/post 更新对应集合）
    const handleRuleEditClick = (row: number, col: number) => {
        if (row === centerRow && col === centerCol) return

        const cellKey = `${row}-${col}`
        if (editingRiverView === 'pre') {
            const newSelection = new Set(selectedCellsPre)
            const newPatterns = { ...selectedCellPatternsPre }
            if (editMode === 'add') {
                newSelection.add(cellKey)
            } else {
                newSelection.delete(cellKey)
                if (newPatterns[cellKey]) delete newPatterns[cellKey]
            }
            setSelectedCellsPre(newSelection)
            setSelectedCellPatternsPre(newPatterns)
        } else {
            const newSelection = new Set(selectedCellsPost)
            const newPatterns = { ...selectedCellPatternsPost }
            if (editMode === 'add') {
                newSelection.add(cellKey)
            } else {
                newSelection.delete(cellKey)
                if (newPatterns[cellKey]) delete newPatterns[cellKey]
            }
            setSelectedCellsPost(newSelection)
            setSelectedCellPatternsPost(newPatterns)
        }
    }

    // 渲染步骤1: 摆放棋子
    const renderPlacementStep = () => {
        const pieceOptions: { type: PieceType; side: Side; label: string }[] = [
            { type: 'general', side: 'red', label: '帅' },
            { type: 'general', side: 'black', label: '将' },
            { type: 'advisor', side: 'red', label: '仕' },
            { type: 'advisor', side: 'black', label: '士' },
            { type: 'elephant', side: 'red', label: '相' },
            { type: 'elephant', side: 'black', label: '象' },
            { type: 'horse', side: 'red', label: '马' },
            { type: 'horse', side: 'black', label: '马' },
            { type: 'rook', side: 'red', label: '车' },
            { type: 'rook', side: 'black', label: '车' },
            { type: 'cannon', side: 'red', label: '炮' },
            { type: 'cannon', side: 'black', label: '炮' },
            { type: 'soldier', side: 'red', label: '兵' },
            { type: 'soldier', side: 'black', label: '兵' },
        ]

        return (
            <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>第一步：摆放棋子</h2>
                
                {/* 棋子选择器 */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)', 
                    gap: '8px', 
                    marginBottom: '16px',
                    background: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <button
                        onClick={() => setSelectedPieceType(null)}
                        style={{
                            padding: '12px 8px',
                            border: selectedPieceType === null ? '2px solid #3b82f6' : '1px solid #ccc',
                            borderRadius: '6px',
                            background: selectedPieceType === null ? '#eff6ff' : 'white',
                            cursor: 'pointer',
                            fontSize: '20px'
                        }}
                        title="点击已有棋子清除"
                    >
                        ❌
                    </button>
                    {pieceOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedPieceType({ type: opt.type, side: opt.side })}
                            style={{
                                padding: '12px 8px',
                                border: selectedPieceType?.type === opt.type && selectedPieceType?.side === opt.side 
                                    ? '2px solid #3b82f6' 
                                    : '1px solid #ccc',
                                borderRadius: '6px',
                                background: selectedPieceType?.type === opt.type && selectedPieceType?.side === opt.side 
                                    ? '#eff6ff' 
                                    : 'white',
                                cursor: 'pointer',
                                fontSize: '18px',
                                color: opt.side === 'red' ? '#dc2626' : '#1f2937'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* 棋盘 */}
                <div style={{ 
                    display: 'inline-block', 
                    border: '3px solid #374151',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginBottom: '16px'
                }}>
                    {placementBoard.map((row, rowIdx) => (
                        <div key={rowIdx} style={{ display: 'flex' }}>
                            {row.map((piece, colIdx) => (
                                <div
                                    key={colIdx}
                                    onClick={() => handlePlacementClick(rowIdx, colIdx)}
                                    style={{
                                        width: 50,
                                        height: 50,
                                        border: '1px solid #9ca3af',
                                        background: piece ? '#fef3c7' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        color: piece?.side === 'red' ? '#dc2626' : '#1f2937'
                                    }}
                                >
                                    {piece && pieceNames[piece.type].split('/')[piece.side === 'red' ? 0 : 1]}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => {
                            localStorage.removeItem('customRuleSet')
                            localStorage.removeItem('placementBoard')
                            navigate('/app/home')
                        }}
                        style={{
                            flex: 1,
                            padding: '14px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        返回
                    </button>
                    <button
                        onClick={() => {
                            // 保存棋盘布局到localStorage
                            localStorage.setItem('placementBoard', JSON.stringify(placementBoard))
                            setCurrentStep('select-piece')
                        }}
                        style={{
                            flex: 2,
                            padding: '14px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        完成摆子，进入编辑 →
                    </button>
                </div>
            </div>
        )
    }

    // 渲染步骤2: 选择要编辑的棋子
    const renderSelectPieceStep = () => {
        return (
            <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>第二步：选择要编辑规则的棋子</h2>
                <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '16px' }}>
                    点击棋盘上的任意棋子，开始编辑它的移动规则
                </p>

                <div style={{ 
                    display: 'inline-block', 
                    border: '3px solid #374151',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    marginBottom: '16px'
                }}>
                    {placementBoard.map((row, rowIdx) => (
                        <div key={rowIdx} style={{ display: 'flex' }}>
                            {row.map((piece, colIdx) => (
                                <div
                                    key={colIdx}
                                    onClick={() => handlePieceSelect(rowIdx, colIdx)}
                                    style={{
                                        width: 50,
                                        height: 50,
                                        border: '1px solid #9ca3af',
                                        background: piece ? '#fef3c7' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: piece ? 'pointer' : 'default',
                                        fontSize: '20px',
                                        fontWeight: 'bold',
                                        color: piece?.side === 'red' ? '#dc2626' : '#1f2937',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (piece) {
                                            (e.currentTarget as HTMLDivElement).style.background = '#fde68a'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (piece) {
                                            (e.currentTarget as HTMLDivElement).style.background = '#fef3c7'
                                        }
                                    }}
                                >
                                    {piece && pieceNames[piece.type].split('/')[piece.side === 'red' ? 0 : 1]}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button
                        onClick={handleSaveAndStart}
                        style={{
                            flex: 2,
                            padding: '14px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        💾 保存并开始对局
                    </button>
                    <button
                        onClick={() => setCurrentStep('choose-mode')}
                        style={{
                            flex: 1,
                            padding: '14px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        ← 返回
                    </button>
                </div>
            </div>
        )
    }

    // 渲染初始选择：修改布局 or 修改规则
    const renderChooseModeStep = () => {
        return (
            <div style={{ padding: '32px 16px', maxWidth: '500px', margin: '0 auto' }}>
                <h1 style={{ textAlign: 'center', marginBottom: '16px', fontSize: '28px' }}>
                    🎨 可视化规则编辑器
                </h1>
                <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '32px' }}>
                    请选择编辑模式
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button
                        onClick={() => setCurrentStep('place-pieces')}
                        style={{
                            padding: '24px',
                            background: 'white',
                            border: '2px solid #3b82f6',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)'
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏗️</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                            修改布局
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                            在棋盘上摆放棋子，自定义初始局面
                        </div>
                    </button>

                    <button
                        onClick={() => setCurrentStep('select-piece')}
                        style={{
                            padding: '24px',
                            background: 'white',
                            border: '2px solid #10b981',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)'
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚙️</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                            修改规则
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                            自定义棋子的移动规则和特殊能力
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            localStorage.removeItem('customRuleSet')
                            localStorage.removeItem('placementBoard')
                            navigate('/app/home')
                        }}
                        style={{
                            marginTop: '16px',
                            padding: '14px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer'
                        }}
                    >
                        返回主页
                    </button>
                </div>
            </div>
        )
    }

    // 渲染步骤3: 编辑规则
    const renderEditRulesStep = () => {
        const renderRuleBoard = () => {
            const rows = []
            const cellSize = 50
            
            for (let row = 0; row < 9; row++) {
                const cells = []
                for (let col = 0; col < 9; col++) {
                    const isCenter = row === centerRow && col === centerCol
                    const cellKey = `${row}-${col}`
                    const isSelectedPre = selectedCellsPre.has(cellKey)
                    const isSelectedPost = selectedCellsPost.has(cellKey)
                    const isSelected = editingRiverView === 'pre' ? isSelectedPre : isSelectedPost
                    const otherSelected = editingRiverView === 'pre' ? isSelectedPost : isSelectedPre

                    let bgColor = 'white'
                    let cursor = 'pointer'
                    if (isCenter) {
                        bgColor = '#ef4444'
                        cursor = 'not-allowed'
                    } else if (isSelected) {
                        bgColor = '#4ade80'
                    } else if (otherSelected) {
                        bgColor = '#fde68a' // indicate other-phase selection
                    }
                    
                    cells.push(
                        <div
                            key={cellKey}
                            style={{
                                width: cellSize,
                                height: cellSize,
                                border: '1px solid #9ca3af',
                                backgroundColor: bgColor,
                                cursor: cursor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                            }}
                            onClick={() => !isCenter && handleRuleEditClick(row, col)}
                            onMouseEnter={(e) => {
                                if (!isCenter && !isSelected) {
                                    (e.currentTarget as HTMLDivElement).style.backgroundColor = '#e5e7eb'
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isCenter && !isSelected) {
                                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white'
                                }
                            }}
                        >
                            {isCenter && (
                                <span style={{ color: 'white', fontSize: '16px' }}>
                                    {pieceNames[editingPieceType].split('/')[templateDisplayBase === 'red' ? 0 : 1]}
                                </span>
                            )}
                            {isSelected && !isCenter && (
                                // For soldiers, show the dot at the bottom of the cell; otherwise keep it centered
                                <div style={{
                                    position: 'absolute',
                                    left: '50%',
                                    // when editing a soldier place dot near bottom; otherwise center vertically
                                    top: editingPieceType === 'soldier' ? undefined : '50%',
                                    bottom: editingPieceType === 'soldier' ? 8 : undefined,
                                    transform: editingPieceType === 'soldier' ? 'translateX(-50%)' : 'translate(-50%, -50%)',
                                    width: 24,
                                    height: 24,
                                    backgroundColor: '#2563eb',
                                    borderRadius: '50%',
                                }} />
                            )}
                            {/* show small indicator if other phase has selection here */}
                            {!isSelected && otherSelected && !isCenter && (
                                <div style={{
                                    position: 'absolute',
                                    right: 6,
                                    bottom: 6,
                                    width: 8,
                                    height: 8,
                                    backgroundColor: '#b91c1c',
                                    borderRadius: '50%'
                                }} />
                            )}
                        </div>
                    )
                }
                rows.push(
                    <div key={row} style={{ display: 'flex' }}>
                        {cells}
                    </div>
                )
            }
            return (
                <div style={{ 
                    display: 'inline-block', 
                    border: '3px solid #374151',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}>
                    {rows}
                </div>
            )
        }

        return (
            <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '20px' }}>
                    第三步：编辑 {pieceNames[editingPieceType]} 的规则
                </h2>
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
                    已选择 <strong style={{ color: '#3b82f6' }}>{editingRiverView === 'pre' ? selectedCellsPre.size : selectedCellsPost.size}</strong> 个位置（{editingRiverView === 'pre' ? '过河前' : '过河后'}）
                </p>

                {/* 模板选择 */}
                <div style={{ 
                    background: 'white', 
                    borderRadius: '8px', 
                    padding: '12px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px', marginTop: 0 }}>模板选择</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {(Object.keys(moveTemplates) as MoveTemplateType[])
                            .filter(id => {
                                const isPawnTemplate = id === 'pawn-forward' || id === 'pawn-cross'
                                if (isPawnTemplate) return editingPieceType === 'soldier'
                                // 其他棋子正常显示模板（炮不会进入此分支）
                                return true
                            })
                            .map(id => (
                                <button
                                    key={id}
                                    onClick={() => applyTemplateToBoard(id)}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '6px',
                                        border: selectedTemplate === id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                        background: selectedTemplate === id ? '#eff6ff' : 'white',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    {moveTemplates[id].icon} {moveTemplates[id].name}
                                </button>
                            ))
                        }
                    </div>
                    
                    {/* 特殊规则开关 */}
                    {selectedTemplate === 'knight-l' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '14px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={horseLegBlocked} onChange={(e) => setHorseLegBlocked(e.target.checked)} />
                            <span>别马脚</span>
                        </label>
                    )}
                    {selectedTemplate === 'elephant-field' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '14px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={elephantEyeBlocked} onChange={(e) => setElephantEyeBlocked(e.target.checked)} />
                            <span>塞象眼</span>
                        </label>
                    )}
                    {/* 已移除“炮吃子需要炮架子”开关；请使用模板自带条件控制 */}
                </div>

                {/* 编辑模式 */}
                <div style={{ 
                    background: 'white', 
                    borderRadius: '8px', 
                    padding: '12px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px', marginTop: 0 }}>编辑模式</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setEditMode('add')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: editMode === 'add' ? '#10b981' : '#f3f4f6',
                                color: editMode === 'add' ? 'white' : '#374151',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            ➕ 添加
                        </button>
                        <button
                            onClick={() => setEditMode('remove')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: editMode === 'remove' ? '#ef4444' : '#f3f4f6',
                                color: editMode === 'remove' ? 'white' : '#374151',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            ➖ 删除
                        </button>
                    </div>
                </div>

                {/* 过河阶段（替代旧的移动/吃子选择） */}
                <div style={{ 
                    background: 'white', 
                    borderRadius: '8px', 
                    padding: '12px',
                    marginBottom: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px', marginTop: 0 }}>编辑视图</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditingRiverView('pre')} style={{ padding: 8, borderRadius: 6, background: editingRiverView === 'pre' ? '#3b82f6' : '#f3f4f6', color: editingRiverView === 'pre' ? 'white' : '#374151' }}>过河前</button>
                        <button onClick={() => setEditingRiverView('post')} style={{ padding: 8, borderRadius: 6, background: editingRiverView === 'post' ? '#3b82f6' : '#f3f4f6', color: editingRiverView === 'post' ? 'white' : '#374151' }}>过河后</button>
                    </div>
                </div>

                {/* 棋盘 */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    {renderRuleBoard()}
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        onClick={handleApplyRule}
                        style={{
                            padding: '14px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        ✅ 保存此棋子规则
                    </button>
                    <button
                        onClick={() => editingRiverView === 'pre' ? setSelectedCellsPre(new Set()) : setSelectedCellsPost(new Set())}
                        style={{
                            padding: '12px',
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        �️ 清除选择
                    </button>
                    <button
                        onClick={() => {
                            setCurrentStep('select-piece')
                            setSelectedCellsPre(new Set())
                            setSelectedCellsPost(new Set())
                        }}
                        style={{
                            padding: '12px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        ← 返回选择棋子
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
            paddingTop: '16px',
            paddingBottom: '32px'
        }}>
            {currentStep === 'choose-mode' && renderChooseModeStep()}
            {currentStep === 'place-pieces' && renderPlacementStep()}
            {currentStep === 'select-piece' && renderSelectPieceStep()}
            {currentStep === 'edit-rules' && renderEditRulesStep()}
        </div>
    )
}
