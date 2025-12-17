import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import { recordsApi, userApi } from '../../services/api'
import { HistoryCard } from './History'

export default function Favorites() {
    const navigate = useNavigate()
    const [list, setList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [meProfile, setMeProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null)

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
        (async () => {
            try {
                const me = await userApi.getMe()
                setMeProfile({ id: me.id as number, nickname: (me as any).nickname, avatarUrl: (me as any).avatarUrl })
            } catch { }
            await refresh()
        })()
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
                    <div className="col gap-8" style={{ height: 420, overflowY: 'auto', paddingRight: 4 }}>
                        {list.map(r => (
                            <HistoryCard
                                key={r.id}
                                r={r}
                                meProfile={meProfile}
                                batchMode={false}
                                isBatchModeAllowed={false}
                                selected={false}
                                onToggleSelected={() => { }}
                                onRefresh={refresh}
                                onEditTags={() => { }}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
