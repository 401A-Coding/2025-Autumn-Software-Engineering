import { useState, useEffect, useCallback } from 'react'
import { communityApi } from '../../services/api'
import { Link } from 'react-router-dom'

export default function CommunitySearch() {
    const [q, setQ] = useState('')
    const [tag, setTag] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [items, setItems] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)

    const doSearch = useCallback(async (opts?: { page?: number }) => {
        try {
            setLoading(true)
            const p = opts?.page ?? page
            const res = await communityApi.search({ q: q || undefined, tag: tag || undefined, page: p, pageSize })
            setItems(res.items ?? [])
            setTotal(res.total ?? 0)
            setPage(res.page ?? p)
        } finally {
            setLoading(false)
        }
    }, [q, tag, page, pageSize])

    useEffect(() => {
        const t = setTimeout(() => doSearch({ page: 1 }), 300)
        return () => clearTimeout(t)
    }, [q, tag])

    return (
        <div className="p-4">
            <div className="mb-4 row-start gap-4">
                <input className="form-input" placeholder="搜索帖子或记录" value={q} onChange={(e) => setQ(e.target.value)} />
                <input className="form-input" placeholder="按标签过滤（可选）" value={tag} onChange={(e) => setTag(e.target.value)} />
                <button className="btn" onClick={() => doSearch({ page: 1 })}>搜索</button>
            </div>

            {loading ? (
                <div className="muted">加载中...</div>
            ) : (
                <div>
                    <div className="mb-3">共 {total} 条结果</div>
                    <ul className="list-none p-0">
                        {items.map((it: any) => (
                            <li key={it.recordId} className="mb-3 border rounded p-3 bg-white">
                                <div className="row-between">
                                    <div className="fw-600">{it.title || '（无标题）'}</div>
                                    <Link to={`/app/community/${it.recordId}`} className="muted">查看</Link>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="row-between mt-4">
                        <div>
                            <button className="btn-ghost" disabled={page <= 1} onClick={() => doSearch({ page: Math.max(1, page - 1) })}>上一页</button>
                            <button className="btn-ghost ml-4" disabled={page * pageSize >= total} onClick={() => doSearch({ page: page + 1 })}>下一页</button>
                        </div>
                        <div className="muted">第 {page} 页</div>
                    </div>
                </div>
            )}
        </div>
    )
}
