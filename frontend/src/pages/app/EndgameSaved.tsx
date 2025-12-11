import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { boardApi } from '../../services/api'
import './app-pages.css'

export default function EndgameSaved() {
    const [boards, setBoards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const nav = useNavigate()

    useEffect(() => {
        (async () => {
            try {
                const mine = await boardApi.getMine(1, 50) as any
                const items = Array.isArray((mine as any)?.items) ? (mine as any).items : Array.isArray(mine) ? mine : []
                setBoards(items)
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    return (
        <section className="paper-card card-pad">
            <h2 className="mt-0">保存的残局</h2>
            {loading ? (
                <div className="empty-box">加载中…</div>
            ) : !boards.length ? (
                <div className="empty-box">暂无保存的残局</div>
            ) : (
                <div className="col gap-8 mt-12">
                    {boards.map((b) => (
                        <button
                            key={b.id}
                            className="paper-card pad-8 row-between"
                            onClick={() => nav('/app/endgame/setup', { state: { layout: b.layout, name: b.name } })}
                            style={{ textAlign: 'left' }}
                        >
                            <div>
                                <div className="fw-600">{b.name || `残局 #${b.id}`}</div>
                                <div className="muted text-13">{new Date(b.updatedAt || b.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="btn-ghost">打开</div>
                        </button>
                    ))}
                </div>
            )}
        </section>
    )
}
