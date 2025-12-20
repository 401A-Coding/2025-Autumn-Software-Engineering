import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { communityApi } from '../../services/api'

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
    const navigate = useNavigate()

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
                    }
                } catch (e) {
                    // ignore
                }
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
                    <button className="btn" onClick={() => doSearch({ page: 1, q, tag, updateURL: true })}>搜索</button>
                </div>
            </div>

            {/* Search history tags (shown before/after) */}
            {history && history.length > 0 && (
                <div className="mb-6 row-start gap-4 flex-wrap">
                    {history.map((h, idx) => (
                        <button key={idx} className="badge badge-light" onClick={() => { setQ(h); doSearch({ page: 1, q: h, updateURL: true }); }}>
                            {h}
                        </button>
                    ))}
                </div>
            )}

            {/* Results area: after search show posts in community preview style */}
            {loading ? (
                <div className="muted">加载中...</div>
            ) : (
                <div>
                    <div className="mb-3">共 {total} 条结果</div>

                    {posts.length === 0 ? (
                        <div className="empty-box">暂无结果</div>
                    ) : (
                        <div className="col gap-12">
                            {posts.map((post: any) => (
                                <div
                                    key={post.id}
                                    className="paper-card cursor-pointer hover:shadow-md transition-shadow"
                                    style={{ padding: 0, overflow: 'hidden' }}
                                    onClick={() => navigate(`/app/community/${post.id}`)}
                                >
                                    <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <img src={post.authorAvatar || ''} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                                            <div>
                                                <div className="fw-600">{post.title || '(无标题)'}</div>
                                                <div className="muted text-12">{post.authorNickname || '匿名'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ padding: '12px 16px' }}>
                                        <p className="muted mb-8 text-14 line-clamp-2">{post.excerpt || '(无内容)'}</p>
                                        <div className="row-start gap-12 text-12 muted">
                                            <span>👍 {post.likeCount}</span>
                                            <span>💬 {post.commentCount}</span>
                                        </div>
                                    </div>
                                </div>
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
            )}
        </div>
    )
}
