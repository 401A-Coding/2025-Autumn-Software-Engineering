import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { communityApi } from '../../services/api'
import PostPreview from '../../features/community/PostPreview'

export default function CommunitySearch() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [q, setQ] = useState('')
    const [tag, setTag] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [items, setItems] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    const doSearch = useCallback(async (opts?: { page?: number; q?: string; tag?: string; updateURL?: boolean }) => {
        try {
            setLoading(true)
            const localQ = opts?.q ?? q
            const localTag = opts?.tag ?? tag
            const p = opts?.page ?? page
            // Use listPosts to get post preview shape consistent with Community page
            const res = await communityApi.listPosts({ q: localQ || undefined, tag: localTag || undefined, page: p, pageSize })
            const data: any = res ?? {}
            setPosts(data.items ?? [])
            setTotal(data.total ?? 0)
            setPage(data.page ?? p)

            // sync URL when requested (e.g., on submit or paging)
            if (opts?.updateURL) {
                const params: Record<string, string> = {}
                if (localQ) params.q = localQ
                if (localTag) params.tag = localTag
                if ((data.page ?? p) > 1) params.page = String(data.page ?? p)
                setSearchParams(params)

                // persist history to localStorage
                try {
                    const key = 'community_search_history'
                    const raw = localStorage.getItem(key)
                    const arr: string[] = raw ? JSON.parse(raw) : []
                    const v = (localQ || '').trim()
                    if (v) {
                        const filtered = [v, ...arr.filter(a => a !== v)].slice(0, 20)
                        localStorage.setItem(key, JSON.stringify(filtered))
                        setHistory(filtered)
                        setHasSearched(true)
                    }
                } catch (e) {
                    // ignore
                }
            }
        } finally {
            setLoading(false)
        }
    }, [q, tag, page, pageSize, setSearchParams])

    // initial load from URL and react to searchParams changes (so back/forward works)
    useEffect(() => {
        const initialQ = searchParams.get('q') ?? ''
        const initialTag = searchParams.get('tag') ?? ''
        const initialPage = Number(searchParams.get('page') ?? '1') || 1
        setQ(initialQ || initialTag)
        setTag(initialTag)
        setPage(initialPage)
        if (initialQ || initialTag) {
            setHasSearched(true)
            doSearch({ page: initialPage, q: initialQ, tag: initialTag, updateURL: false })
        } else {
            // no query -> reset search state
            setHasSearched(false)
            setPosts([])
            setTotal(0)
        }
        // only react to URL param changes; avoid including `doSearch` in deps to prevent loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.toString()])

    // load search history
    const loadHistory = useCallback(() => {
        try {
            const raw = localStorage.getItem('community_search_history')
            return raw ? (JSON.parse(raw) as string[]) : []
        } catch (e) {
            return []
        }
    }, [])
    const [history, setHistory] = useState<string[]>(() => loadHistory())

    return (
        <div className="p-4">
            {/* Top search area: back button, centered rounded search box, search button */}
            <div className="mb-4" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-ghost" onClick={() => navigate(-1)} style={{ minWidth: 48 }}>⬅</button>
                    <input
                        className="flex-1 search-input-full"
                        placeholder="输入关键词后回车或点击搜索"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { doSearch({ page: 1, q, tag, updateURL: true }); } }}
                        autoFocus
                    />
                    <button className="btn-ghost" style={{ minWidth: 48 }} onClick={() => doSearch({ page: 1, q, tag, updateURL: true })}>🔍</button>
                </div>
            </div>

            {/* Search history tags (shown before/after) */}
            {!hasSearched && history && history.length > 0 && (
                <div className="mb-6 search-history">
                    <div className="row-between mb-2">
                        <div className="muted">搜索历史</div>
                        <div>
                            <button className="history-clear btn-ghost" onClick={() => { localStorage.removeItem('community_search_history'); setHistory([]); }} style={{ marginLeft: 8 }}>清除</button>
                        </div>
                    </div>
                    <div className="history-list row-start gap-4 flex-wrap" style={{ alignItems: 'center' }}>
                        {history.map((h, idx) => (
                            <button key={idx} className="badge badge-light history-tag" onClick={() => { setQ(h); doSearch({ page: 1, q: h, updateURL: true }); }}>
                                {h}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results area: after search show posts in community preview style */}
            {hasSearched && (loading ? (
                <div className="muted">加载中...</div>
            ) : (
                <div>
                    <div className="mb-3">共 {total} 条结果</div>

                    {posts.length === 0 ? (
                        <div className="empty-box">暂无结果</div>
                    ) : (
                        <div className="col gap-12">
                            {posts.map((post: any) => (
                                <PostPreview
                                    key={post.id}
                                    post={post}
                                    onClick={() => navigate(`/app/community/${post.id}`, { state: { from: location.pathname + location.search } })}
                                />
                            ))}
                        </div>
                    )}

                    <div className="row-between mt-4">
                        <div>
                            <button className="btn-ghost" disabled={page <= 1} onClick={() => doSearch({ page: Math.max(1, page - 1), q, tag, updateURL: true })}>上一页</button>
                            <button className="btn-ghost ml-4" disabled={page * pageSize >= total} onClick={() => doSearch({ page: page + 1, q, tag, updateURL: true })}>下一页</button>
                        </div>
                        <div className="muted">第 {page} 页</div>
                    </div>
                </div>
            ))}
        </div>
    )
}
