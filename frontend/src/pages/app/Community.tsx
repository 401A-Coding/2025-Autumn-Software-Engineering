import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './app-pages.css'
import { communityApi, userApi } from '../../services/api'
import UserAvatar from '../../components/UserAvatar'
import RecordEmbed from '../../components/RecordEmbed'
import BoardPreview from '../../components/BoardPreview'
import DropdownMenu, { type MenuAction } from '../../components/DropdownMenu'

type Post = {
    id: number
    authorId: number
    authorNickname?: string
    authorAvatar?: string | null
    title: string | null
    excerpt: string
    shareType: string | null // backend returns lower-case, e.g. 'record' | 'board' | null
    shareRefId: number | null
    createdAt: string
    likeCount: number
    commentCount: number
    tags: string[]
}

export default function Community() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [pageSize] = useState(10)
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)

    async function loadPosts(pageNum = 1) {
        setLoading(true)
        try {
            const res = await communityApi.listPosts({ page: pageNum, pageSize })
            setPosts((res as any).items || [])
            setTotal((res as any).total || 0)
            setPage(pageNum)
        } catch (e) {
            console.error('Failed to load posts:', e)
            setPosts([])
        } finally {
            setLoading(false)
        }
    }

    async function handleSearch(e?: React.FormEvent | string) {
        let query: string
        if (typeof e === 'string') {
            query = e
        } else {
            e?.preventDefault()
            query = searchQuery
        }
        
        if (!query.trim()) return

        setLoading(true)
        setIsSearching(true)
        try {
            const res = await communityApi.listPosts({
                q: query,
                page: 1,
                pageSize: pageSize,
            })
            setPosts((res as any).items || [])
            setTotal((res as any).total || 0)
            setPage(1)
        } catch (e) {
            console.error('Search failed:', e)
            setPosts([])
        } finally {
            setLoading(false)
        }
    }

    function handleClearSearch() {
        setSearchQuery('')
        setIsSearching(false)
        setPage(1)
        loadPosts(1)
    }

    useEffect(() => {
        const urlSearch = searchParams.get('search')
        if (urlSearch) {
            setSearchQuery(urlSearch)
            setIsSearching(true)
            handleSearch(urlSearch)
        } else {
            loadPosts(1)
        }
        loadCurrentUser()
    }, [])

    async function loadCurrentUser() {
        try {
            const me = await userApi.getMe()
            setCurrentUserId(me.id as number)
        } catch (e) {
            console.error('Failed to get current user:', e)
            setCurrentUserId(null)
        }
    }

    function getPostActions(post: Post): MenuAction[] {
        const actions: MenuAction[] = []

        if (currentUserId && currentUserId === post.authorId) {
            actions.push({
                label: '编辑',
                onClick: () => navigate(`/app/community/${post.id}/edit`),
            })
            actions.push({
                label: '删除',
                onClick: () => handleDeletePost(post.id),
                danger: true,
            })
        }

        actions.push({
            label: '举报',
            onClick: () => alert('举报功能即将推出'),
        })

        return actions
    }

    async function handleDeletePost(postId: number) {
        if (!window.confirm('确定要删除这篇帖子吗?')) return
        try {
            await communityApi.deletePost(postId)
            setPosts(posts.filter(p => p.id !== postId))
            setTotal(Math.max(0, total - 1))
            alert('帖子已删除')
        } catch (e) {
            console.error('Delete post failed:', e)
            alert('删除失败')
        }
    }

    const maxPage = Math.ceil(total / pageSize) || 1

    return (
        <div>
            {/* 顶部导航栏 */}
            <section className="paper-card card-pad mb-12">
                <div className="row-between align-center mb-12">
                    <h3 className="mt-0 mb-0">社区</h3>
                    <div className="row-start gap-8">
                        <button
                            className="btn-primary"
                            title="发布新帖"
                            onClick={() => navigate('/app/community/new')}
                        >
                            ➕ 发布
                        </button>
                    </div>
                </div>

                {/* 搜索栏 */}
                <form onSubmit={handleSearch} className="row-start gap-8 mb-12">
                    <input
                        type="text"
                        placeholder="搜索帖子..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1"
                    />
                    <button type="submit" className="btn-ghost" title="搜索">
                        🔍
                    </button>
                    {isSearching && (
                        <button
                            type="button"
                            className="btn-ghost"
                            title="清除搜索"
                            onClick={handleClearSearch}
                        >
                            ✕
                        </button>
                    )}
                </form>

                {isSearching && (
                    <div className="muted text-12">
                        搜索结果："{searchQuery}" （共 {total} 条）
                    </div>
                )}
            </section>

            {/* 帖子列表 */}
            <section className="paper-card card-pad">
                {loading ? (
                    <div className="muted text-center py-24">加载中...</div>
                ) : posts.length === 0 ? (
                    <div className="empty-box">暂无帖子</div>
                ) : (
                    <>
                        <div className="col gap-12">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    className="paper-card cursor-pointer hover:shadow-md transition-shadow"
                                    style={{ padding: 0, overflow: 'hidden' }}
                                    onClick={() => navigate(`/app/community/${post.id}`)}
                                >
                                    {/* 用户信息区域 */}
                                    <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <UserAvatar
                                            userId={post.authorId}
                                            nickname={post.authorNickname}
                                            avatarUrl={post.authorAvatar ?? undefined}
                                            timestamp={post.createdAt}
                                            size="medium"
                                        />
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu actions={getPostActions(post)} />
                                        </div>
                                    </div>

                                    {/* 帖子内容区域 */}
                                    <div style={{ padding: '12px 16px' }}>
                                        {/* 帖子标题 */}
                                        <h4 className="mt-0 mb-6" style={{ textAlign: 'left' }}>{post.title || '(无标题)'}</h4>

                                        {/* 帖子摘要 */}
                                        <p className="muted mb-8 text-14 line-clamp-2" style={{ textAlign: 'left' }}>
                                            {post.excerpt || '(无内容)'}
                                        </p>

                                        {/* 引用资源预览 */}
                                        {post.shareType === 'record' && post.shareRefId && (
                                            <div className="mb-8">
                                                <RecordEmbed recordId={post.shareRefId} />
                                            </div>
                                        )}
                                        {post.shareType === 'board' && post.shareRefId && (
                                            <div className="mb-8">
                                                <BoardPreview
                                                    boardId={post.shareRefId}
                                                    onClick={() => {
                                                        navigate(`/app/boards/${post.shareRefId}`)
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* 标签 */}
                                        {post.tags && post.tags.length > 0 && (
                                            <div className="row-start gap-4 mb-8 flex-wrap">
                                                {post.tags.slice(0, 3).map((tag, idx) => (
                                                    <span key={idx} className="badge badge-light text-12">
                                                        {tag}
                                                    </span>
                                                ))}
                                                {post.tags.length > 3 && (
                                                    <span className="badge badge-light text-12">
                                                        +{post.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* 底部信息 */}
                                        <div className="row-start gap-12 text-12 muted">
                                            <span>👍 {post.likeCount}</span>
                                            <span>💬 {post.commentCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 分页器 */}
                        {maxPage > 1 && (
                            <div className="row-center gap-8 mt-16 pt-12 border-top">
                                <button
                                    className="btn-ghost"
                                    onClick={() => loadPosts(Math.max(1, page - 1))}
                                    disabled={page <= 1}
                                >
                                    ← 上一页
                                </button>
                                <span className="muted text-12">
                                    第 {page} / {maxPage} 页
                                </span>
                                <button
                                    className="btn-ghost"
                                    onClick={() => loadPosts(Math.min(maxPage, page + 1))}
                                    disabled={page >= maxPage}
                                >
                                    下一页 →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}
