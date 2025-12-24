import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './app-pages.css'
import { communityApi, userApi } from '../../services/api'
import Segmented from '../../components/Segmented'
import UserAvatar from '../../components/UserAvatar'

type Post = {
    id: number
    authorId: number
    authorNickname?: string
    authorAvatar?: string | null
    title: string | null
    excerpt: string
    shareType: string | null
    shareRefId: number | null
    createdAt: string
    likeCount: number
    commentCount: number
    tags: string[]
}

type Comment = {
    id: number
    postId: number
    postTitle: string | null
    postStatus: string | null
    parentId: number | null
    parentAuthorNickname: string | null
    content: string | null
    isDeleted?: boolean
    createdAt: string
    authorId: number
    authorNickname?: string
    authorAvatar?: string | null
}

export default function MyPosts() {
    const navigate = useNavigate()
    const location = useLocation()
    const initialTab = (location.state as { tab?: 'posts' | 'comments' })?.tab || 'posts'
    const [tab, setTab] = useState<'posts' | 'comments'>(initialTab)
    const [posts, setPosts] = useState<Post[]>([])
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)

    useEffect(() => {
        loadCurrentUser()
    }, [])

    useEffect(() => {
        if (currentUserId !== null) {
            if (tab === 'posts') {
                loadMyPosts()
            } else {
                loadMyComments()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, currentUserId])

    async function loadCurrentUser() {
        try {
            const me = await userApi.getMe()
            setCurrentUserId(me.id as number)
        } catch (e) {
            console.error('Failed to get current user:', e)
            setCurrentUserId(null)
        }
    }

    async function loadMyPosts() {
        if (!currentUserId) return
        setLoading(true)
        try {
            // 获取当前用户的所有帖子
            const res = await communityApi.listPosts({ authorId: currentUserId, page: 1, pageSize: 100 })
            setPosts((res as any).items || [])
        } catch (e) {
            console.error('Failed to load my posts:', e)
            setPosts([])
        } finally {
            setLoading(false)
        }
    }

    async function loadMyComments() {
        if (!currentUserId) return
        setLoading(true)
        try {
            const res = await communityApi.getMyComments(1, 100)
            setComments((res as any).items || [])
        } catch (e) {
            console.error('Failed to load my comments:', e)
            setComments([])
        } finally {
            setLoading(false)
        }
    }

    const headerRef = useRef<HTMLDivElement | null>(null)
    const [headerHeight, setHeaderHeight] = useState(0)

    useEffect(() => {
        function update() {
            const h = headerRef.current ? headerRef.current.getBoundingClientRect().height : 0
            setHeaderHeight(h)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    // 页面挂载时禁止 document 根滚动，卸载时恢复（仅影响 MyPosts）
    useEffect(() => {
        const prevHtml = document.documentElement.style.overflow
        const prevBody = document.body.style.overflow
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        return () => {
            document.documentElement.style.overflow = prevHtml
            document.body.style.overflow = prevBody
        }
    }, [])

    return (
        <div className="app-page no-root-scroll">
            <div ref={headerRef} className="app-page-header">
                <button className="back-button btn-ghost" onClick={() => navigate('/app/profile')}>
                    ← 返回
                </button>
                <h2>我的帖子</h2>
                <div style={{ width: 64 }} />
            </div>

            <div className="app-page-content">
                <div className="like-filter-bar" style={{ position: 'sticky', top: headerHeight, background: '#ffffff', zIndex: 38 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="like-filter-label">帖子类型</span>
                    </div>
                    <div>
                        <Segmented
                        options={[
                            { label: '主贴', value: 'posts' },
                            { label: '回复', value: 'comments' },
                        ]}
                        value={tab}
                        onChange={(v: string) => setTab(v as 'posts' | 'comments')}
                    />
                </div>

                {loading ? (
                    <div className="muted text-center py-24">加载中...</div>
                ) : tab === 'posts' ? (
                    posts.length === 0 ? (
                        <div className="empty-box">暂无发帖</div>
                    ) : (
                        <div className="col gap-12">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    className="paper-card cursor-pointer hover:shadow-md transition-shadow"
                                    style={{ padding: 0, overflow: 'hidden' }}
                                    onClick={() => navigate(`/app/community/${post.id}`, { state: { from: '/app/my-posts', tab } })}
                                >
                                    <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                                        <UserAvatar
                                            userId={post.authorId}
                                            nickname={post.authorNickname}
                                            avatarUrl={post.authorAvatar ?? undefined}
                                            timestamp={post.createdAt}
                                            size="medium"
                                        />
                                    </div>
                                    <div style={{ padding: '12px 16px' }}>
                                        <h4 className="mt-0 mb-6" style={{ textAlign: 'left' }}>{post.title || '(无标题)'}</h4>
                                        <p className="muted mb-8 text-14 line-clamp-2" style={{ textAlign: 'left' }}>
                                            {post.excerpt || '(无内容)'}
                                        </p>
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
                                        <div className="row-start gap-12 text-12 muted">
                                            <span>👍 {post.likeCount}</span>
                                            <span>💬 {post.commentCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    comments.length === 0 ? (
                        <div className="empty-box">暂无回复</div>
                    ) : (
                        <div className="col gap-12">
                            {comments.map((comment) => {
                                const canNavigate = comment.postStatus !== 'REMOVED' && comment.postStatus !== 'DELETED'
                                const handleCommentClick = () => {
                                    if (canNavigate) {
                                        navigate(`/app/community/${comment.postId}`, { state: { from: '/app/my-posts', commentId: comment.id, tab } })
                                    }
                                }
                                return (
                                    <div
                                        key={comment.id}
                                        className="paper-card"
                                        style={{
                                            padding: '16px',
                                            overflow: 'hidden',
                                            cursor: canNavigate ? 'pointer' : 'default',
                                            transition: 'box-shadow 0.2s'
                                        }}
                                        onClick={handleCommentClick}
                                        onMouseEnter={(e) => {
                                            if (canNavigate) {
                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (canNavigate) {
                                                e.currentTarget.style.boxShadow = ''
                                            }
                                        }}
                                    >
                                        {/* 用户信息行 */}
                                        <div className="row-between align-center mb-8">
                                            <div className="row gap-8 align-center flex-1">
                                                {comment.authorAvatar && (
                                                    <img
                                                        src={comment.authorAvatar}
                                                        alt={comment.authorNickname}
                                                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                                    />
                                                )}
                                                <div>
                                                    <div className="fw-600 text-14">{comment.authorNickname}</div>
                                                    <div className="text-12 muted">{new Date(comment.createdAt).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 回复信息 */}
                                        <div className="mb-8">
                                            <div className="text-14" style={{ lineHeight: 1.5, color: '#333', textAlign: 'left' }}>
                                                <span style={{ color: '#666' }}>
                                                    回复 {comment.parentAuthorNickname ? `${comment.parentAuthorNickname}` : '楼主'}：
                                                </span>
                                                {comment.isDeleted ? (
                                                    <span style={{ color: '#999', fontStyle: 'italic' }}>（该回复已被删除）</span>
                                                ) : (
                                                    comment.content
                                                )}
                                            </div>
                                        </div>

                                        {/* 原帖信息框 */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleCommentClick()
                                            }}
                                            style={{
                                                padding: '12px',
                                                backgroundColor: '#f5f5f5',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                cursor: canNavigate ? 'pointer' : 'default',
                                                transition: canNavigate ? 'background-color 0.2s' : 'none',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (canNavigate) {
                                                    e.currentTarget.style.backgroundColor = '#e8e8e8'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (canNavigate) {
                                                    e.currentTarget.style.backgroundColor = '#f5f5f5'
                                                }
                                            }}
                                            className={canNavigate ? 'cursor-pointer' : ''}
                                        >
                                            <div className="text-13" style={{ color: canNavigate ? '#333' : '#999' }}>
                                                <span style={{ color: '#999', marginRight: '4px' }}>原帖：</span>
                                                {comment.postTitle || '(无标题)'}
                                                {!canNavigate && <span style={{ marginLeft: '8px', color: '#999' }}>(已删除)</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </section>
        </div>
    )
}
