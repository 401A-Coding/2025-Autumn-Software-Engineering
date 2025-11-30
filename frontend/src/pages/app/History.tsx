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
    const filtered = filter === 'favorite' ? list.filter(r => r.favorite) : list

    if (loading) return <div className="muted">加载中...</div>

    if (!filtered || filtered.length === 0) {
        return <div className="empty-box">暂无{filter === 'favorite' ? '收藏' : '记录'}</div>
    }

    async function toggleAndRefresh(r: any) {
        await recordStore.toggleFavorite(r.id, !r.favorite)
        await onRefresh()
    }

    return (
        <div className="col gap-8">
            {filtered.map(r => (
                <div key={r.id} className="paper-card pad-12 row-between align-center">
                    <div>
                        <div className="fw-600">{new Date(r.startedAt).toLocaleString()}</div>
                        <div className="muted text-12">
                            对手：{r.opponent || '—'} · 结果：{r.result || '—'} · 标签：{(r.keyTags || []).join(', ') || '—'}
                        </div>
                    </div>
                    <div className="row-start gap-8">
                        <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                        <button className="btn-ghost" onClick={() => { toggleAndRefresh(r) }}>{r.favorite ? '取消收藏' : '收藏'}</button>
                    </div>
                </div>
            ))}
        </div>
    )
}
