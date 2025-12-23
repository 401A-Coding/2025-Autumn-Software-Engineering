import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createInitialBoard } from '../../features/chess/types'
import { movePiece } from '../../features/chess/rules'
import BoardViewer from '../../features/chess/BoardViewer'
import { recordStore } from '../../features/records/recordStore'
import { recordsApi, userApi } from '../../services/api'
import type { ChessRecord, Bookmark } from '../../features/records/types'
// 书签即评论，统一用 bookmarks 展示
import './app-pages.css'
import MobileFrame from '../../components/MobileFrame'

export default function RecordReplay() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [record, setRecord] = useState<ChessRecord | null>(null)
    const [step, setStep] = useState(0)
    // 书签/笔记输入已移除
    const [isPlaying, setIsPlaying] = useState(false)
    const [intervalMs, setIntervalMs] = useState(2000)
    // 书签底部弹窗状态
    const [showBookmarkSheet, setShowBookmarkSheet] = useState(false)
    const [editingBm, setEditingBm] = useState<Bookmark | null>(null)
    const [bmLabel, setBmLabel] = useState('')
    // 速度设置弹窗
    const [showSpeedSheet, setShowSpeedSheet] = useState(false)
    // Profiles for header
    const [myProfile, setMyProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)
    const [opponentProfile, setOpponentProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)

    // 计算总步数（在 hooks 之前，避免条件 hooks）
    const total = record?.moves.length ?? 0

    useEffect(() => {
        if (!id) return
            ; (async () => {
                const r = await recordStore.get(id)
                if (!r) {
                    setRecord(null)
                } else {
                    setRecord(r)
                    setStep(r.moves.length) // 默认展示最终局面
                }
            })()
    }, [id])

    useEffect(() => {
        // Load profiles once record is ready
        (async () => {
            try {
                const me = await userApi.getMe()
                setMyProfile({ id: me.id as number, nickname: (me as any).nickname, avatarUrl: (me as any).avatarUrl })
            } catch { }
            try {
                const oppId = record && record.opponent && /^\d+$/.test(String(record.opponent)) ? Number(record.opponent) : null
                if (oppId) {
                    const info = await userApi.getById(oppId)
                    setOpponentProfile({ id: info.id, nickname: info.nickname, avatarUrl: info.avatarUrl || undefined })
                } else if (myProfile) {
                    // local self vs self
                    setOpponentProfile({ ...myProfile })
                }
            } catch { }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record])

    function jumpToBookmarkStep(bm: Bookmark) {
        setStep(Math.max(0, Math.min(bm.step, total)))
    }

    // 自动播放（保持 hooks 顺序稳定）
    useEffect(() => {
        if (!isPlaying) return
        if (total <= 0) { setIsPlaying(false); return }
        if (step >= total) { setIsPlaying(false); return }
        const t = window.setInterval(() => {
            setStep((s) => {
                if (s >= total) { window.clearInterval(t); return s }
                return Math.min(total, s + 1)
            })
        }, intervalMs)
        return () => window.clearInterval(t)
    }, [isPlaying, step, total, intervalMs])

    if (!record) {
        return (
            <MobileFrame title="复盘">
                <section className="paper-card card-pad">
                    <h3 className="mt-0">复盘</h3>
                    <div className="empty-box">记录不存在或已被清理</div>
                    <button className="btn-ghost mt-8" onClick={() => navigate('/app/history')}>返回列表</button>
                </section>
            </MobileFrame>
        )
    }

    // 旧的添加方法已替换为 prompt 交互，保留位置注释避免误用

    // 解析我方棋色（从 keyTags 中提取 '我方:红' 或 '我方:黑'）
    const mySide = (record.keyTags || []).find((t: string) => t.startsWith('我方:'))?.split(':')[1] || 'red'
    const isRedSide = mySide === '红'

    // 计算显示顺序：红方在左（先手），黑方在右（后手）
    const leftProfile = isRedSide ? myProfile : opponentProfile
    const rightProfile = isRedSide ? opponentProfile : myProfile

    const renderFramedAvatar = (
        profile: { id: number; nickname?: string; avatarUrl?: string } | null,
        color: string,
    ) => {
        if (!profile) return null
        const size = 48
        const initials = (profile.nickname || '?').slice(0, 2).toUpperCase()
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/app/users/${profile.id}`)}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        border: `3px solid ${color}`,
                        overflow: 'hidden',
                        backgroundColor: profile.avatarUrl ? 'transparent' : '#e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {profile.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt={profile.nickname || '玩家头像'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>{initials}</span>
                    )}
                </div>
                <div
                    style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#333',
                        textAlign: 'center',
                        maxWidth: 120,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {profile.nickname || '匿名用户'}
                </div>
            </div>
        )
    }

    // 胜负标题与颜色（result 是相对红方的：red=红胜，black=黑胜，draw=平）
    const result = record.result
    let titleText = '平局'
    let titleClass = 'replay-title--draw'
    if (result === 'red') { titleText = '先胜'; titleClass = 'replay-title--red' }
    else if (result === 'black') { titleText = '先负'; titleClass = 'replay-title--black' }
    else if (!result || (record as any)?.result === 'unfinished') { titleText = '未结束'; titleClass = 'replay-title--ongoing' }

    return (
        <MobileFrame>
            <div>
                <div className="row-between align-center mb-12" style={{ gap: 12 }}>
                    <button className="btn-ghost" onClick={() => navigate('/app/history')}>← 返回列表</button>
                    <h2 className={`mt-0 mb-0 ${titleClass}`} style={{ margin: 0, flex: 1, textAlign: 'center' }}>{titleText}</h2>
                    <button
                        className="btn-ghost"
                        title={record.favorite ? '取消收藏' : '收藏'}
                        onClick={async () => {
                            try {
                                if (record.favorite) {
                                    await recordsApi.unfavorite(Number(record.id))
                                    setRecord({ ...record, favorite: false })
                                } else {
                                    await recordsApi.favorite(Number(record.id))
                                    setRecord({ ...record, favorite: true })
                                }
                            } catch (e) {
                                console.error('Failed to toggle favorite:', e)
                            }
                        }}
                        style={{ fontSize: '28px', lineHeight: 1 }}
                    >
                        {record.favorite ? '❤️' : '🤍'}
                    </button>
                </div>
                <section className="paper-card card-pad pos-rel">
                    {/* 战果居中显示，两侧头像 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 16 }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {renderFramedAvatar(leftProfile, '#c8102e')}
                        </div>
                        <div className="fw-600" style={{ textAlign: 'center', fontSize: 18 }}>
                            {result === 'red' ? '先胜' : result === 'black' ? '先负' : result === 'draw' ? '平局' : '未结束'}
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                            {renderFramedAvatar(rightProfile, '#333')}
                        </div>
                    </div>

                    <div className="muted text-13">
                        开始：{new Date(record.startedAt).toLocaleString()} · 结束：{record.endedAt ? new Date(record.endedAt).toLocaleString() : '—'}
                    </div>

                    {/* 未结束操作区已移除（统一用“残局导出”流程） */}

                    {/* 棋盘区域：上方黑方（棋盘上半），中间棋盘，下方红方（棋盘下半） */}
                    <div className="mt-12" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        {/* 上方：黑方玩家（棋盘上半部分）- 黑色边框 */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {renderFramedAvatar(rightProfile, '#333')}
                        </div>

                    {/* 中间：棋盘 */}
                    <div>
                        <BoardViewer 
                            moves={record.moves} 
                            step={step} 
                            initialLayout={
                                record.mode === 'custom'
                                    ? (record as any).customLayout // 自定义：保存的是初始布局，叠加 moves 重放
                                    : record.initialLayout as any // 标准：pieces 格式
                            } 
                        />
                    </div>

                        {/* 下方：红方玩家（棋盘下半部分）- 红色边框 */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {renderFramedAvatar(leftProfile, '#c8102e')}
                        </div>
                    </div>

                    {/* 步数控制 */}
                    <div className="mt-12 inline-controls">
                        <button className="btn-ghost" disabled={step <= 0} onClick={() => setStep(s => Math.max(0, s - 1))}>◀</button>
                        <button className="btn-ghost" disabled={step >= total} onClick={() => setStep(s => Math.min(total, s + 1))}>▶</button>
                        <div className="minw-80 text-center">{step}/{total}</div>
                        <button className="btn-ghost" onClick={() => setStep(0)}>开局</button>
                        <button className="btn-ghost" onClick={() => setStep(total)}>终局</button>
                        <button className="btn-ghost" onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸ 暂停' : '▶ 自动'}</button>
                        <div className="ml-auto">
                            <button className="btn-ghost" onClick={() => setShowSpeedSheet(true)}>修改播放速度</button>
                        </div>
                    </div>

                {/* 残局导出：将当前步的局面导出到布置残局 */}
                <div className="mt-12">
                    <button className="btn-primary" onClick={() => {
                        if (!record) return
                        // 复用 BoardViewer 的逻辑在此计算局面
                        const { board } = (() => {
                            const b = (() => {
                                // 自定义对战使用 customLayout
                                if (record.mode === 'custom' && (record as any).customLayout) {
                                    return (record as any).customLayout
                                }
                                // 标准对战使用 initialLayout 字段（pieces 格式）
                                const il: any = (record as any).initialLayout
                                if (il && Array.isArray(il.pieces)) {
                                    const base: any[][] = Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null))
                                    let id = 0
                                    for (const p of il.pieces) {
                                        const x = Math.max(0, Math.min(8, p.x))
                                        const y = Math.max(0, Math.min(9, p.y))
                                        base[y][x] = { id: `init-${id++}`, type: p.type, side: p.side }
                                    }
                                    return createInitialBoard()
                                })()
                                for (let i = 0; i < Math.min(step, record.moves.length); i++) {
                                    const m = record.moves[i]
                                    const nb = movePiece(b, m.from, m.to)
                                    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) b[y][x] = nb[y][x]
                                }
                                return { board: b }
                            })()
                            // 序列化为布局 JSON：{ pieces: [{ type, side, x, y }] }
                            const pieces: any[] = []
                            for (let y = 0; y < 10; y++) {
                                for (let x = 0; x < 9; x++) {
                                    const p: any = (board as any)[y][x]
                                    if (p) pieces.push({ type: p.type, side: p.side, x, y })
                                }
                            }
                            const layout = { pieces }
                            // 当前手按上一步的走子方取反：如果 step>0，则 nextTurn = opposite(record.moves[step-1].turn)
                            // 若 step=0（开局局面），默认红先手；如未来记录含首手字段，可改为读取该字段
                            const lastTurn = step > 0 ? (record.moves[step - 1]?.turn) : undefined
                            // 当没有步数（step=0）时，使用记录的 initialLayout.turn；若不存在则回退红先手
                            const initialTurn = (() => {
                                const il: any = (record as any).initialLayout
                                const t = il?.turn
                                return t === 'red' || t === 'black' ? t : 'red'
                            })()
                            const turn = lastTurn ? (lastTurn === 'red' ? 'black' : 'red') : initialTurn
                            navigate('/app/endgame/setup', { state: { layout, name: `${record.opponent || '残局'}@步${step}`, turn } })
                        }}>残局导出</button>
                    </div>

                    {/* 书签操作：改为按钮 prompt 编辑 */}
                    <div className="mt-16 row-start gap-12">
                        <button
                            className="btn-ghost"
                            onClick={() => {
                                setEditingBm(null)
                                setBmLabel('')
                                setShowBookmarkSheet(true)
                            }}
                        >添加书签</button>
                    </div>

                    {/* 已有书签 */}
                    <div className="mt-16">
                        <strong>书签 / 评论：</strong>
                        {!(record.bookmarks && record.bookmarks.length) ? (
                            <span className="muted"> 无</span>
                        ) : (
                            <div className="row-start wrap gap-6 mt-6">
                                {record.bookmarks!.map(b => (
                                    <div key={b.id} className="paper-card pad-4-8 inline-flex align-center gap-6">
                                        <button
                                            className="btn-ghost btn-xs"
                                            onClick={() => jumpToBookmarkStep(b)}
                                            title={b.note ? b.note : undefined}
                                        >步 {b.step}{b.label ? ' · ' + b.label : ''}</button>
                                        {b.note && (
                                            <span className="text-12 muted">{b.note}</span>
                                        )}
                                        <button
                                            className="btn-ghost btn-xs"
                                            title="编辑"
                                            onClick={() => {
                                                setEditingBm(b)
                                                setBmLabel(b.label || '')
                                                setShowBookmarkSheet(true)
                                            }}
                                        >✎</button>
                                        <button
                                            className="btn-ghost btn-xs"
                                            aria-label="删除书签"
                                            title="删除"
                                            onClick={async () => {
                                                await recordStore.removeBookmark(record.id, b.id)
                                                const updated = await recordStore.get(record.id)
                                                if (updated) setRecord(updated)
                                            }}
                                        >✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 评论与书签合并展示，见上方书签列表 */}

                </section>
                {showBookmarkSheet && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="书签编辑"
                        className="modal-mask"
                        onClick={() => setShowBookmarkSheet(false)}
                    >
                        <div
                            className="paper-card sheet-bottom mw-520"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="fw-600 mb-8">{editingBm ? '编辑书签' : '添加书签'}</div>
                            <div className="row-start gap-8 align-center">
                                <input
                                    placeholder="书签标签 (可留空)"
                                    value={bmLabel}
                                    onChange={(e) => setBmLabel(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                            <div className="row-between mt-12 gap-8">
                                <button className="btn-ghost" onClick={() => setShowBookmarkSheet(false)}>取消</button>
                                <div className="row-start gap-8">
                                    {editingBm && (
                                        <button
                                            className="btn-ghost"
                                            onClick={async () => {
                                                await recordStore.removeBookmark(record.id, editingBm.id)
                                                const updated = await recordStore.get(record.id)
                                                if (updated) setRecord(updated)
                                                setShowBookmarkSheet(false)
                                            }}
                                        >删除</button>
                                    )}
                                    <button
                                        className="btn-primary"
                                        onClick={async () => {
                                            const trimmed = bmLabel.trim()
                                            if (editingBm) {
                                                await recordStore.updateBookmark(record.id, editingBm.id, trimmed ? trimmed : undefined, bmLabel ? bmLabel : undefined)
                                            } else {
                                                await recordStore.addBookmark(record.id, step, trimmed ? trimmed : undefined, bmLabel ? bmLabel : undefined)
                                            }
                                            const updated = await recordStore.get(record.id)
                                            if (updated) setRecord(updated)
                                            setShowBookmarkSheet(false)
                                        }}
                                    >保存</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showSpeedSheet && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="播放速度"
                        className="modal-mask"
                        onClick={() => setShowSpeedSheet(false)}
                    >
                        <div
                            className="paper-card sheet-bottom mw-520"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="fw-600 mb-8">修改播放速度</div>
                            <div className="muted text-12 mb-6">以“秒/步”为单位，最小 1 秒</div>
                            <div className="row-start align-center gap-8">
                                <span className="minw-80">速度：</span>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    defaultValue={Math.max(1, Math.round(intervalMs / 1000))}
                                    className="w-100"
                                    placeholder="秒/步"
                                    title="播放速度（秒/步）"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const target = e.target as HTMLInputElement
                                            const sec = Math.max(1, parseInt(target.value || '1', 10) || 1)
                                            setIntervalMs(sec * 1000)
                                            setShowSpeedSheet(false)
                                        }
                                    }}
                                    id="speed-input"
                                />
                            </div>
                            <div className="row-between mt-12 gap-8">
                                <button className="btn-ghost" onClick={() => setShowSpeedSheet(false)}>取消</button>
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        const el = document.getElementById('speed-input') as HTMLInputElement | null
                                        const sec = Math.max(1, parseInt(el?.value || '1', 10) || 1)
                                        setIntervalMs(sec * 1000)
                                        setShowSpeedSheet(false)
                                    }}
                                >保存</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MobileFrame>
    )
}
