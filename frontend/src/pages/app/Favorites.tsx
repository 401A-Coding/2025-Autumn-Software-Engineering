import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Segmented from '../../components/Segmented'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'

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
            <div className="row-between mb-8">
                <h3 className="mt-0">收藏对局</h3>
                <Segmented
                    options={[{ label: '记录', value: 'history' }, { label: '收藏', value: 'favorites' }]}
                    value={'favorites'}
                    onChange={(v) => navigate(v === 'history' ? '/app/history' : '/app/favorites')}
                />
            </div>

            <section className="paper-card card-pad">
                {loading ? (
                    <div className="muted">加载中...</div>
                ) : list.length === 0 ? (
                    <div className="empty-box">暂无收藏</div>
                ) : (
                    <div className="col gap-8">
                        {list.map(r => (
                            <div key={r.id} className="paper-card pad-12 row-between align-center">
                                <div>
                                    <div className="fw-600">{new Date(r.startedAt).toLocaleString()}</div>
                                    <div className="muted text-12">
                                        对手：{r.opponent || '—'} · 结果：{r.result || '—'} · 标签：{(r.keyTags || []).join(', ') || '—'}
                                    </div>
                                </div>
                                <div className="row-start gap-8">
                                    <button className="btn-ghost" onClick={() => navigate(`/app/record/${r.id}`)}>复盘</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
