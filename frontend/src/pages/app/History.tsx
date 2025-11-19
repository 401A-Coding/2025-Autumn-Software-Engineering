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
                                    <label className="muted nowrap">保留条数</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={keepLimit}
                                        onChange={(e) => updateLimit(Number(e.target.value))}
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
                {tab === 'records' ? <RecordsList filter="all" /> : <RecordsList filter="favorite" />}
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
                        <button className="btn-ghost" onClick={() => { recordStore.toggleFavorite(r.id, !r.favorite); location.reload() }}>{r.favorite ? '取消收藏' : '收藏'}</button>
                    </div>
                </div>
            ))}
        </div>
    )
}
