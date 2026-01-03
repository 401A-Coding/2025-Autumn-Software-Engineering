import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { communityApi, userApi } from '../../services/api'
import PostPreview from '../../features/community/PostPreview'

interface MatchedTag {
    name: string
}

interface MatchedUser {
    id: number
    username: string
}

type MatchResult = { type: 'tag'; data: MatchedTag } | { type: 'user'; data: MatchedUser } | null

export default function CommunitySearch() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [q, setQ] = useState('')
    const [tag, setTag] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(10)
    const [total, setTotal] = useState(0)
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [authorId, setAuthorId] = useState<number | null>(null)
    const [authorName, setAuthorName] = useState<string | null>(null)
    const [availableTags, setAvailableTags] = useState<MatchedTag[]>([])
    const [matchResult, setMatchResult] = useState<MatchResult>(null)
    const navigate = useNavigate()
    const location = useLocation()

    // 模糊匹配标签或用户名
    const fuzzyMatchTagsAndUsers = useCallback(async (input: string): Promise<MatchResult> => {
        if (!input.trim()) return null

        const lowerInput = input.toLowerCase()

        // 先尝试匹配可用标签
        const matchedTag = availableTags.find(t => t.name.toLowerCase().includes(lowerInput))
        if (matchedTag) {
            return { type: 'tag', data: matchedTag }
        }

        // 再尝试模糊匹配用户名
        try {
            const users = await userApi.searchUsers(input)
            if (users && users.length > 0) {
                return { type: 'user', data: { id: users[0].id, username: users[0].username } }
            }
        } catch (e) {
            // ignore search errors
        }

        return null
    }, [availableTags])

    // 处理搜索，自动应用匹配的标签或用户
    const handleSearch = async () => {
        let finalTag = tag
        let finalAuthorId = authorId

        // 检查是否有匹配的标签或用户
        const match = await fuzzyMatchTagsAndUsers(q)
        if (match) {
            if (match.type === 'tag') {
                finalTag = match.data.name
            } else if (match.type === 'user') {
                finalAuthorId = match.data.id
                setAuthorName(match.data.username)
            }
        }

        doSearch({ page: 1, q, tag: finalTag, authorId: finalAuthorId, updateURL: true })
    }

    const doSearch = useCallback(async (opts?: { page?: number; q?: string; tag?: string; authorId?: number | null; updateURL?: boolean }) => {
        try {
            setLoading(true)
            const localQ = opts?.q ?? q
            const localTag = opts?.tag ?? tag
            const p = opts?.page ?? page
            const localAuthor = opts?.authorId ?? authorId
            // Use listPosts to get post preview shape consistent with Community page
            const res = await communityApi.listPosts({ q: localQ || undefined, tag: localTag || undefined, page: p, pageSize, authorId: localAuthor ?? undefined })
            const data: any = res ?? {}
            setPosts(data.items ?? [])
            setTotal(data.total ?? 0)
            setPage(data.page ?? p)

            // sync URL when requested (e.g., on submit or paging)
            if (opts?.updateURL) {
                const params: Record<string, string> = {}
                if (localQ) params.q = localQ
                if (localTag) params.tag = localTag
                if (localAuthor) params.authorId = String(localAuthor)
                if (authorName) params.authorName = authorName
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
                        // if search included author filter, keep it in state
                        if (localAuthor) setAuthorId(localAuthor)
                    }
                } catch (e) {
                    // ignore
                }
            }
        } finally {
            setLoading(false)
        }
    }, [q, tag, page, pageSize, setSearchParams, authorId, authorName])

    // 加载可用标签列表
    useEffect(() => {
        const loadTags = async () => {
            try {
                // 暂时使用搜索获取标签，后续可改为专门的 API
                const res = await communityApi.search({ pageSize: 1000 })
                const tags = new Set<string>()
                if (res && Array.isArray(res.items)) {
                    // 这里假设返回的 SearchResultItem 包含标签信息
                    // 如果实际结构不同需要调整
                }
                // TODO: 后续需要后端提供专门的获取标签列表接口
                setAvailableTags([])
            } catch (e) {
                // ignore
            }
        }
        loadTags()
    }, [])

    // initial load from URL and react to searchParams changes (so back/forward works)
    useEffect(() => {
        const initialQ = searchParams.get('q') ?? ''
        const initialTag = searchParams.get('tag') ?? ''
        const initialAuthor = searchParams.get('authorId') ?? ''
        const initialAuthorName = searchParams.get('authorName') ?? ''
        const initialPage = Number(searchParams.get('page') ?? '1') || 1
        // do not populate the input with authorId; keep author as filter/placeholder only
        setQ(initialQ || initialTag)
        setTag(initialTag)
        setAuthorId(initialAuthor ? Number(initialAuthor) : null)
        setAuthorName(initialAuthorName || null)
        setPage(initialPage)
        if (initialQ || initialTag) {
            // explicit query requested in URL -> run search
            setHasSearched(true)
            doSearch({ page: initialPage, q: initialQ || initialTag, tag: initialTag, authorId: initialAuthor ? Number(initialAuthor) : undefined, updateURL: false })
        } else if (initialAuthor) {
            // only author present -> show placeholder but do NOT auto-run search
            setHasSearched(false)
            setPosts([])
            setTotal(0)
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
        <div>
            <div className="mb-4 topbar-sticky">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-ghost" onClick={() => navigate(-1)} style={{ minWidth: 48 }}>⬅</button>
                    <input
                        className="flex-1 search-input-full"
                        placeholder={authorId && !hasSearched && !q ? `搜索${authorName || ''}的帖子` : '输入关键词后回车或点击搜索'}
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value)
                            // 实时更新匹配结果
                            fuzzyMatchTagsAndUsers(e.target.value).then(setMatchResult)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch()
                            }
                        }}
                        autoFocus
                    />
                    <button className="btn-ghost" style={{ minWidth: 48 }} onClick={handleSearch}>🔍</button>
                </div>
            </div>

            {/* 显示匹配提示 */}
            {matchResult && q && (
                <div className="mb-4" style={{ padding: '8px 12px', backgroundColor: '#f0f8ff', borderRadius: '4px', borderLeft: '3px solid #1976d2' }}>
                    <div className="text-12 muted">
                        {matchResult.type === 'tag'
                            ? `🏷️ 将按标签"${matchResult.data.name}"搜索`
                            : `👤 将包含用户"${matchResult.data.username}"的结果`
                        }
                    </div>
                </div>
            )}

            <div>
                {/* Search history tags (shown before/after) */}
                {!hasSearched && !authorId && history && history.length > 0 && (
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
        </div>
    )
}
