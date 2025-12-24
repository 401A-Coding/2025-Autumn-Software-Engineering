import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi } from '../../services/api'
import Segmented from '../../components/Segmented'
import './app-pages.css'

interface LikeItem {
    type: 'post' | 'comment'
    id: number
    postId?: number
    title?: string
    postTitle?: string | null
    excerpt?: string
    likeCount?: number
    commentCount?: number
    content?: string
    commentLikeCount?: number
    likedAt: string
    createdAt: string
}

export default function MyLikes() {
    const navigate = useNavigate()
    const [type, setType] = useState<'all' | 'post' | 'comment'>('all')
    const [likes, setLikes] = useState<LikeItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [_total, setTotal] = useState(0)
    const pageSize = 20

    function formatDate(iso?: string | Date | null) {
        if (!iso) return '-'
        const d = typeof iso === 'string' ? new Date(iso) : iso
        if (Number.isNaN(d.getTime())) return '-'
        return d.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const loadLikes = useCallback(async (t: typeof type, p: number) => {
        try {
            setLoading(true)
            setError(null)
            const data = await communityApi.getMyLikes(t, p, pageSize)
            setLikes(data.items || [])
            setTotal(data.total || 0)
        } catch (e) {
            console.error('加载点赞列表失败:', e)
            setError(e instanceof Error ? e.message : '加载失败')
            setLikes([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [pageSize])

    useEffect(() => {
        loadLikes(type, page)
    }, [type, page, loadLikes])

    // 页面挂载时禁止 document 根滚动，卸载时恢复（仅影响此页面）
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

    const handleTypeChange = (newType: string) => {
        setType(newType as typeof type)
        setPage(1)
    }

    const handleItemClick = (item: LikeItem) => {
        if (item.type === 'post') {
            navigate(`/app/community/${item.id}`, { state: { from: '/app/my-likes' } })
        } else {
            navigate(`/app/community/${item.postId}`, {
                state: { from: '/app/my-likes', commentId: item.id }
            })
        }
    }

    return (
        <div className="app-page no-root-scroll">
            <div className="app-page-header">
                <button onClick={() => navigate('/app/profile')} className="back-button">
                    ← 返回
                </button>
                <h2>我的点赞</h2>
                <div className="header-spacer"></div>
            </div>

            <div className="app-page-content">
                <div className="like-filter-bar">
                    <span className="like-filter-label">点赞筛选</span>
                    <Segmented
                        value={type}
                        onChange={handleTypeChange}
                        options={[
                            { label: '全部', value: 'all' },
                            { label: '主贴', value: 'post' },
                            { label: '回帖', value: 'comment' },
                        ]}
                    />
                </div>

                {loading && <div className="loading-message">加载中...</div>}
                {error && <div className="error-message">{error}</div>}

                {!loading && likes.length === 0 && (
                    <div className="empty-message">暂无点赞记录</div>
                )}

                {!loading && likes.length > 0 && (
                    <div className="like-list">
                        {likes.map((item) => {
                            const anyItem = item as any
                            // 标题与摘要
                            const postTitle = item.type === 'post' ? (item.title ?? anyItem.postTitle) : anyItem.postTitle
                            const excerpt = item.excerpt ?? anyItem.excerpt ?? ''
                            // 统计数值：支持嵌套结构和多命名
                            const postLikeCount = item.type === 'post'
                                ? (item.likeCount ?? anyItem.postLikeCount ?? anyItem.post_likes ?? anyItem.post?.likeCount ?? 0)
                                : (anyItem.postLikeCount ?? anyItem.post_likes ?? anyItem.post?.likeCount ?? 0)
                            const postCommentCount = item.type === 'post'
                                ? (item.commentCount ?? anyItem.postCommentCount ?? anyItem.post_comments ?? anyItem.post?.commentCount ?? 0)
                                : (anyItem.postCommentCount ?? anyItem.post_comments ?? anyItem.post?.commentCount ?? 0)
                            const commentLikeCount = item.type === 'comment'
                                ? (item.commentLikeCount ?? anyItem.commentLikeCount ?? anyItem.comment_likes ?? anyItem.likeCount ?? anyItem.comment?.likeCount ?? 0)
                                : 0
                            // 删除状态：优先用状态字段，其次用空标题或明确标志推断
                            const postStatus: string | undefined = anyItem.postStatus ?? anyItem.status ?? anyItem.post?.status
                            const commentStatus: string | undefined = anyItem.commentStatus ?? anyItem.status ?? anyItem.comment?.status
                            const postRemoved = (postStatus === 'REMOVED' || postStatus === 'DELETED' || postStatus === 'deleted')
                                || anyItem.postDeleted === true || anyItem.isDeleted === true || anyItem.postRemoved === true
                                || (postTitle == null)
                            const commentRemoved = (commentStatus === 'REMOVED' || commentStatus === 'DELETED' || commentStatus === 'deleted')
                                || anyItem.commentDeleted === true || anyItem.commentRemoved === true
                            const canNavigate = item.type === 'post'
                                ? !postRemoved
                                : (!postRemoved && !commentRemoved && !!item.postId)
                            return (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className={`like-item like-item--compact ${!canNavigate ? 'like-item--disabled' : ''}`}
                                    style={{ cursor: canNavigate ? 'pointer' : 'default' }}
                                    onClick={() => { if (canNavigate) handleItemClick(item) }}
                                >
                                    <div className="like-type-badge left">
                                        {item.type === 'post' ? '主贴' : '回帖'}{!canNavigate ? ' · 已删除' : ''}
                                    </div>
                                    <div className="like-item-content left-align">
                                        <div className="like-item-title">
                                            {postTitle || '(无标题)'} {!canNavigate && <span className="muted text-12">(已删除)</span>}
                                        </div>
                                        {excerpt ? (
                                            <div className="like-item-excerpt">{excerpt}</div>
                                        ) : null}
                                        <div className="like-item-stats">
                                            <span>👍 {postLikeCount}</span>
                                            <span>💬 {postCommentCount}</span>
                                        </div>
                                    </div>
                                    {item.type === 'comment' ? (
                                        <div className="liked-comment-box">
                                            <div className="liked-comment-header">
                                                <span className="badge">被点赞的回帖</span>
                                                <span className="liked-comment-stats">👍 {commentLikeCount}</span>
                                            </div>
                                            {commentRemoved ? (
                                                <div className="muted text-12" style={{ marginBottom: 6 }}>
                                                    (该回复已被删除)
                                                </div>
                                            ) : postRemoved ? (
                                                <div className="muted text-12" style={{ marginBottom: 6 }}>
                                                    (所属主贴已删除，无法跳转)
                                                </div>
                                            ) : null}
                                            <div className="liked-comment-content">{item.content || '(无内容)'}</div>
                                        </div>
                                    ) : null}
                                    <div className="like-item-footer left-align">
                                        点赞于 {formatDate(item.likedAt)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
