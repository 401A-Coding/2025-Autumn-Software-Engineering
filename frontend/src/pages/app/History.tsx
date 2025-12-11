import { useEffect, useState } from 'react'
import Segmented from '../../components/Segmented'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import { useNavigate } from 'react-router-dom'
import { recordsApi } from '../../services/api'

export default function History() {
    const [keepLimit, setKeepLimit] = useState<number>(30)
    const [tab, setTab] = useState<'records' | 'favorites'>('records')
    const [showSettings, setShowSettings] = useState(false)
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

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
            <section className="paper-card card-pad pos-rel">
                <h3 className="mt-0">对局记录</h3>
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
                    <Segmented
                        options={[
                            { label: '记录', value: 'records' },
                            { label: '收藏', value: 'favorites' },
                        ]}
                        value={tab}
                        onChange={(v: string) => setTab(v as 'records' | 'favorites')}
                    />
                </div>
                {tab === 'records' ? <RecordsList filter="all" list={list} loading={loading} onRefresh={refresh} /> : <RecordsList filter="favorite" list={list} loading={loading} onRefresh={refresh} />}
            </section>
        </div>
    );
}

function RecordsList({ filter, list, loading, onRefresh }: { filter: 'all' | 'favorite', list: any[], loading: boolean, onRefresh: () => Promise<void> }) {
    const navigate = useNavigate()
    const [showTagModal, setShowTagModal] = useState(false)
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
    const [tagInput, setTagInput] = useState('')
    const [selectionMode, setSelectionMode] = useState<'none' | 'favorite' | 'delete'>('none')
    const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
    const filtered = filter === 'favorite' ? list.filter(r => r.favorite) : list

    if (loading) return <div className="muted">加载中...</div>

    if (!filtered || filtered.length === 0) {
        return <div className="empty-box">暂无{filter === 'favorite' ? '收藏' : '记录'}</div>
    }

    // 保留函数以备后续单行收藏逻辑需要；当前批量模式下未使用

    return (
        <div className="col gap-8">
            <div className="col gap-8" style={{ height: 420, overflowY: 'auto', paddingRight: 4 }}>
                {filtered.map(r => {
                    const hasTags = Array.isArray(r.keyTags) && r.keyTags.length > 0
                    const visibleTags = hasTags ? (r.keyTags as string[]).slice(0, 3) : []
                    const moreCount = hasTags ? Math.max(0, (r.keyTags as string[]).length - visibleTags.length) : 0
                    return (
                        <div key={r.id} className="paper-card pad-12 row-between align-center">
                            <div>
                                <div className="row-start wrap gap-6 align-center">
                                    <div className="fw-600">{new Date(r.startedAt).toLocaleString()}</div>
                                    {hasTags && visibleTags.map((t: string, idx: number) => (
                                        <span
                                            key={`${r.id}-tag-${idx}`}
                                            className="text-12 fw-600"
                                            style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 8px' }}
                                        >{t}</span>
                                    ))}
                                    {hasTags && moreCount > 0 && (
                                        <span className="text-12 muted" style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 8px' }}>+{moreCount}</span>
                                    )}
                                </div>
                                <div className="muted text-12 mt-2">
                                    对手：{r.opponent || '—'} · 结果：{r.result || '—'}
                                </div>
                            </div>
                            <div className="row-start gap-8">
                                {selectionMode !== 'none' && (
                                    <input
                                        type="checkbox"
                                        aria-label="选择此记录"
                                        checked={!!selectedIds[String(r.id)]}
                                        onChange={() => setSelectedIds(prev => ({ ...prev, [String(r.id)]: !prev[String(r.id)] }))}
                                    />
                                )}
                                <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                                <button
                                    className="btn-ghost"
                                    onClick={() => {
                                        setEditingRecordId(String(r.id))
                                        setTagInput((r.keyTags || []).join('/'))
                                        setShowTagModal(true)
                                    }}
                                >标签</button>
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* 底部操作栏：批量收藏/删除 */}
            <div className="row-between mt-12">
                {selectionMode === 'none' ? (
                    <div className="row-start gap-8">
                        <button
                            className="btn-ghost"
                            onClick={() => { setSelectionMode('favorite'); setSelectedIds({}) }}
                        >批量收藏</button>
                        <button
                            className="btn-ghost"
                            onClick={() => { setSelectionMode('delete'); setSelectedIds({}) }}
                        >批量删除</button>
                    </div>
                ) : (
                    <div className="row-between w-full">
                        <div className="muted">已选 {Object.values(selectedIds).filter(Boolean).length} 条</div>
                        <div className="row-start gap-8">
                            <button className="btn-ghost" onClick={() => { setSelectionMode('none'); setSelectedIds({}) }}>取消</button>
                            <button
                                className="btn-primary"
                                onClick={async () => {
                                    const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
                                    if (!ids.length) return
                                    if (selectionMode === 'favorite') {
                                        for (const id of ids) {
                                            try { await recordsApi.favorite(Number(id)) } catch { }
                                        }
                                    } else if (selectionMode === 'delete') {
                                        for (const id of ids) {
                                            try { await recordStore.remove(id) } catch { }
                                        }
                                    }
                                    setSelectionMode('none')
                                    setSelectedIds({})
                                    await onRefresh()
                                }}
                            >{selectionMode === 'favorite' ? '收藏选中' : '删除选中'}</button>
                        </div>
                    </div>
                )}
            </div>
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
