import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { connectBattle } from '../../services/battlesSocket'
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket'
import { battleApi, userApi, boardApi } from '../../services/api'
import OnlineBoard from '../../features/chess/OnlineBoard'
import type { CustomRuleSet } from '../../features/chess/ruleEngine'
import type { CustomRules } from '../../features/chess/types'
import { ruleSetToCustomRules } from '../../features/chess/ruleAdapter'
import { recordStore } from '../../features/records/recordStore'
import type { ChessRecord, MoveRecord } from '../../features/records/types'
import { cloneBoard } from '../../features/chess/types'
import { boardToApiFormat, apiBoardToLocalFormat } from '../../features/chess/boardAdapter'
import { movePiece } from '../../features/chess/rules'
// board adapter not needed; snapshot.board already local Board format
import './LiveBattle.css'

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
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null)
    const [endMessage, setEndMessage] = useState<string | null>(null)
    const [endKind, setEndKind] = useState<'win' | 'lose' | 'draw' | 'info' | null>(null)
    const [moves, setMoves] = useState<BattleMove[]>([])
    const [startedAt] = useState<string>(new Date().toISOString())
    
    // 自定义规则和棋盘
    const [customRuleSet, setCustomRuleSet] = useState<CustomRuleSet | null>(null)
    const [customRules, setCustomRules] = useState<CustomRules | null>(null)
    const [boardId, setBoardId] = useState<number | null>(null)

    // 用户信息
    const [myUserId, setMyUserId] = useState<number | null>(null)
    const [myProfile, setMyProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)
    const [opponentProfile, setOpponentProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)

    // 内部引用
    const movesRef = useRef<BattleMove[]>([])
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null)
    const battleIdRef = useRef<number | null>(null)
    const latestSnapshotRef = useRef<BattleSnapshot | null>(null)
    // 记录进入对局时的模板布局（优先使用此布局作为保存时的初始布局）
    const initialTemplateRef = useRef<{ initialLayout?: any; customLayout?: any } | null>(null)
    const createLockRef = useRef(false)

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
            const rs = state.rules as CustomRuleSet
            setCustomRuleSet(rs)
            try {
                const cr = ruleSetToCustomRules(rs)
                setCustomRules(cr)
            } catch (e) {
                console.warn('ruleSet 转换为 customRules 失败，继续使用标准规则', e)
            }
        }
        if (state.boardId) {
            setBoardId(state.boardId)
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

            // 首次收到快照时捕获模板布局（若服务器未包含 board，则尝试根据 boardId 拉取）
            if (!initialTemplateRef.current) {
                if (s.board) {
                    try {
                        initialTemplateRef.current = {
                            customLayout: cloneBoard(s.board as any),
                            initialLayout: boardToApiFormat(s.board as any),
                        }
                    } catch (e) {
                        console.error('Failed to capture initial template from snapshot.board', e)
                    }
                } else {
                    const bid = (s as any).boardId ?? boardId
                    if (bid) {
                        ;(async () => {
                            try {
                                const apiBoard = await boardApi.get(Number(bid))
                                const local = apiBoardToLocalFormat(apiBoard as any)
                                initialTemplateRef.current = {
                                    customLayout: cloneBoard(local),
                                    initialLayout: apiBoard,
                                }
                            } catch (e) {
                                console.error('Failed to fetch board template on snapshot', e)
                            }
                        })()
                    }
                }
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
                let msg = '对局已结束。'
                let kind: 'win' | 'lose' | 'draw' | 'info' = 'info'
                if (s.winnerId == null) {
                    kind = 'draw'
                    msg = '对局已结束，双方打成平局。'
                } else if (myUserId && s.winnerId === myUserId) {
                    kind = 'win'
                    msg = '对局已结束，您已获胜。'
                } else if (myUserId && s.winnerId !== myUserId) {
                    kind = 'lose'
                    msg = '对局已落败。'
                }
                setEndMessage(msg)
                setEndKind(kind)
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
            if (!boardId) {
                alert('缺少棋局 ID')
                return
            }

            const battle = await battleApi.create({
                initialBoardId: boardId,
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
            conn.join(roomId, 0)
            conn.snapshot(roomId)
            battleIdRef.current = roomId
            setBattleId(roomId)
        } catch (e: any) {
            alert(`加入房间失败: ${e?.message || e}`)
            console.error('Join room failed', e)
        }
    }

    // 走子
    const handleMove = async (from: any, to: any) => {
        if (!connected || !snapshot || battleIdRef.current == null) {
            alert('未连接到对局服务器或房间未创建')
            return
        }

        try {
            conn.move(battleIdRef.current, from, to)
        } catch (e: any) {
            console.error('Move failed', e)
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

            const mappedMoves: MoveRecord[] = (moves || []).map((m, idx) => {
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
            
            const rawApi = initialTemplateRef.current?.initialLayout ?? (s.board ? boardToApiFormat(s.board as any) : undefined)
            const apiLayout = rawApi ? (rawApi.layout?.pieces ? { pieces: rawApi.layout.pieces } : (rawApi.pieces ? { pieces: rawApi.pieces } : undefined)) : undefined

            const rec: Omit<ChessRecord, 'id'> = {
                startedAt: recordStartedAt,
                endedAt: new Date().toISOString(),
                opponent: opponentProfile?.nickname || '在线对手',
                result,
                keyTags: ['自定义对战', '在线对战'],
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
                    const mySide = myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator'
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
                                const mySide = myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator'
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
                                                customRules={customRules ?? undefined}
                                            />
                                        </div>

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
                                    {snapshot.status === 'waiting' ? '等待对手加入' : '对局进行中'}
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

    return null
}
