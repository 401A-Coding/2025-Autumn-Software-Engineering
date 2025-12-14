import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import type { PieceType, Piece, Side } from '../../features/chess/types'
import { createInitialBoard } from '../../features/chess/types'
import type { CustomRuleSet, MovePattern } from '../../features/chess/ruleEngine'
import { standardChessRules } from '../../features/chess/rulePresets'
import { moveTemplates, getDefaultTemplateForPiece, type MoveTemplateType } from '../../features/chess/moveTemplates'
import { boardStore } from '../../features/boards/boardStore'
import '../../features/chess/board.css'



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

    // 模板由独立页面管理；编辑器顶部提供快速跳转

    // 三步流程状态
    const [currentStep, setCurrentStep] = useState<EditorStep>('choose-mode')

    // 步骤1: 摆放棋子
    const location = useLocation()
    const stateAny: any = (location && (location as any).state) || {}
    const [placementBoard, setPlacementBoard] = useState<PlacementBoard>(() => {
        // 不再使用 localStorage 持久化；优先使用路由 state 的布局（由模板管理导入），否则使用初始棋盘
        if (stateAny.layout) {
            try {
                return stateAny.layout as PlacementBoard
            } catch (e) {
                console.error('Invalid layout in navigation state', e)
            }
        }
        return createInitialBoard()
    })
    const [selectedPieceType, setSelectedPieceType] = useState<{ type: PieceType; side: Side } | null>(null)

    // 步骤2&3: 选中的棋子类型和阵营
    const [editingPieceType, setEditingPieceType] = useState<PieceType>('rook')
    const [editingSide, setEditingSide] = useState<Side>('black')

    // 步骤3: 规则编辑
    const [ruleSet, setRuleSet] = useState<CustomRuleSet>(() => {
        // 不再使用 localStorage 持久化；优先使用路由 state 中传入的 rules（由模板管理导入）
        if (stateAny.rules) {
            try {
                return stateAny.rules as CustomRuleSet
            } catch (e) {
                console.error('Invalid rules in navigation state', e)
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
    const [selectedTemplatesPre, setSelectedTemplatesPre] = useState<Set<MoveTemplateType>>(new Set())
    const [selectedTemplatesPost, setSelectedTemplatesPost] = useState<Set<MoveTemplateType>>(new Set())
    const getCurrentSelectedTemplates = () => editingRiverView === 'pre' ? selectedTemplatesPre : selectedTemplatesPost
    const setCurrentSelectedTemplates = (s: Set<MoveTemplateType>) => {
        if (editingRiverView === 'pre') setSelectedTemplatesPre(s)
        else setSelectedTemplatesPost(s)
    }
    // per-phase toggles for special blocking rules and cannon-capture behavior
    const [horseLegBlockedPre, setHorseLegBlockedPre] = useState(true)
    const [horseLegBlockedPost, setHorseLegBlockedPost] = useState(true)
    const [elephantEyeBlockedPre, setElephantEyeBlockedPre] = useState(true)
    const [elephantEyeBlockedPost, setElephantEyeBlockedPost] = useState(true)
    const [useCannonCapturePre, setUseCannonCapturePre] = useState(false)
    const [useCannonCapturePost, setUseCannonCapturePost] = useState(false)
    const [allowDualCapturePre, setAllowDualCapturePre] = useState(false)
    const [allowDualCapturePost, setAllowDualCapturePost] = useState(false)

    const getCurrentHorseLegBlocked = () => editingRiverView === 'pre' ? horseLegBlockedPre : horseLegBlockedPost
    const setCurrentHorseLegBlocked = (v: boolean) => { if (editingRiverView === 'pre') setHorseLegBlockedPre(v); else setHorseLegBlockedPost(v) }
    const getCurrentElephantEyeBlocked = () => editingRiverView === 'pre' ? elephantEyeBlockedPre : elephantEyeBlockedPost
    const setCurrentElephantEyeBlocked = (v: boolean) => { if (editingRiverView === 'pre') setElephantEyeBlockedPre(v); else setElephantEyeBlockedPost(v) }
    const getCurrentUseCannonCapture = () => editingRiverView === 'pre' ? useCannonCapturePre : useCannonCapturePost
    const setCurrentUseCannonCapture = (v: boolean) => { if (editingRiverView === 'pre') setUseCannonCapturePre(v); else setUseCannonCapturePost(v) }
    const getCurrentAllowDualCapture = () => editingRiverView === 'pre' ? allowDualCapturePre : allowDualCapturePost
    const setCurrentAllowDualCapture = (v: boolean) => { if (editingRiverView === 'pre') setAllowDualCapturePre(v); else setAllowDualCapturePost(v) }
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

    // 所有模板现在对任意棋子均可用；不再限制模板白名单

    const gridRows = 17
    const gridCols = 17
    const centerRow = Math.floor(gridRows / 2)
    const centerCol = Math.floor(gridCols / 2)

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
            // 清除之前保留的模板选择，避免遗留模板（如直线无限）影响当前棋子
            setSelectedTemplatesPre(new Set())
            setSelectedTemplatesPost(new Set())
            // 立即以被点击的棋子类型/阵营为准计算 displayBase，避免 state 更新延迟导致显示错误
            const displayBase: Side = piece.type === 'soldier' ? 'red' : piece.side
            applyTemplateToBoard(defTpl, displayBase)

            // 初始化 pre/post 的已选格和 pattern 映射：优先使用已有的 rules（ruleSet）
            const existing = ruleSet.pieceRules?.[piece.type]?.movePatterns || []
            const preSet = new Set<string>()
            const postSet = new Set<string>()
            const preMap: Record<string, MovePattern[]> = {}
            const postMap: Record<string, MovePattern[]> = {}

            const pushToMap = (map: Record<string, MovePattern[]>, key: string, pat: MovePattern) => {
                if (!map[key]) map[key] = []
                map[key].push(pat)
            }

            for (const pat of existing) {
                // 判断是否为 pre/post/both
                const conds = pat.conditions || []
                let isPre = false
                let isPost = false
                for (const c of conds) {
                    if ((c as any).notCrossedRiver) isPre = true
                    if ((c as any).crossedRiver) isPost = true
                }
                // 若无明确 river 条件，则视为同时适用（both）
                if (!isPre && !isPost) { isPre = true; isPost = true }

                // 将 pattern 的 dx/dy 转换为编辑器格子坐标（考虑阵营方向）
                const dx = pat.dx
                const patternDy = pat.dy
                const visualDy = piece.side === 'red' ? -patternDy : patternDy

                if (pat.repeat) {
                    // 重复模式：沿方向展开所有格子
                    const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1)
                    const stepY = visualDy === 0 ? 0 : (visualDy > 0 ? 1 : -1)
                    let r = centerRow + stepY
                    let c = centerCol + stepX
                    while (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                        const key = `${r}-${c}`
                        if (isPre) {
                            preSet.add(key)
                            pushToMap(preMap, key, pat)
                        }
                        if (isPost) {
                            postSet.add(key)
                            pushToMap(postMap, key, pat)
                        }
                        r += stepY
                        c += stepX
                    }
                } else {
                    const row2 = centerRow + visualDy
                    const col2 = centerCol + dx
                    if (row2 >= 0 && row2 < gridRows && col2 >= 0 && col2 < gridCols && !(row2 === centerRow && col2 === centerCol)) {
                        const key = `${row2}-${col2}`
                        if (isPre) { preSet.add(key); pushToMap(preMap, key, pat) }
                        if (isPost) { postSet.add(key); pushToMap(postMap, key, pat) }
                    }
                }
            }

            // 如果没有 post 特殊规则，则默认继承 pre 的配置（避免用户忘记在 post 中重复设置）
            if (postSet.size === 0 && preSet.size > 0) {
                for (const k of Array.from(preSet)) {
                    postSet.add(k)
                    postMap[k] = (preMap[k] || []).map(p => ({ ...p }))
                }
            }

            setSelectedCellsPre(preSet)
            setSelectedCellsPost(postSet)
            setSelectedCellPatternsPre(preMap)
            setSelectedCellPatternsPost(postMap)
        }
    }



    // 模板应用
    // applyTemplateToBoard 接受可选的 displayBase 和 phase，用于避免在 handlePieceSelect 中出现 React state 更新延迟导致的显示不一致
    const applyTemplateToBoard = (tplId: MoveTemplateType, displayBase?: Side, phase?: 'pre' | 'post' | 'both') => {
        // toggle template selection in current phase
        const nextSet = new Set(getCurrentSelectedTemplates())
        if (nextSet.has(tplId)) nextSet.delete(tplId)
        else nextSet.add(tplId)
        setCurrentSelectedTemplates(nextSet)

        // effective display base
        const effectiveDisplayBase: Side = displayBase ?? (editingPieceType === 'soldier' ? 'red' : editingSide)
        setTemplateDisplayBase(effectiveDisplayBase)

        // merge patterns from all selected templates
        const patternsMap: Record<string, MovePattern[]> = {}
        const nextCells = new Set<string>()

        const pushToMap = (key: string, p: MovePattern) => {
            if (!patternsMap[key]) patternsMap[key] = []
            patternsMap[key].push(p)
        }

        const selectedIds = Array.from(nextSet)
        for (const id of selectedIds) {
            const tpl = (moveTemplates as any)[id as MoveTemplateType]
            tpl.patterns.forEach((p: any) => {
                const displayDy = (effectiveDisplayBase === 'red') ? -p.dy : p.dy
                const stepX = p.dx === 0 ? 0 : (p.dx > 0 ? 1 : -1)
                const stepY = displayDy === 0 ? 0 : (displayDy > 0 ? 1 : -1)
                if (p.repeat) {
                    let r = centerRow + stepY
                    let c = centerCol + stepX
                    while (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                        const key = `${r}-${c}`
                        nextCells.add(key)
                        pushToMap(key, p)
                        r += stepY
                        c += stepX
                    }
                } else {
                    const row = centerRow + displayDy
                    const col = centerCol + p.dx
                    if (row >= 0 && row < gridRows && col >= 0 && col < gridCols && !(row === centerRow && col === centerCol)) {
                        const key = `${row}-${col}`
                        nextCells.add(key)
                        pushToMap(key, p)
                    }
                }
            })
        }

        const effectivePhase = phase ?? editingRiverView
        if (effectivePhase === 'pre' || effectivePhase === 'both') {
            setSelectedCellsPre(nextCells)
            setSelectedCellPatternsPre(patternsMap)
        }
        if (effectivePhase === 'post' || effectivePhase === 'both') {
            setSelectedCellsPost(nextCells)
            setSelectedCellPatternsPost(patternsMap)
        }

        // derive moveType/isRepeatable from merged patterns
        const allPatterns = Object.values(patternsMap).flat()
        const hasMoveOnly = allPatterns.length > 0 && allPatterns.every(p => p.moveOnly)
        const hasCaptureOnly = allPatterns.length > 0 && allPatterns.every(p => p.captureOnly)
        if (hasMoveOnly) setMoveType('move')
        else if (hasCaptureOnly) setMoveType('capture')
        else setMoveType('both')
        setIsRepeatable(allPatterns.some(p => p.repeat))

        // if any selected template implies special blocking, enable the toggle by default (for the current phase)
        if (nextSet.has('knight-l')) setCurrentHorseLegBlocked(true)
        if (nextSet.has('elephant-field')) setCurrentElephantEyeBlocked(true)
    }

    // 生成移动模式
    const generateMovePatterns = (): MovePattern[] => {
        const patterns: MovePattern[] = []

        // helper to process a phase's selections
        const processPhase = (phase: 'pre' | 'post', cells: Set<string>, cellPats: Record<string, MovePattern[]>) => {
            const injectRiverCond = phase === 'pre' ? { type: 'position' as const, notCrossedRiver: true } : { type: 'position' as const, crossedRiver: true }
            const cannonEnabled = phase === 'pre' ? (useCannonCapturePre || allowDualCapturePre) : (useCannonCapturePost || allowDualCapturePost)
            const allowDual = phase === 'pre' ? allowDualCapturePre : allowDualCapturePost
            const horseBlocked = phase === 'pre' ? horseLegBlockedPre : horseLegBlockedPost
            const elephantBlocked = phase === 'pre' ? elephantEyeBlockedPre : elephantEyeBlockedPost
            cells.forEach(cellKey => {
                const [row, col] = cellKey.split('-').map(Number)
                const dx = col - centerCol
                const visualDy = row - centerRow
                const dy = editingSide === 'red' ? -visualDy : visualDy
                if (dx === 0 && dy === 0) return

                const tplPats = cellPats[cellKey]
                if (tplPats && tplPats.length) {
                    for (const tplPat of tplPats) {
                        // Templates are only suggestions — the visual editor's selected points are authoritative.
                        // Determine `repeat` from the selection: if user selected multiple cells along the same
                        // normalized direction, treat it as repeat; otherwise respect explicit tplPat.repeat or global isRepeatable.
                        // fallback normalize
                        const getNorm = (x: number, y: number) => {
                            if (x === 0 && y === 0) return { x: 0, y: 0 }
                            const ax = Math.abs(x), ay = Math.abs(y)
                            let g = 1
                            for (let i = Math.min(ax, ay); i > 1; i--) {
                                if (ax % i === 0 && ay % i === 0) { g = i; break }
                            }
                            if (ax === 0) g = ay
                            if (ay === 0) g = ax
                            return { x: x / g, y: y / g }
                        }
                        const tplNorm = getNorm(dx, dy)
                        // 统计在相同归一方向上被选中的格子数（包括当前格）
                        let selectedStepsCount = 1
                        for (const otherKey of cells) {
                            if (otherKey === cellKey) continue
                            const [orow, ocol] = otherKey.split('-').map(Number)
                            const odx = ocol - centerCol
                            const ovisualDy = orow - centerRow
                            const ody = editingSide === 'red' ? -ovisualDy : ovisualDy
                            const onorm = getNorm(odx, ody)
                            if (onorm.x === tplNorm.x && onorm.y === tplNorm.y) { selectedStepsCount++ }
                        }

                        const tplRepeat = tplPat.repeat ?? false
                        // 只有模板自身或全局 isRepeatable 才会产生无限 repeat
                        const effectiveRepeat = tplRepeat || isRepeatable

                        // moveType（编辑器全局选择）应优先于模板的 moveOnly/captureOnly
                        const moveOnlyVal = moveType === 'move' ? true : moveType === 'capture' ? false : (tplPat.moveOnly ?? false)
                        const captureOnlyVal = moveType === 'capture' ? true : moveType === 'move' ? false : (tplPat.captureOnly ?? false)

                        const base: MovePattern = {
                            dx,
                            dy,
                            repeat: effectiveRepeat,
                            // 若为无限 repeat 则 maxSteps=0，否则使用用户选中的步数（若用户选了多格则放行为多步），默认 1
                            maxSteps: effectiveRepeat ? 0 : (selectedStepsCount > 1 ? selectedStepsCount : 1),
                            moveOnly: moveOnlyVal,
                            captureOnly: captureOnlyVal,
                            conditions: tplPat.conditions ? [...tplPat.conditions] : undefined,
                        }

                        // 如果启用了“炮式吃子”，则在为直线方向添加炮式吃子时，取消原有的吃子能力（仅保留移动），
                        // 以达到“变成炮吃子后原来的吃子方式取消”的语义。
                        if (cannonEnabled && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
                            // 如果启用了“炮式吃子”，并且没有选中“同时保留原吃子”，则把原有吃子改为仅移动
                            if (!allowDual) {
                                if (!base.moveOnly) {
                                    base.moveOnly = true
                                    base.captureOnly = false
                                }
                            }
                        }

                        // ensure river condition exists for this phase only if template didn't specify it
                        const hasRiverCond = (base.conditions || []).some(c => c.type === 'position' && ((c as any).crossedRiver !== undefined || (c as any).notCrossedRiver !== undefined))
                        if (!hasRiverCond) {
                            base.conditions = [...(base.conditions || []), injectRiverCond]
                        }

                        patterns.push(base)

                        // 如果启用了“炮型吃子”选项，并且此 pattern 允许吃子（不是纯移动），
                        // 则为该方向添加一个额外的炮式吃子 pattern（只在直线方向有意义）。
                        const tplAllowsCapture = !(moveOnlyVal === true)
                        if (cannonEnabled && tplAllowsCapture) {
                            // 仅在直线方向添加炮吃子行为（dx===0 || dy===0）
                            if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
                                // 不重复添加已有的 obstacleCount 条件
                                const existingPathCond = (tplPat.conditions || []).find((c: any) => c.type === 'path' && (c as any).obstacleCount !== undefined)
                                if (!existingPathCond) {
                                    const cannonCond = { type: 'path' as const, obstacleCount: 1 }
                                    const cannonPattern: MovePattern = {
                                        dx,
                                        dy,
                                        repeat: true,
                                        maxSteps: 0,
                                        captureOnly: true,
                                        conditions: [...(tplPat.conditions || []), cannonCond],
                                    }
                                    patterns.push(cannonPattern)
                                }
                            }
                        }
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
                // 如果启用了炮式吃子并且是直线方向，取消默认的吃子（保留移动）
                if (cannonEnabled && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
                    if (!allowDual) {
                        if (!base.moveOnly) {
                            base.moveOnly = true
                            base.captureOnly = false
                        }
                    }
                }
                // 如果是马/象/炮等需要额外阻塞判断的棋子，自动注入相应条件（除非模板已指定）
                // 马的别马脚
                if (editingPieceType === 'horse' && horseBlocked) {
                    const absDx = Math.abs(dx), absDy = Math.abs(dy)
                    if ((absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2)) {
                        base.conditions = [...(base.conditions || []), { type: 'path' as const, hasNoObstacle: true } as any]
                    }
                }
                // 象的塞象眼（田字）
                if (editingPieceType === 'elephant' && elephantBlocked) {
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

        // 保留已有 restrictions，但强制禁止越子（内核级规则）——编辑器不能开启跳子
        const prevRestrictions = ruleSet.pieceRules[editingPieceType]?.restrictions || {}
        const normalizedRestrictions = {
            ...prevRestrictions,
            // 绝对禁止越子：即使用户或旧数据里有 true，也要强制为 false
            canJump: false,
            canCrossRiver: prevRestrictions.canCrossRiver ?? (editingPieceType === 'soldier' ? true : prevRestrictions.canCrossRiver),
        }

        // 为防止可视化编辑意外引入跳子字段或其他运行时不允许的属性，清理 patterns
        const sanitizedPatterns = patterns.map(p => {
            const { jumpObstacle, ...rest } = p as any
            return rest as MovePattern
        })

        const updatedRuleSet = {
            ...ruleSet,
            pieceRules: {
                ...ruleSet.pieceRules,
                [editingPieceType]: {
                    name: pieceNames[editingPieceType],
                    movePatterns: sanitizedPatterns,
                    restrictions: normalizedRestrictions,
                },
            },
        }

        setRuleSet(updatedRuleSet)

        // 返回选择棋子界面,清空当前选择（清空 pre/post 两侧）
        setSelectedCellsPre(new Set())
        setSelectedCellsPost(new Set())
        setSelectedCellPatternsPre({})
        setSelectedCellPatternsPost({})
        setCurrentStep('select-piece')
    }

    // 保存当前布局+规则为模板
    const handleSaveTemplate = async () => {
        try {
            const name = window.prompt('为模板输入一个名称：', `模板 ${new Date().toLocaleString()}`)
            if (!name) return
            // 通过后端保存模板（不再在前端本地保存）
            const { boardToApiFormat } = await import('../../features/chess/boardAdapter')
            const { boardApi } = await import('../../services/api')
            const payload = boardToApiFormat(placementBoard, name, '')

            // 生成最小可通过 DTO 校验的 RulesDto 结构
            const toServerRules = () => {
                const pieceRules: Record<string, any> = {}
                const src = (ruleSet && (ruleSet as any).pieceRules) || {}
                for (const [k, cfg] of Object.entries(src)) {
                    if (!cfg || !(cfg as any).movePatterns) continue
                    const patterns = (cfg as any).movePatterns as Array<{ dx: number; dy: number }>
                    // 将本地 movePatterns 简化为 gridMask（忽略复杂条件与重复，仅保留目标相对坐标）
                    const gridMask: [number, number][] = []
                    const seen = new Set<string>()
                    for (const p of patterns) {
                        const key = `${p.dx},${p.dy}`
                        if (seen.has(key)) continue
                        seen.add(key)
                        gridMask.push([p.dx, p.dy])
                    }

                    // 约束映射：仅保留与 DTO 对齐的字段
                    const restrictions = (cfg as any).restrictions || {}
                    const constraints: any = {}
                    if (restrictions.mustStayInPalace === true) constraints.palace = 'insideOnly'
                    if (restrictions.canCrossRiver === false) constraints.river = 'cannotCross'

                    pieceRules[k] = {
                        ruleType: 'custom',
                        movement: gridMask.length ? { gridMask } : undefined,
                        captureMode: 'sameAsMove',
                        constraints: Object.keys(constraints).length ? constraints : undefined,
                    }
                }
                return {
                    ruleVersion: 1,
                    layoutSource: 'empty',
                    coordinateSystem: 'relativeToSide',
                    mode: 'analysis',
                    pieceRules,
                }
            }

                // 后端必填字段：preview（string）；并标记为模板
                ; (payload as any).preview = ''
                ; (payload as any).isTemplate = true
                // 附加规则（转换后的 DTO 结构）
                ; (payload as any).rules = toServerRules()
            try {
                const res = await boardApi.create(payload as any)
                alert(`已上传模板到服务器，ID: ${(res as any).boardId}`)
            } catch (e: any) {
                console.error('保存到服务器失败', e)
                alert(`保存到服务器失败：${e?.message || e}`)
            }
        } catch (e) {
            console.error('保存模板失败', e)
            alert('保存模板失败，请查看控制台')
        }
    }

    // 保存并开始对局
    const handleSaveAndStart = () => {
        // 不再将规则写入 localStorage，改为通过路由 state 传递给 CustomBattle
        navigate('/app/custom-battle', { state: { layout: placementBoard, rules: ruleSet } })
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

        const PieceGlyph = ({ type, side }: { type: PieceType; side: Side }) => {
            const glyph = (t: PieceType, s: Side) => {
                if (t === 'general') return s === 'red' ? '帥' : '將'
                if (t === 'advisor') return s === 'red' ? '仕' : '士'
                if (t === 'elephant') return s === 'red' ? '相' : '象'
                if (t === 'soldier') return s === 'red' ? '兵' : '卒'
                if (t === 'horse') return '馬'
                if (t === 'rook') return '車'
                if (t === 'cannon') return '炮'
                return '?'
            }
            return <div className={`piece ${side === 'red' ? 'piece--red' : 'piece--black'}`}>{glyph(type, side)}</div>
        }

        const PlacementBoard = () => (
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

                {placementBoard.map((row, y) =>
                    row.map((p, x) =>
                        p ? (
                            <div key={`${y}-${x}`} className={`piece-wrap piece-x-${x} piece-y-${y}`}>
                                <PieceGlyph type={p.type} side={p.side} />
                            </div>
                        ) : null
                    )
                )}

                {Array.from({ length: 10 }).map((_, y) =>
                    Array.from({ length: 9 }).map((_, x) => (
                        <button
                            key={`c-${x}-${y}`}
                            className={`click-area cell-x-${x} cell-y-${y}`}
                            onClick={() => handlePlacementClick(y, x)}
                            aria-label={`cell ${x},${y}`}
                            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                        />
                    ))
                )}
            </div>
        )

        return (
            <div className="pad-16 mw-720 mx-auto">
                <h2 className="text-center mb-16">第一步：摆放棋子</h2>

                {/* 棋子选择器 */}
                <div className="grid-7 gap-8 mb-16 card-surface">
                    <button
                        onClick={() => setSelectedPieceType(null)}
                        className={`opt-btn opt-btn--icon ${selectedPieceType === null ? 'opt-btn--active' : ''}`}
                        title="点击已有棋子清除"
                    >
                        ❌
                    </button>
                    {pieceOptions.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedPieceType({ type: opt.type, side: opt.side })}
                            className={`opt-btn ${selectedPieceType?.type === opt.type && selectedPieceType?.side === opt.side ? 'opt-btn--active' : ''} text-18 ${opt.side === 'red' ? 'text-red' : 'text-gray-800'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* 棋盘（采用与残局布置相同的渲染） */}
                <div className="row-center mb-16">
                    <PlacementBoard />
                </div>

                <div className="row gap-12">
                    <button
                        onClick={() => {
                            // 不再使用 localStorage 清理；直接返回主页
                            navigate('/app/home')
                        }}
                        className="btn-lg btn-lg--slate flex-1"
                    >
                        返回
                    </button>
                    <button
                        onClick={() => {
                            // 不再持久化到 localStorage，直接进入下一步
                            setCurrentStep('select-piece')
                        }}
                        className="btn-lg btn-lg--blue flex-2"
                    >
                        完成摆子，进入编辑 →
                    </button>
                </div>
            </div>
        )
    }

    // 渲染步骤2: 选择要编辑的棋子
    const renderSelectPieceStep = () => {
        const PieceGlyph = ({ type, side }: { type: PieceType; side: Side }) => {
            const glyph = (t: PieceType, s: Side) => {
                if (t === 'general') return s === 'red' ? '帥' : '將'
                if (t === 'advisor') return s === 'red' ? '仕' : '士'
                if (t === 'elephant') return s === 'red' ? '相' : '象'
                if (t === 'soldier') return s === 'red' ? '兵' : '卒'
                if (t === 'horse') return '馬'
                if (t === 'rook') return '車'
                if (t === 'cannon') return '炮'
                return '?'
            }
            return <div className={`piece ${side === 'red' ? 'piece--red' : 'piece--black'}`}>{glyph(type, side)}</div>
        }

        const SelectBoard = () => (
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

                {placementBoard.map((row, y) =>
                    row.map((p, x) =>
                        p ? (
                            <div key={`${y}-${x}`} className={`piece-wrap piece-x-${x} piece-y-${y}`}>
                                <PieceGlyph type={p.type} side={p.side} />
                            </div>
                        ) : null
                    )
                )}

                {Array.from({ length: 10 }).map((_, y) =>
                    Array.from({ length: 9 }).map((_, x) => (
                        <button
                            key={`s-${x}-${y}`}
                            className={`click-area cell-x-${x} cell-y-${y}`}
                            onClick={() => handlePieceSelect(y, x)}
                            aria-label={`cell ${x},${y}`}
                            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                        />
                    ))
                )}
            </div>
        )

        return (
            <div className="pad-16 mw-720 mx-auto">
                <h2 className="text-center mb-16">第二步：选择要编辑规则的棋子</h2>
                <p className="text-center mb-16 text-slate">
                    点击棋盘上的任意棋子，开始编辑它的移动规则
                </p>

                <div className="row-center mb-16">
                    <SelectBoard />
                </div>

                <div className="row gap-12 mt-16">
                    <button
                        onClick={handleSaveAndStart}
                        className="btn-lg btn-lg--green flex-2"
                    >
                        💾 保存并开始对局
                    </button>
                    <button
                        onClick={() => setCurrentStep('choose-mode')}
                        className="btn-lg btn-lg--slate flex-1"
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
            <div className="pt-32 pad-16 mw-520 mx-auto">
                <h1 className="text-center mb-16 text-28">
                    🎨 可视化规则编辑器
                </h1>
                <p className="text-center mb-32 text-slate">
                    请选择编辑模式
                </p>

                <div className="col gap-16">
                    <button
                        onClick={() => setCurrentStep('place-pieces')}
                        className="mode-card mode-card--layout"
                    >
                        <div className="text-32 mb-8">🏗️</div>
                        <div className="text-20 fw-700 text-gray mb-8">
                            修改布局
                        </div>
                        <div className="text-14 text-gray">
                            在棋盘上摆放棋子，自定义初始局面
                        </div>
                    </button>

                    <button
                        onClick={() => setCurrentStep('select-piece')}
                        className="mode-card mode-card--rules"
                    >
                        <div className="text-32 mb-8">⚙️</div>
                        <div className="text-20 fw-700 text-gray mb-8">
                            修改规则
                        </div>
                        <div className="text-14 text-gray">
                            自定义棋子的移动规则和特殊能力
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/app/home')}
                        className="btn-lg btn-lg--slate mt-16"
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

            for (let row = 0; row < gridRows; row++) {
                const cells = []
                for (let col = 0; col < gridCols; col++) {
                    const isCenter = row === centerRow && col === centerCol
                    const cellKey = `${row}-${col}`
                    const isSelectedPre = selectedCellsPre.has(cellKey)
                    const isSelectedPost = selectedCellsPost.has(cellKey)
                    const isSelected = editingRiverView === 'pre' ? isSelectedPre : isSelectedPost
                    const otherSelected = editingRiverView === 'pre' ? isSelectedPost : isSelectedPre

                    const cellClasses = ['rule-cell']
                    if (!isCenter) {
                        cellClasses.push('rule-cell--hover')
                    }
                    if (isCenter) {
                        cellClasses.push('rule-cell--center')
                    }
                    if (isSelected) {
                        cellClasses.push('rule-cell--selected')
                    }
                    if (!isSelected && otherSelected && !isCenter) {
                        cellClasses.push('rule-cell--other')
                    }

                    cells.push(
                        <div
                            key={cellKey}
                            className={cellClasses.join(' ')}
                            onClick={() => !isCenter && handleRuleEditClick(row, col)}
                        >
                            {isCenter && (
                                <span className="text-white text-16 fw-600">
                                    {pieceNames[editingPieceType].split('/')[templateDisplayBase === 'red' ? 0 : 1]}
                                </span>
                            )}
                            {isSelected && !isCenter && (
                                <div className={`rule-dot ${editingPieceType === 'soldier' ? 'rule-dot--soldier' : ''}`} />
                            )}
                            {/* show small indicator if other phase has selection here */}
                            {!isSelected && otherSelected && !isCenter && (
                                <div className="rule-indicator" />
                            )}
                        </div>
                    )
                }
                rows.push(
                    <div key={row} className="row">
                        {cells}
                    </div>
                )
            }
            return (
                <div className="rule-board-frame">
                    {rows}
                </div>
            )
        }

        return (
            <div className="pad-16 mw-600 mx-auto">
                <h2 className="text-center mb-8 text-20">
                    第三步：编辑 {pieceNames[editingPieceType]} 的规则
                </h2>
                <p className="text-center text-14 mb-16 text-gray">
                    已选择 <strong className="text-blue-600">{editingRiverView === 'pre' ? selectedCellsPre.size : selectedCellsPost.size}</strong> 个位置（{editingRiverView === 'pre' ? '过河前' : '过河后'}）
                </p>

                {/* 模板选择 */}
                <div className="card-surface mb-12">
                    <h3 className="text-16 mb-8 mt-0">模板选择</h3>
                    <div className="grid-2 gap-6">
                        {(Object.keys(moveTemplates) as MoveTemplateType[])
                            .map(id => (
                                <button
                                    key={id}
                                    onClick={() => applyTemplateToBoard(id)}
                                    className={`opt-btn text-left ${getCurrentSelectedTemplates().has(id as MoveTemplateType) ? 'opt-btn--active' : ''} text-13`}
                                >
                                    {moveTemplates[id].icon} {moveTemplates[id].name}
                                </button>
                            ))
                        }
                    </div>

                    {/* 特殊规则开关 */}
                    {getCurrentSelectedTemplates().has('knight-l' as MoveTemplateType) && (
                        <label className="row gap-6 mt-8 text-14 cursor-pointer">
                            <input type="checkbox" checked={getCurrentHorseLegBlocked()} onChange={(e) => setCurrentHorseLegBlocked(e.target.checked)} />
                            <span>别马脚</span>
                        </label>
                    )}
                    {getCurrentSelectedTemplates().has('elephant-field' as MoveTemplateType) && (
                        <label className="row gap-6 mt-6 text-14 cursor-pointer">
                            <input type="checkbox" checked={getCurrentElephantEyeBlocked()} onChange={(e) => setCurrentElephantEyeBlocked(e.target.checked)} />
                            <span>塞象眼</span>
                        </label>
                    )}
                    <label className="row gap-6 mt-8 text-14 cursor-pointer">
                        <input type="checkbox" checked={getCurrentUseCannonCapture()} onChange={(e) => setCurrentUseCannonCapture(e.target.checked)} />
                        <span>将所选模板的吃子方式改为炮（隔子吃），移动方式保持不变</span>
                    </label>
                    <label className="row gap-6 mt-6 text-14 cursor-pointer">
                        <input type="checkbox" checked={getCurrentAllowDualCapture()} onChange={(e) => { const v = e.target.checked; setCurrentAllowDualCapture(v); }} />
                        <span>同时保留原始吃子规则与炮式吃子（两种吃子方式共存）</span>
                    </label>
                    {/* 已移除“炮吃子需要炮架子”开关；请使用模板自带条件控制 */}
                </div>

                {/* 编辑模式 */}
                <div className="card-surface mb-12">
                    <h3 className="text-16 mb-8 mt-0">编辑模式</h3>
                    <div className="row gap-8">
                        <button
                            onClick={() => setEditMode('add')}
                            className={`seg-btn ${editMode === 'add' ? 'seg-btn--active' : ''}`}
                        >
                            ➕ 添加
                        </button>
                        <button
                            onClick={() => setEditMode('remove')}
                            className={`seg-btn ${editMode === 'remove' ? 'seg-btn--active' : ''}`}
                        >
                            ➖ 删除
                        </button>
                    </div>
                </div>

                {/* 过河阶段（替代旧的移动/吃子选择） */}
                <div className="card-surface mb-12">
                    <h3 className="text-16 mb-8 mt-0">编辑视图</h3>
                    <div className="row gap-8">
                        <button onClick={() => { setEditingRiverView('pre'); }} className={`seg-btn ${editingRiverView === 'pre' ? 'seg-btn--active' : ''}`}>过河前</button>
                        <button onClick={() => { setEditingRiverView('post'); }} className={`seg-btn ${editingRiverView === 'post' ? 'seg-btn--active' : ''}`}>过河后</button>
                    </div>
                </div>

                {/* 棋盘 */}
                <div className="row-center mb-12">
                    {renderRuleBoard()}
                </div>

                {/* 操作按钮 */}
                <div className="col gap-8">
                    <button
                        onClick={handleApplyRule}
                        className="btn-lg btn-lg--green"
                    >
                        ✅ 保存此棋子规则
                    </button>

                    <button
                        onClick={() => editingRiverView === 'pre' ? setSelectedCellsPre(new Set()) : setSelectedCellsPost(new Set())}
                        className="btn-lg btn-lg--amber text-14"
                    >
                        ♻️ 清除选择
                    </button>
                    <button
                        onClick={() => {
                            setCurrentStep('select-piece')
                            setSelectedCellsPre(new Set())
                            setSelectedCellsPost(new Set())
                        }}
                        className="btn-lg btn-lg--slate text-14"
                    >
                        ← 返回选择棋子
                    </button>
                </div>
            </div>
        )
    }

    // 模板管理已移至独立页面：/app/templates

    return (
        <div className="minh-100vh bg-editor-gradient pt-16 pb-32">
            <div className="pad-12 card-surface mb-12 mw-960 mx-auto">
                <div className="row-between">
                    <div className="fw-700">模板</div>
                    <div className="row gap-8">
                        <button className="btn-ghost btn-compact" onClick={() => navigate('/app/templates')}>管理模板</button>
                        <button className="btn-ghost btn-compact" onClick={handleSaveTemplate}>保存为模板</button>
                    </div>
                </div>
            </div>
            {currentStep === 'choose-mode' && renderChooseModeStep()}
            {currentStep === 'place-pieces' && renderPlacementStep()}
            {currentStep === 'select-piece' && renderSelectPieceStep()}
            {currentStep === 'edit-rules' && renderEditRulesStep()}
        </div>
    )
}
