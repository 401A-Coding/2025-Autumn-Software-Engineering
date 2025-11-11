import { useEffect, useState } from 'react'
import Segmented from '../../components/Segmented'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

export default function History() {
    const [keepLimit, setKeepLimit] = useState<number>(30)
    const [tab, setTab] = useState<'records' | 'favorites'>('records')
    const [showSettings, setShowSettings] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('record.keepLimit')
        if (saved) {
            const n = parseInt(saved, 10)
            if (!Number.isNaN(n)) setKeepLimit(n)
        }
    }, [])

    function updateLimit(n: number) {
        const v = Math.max(1, Math.min(500, Math.floor(n)))
        setKeepLimit(v)
        localStorage.setItem('record.keepLimit', String(v))
    }
    return (
        <div>
            <section className="paper-card card-pad" style={{ position: 'relative' }}>
                <h3 className="mt-0">对局记录</h3>

                {/* 顶部工具条：左上角设置，右上角滑块 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            aria-label="记录保留设置"
                            title="记录保留设置"
                            onClick={() => setShowSettings((s) => !s)}
                            style={{
                                border: '1px solid var(--control-border)',
                                background: 'var(--control-bg-active)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                color: 'var(--control-text)'
                            }}
                        >
                            ⚙ 设置
                        </button>
                        {showSettings && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 36,
                                    left: 0,
                                    zIndex: 10,
                                    background: 'var(--control-bg)',
                                    border: '1px solid var(--control-border)',
                                    borderRadius: 8,
                                    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                                    padding: 12,
                                    width: 260,
                                }}
                            >
                                <div className="row-start gap-12" style={{ alignItems: 'center' }}>
                                    <label className="muted" style={{ whiteSpace: 'nowrap' }}>保留条数</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={keepLimit}
                                        onChange={(e) => updateLimit(Number(e.target.value))}
                                        style={{ width: 96 }}
                                    />
                                </div>
                                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
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

                {/* 主体列表（根据 tab 渲染） */}
                {tab === 'records' ? (
                    <RecordsList filter="all" />
                ) : (
                    <RecordsList filter="favorite" />
                )}
            </section>
        </div>
    );
}

function RecordsList({ filter }: { filter: 'all' | 'favorite' }) {
    const navigate = useNavigate()
    const list = useMemo(() => recordStore.list(), [])
    const filtered = filter === 'favorite' ? list.filter(r => r.favorite) : list

    if (filtered.length === 0) {
        return <div className="empty-box">暂无{filter === 'favorite' ? '收藏' : '记录'}</div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((r) => (
                <div key={r.id} className="paper-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 600 }}>{new Date(r.startedAt).toLocaleString()}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                            对手：{r.opponent || '—'} · 结果：{r.result || '—'} · 标签：{(r.keyTags || []).join(', ') || '—'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                        <button className="btn-ghost" onClick={() => { recordStore.toggleFavorite(r.id, !r.favorite); location.reload() }}>{r.favorite ? '取消收藏' : '收藏'}</button>
                    </div>
                </div>
            ))}
        </div>
    )
}
