import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { connectBattle } from '../../services/battlesSocket'
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket'
import { battleApi, userApi, boardApi } from '../../services/api'
import OnlineBoard from '../../features/chess/OnlineBoard'
import type { CustomRuleSet } from '../../features/chess/ruleEngine'
import type { CustomRules, PieceType } from '../../features/chess/types'
import type { Board, Side } from '../../features/chess/types'
import { ruleSetToCustomRules, ruleSetToServerRules, serverRulesToRuleSet } from '../../features/chess/ruleAdapter'
import { recordStore } from '../../features/records/recordStore'
import type { ChessRecord, MoveRecord } from '../../features/records/types'
import { cloneBoard } from '../../features/chess/types'
import { boardToApiFormat, apiBoardToLocalFormat } from '../../features/chess/boardAdapter'
// board adapter not needed; snapshot.board already local Board format
import './LiveBattle.css'
import { standardChessRules } from '../../features/chess/rulePresets'
import { getModifiedPieceKeys, pieceDisplayNames } from '../../features/chess/ruleDiff'
import RuleViewerModal from '../../components/RuleViewerModal'
// 移除了基于“将军”提示的逻辑，不再需要规则引擎的走法计算

/**
 * 自定义在线对战页面
 * 完全独立于标准在线对战，只用于自定义棋局规则的好友房对战
 */
export default function CustomOnlineLiveBattle() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const action = searchParams.get('action') // create | join
    const joinRoomParam = searchParams.get('room')
    const loc = useLocation() as any

    // 基础状态
    const [battleId, setBattleId] = useState<number | ''>('')
    const [joinIdInput, setJoinIdInput] = useState<string>(joinRoomParam || '')
    const [connected, setConnected] = useState(false)

    const [endMessage, setEndMessage] = useState<string | null>(null)
    const [endKind, setEndKind] = useState<'win' | 'lose' | 'draw' | 'info' | null>(null)
    const [moves, setMoves] = useState<BattleMove[]>([])
    const [startedAt] = useState<string>(new Date().toISOString())

    // 自定义规则和棋盘
    const [customRuleSet, setCustomRuleSet] = useState<CustomRuleSet | null>(null)
    const [customRules, setCustomRules] = useState<CustomRules | null>(null)
    const [boardId, setBoardId] = useState<number | null>(null)
    const [myUserId, setMyUserId] = useState<number | null>(null)
    const [myProfile, setMyProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)
    const [opponentProfile, setOpponentProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null)
    const [viewerPieceKey, setViewerPieceKey] = useState<PieceType | null>(null)
    // 向棋盘传递的有效规则：优先使用 CustomRuleSet（与编辑器完全一致），否则回退到简化版 CustomRules
    const effectiveRulesForBoard: (CustomRuleSet | CustomRules) | null = useMemo(() => {
        if (customRuleSet) return customRuleSet
        if (customRules) return customRules
        // 不再回退到标准规则，必须加载模板规则后再渲染棋盘
        return null
    }, [customRuleSet, customRules])

    // 检查某方是否仍有“将”存在；用于判定被吃掉（失败）
    function hasGeneral(board: Board | null | undefined, side: Side): boolean {
        if (!board) return false
        for (let y = 0; y < board.length; y++) {
            for (let x = 0; x < board[y].length; x++) {
                const p = board[y][x]
                if (p && p.type === 'general' && p.side === side) return true
            }
        }
        return false
    }

    // 用户信息
    // 内部引用
    const movesRef = useRef<BattleMove[]>([])
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null)
    const battleIdRef = useRef<number | null>(null)
    const latestSnapshotRef = useRef<BattleSnapshot | null>(null)
    // 记录进入对局时的模板布局（优先使用此布局作为保存时的初始布局）
    const initialTemplateRef = useRef<{ initialLayout?: any; customLayout?: any } | null>(null)
    const createLockRef = useRef(false)

    // 将本地 CustomRuleSet 转换为后端 DTO（RulesDto），尽量保真
    function toServerRulesFromRuleSet(ruleSet?: CustomRuleSet | null) {
        if (!ruleSet || !(ruleSet as any).pieceRules) return undefined
        try { return ruleSetToServerRules(ruleSet) } catch { return undefined }
    }

    // 初始化：获取当前用户、规则和棋盘
    useEffect(() => {
        const init = async () => {
            try {
                const profile = await userApi.getMe()
                const uid = typeof profile.id === 'number' ? profile.id : null
                setMyUserId(uid)
                if (uid != null) {
                    setMyProfile({ id: uid, nickname: profile.nickname, avatarUrl: profile.avatarUrl ?? undefined })
                }
            } catch (e) {
                console.error('Failed to get user profile', e)
            }
        }
        init()

        // 从路由状态获取规则和棋盘
        const state = loc.state || {}
        if (state.rules && state.rules.pieceRules) {
            try {
                // 兼容两种来源：
                // - 已是 CustomRuleSet（来自编辑器/本地）
                // - 服务器 Rules DTO（来自模板列表 lobby），需要先转换
                const firstPiece: any = Object.values(state.rules.pieceRules)[0]
                const looksLikeServerDto = firstPiece && (firstPiece.movement !== undefined || firstPiece.captureMode !== undefined)
                const rs: CustomRuleSet = looksLikeServerDto
                    ? serverRulesToRuleSet(state.rules)
                    : (state.rules as CustomRuleSet)

                console.debug('[CUSTLIVE] Initial route rules loaded, ruleSet=', rs)
                setCustomRuleSet(rs)
                try {
                    const cr = ruleSetToCustomRules(rs)
                    console.debug('[CUSTLIVE] Converted initial ruleSet -> customRules', cr)
                    setCustomRules(cr)
                } catch (e) {
                    console.warn('ruleSet 转换为 customRules 失败，继续使用标准规则', e)
                }
            } catch (e) {
                console.warn('解析路由传入的规则失败，将尝试通过 boardId 载入', e)
            }
        }
        if (state.boardId) {
            setBoardId(state.boardId)
            if (!state.rules) {
                ;(async () => {
                    try {
                        const apiBoard = await boardApi.get(Number(state.boardId))
                        if ((apiBoard as any)?.rules && !customRuleSet) {
                            const rs = serverRulesToRuleSet((apiBoard as any).rules)
                                console.debug('[CUSTLIVE] Loaded apiBoard.rules -> ruleSet=', rs)
                                setCustomRuleSet(rs)
                                try { const cr = ruleSetToCustomRules(rs); console.debug('[CUSTLIVE] Converted apiBoard.ruleSet -> customRules', cr); setCustomRules(cr) } catch {}
                        }
                    } catch (e) {
                        console.warn('加载模板规则失败', e)
                    }
                })()
            }
        }

        // 如果路由 state 提供了 layout（用户来自编辑器并对布局做了修改），将其缓存为 initial template
        if (state.layout) {
            try {
                const l = state.layout
                if (Array.isArray(l)) {
                    // 前端二维数组格式
                    initialTemplateRef.current = {
                        customLayout: l,
                        initialLayout: boardToApiFormat(l as any, '路由传入模板')
                    }
                } else if (l && Array.isArray((l as any).pieces)) {
                    // API pieces 格式
                    const apiBoard = { layout: { pieces: (l as any).pieces } }
                    initialTemplateRef.current = {
                        customLayout: apiBoardToLocalFormat(apiBoard as any),
                        initialLayout: apiBoard
                    }
                } else {
                    // 其他格式，直接保存为 customLayout（保守处理）
                    initialTemplateRef.current = { customLayout: l, initialLayout: undefined }
                }
            } catch (e) {
                // ignore
            }
        }
    }, [loc])

    // 头像弹窗已移除

    // 建立 WebSocket 连接
    const conn = useMemo(() => {
        const c = connectBattle()
        connRef.current = c
        c.socket.on('connect', () => {
            setConnected(true)
            const id = battleIdRef.current
            if (id && id > 0) {
                const lastSeq = movesRef.current.length ? movesRef.current[movesRef.current.length - 1].seq : 0
                c.join(id, lastSeq)
                c.snapshot(id)
            }
        })

        c.socket.on('disconnect', () => setConnected(false))

        c.onSnapshot((s) => {
            latestSnapshotRef.current = s
            setSnapshot(s)

            // 若服务器提供了 boardId，优先异步拉取该 board 的原始模板并缓存为 initialTemplateRef
            // 注意：仅缓存，不覆盖当前快照（避免回放时显示为空或覆盖运行时 board）
            try {
                const bid = (s as any).boardId ?? boardId
                if (bid) {
                    ;(async () => {
                        try {
                            const apiBoard = await boardApi.get(Number(bid))
                            // 仅在未缓存初始模板时写入布局缓存，避免覆盖已有自定义布局
                            if (!initialTemplateRef.current || !initialTemplateRef.current.initialLayout) {
                                const local = apiBoardToLocalFormat(apiBoard as any)
                                initialTemplateRef.current = {
                                    customLayout: cloneBoard(local),
                                    initialLayout: apiBoard,
                                }
                            }
                            // 无论是否已有初始模板缓存，只要尚未设置规则则尝试同步规则
                            if ((apiBoard as any)?.rules && !customRuleSet) {
                                const rs = serverRulesToRuleSet((apiBoard as any).rules)
                                setCustomRuleSet(rs)
                                try { setCustomRules(ruleSetToCustomRules(rs)) } catch { /* ignore */ }
                            }
                        } catch (e) {
                            // 如果拉取失败且 snapshot 自带 board，则使用 snapshot.board 的拷贝作为缓存
                            try {
                                if (s.board && !initialTemplateRef.current) {
                                    initialTemplateRef.current = {
                                        customLayout: cloneBoard(s.board as any),
                                        initialLayout: s.board ? boardToApiFormat(s.board as any) : undefined,
                                    }
                                }
                            } catch { /* ignore */ }
                            // 兜底：若仍未同步规则，尝试通过 HTTP 获取 initialBoardId 并拉取模板规则
                            try {
                                if (!customRuleSet && battleIdRef.current) {
                                    const info = await battleApi.snapshot(battleIdRef.current)
                                    const httpBid = (info as any)?.initialBoardId ?? (info as any)?.boardId
                                    if (httpBid) {
                                        const apiBoard2 = await boardApi.get(Number(httpBid))
                                        if ((apiBoard2 as any)?.rules) {
                                                const rs2 = serverRulesToRuleSet((apiBoard2 as any).rules)
                                                console.debug('[CUSTLIVE] Fetched board by id -> ruleSet=', rs2)
                                                setCustomRuleSet(rs2)
                                                try { const cr2 = ruleSetToCustomRules(rs2); console.debug('[CUSTLIVE] Converted fetched ruleSet -> customRules', cr2); setCustomRules(cr2) } catch { /* ignore */ }
                                        }
                                    }
                                }
                            } catch { /* ignore */ }
                        }
                    })()
                }
            } catch (e) {
                // ignore
            }

            // 保持原有行为：直接使用从服务器/WS 接收到的快照

            if (myUserId && Array.isArray(s.players)) {
                const oppId = s.players.find((uid) => uid !== myUserId)
                if (typeof oppId === 'number') {
                    ; (async () => {
                        try {
                            const info = await userApi.getById(oppId)
                            setOpponentProfile({ id: info.id, nickname: info.nickname, avatarUrl: info.avatarUrl || undefined })
                        } catch { /* ignore */ }
                    })()
                }
            }

            const snapMoves = s.moves || []
            const prevLast = movesRef.current.length ? movesRef.current[movesRef.current.length - 1].seq : 0
            const snapLast = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0
            if (snapLast > prevLast) {
                movesRef.current = snapMoves
                setMoves(snapMoves)
            }

            if (s.status === 'finished') {
                // 显示谁输谁赢
                const redUser = s.players?.[0]
                const blackUser = s.players?.[1]
                let msg = '对局已结束'
                let kind: 'win' | 'lose' | 'draw' | 'info' = 'info'
                if (s.winnerId == null) {
                    kind = 'draw'
                    msg = '平局'
                } else if (s.winnerId === redUser) {
                    msg = '红方胜'
                    kind = myUserId && myUserId === redUser ? 'win' : (myUserId && myUserId === blackUser ? 'lose' : 'info')
                } else if (s.winnerId === blackUser) {
                    msg = '黑方胜'
                    kind = myUserId && myUserId === blackUser ? 'win' : (myUserId && myUserId === redUser ? 'lose' : 'info')
                }
                setEndMessage(msg)
                setEndKind(kind)
            } else {
                // 认输触发改为：一方“将”被吃掉即判负，显示谁输谁赢
                try {
                    const redUser = s.players?.[0]
                    const blackUser = s.players?.[1]
                    const redHas = hasGeneral(s.board, 'red')
                    const blackHas = hasGeneral(s.board, 'black')
                    if (!redHas || !blackHas) {
                        const loserSide: Side = !redHas ? 'red' : 'black'
                        const winnerSide: Side = loserSide === 'red' ? 'black' : 'red'
                        const loserId = loserSide === 'red' ? redUser : blackUser
                        const winnerId = winnerSide === 'red' ? redUser : blackUser

                        // 仅由失败方客户端触发认输
                        if (myUserId && battleIdRef.current && loserId && myUserId === loserId) {
                            ;(async () => { try { await battleApi.resign(battleIdRef.current!) } catch {} })()
                        }

                        const msg = winnerSide === 'red' ? '红方胜' : '黑方胜'
                        const kind: 'win' | 'lose' | 'info' = myUserId
                            ? (myUserId === winnerId ? 'win' : (myUserId === loserId ? 'lose' : 'info'))
                            : 'info'
                        setEndMessage(msg)
                        setEndKind(kind)
                    }
                } catch { /* ignore */ }
            }
        })

        c.onMove((m) => {
            console.log('[CustomWS] move', m)
            movesRef.current = [...movesRef.current, m]
            setMoves([...movesRef.current])
        })

        return c
    }, [myUserId])

    // 创建房间
    const handleCreateRoom = async () => {
        if (createLockRef.current) return
        createLockRef.current = true

        try {
            let useBoardId = boardId
            // 若用户有本地模板，优先将其持久化到服务器：
            // - 若已有 boardId，则尝试更新该 board
            // - 否则创建新 board 并使用返回 id
            const tmp = initialTemplateRef.current?.customLayout
            if (tmp) {
                // tmp 可能是二维数组（前端格式）或 API 格式（含 pieces）
                let payload: any
                if (Array.isArray(tmp)) {
                    payload = boardToApiFormat(tmp as any, '临时房间模板')
                } else if ((tmp as any).pieces) {
                    payload = { ...tmp }
                } else {
                    // 保守：把它视作前端二维数组的包装
                    try {
                        payload = boardToApiFormat(tmp as any, '临时房间模板')
                    } catch {
                        payload = { layout: { pieces: [] } }
                    }
                }

                // 附加规则（若存在），确保模板保存包含棋子规则
                const rulesDto = toServerRulesFromRuleSet(customRuleSet)
                if (rulesDto) (payload as any).rules = rulesDto

                try {
                    if (useBoardId) {
                        try {
                            const updated = await boardApi.update(useBoardId as number, payload as any)
                            useBoardId = (updated as any)?.id ?? (updated as any)?.boardId ?? useBoardId
                        } catch (e) {
                            console.warn('Failed to update existing board, trying to create new one', e)
                            const created = await boardApi.create(payload as any)
                            useBoardId = (created as any)?.id ?? (created as any)?.boardId ?? useBoardId
                            if (useBoardId) setBoardId(Number(useBoardId))
                        }
                    } else {
                        const created = await boardApi.create(payload as any)
                        useBoardId = (created as any)?.id ?? (created as any)?.boardId ?? null
                        if (useBoardId) setBoardId(Number(useBoardId))
                    }
                } catch (e) {
                    console.error('Failed to persist template before room creation', e)
                }
            }

            if (!useBoardId) {
                alert('缺少棋局 ID')
                return
            }

            const battle = await battleApi.create({
                initialBoardId: useBoardId,
                mode: 'custom'
            })
            // 后端返回字段为 data.battleId（见 OpenAPI 类型 ApiResponseBattleCreateResult）
            const newId = (battle as any)?.battleId ?? (battle as any)?.id
            if (!newId || isNaN(Number(newId))) {
                throw new Error('房间号无效：后端未返回 battleId')
            }
            const nid = Number(newId)
            battleIdRef.current = nid
            setBattleId(nid)
            // 先通过 REST 加入房间，确保服务器登记玩家身份（避免 WS 侧拒绝 move）
            try {
                await battleApi.join(nid)
            } catch (e) {
                console.warn('REST join failed (will still try WS join)', e)
            }
            // 房主设置临时规则（只存规则，不存布局），供加入方拉取
            try {
                const rulesDto = toServerRulesFromRuleSet(customRuleSet)
                if (rulesDto) {
                    await battleApi.setRules(nid, rulesDto)
                }
            } catch (e) {
                console.warn('Failed to set temporary custom rules for battle', e)
            }
            conn.join(nid, 0)
            conn.snapshot(nid)
        } catch (e: any) {
            alert(`创建房间失败: ${e?.message || e}`)
            console.error('Create room failed', e)
        } finally {
            createLockRef.current = false
        }
    }

    // 加入房间
    const handleJoinRoom = async () => {
        const roomId = Number(joinIdInput)
        if (isNaN(roomId) || roomId <= 0) {
            alert('请输入有效的房间号')
            return
        }

        try {
            // 先通过 REST 加入房间，避免 WS move 被服务器拒绝
            try {
                await battleApi.join(roomId)
            } catch (e) {
                console.warn('REST join failed (will still try WS join)', e)
            }
            conn.join(roomId, 0)
            conn.snapshot(roomId)
            battleIdRef.current = roomId
            setBattleId(roomId)
            // 加入后主动查询一次对局信息，获取初始模板与规则，确保加入方规则同步
            try {
                const info = await battleApi.snapshot(roomId)
                const bid = (info as any)?.initialBoardId ?? (info as any)?.boardId
                if (bid) {
                    try {
                        const apiBoard = await boardApi.get(Number(bid))
                        // 仅在未缓存初始模板时写入布局缓存
                        if (!initialTemplateRef.current || !initialTemplateRef.current.initialLayout) {
                            const local = apiBoardToLocalFormat(apiBoard as any)
                            initialTemplateRef.current = {
                                customLayout: cloneBoard(local),
                                initialLayout: apiBoard,
                            }
                        }
                        // 无论缓存与否，若尚未设置规则则同步规则
                        if ((apiBoard as any)?.rules && !customRuleSet) {
                                const rs = serverRulesToRuleSet((apiBoard as any).rules)
                                console.debug('[CUSTLIVE] Joined: loaded initial board rules -> ruleSet=', rs)
                                setCustomRuleSet(rs)
                                try { const cr = ruleSetToCustomRules(rs); console.debug('[CUSTLIVE] Joined: converted ruleSet -> customRules', cr); setCustomRules(cr) } catch { /* ignore */ }
                        }
                    } catch (e) {
                        console.warn('加载房间初始模板失败', e)
                        // 回退：若 HTTP 失败，尝试使用当前快照棋盘作为初始布局缓存
                        try {
                            const s = latestSnapshotRef.current
                            if (s?.board && !initialTemplateRef.current) {
                                initialTemplateRef.current = {
                                    customLayout: cloneBoard(s.board as any),
                                    initialLayout: s.board ? boardToApiFormat(s.board as any) : undefined,
                                }
                            }
                        } catch { /* ignore */ }
                    }
                }
                // 额外：拉取房主设置的临时规则（只存规则），优先应用到本局
                try {
                    const tempRules = await battleApi.getRules(roomId)
                    if (tempRules && (tempRules as any).pieceRules) {
                            const rs = serverRulesToRuleSet(tempRules)
                            console.debug('[CUSTLIVE] Pulled tempRules from battleApi -> ruleSet=', rs)
                            setCustomRuleSet(rs)
                            try { const cr = ruleSetToCustomRules(rs); console.debug('[CUSTLIVE] Converted temp ruleSet -> customRules', cr); setCustomRules(cr) } catch { /* ignore */ }
                    }
                } catch (e) {
                    console.warn('拉取临时规则失败', e)
                }
            } catch (e) {
                console.warn('获取房间信息失败，规则可能无法同步', e)
            }
        } catch (e: any) {
            alert(`加入房间失败: ${e?.message || e}`)
            console.error('Join room failed', e)
        }
    }

    // 走子
    const handleMove = async (from: any, to: any) => {
        // 放宽校验：只要已连接且有房间号即可发起走子请求
        if (!connected || battleIdRef.current == null) {
            alert('未连接到对局服务器或房间未创建')
            return
        }

        try {
            console.debug('[CustomOnline] attempt move', { from, to, battleId: battleIdRef.current })
            const ack = await conn.move(battleIdRef.current, from, to)
            console.debug('[CustomOnline] move ack', ack)
        } catch (e: any) {
            console.error('Move failed', e)
            const msg = e?.message || 'move ack timeout/服务器未接受走子'
            alert(`走子失败：${msg}`)
            // 回退：请求一次最新快照，避免前端状态与服务器脱节
            try {
                if (battleIdRef.current) conn.snapshot(battleIdRef.current)
            } catch { /* ignore */ }
        }
    }

    // 认输
    const handleResign = async () => {
        if (!battleIdRef.current) return
        if (!confirm('确定要认输吗？')) return

        try {
            await battleApi.resign(battleIdRef.current)
        } catch (e: any) {
            console.error('Resign failed', e)
        }
    }

    // 返回大厅
    const handleBackToLobby = () => {
        const ongoing = snapshot && snapshot.status !== 'finished'
        if (ongoing && battleIdRef.current) {
            const ok = window.confirm('对局尚未结束，退出将视为认输，是否继续？')
            if (!ok) return
                ; (async () => {
                    try { await battleApi.resign(battleIdRef.current!) } catch { /* 忽略 */ }
                    navigate('/app/custom-online-lobby')
                })()
            return
        }
        navigate('/app/custom-online-lobby')
    }

    // 保存棋局到记录（服务器优先，失败则本地）
    const handleSaveRecord = async () => {
        try {
            console.log('[CustomBattle] handleSaveRecord called, startedAt:', startedAt)

            const s = latestSnapshotRef.current || snapshot
            if (!s) { alert('暂无对局数据可保存'); return }
            
            // players 数组约定：index 0 为红方（先手），index 1 为黑方（后手）
            const redUser = s.players?.[0]
            const blackUser = s.players?.[1]
            const winnerId = s.winnerId

            console.log('[CustomBattle] Saving record', { redUser, blackUser, winnerId, status: s.status })

            const result: 'red' | 'black' | 'draw' | undefined = ((): any => {
                if (s.status === 'finished') {
                    if (winnerId == null) return 'draw'
                    if (winnerId === redUser) return 'red'
                    if (winnerId === blackUser) return 'black'
                }
                return undefined
            })()

            // 默认从本地 moves 构造；若为加入方，则优先使用后端临时回放（复制红方）
            let mappedMoves: MoveRecord[] = (moves || []).map((m, idx) => {
                const turn = m.by === redUser ? 'red' : m.by === blackUser ? 'black' : (idx % 2 === 0 ? 'red' : 'black')
                return {
                    from: { x: m.from?.x ?? 0, y: m.from?.y ?? 0 },
                    to: { x: m.to?.x ?? 0, y: m.to?.y ?? 0 },
                    turn,
                    ts: m.ts || Date.now(),
                }
            })

            console.log('[CustomBattle] Mapped moves:', mappedMoves.length)

            const recordStartedAt = startedAt || new Date().toISOString()
            
            let rawApi = initialTemplateRef.current?.initialLayout ?? (s.board ? boardToApiFormat(s.board as any) : undefined)
            let apiLayout = rawApi ? (rawApi.layout?.pieces ? { pieces: rawApi.layout.pieces } : (rawApi.pieces ? { pieces: rawApi.pieces } : undefined)) : undefined

            // 解析我方阵营（红=创建者，黑=加入者）用于记录视角标记
            const mySide: 'red' | 'black' | 'spectator' = myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator'

            const rec: Omit<ChessRecord, 'id'> = {
                startedAt: recordStartedAt,
                endedAt: new Date().toISOString(),
                opponent: opponentProfile?.nickname || '在线对手',
                result,
                // 加入“我方:红/黑”标签，复盘时自动按我方视角翻转
                keyTags: ['自定义对战', '在线对战'].concat(mySide === 'red' ? ['我方:红'] : mySide === 'black' ? ['我方:黑'] : []),
                favorite: false,
                moves: mappedMoves,
                bookmarks: [],
                notes: [],
                mode: 'custom',
                // 保存初始布局（快照的棋盘），回放时叠加 moves 重放
                // 保存初始棋盘的拷贝，避免后续在线对局继续推进时污染复盘起点
                customLayout: initialTemplateRef.current?.customLayout ?? (s.board ? cloneBoard(s.board as any) : undefined),
                initialLayout: apiLayout,
                customRules: customRuleSet, // 直接保存规则
            }

            // 若为加入方（黑），尝试使用后端的临时回放以确保镜像一致
            if (mySide === 'black' && battleIdRef.current) {
                try {
                    const temp = await battleApi.getReplay(battleIdRef.current)
                    if (temp?.moves && Array.isArray(temp.moves)) {
                        mappedMoves = temp.moves.map((m: any) => ({
                            from: { x: m?.from?.x ?? 0, y: m?.from?.y ?? 0 },
                            to: { x: m?.to?.x ?? 0, y: m?.to?.y ?? 0 },
                            turn: m?.turn === 'black' ? 'black' : 'red',
                            ts: m?.ts || Date.now(),
                        }))
                        rec.moves = mappedMoves
                    }
                    if (temp?.initialLayout?.pieces && Array.isArray(temp.initialLayout.pieces)) {
                        rec.initialLayout = { pieces: temp.initialLayout.pieces }
                    }
                    if (temp?.customLayout) {
                        rec.customLayout = temp.customLayout
                    }
                } catch (e) {
                    console.warn('[CustomBattle] getReplay failed, fallback to local moves', e)
                }
            }

            // 若为房主（红），尝试将本次回放存入后端供加入方复制
            if (mySide === 'red' && battleIdRef.current) {
                try {
                    await battleApi.setReplay(battleIdRef.current, {
                        startedAt: rec.startedAt,
                        moves: rec.moves,
                        initialLayout: rec.initialLayout,
                        customLayout: rec.customLayout,
                    })
                } catch (e) {
                    console.warn('[CustomBattle] setReplay failed (non-blocking)', e)
                }
            }

            // 避免 JSON.stringify 因循环引用导致报错，直接输出对象
            console.log('[CustomBattle] Record object before save:', rec)
            const { savedToServer } = await recordStore.saveNew(rec)
            console.log('[CustomBattle] Save result:', { savedToServer })
            alert(savedToServer ? '棋局已保存到服务器' : '已在本地保存（未登录或服务器不可用）')
        } catch (e: any) {
            console.error('save record failed', e)
            const msg = e?.message || e?.toString() || '未知错误'
            console.error('Error details:', msg)
            console.error('Stack:', e?.stack)
            alert(`保存失败: ${msg}`)
        }
    }

    const handleCopyRoomId = async () => {
        if (!battleIdRef.current) return
        try {
            await navigator.clipboard.writeText(String(battleIdRef.current))
            alert('房间号已复制')
        } catch {
            alert('复制失败，请手动选择并复制房间号')
        }
    }

    // 创建房间阶段
    if (action === 'create' && !battleId) {
        return (
            <div className="pad-16">
                <div className="row-between mb-12 align-center">
                    <button className="btn-ghost" onClick={handleBackToLobby}>← 返回大厅</button>
                    <h2 className="m-0">创建自定义对战房间</h2>
                    <div style={{ width: 80 }} />
                </div>

                <div className="paper-card card-pad text-center col gap-12" style={{ maxWidth: 620, margin: '0 auto' }}>
                    <div className="livebattle-banner">
                        <div className="livebattle-banner-title">准备就绪</div>
                        <div className="livebattle-banner-sub">选择的自定义规则将用于本局对战</div>
                        {customRuleSet && (
                            <div className="text-14" style={{ marginTop: 6 }}>
                                规则：<strong>{customRuleSet.name}</strong>
                            </div>
                        )}
                    </div>
                    <button className="btn-primary btn-lg" onClick={handleCreateRoom}>
                        创建房间
                    </button>
                    <div className="text-12 text-gray">创建后将生成房间号，可分享给好友加入</div>
                </div>
            </div>
        )
    }

    // 加入房间阶段
    if (action === 'join' && !battleId) {
        return (
            <div className="pad-16">
                <div className="row-between mb-12 align-center">
                    <button className="btn-ghost" onClick={handleBackToLobby}>← 返回大厅</button>
                    <h2 className="m-0">加入自定义对战房间</h2>
                    <div style={{ width: 80 }} />
                </div>

                <div className="paper-card card-pad col gap-12" style={{ maxWidth: 620, margin: '0 auto' }}>
                    <div className="livebattle-banner">
                        <div className="livebattle-banner-title">好友房对战</div>
                        <div className="livebattle-banner-sub">输入房间号加入，自动加载房主的自定义规则</div>
                    </div>
                    <div className="row gap-8 livebattle-room-bar" style={{ justifyContent: 'center' }}>
                        <input
                            type="number"
                            placeholder="输入房间号"
                            value={joinIdInput}
                            onChange={(e) => setJoinIdInput(e.target.value)}
                            className="input livebattle-room-input"
                            onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                        />
                        <button className="btn-primary" onClick={handleJoinRoom}>加入房间</button>
                        <button className="btn-ghost" onClick={handleBackToLobby}>返回</button>
                    </div>
                </div>
            </div>
        )
    }

    // 等待对手或对局进行中
    if (battleId) {
        return (
            <div className="pad-16">
                <div className="livebattle-room-bar">
                    <button className="btn-ghost" onClick={handleBackToLobby}>← 返回大厅</button>
                    <div className="livebattle-room-badge">房间号 {battleId}</div>
                    <button className="btn-secondary btn-compact" onClick={handleCopyRoomId}>复制</button>
                    {connected ? (
                        <span className="badge badge-success">已连接</span>
                    ) : (
                        <span className="badge badge-warning">连接中...</span>
                    )}
                </div>

                {customRuleSet && (
                    <div className="livebattle-banner" style={{ marginTop: 8 }}>
                        <div className="livebattle-banner-title">自定义规则</div>
                        <div className="text-13" style={{ marginTop: 4 }}>{customRuleSet.name}</div>
                    </div>
                )}

                {snapshot && (() => {
                    const turn = snapshot.turn ?? (snapshot.turnIndex === 0 ? 'red' : 'black')
                    const redUser = snapshot.players?.[0]
                    const blackUser = snapshot.players?.[1]
                    // 强制阵营：创建方为红方，加入方为黑方；其他情况按服务器推断
                    const mySide = action === 'create' ? 'red' : action === 'join' ? 'black' : (myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator')
                    return (
                        <div style={{ fontSize: 14, marginTop: 10 }}>
                            我方：<b className={mySide === 'red' ? 'turn-red' : mySide === 'black' ? 'turn-black' : 'turn-draw'}>
                                {mySide === 'spectator' ? '观战' : mySide === 'red' ? '红' : '黑'}
                            </b>
                            <span style={{ marginLeft: 12 }}>
                                当前手：<b className={turn === 'red' ? 'turn-red' : 'turn-black'}>{turn === 'red' ? '红' : '黑'}</b>
                            </span>
                        </div>
                    )
                })()}

                {!snapshot ? (
                    <div className="paper-card card-pad text-center" style={{ marginTop: 12 }}>
                        <p>等待对手加入...</p>
                        {!connected && (
                            <div className="livebattle-disconnect-banner" style={{ marginTop: 8 }}>
                                <span className="livebattle-dot-yellow" /> 正在尝试连接…
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="row gap-16 align-start wrap" style={{ marginTop: 12 }}>
                        {/* 棋盘与上下头像，参考标准在线对战布局 */}
                        <div className="board-area">
                            {(() => {
                                const turn = snapshot.turn ?? (snapshot.turnIndex === 0 ? 'red' : 'black')
                                const redUser = snapshot.players?.[0]
                                const blackUser = snapshot.players?.[1]
                                // 强制阵营：创建方为红方，加入方为黑方
                                const mySide = action === 'create' ? 'red' : action === 'join' ? 'black' : (myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator')
                                const opponentSide = mySide === 'red' ? 'black' : mySide === 'black' ? 'red' : null
                                const isMyTurn = mySide !== 'spectator' && turn === mySide
                                const isOpponentTurn = opponentSide !== null && turn === opponentSide
                                const avatarSize = 40

                                return (
                                    <>
                                        {opponentProfile && opponentSide && (
                                            <div className="livebattle-board-wrapper" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div
                                                    style={{
                                                        width: avatarSize,
                                                        height: avatarSize,
                                                        borderRadius: '50%',
                                                        border: `3px solid ${opponentSide === 'red' ? '#c8102e' : '#333'}`,
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                        animation: isOpponentTurn ? 'pulse-border 1s infinite' : 'none',
                                                        backgroundColor: opponentProfile.avatarUrl ? 'transparent' : '#e0e0e0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {opponentProfile.avatarUrl ? (
                                                        <img src={opponentProfile.avatarUrl} alt={opponentProfile.nickname || '对手'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                                                            {(opponentProfile.nickname || '?').slice(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>
                                                    {opponentProfile.nickname || '匿名用户'}
                                                </div>
                                            </div>
                                        )}

                                        <div className="livebattle-board-wrapper" style={{ position: 'relative' }}>
                                            <OnlineBoard
                                                moves={moves}
                                                turnIndex={snapshot.turnIndex}
                                                players={snapshot.players}
                                                myUserId={myUserId}
                                                onAttemptMove={handleMove}
                                                winnerId={snapshot.winnerId}
                                                authoritativeBoard={snapshot.board}
                                                authoritativeTurn={snapshot.turn}
                                                snapshotMoves={snapshot.moves}
                                                // 若规则尚未同步，提供一个空规则占位，避免回退到标准规则
                                                customRules={(effectiveRulesForBoard ?? ({ name: '加载中', pieceRules: {} } as CustomRuleSet))}
                                                forcedMySide={action === 'create' ? 'red' : action === 'join' ? 'black' : undefined}
                                            />
                                        </div>

                                        {customRuleSet && (() => {
                                            const modifiedKeys = getModifiedPieceKeys(customRuleSet, standardChessRules)
                                            if (modifiedKeys.length === 0) return null
                                            return (
                                                <div className="mt-8">
                                                    <div className="text-13 fw-600 mb-6">已修改规则的棋子</div>
                                                    <div className="row gap-8 wrap">
                                                        {modifiedKeys.map(k => (
                                                            <button
                                                                key={k}
                                                                className="chip chip-info"
                                                                onClick={() => setViewerPieceKey(k as PieceType)}
                                                            >
                                                                {pieceDisplayNames[k] || k}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {myProfile && mySide !== 'spectator' && (
                                            <div className="livebattle-board-wrapper" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>
                                                    {myProfile.nickname || '匿名用户'}
                                                </div>
                                                <div
                                                    style={{
                                                        width: avatarSize,
                                                        height: avatarSize,
                                                        borderRadius: '50%',
                                                        border: `3px solid ${mySide === 'red' ? '#c8102e' : '#333'}`,
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                        animation: isMyTurn ? 'pulse-border 1s infinite' : 'none',
                                                        backgroundColor: myProfile.avatarUrl ? 'transparent' : '#e0e0e0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    {myProfile.avatarUrl ? (
                                                        <img src={myProfile.avatarUrl} alt={myProfile.nickname || '我'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                                                            {(myProfile.nickname || '?').slice(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )
                            })()}
                        </div>

                        {/* 侧栏：只保留状态与操作，避免重复头像显示 */}
                        <aside className="col gap-12 flex-1 minw-260">
                            <div className="pad-12 bg-muted rounded-8">
                                <div className="fw-600 mb-8">对局状态</div>
                                <div className="text-13">
                                    {connected ? '实时连接正常' : '连接中…'}
                                </div>
                                <div className="text-12 text-gray" style={{ marginTop: 4 }}>
                                    {snapshot?.status === 'waiting' ? '等待对手加入' : '对局进行中'}
                                </div>
                            </div>

                            {customRuleSet && (
                                <div className="pad-12 bg-muted rounded-8">
                                    <div className="fw-600 mb-8">自定义规则</div>
                                    <div className="text-13 text-gray">{customRuleSet.name}</div>
                                </div>
                            )}

                            <div className="col gap-8">
                                <button className="btn-danger btn-compact" onClick={handleResign}>
                                    认输
                                </button>
                                <button className="btn-ghost btn-compact" onClick={handleBackToLobby}>
                                    返回大厅
                                </button>
                            </div>
                        </aside>
                    </div>
                )}

                {/* 对局结束弹窗 */}
                {endMessage && (
                    <div className="gameover-mask">
                        <div className="paper-card gameover-card">
                            <div className={`gameover-title ${endKind === 'win' ? 'turn-red' : endKind === 'lose' ? 'turn-black' : 'turn-draw'}`}>
                                {endKind === 'win' ? '恭喜！您获胜' : endKind === 'lose' ? '您已落败' : endKind === 'draw' ? '平局' : endMessage}
                            </div>
                            <div className="gameover-actions">
                                <button className="btn-secondary btn-wide" onClick={handleSaveRecord}>
                                    💾 保存棋局
                                </button>
                                <button className="btn-primary btn-wide" onClick={handleBackToLobby}>
                                    返回大厅
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 信息框已移除 */}
            </div>
        )
    }

    {viewerPieceKey && customRuleSet?.pieceRules?.[viewerPieceKey] && (
        <RuleViewerModal
            title={pieceDisplayNames[viewerPieceKey] || customRuleSet.pieceRules[viewerPieceKey]?.name || viewerPieceKey}
            rule={customRuleSet.pieceRules[viewerPieceKey]!}
            onClose={() => setViewerPieceKey(null)}
        />
    )}

    return null
}
