import { useEffect, useState } from 'react'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import { useNavigate } from 'react-router-dom'
import { recordsApi, userApi } from '../../services/api'
import UserAvatar from '../../components/UserAvatar'

export default function History() {
    const navigate = useNavigate()
    const [keepLimit, setKeepLimit] = useState<number>(30)
    const [showSettings, setShowSettings] = useState(false)
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [meProfile, setMeProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)

    async function refresh() {
        setLoading(true)
        try {
            const records = await recordStore.list()
            setList(records)
        } catch (e) {
            const records = await (recordStore.list() as Promise<any[]>)
            setList(records)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    const prefs = await recordsApi.prefs.get()
                    if (mounted && prefs) {
                        setKeepLimit((prefs as any).keepLimit ?? 30)
                    }
                } catch (_) {
                    // 后端不可用时，使用默认值
                    setKeepLimit(30)
                }
                try {
                    const me = await userApi.getMe()
                    if (mounted) setMeProfile({ id: me.id as number, nickname: (me as any).nickname, avatarUrl: (me as any).avatarUrl })
                } catch { }
                await refresh()
            })()
        return () => { mounted = false }
    }, [])

    function updateLimit(n: number) {
        const v = Math.max(1, Math.min(500, Math.floor(n)))
        setKeepLimit(v)
        // try to persist to backend
        recordsApi.prefs.update({ keepLimit: v }).catch(() => { })
    }

    return (
        <div>
            <div className="row align-center mb-12">
                <button className="btn-ghost" onClick={() => navigate('/app/profile')}>
                    ← 返回
                </button>
                <h3 style={{ margin: 0, flex: 1, textAlign: 'center' }}>对局记录</h3>
                <div style={{ width: 64 }} />
            </div>
            <section className="paper-card card-pad pos-rel">
                <div className="row-between mb-12">
                    <div className="pos-rel">
                        <button
                            aria-label="记录保留设置"
                            title="记录保留设置"
                            onClick={() => setShowSettings(s => !s)}
                            className="settings-btn"
                        >
                            ⚙ 设置
                        </button>
                        {showSettings && (
                            <div className="settings-popover">
                                <div className="row-start gap-12 align-center">
                                    <label className="muted nowrap" htmlFor="keepLimitInput">保留条数</label>
                                    <input
                                        id="keepLimitInput"
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={keepLimit}
                                        onChange={(e) => updateLimit(Number(e.target.value))}
                                        placeholder="1-500"
                                        className="w-96"
                                    />
                                </div>
                                <div className="muted mt-6 text-12">
                                    超过此数量的“非收藏”记录将自动清理（默认 30，范围 1-500）
                                </div>

                            </div>
                        )}
                    </div>
                </div>
                <RecordsList filter="all" list={list} loading={loading} onRefresh={refresh} meProfile={meProfile} />
            </section>
        </div>
    );
}

function RecordsList({ filter, list, loading, onRefresh, meProfile }: { filter: 'all' | 'favorite', list: any[], loading: boolean, onRefresh: () => Promise<void>, meProfile: { id: number; nickname?: string; avatarUrl?: string } | null }) {
    const [showTagModal, setShowTagModal] = useState(false)
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
    const [tagInput, setTagInput] = useState('')
    const [batchMode, setBatchMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
    const filtered = filter === 'favorite' ? list.filter(r => r.favorite) : list
    const selectedCount = Object.values(selectedIds).filter(Boolean).length
    const isBatchModeAllowed = filter === 'all' // 批量操作仅在"记录"标签页可用

    if (loading) return <div className="muted">加载中...</div>

    if (!filtered || filtered.length === 0) {
        return <div className="empty-box">暂无{filter === 'favorite' ? '收藏' : '记录'}</div>
    }

    return (
        <div className="col gap-8">
            {/* 上方提示栏：批量模式 */}
            {batchMode && isBatchModeAllowed && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#f0f7ff',
                    borderRadius: '6px',
                    border: '1px solid #d0e8ff'
                }}>
                    <button
                        className="btn-ghost"
                        onClick={() => {
                            const allIds = filtered.map(r => String(r.id))
                            const allSelected = allIds.every(id => selectedIds[id])
                            if (allSelected) {
                                setSelectedIds({})
                            } else {
                                const newSelected: Record<string, boolean> = {}
                                allIds.forEach(id => { newSelected[id] = true })
                                setSelectedIds(newSelected)
                            }
                        }}
                    >
                        {Object.values(selectedIds).filter(Boolean).length === filtered.length && filtered.length > 0 ? '✓ 取消全选' : '全选'}
                    </button>
                    <div className="muted">已选择 {selectedCount} 条</div>
                    <button
                        className="btn-primary"
                        onClick={() => {
                            setBatchMode(false)
                            setSelectedIds({})
                        }}
                    >完成</button>
                </div>
            )}

            <div className="col gap-8" style={{ height: 420, overflowY: 'auto', paddingRight: 4 }}>
                {filtered.map(r => (
                    <HistoryCard
                        key={r.id}
                        r={r}
                        meProfile={meProfile}
                        batchMode={batchMode}
                        isBatchModeAllowed={isBatchModeAllowed}
                        selected={!!selectedIds[String(r.id)]}
                        onToggleSelected={() => setSelectedIds(prev => ({ ...prev, [String(r.id)]: !prev[String(r.id)] }))}
                        onRefresh={onRefresh}
                        onEditTags={(id: string, currentTags: string[]) => { setEditingRecordId(String(id)); setTagInput((currentTags || []).join('/')); setShowTagModal(true); }}
                    />
                ))}
            </div>

            {/* 下方操作栏：仅在批量模式时显示 */}
            {batchMode && isBatchModeAllowed && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '12px 16px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0'
                }}>
                    <button
                        className="btn-ghost"
                        onClick={async () => {
                            const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
                            if (!ids.length) return
                            for (const id of ids) {
                                try { await recordsApi.favorite(Number(id)) } catch { }
                            }
                            setSelectedIds({})
                            await onRefresh()
                        }}
                        disabled={selectedCount === 0}
                    >收藏选中</button>
                    <button
                        className="btn-ghost"
                        onClick={async () => {
                            const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
                            if (!ids.length) return
                            for (const id of ids) {
                                try { await recordStore.remove(id) } catch { }
                            }
                            setSelectedIds({})
                            await onRefresh()
                        }}
                        disabled={selectedCount === 0}
                    >删除选中</button>
                </div>
            )}

            {/* 底部操作栏：仅在非批量模式且允许批量操作时显示 */}
            {!batchMode && isBatchModeAllowed && (
                <div className="row-start mt-12">
                    <button
                        className="btn-ghost"
                        onClick={() => { setBatchMode(true); setSelectedIds({}) }}
                    >批量操作</button>
                </div>
            )}

            {showTagModal && (
                <div role="dialog" aria-modal="true" aria-labelledby="tag-title" className="modal-mask" onClick={() => setShowTagModal(false)}>
                    <div className="paper-card modal-card mw-420" onClick={(e) => e.stopPropagation()}>
                        <h4 id="tag-title" className="mt-0 mb-8">设置标签</h4>
                        <div className="muted text-12 mb-8">用斜杠分隔多个标签，例如：残局/演练/启发</div>
                        <input
                            className="w-full"
                            placeholder="例如：残局/演练/启发"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                        />
                        <div className="row-between gap-8 mt-12">
                            <button className="btn-ghost" onClick={() => setShowTagModal(false)}>取消</button>
                            <div className="row-start gap-8">
                                <button
                                    className="btn-ghost"
                                    onClick={() => {
                                        setTagInput('')
                                    }}
                                >清空</button>
                                <button
                                    className="btn-primary"
                                    onClick={async () => {
                                        const tags = tagInput.split('/').map(s => s.trim()).filter(Boolean)
                                        try {
                                            if (editingRecordId) {
                                                await recordsApi.update(Number(editingRecordId), { keyTags: tags } as any)
                                            }
                                        } catch { }
                                        setShowTagModal(false)
                                        setEditingRecordId(null)
                                        await onRefresh()
                                    }}
                                >保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function HistoryCard({ r, meProfile, batchMode, isBatchModeAllowed, selected, onToggleSelected, onRefresh, onEditTags }: {
    r: any,
    meProfile: { id: number; nickname?: string; avatarUrl?: string } | null,
    batchMode: boolean,
    isBatchModeAllowed: boolean,
    selected: boolean,
    onToggleSelected: () => void,
    onRefresh: () => Promise<void>,
    onEditTags: (id: string, currentTags: string[]) => void,
}) {
    const navigate = useNavigate()
    const [oppProfile, setOppProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)
    useEffect(() => {
        let mounted = true
            ; (async () => {
                const oppId = r.opponent && /^\d+$/.test(String(r.opponent)) ? Number(r.opponent) : null
                if (oppId) {
                    try {
                        const info = await userApi.getById(oppId)
                        if (mounted) setOppProfile({ id: info.id, nickname: info.nickname, avatarUrl: info.avatarUrl || undefined })
                    } catch { }
                } else if (meProfile && mounted) {
                    setOppProfile({ ...meProfile })
                }
            })()
        return () => { mounted = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const hasTags = Array.isArray(r.keyTags) && r.keyTags.length > 0
    const visibleTags = hasTags ? (r.keyTags as string[]).filter((t: string) => !t.startsWith('我方:')).slice(0, 3) : []
    const moreCount = hasTags ? Math.max(0, (r.keyTags as string[]).filter((t: string) => !t.startsWith('我方:')).length - visibleTags.length) : 0
    const sourceLabel = (r.keyTags || []).includes('在线匹配') ? '在线匹配' : (r.keyTags || []).includes('好友对战') ? '好友对战' : '本地对局'
    const rounds = (r.moves || []).length

    // 判断我方是红方还是黑方
    const mySide = (r.keyTags || []).find((t: string) => t.startsWith('我方:'))?.split(':')[1] || 'red'
    const isRedSide = mySide === '红'

    // 计算显示顺序：红方在左（先手），黑方在右（后手）
    const leftProfile = isRedSide ? meProfile : oppProfile
    const rightProfile = isRedSide ? oppProfile : meProfile

    // 战果显示：相对于红方
    const resultDisplay = r.result === 'red' ? '先胜' : r.result === 'black' ? '先负' : r.result === 'draw' ? '平局' : '未结束'

    return (
        <div className="paper-card pad-12">
            <div className="row-between align-center">
                <div className="muted">{sourceLabel}</div>
                <div className="fw-600">{new Date(r.startedAt).toLocaleString()}</div>
            </div>
            {/* 红方（先手）在左，黑方（后手）在右 */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {leftProfile && (
                        <UserAvatar userId={leftProfile.id} nickname={leftProfile.nickname} avatarUrl={leftProfile.avatarUrl} size="medium" showTime={false} />
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div className="fw-600">{resultDisplay}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{rounds} 回合</div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    {rightProfile && (
                        <UserAvatar userId={rightProfile.id} nickname={rightProfile.nickname} avatarUrl={rightProfile.avatarUrl} size="medium" showTime={false} />
                    )}
                </div>
            </div>
            {hasTags && (
                <div className="row-start wrap gap-6 align-center mt-8">
                    {visibleTags.map((t: string, idx: number) => (
                        <span key={`${r.id}-tag-${idx}`} className="text-12 fw-600" style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 8px' }}>{t}</span>
                    ))}
                    {moreCount > 0 && (
                        <span className="text-12 muted" style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 8px' }}>+{moreCount}</span>
                    )}
                </div>
            )}
            <div className="row-start gap-8" style={{ marginTop: 12 }}>
                {batchMode && isBatchModeAllowed && (
                    <input
                        type="checkbox"
                        aria-label="选择此记录"
                        checked={selected}
                        onChange={onToggleSelected}
                    />
                )}
                <button
                    className="btn-ghost"
                    title={r.favorite ? '取消收藏' : '收藏'}
                    onClick={async () => {
                        try {
                            if (r.favorite) {
                                await recordsApi.unfavorite(Number(r.id))
                            } else {
                                await recordsApi.favorite(Number(r.id))
                            }
                            await onRefresh()
                        } catch (e) {
                            console.error('Failed to toggle favorite:', e)
                        }
                    }}
                >
                    {r.favorite ? '❤️' : '🤍'}
                </button>
                <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                <button className="btn-ghost" onClick={() => onEditTags(String(r.id), r.keyTags || [])}>标签</button>
            </div>
        </div>
    )
}

export { HistoryCard }
