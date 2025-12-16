import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import { recordsApi } from '../../services/api'

export default function Favorites() {
    const navigate = useNavigate()
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    async function refresh() {
        setLoading(true)
        try {
            const records = await recordStore.list()
            setList(records.filter(r => r.favorite))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
    }, [])

    return (
        <div>
            <button className="btn-ghost mb-12" onClick={() => navigate('/app/profile')}>
                ← 返回
            </button>
            <section className="paper-card card-pad">
                <h3 className="mt-0">收藏对局</h3>
                {loading ? (
                    <div className="muted">加载中...</div>
                ) : list.length === 0 ? (
                    <div className="empty-box">暂无收藏</div>
                ) : (
                    <div className="col gap-8">
                        {list.map(r => {
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
                                        <button
                                            className="btn-ghost"
                                            title="取消收藏"
                                            onClick={async () => {
                                                try {
                                                    await recordsApi.unfavorite(Number(r.id))
                                                    await refresh()
                                                } catch (e) {
                                                    console.error('Failed to unfavorite:', e)
                                                }
                                            }}
                                        >
                                            ❤️
                                        </button>
                                        <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
