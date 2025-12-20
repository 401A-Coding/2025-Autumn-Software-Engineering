import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { communityApi } from '../../services/api'

export default function CommunitySearch() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [q, setQ] = useState('')
    const [tag, setTag] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [items, setItems] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)

    const doSearch = useCallback(async (opts?: { page?: number; q?: string; tag?: string; updateURL?: boolean }) => {
        try {
            setLoading(true)
            const localQ = opts?.q ?? q
            const localTag = opts?.tag ?? tag
            const p = opts?.page ?? page
            const res = await communityApi.search({ q: localQ || undefined, tag: localTag || undefined, page: p, pageSize })
            setItems(res.items ?? [])
            setTotal(res.total ?? 0)
            setPage(res.page ?? p)

            // sync URL when requested (e.g., on submit or paging)
            if (opts?.updateURL) {
                const params: Record<string, string> = {}
                if (localQ) params.q = localQ
                if (localTag) params.tag = localTag
                if ((res.page ?? p) > 1) params.page = String(res.page ?? p)
                setSearchParams(params)
            }
        } finally {
            setLoading(false)
        }
    }, [q, tag, page, pageSize, setSearchParams])

    // initial load from URL
    useEffect(() => {
        const initialQ = searchParams.get('q') ?? ''
        const initialTag = searchParams.get('tag') ?? ''
        const initialPage = Number(searchParams.get('page') ?? '1') || 1
        setQ(initialQ)
        setTag(initialTag)
        setPage(initialPage)
        if (initialQ || initialTag) {
            doSearch({ page: initialPage, q: initialQ, tag: initialTag, updateURL: false })
        }
    }, [])

    return (
        <div className="p-4">
            <div className="mb-4 row-start gap-4">
                <input
                    className="form-input flex-1"
                    placeholder="输入关键词后回车或点击搜索"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { doSearch({ page: 1, q, tag, updateURL: true }) } }}
                    autoFocus
                />
                <input className="form-input" placeholder="按标签过滤（可选）" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { doSearch({ page: 1, q, tag, updateURL: true }) } }} />
                <button className="btn" onClick={() => doSearch({ page: 1, q, tag, updateURL: true })}>搜索</button>
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
