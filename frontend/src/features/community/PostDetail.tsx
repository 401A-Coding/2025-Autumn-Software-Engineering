import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import { communityApi } from '../../services/api'
import UserAvatar from '../../components/UserAvatar'

type Post = {
    id: number
    authorId: number
    authorNickname?: string
    title: string | null
    content: string
    shareReference?: any
    attachments: any[]
    tags: string[]
    likeCount: number
    commentCount: number
    createdAt: string
    updatedAt?: string
}

type Comment = {
    authorId?: number
    authorNickname?: string
    id: number
    type: string
    createdAt?: string
    content: string
}

export default function PostDetail() {
    const navigate = useNavigate()
    const { postId } = useParams<{ postId: string }>()
    const [post, setPost] = useState<Post | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [liking, setLiking] = useState(false)
    const [liked, setLiked] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function loadPost() {
        if (!postId) return
        const id = Number(postId)
        if (Number.isNaN(id)) return
        setLoading(true)
        try {
            const data = await communityApi.getPost(id)
            if (data) {
                setPost(data as Post)
            }
        } catch (e) {
            console.error('Failed to load post:', e)
        } finally {
            setLoading(false)
        }
    }

    async function handleLike() {
        if (!post || liking) return
        setLiking(true)
        try {
            if (!liked) {
                await communityApi.likePost(post.id)
                setLiked(true)
                setPost({ ...post, likeCount: post.likeCount + 1 })
            } else {
                await communityApi.unlikePost(post.id)
                setLiked(false)
                setPost({ ...post, likeCount: Math.max(0, post.likeCount - 1) })
            }
        } catch (e) {
            console.error('Like failed:', e)
        } finally {
            setLiking(false)
        }
    }

    async function handleCommentSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!post || !commentText.trim() || submitting) return

        setSubmitting(true)
        try {
            const res = await communityApi.addComment(post.id, { content: commentText })
            setComments([
                ...comments,
                {
                    id: (res as any).commentId || Date.now(),
                    type: 'static',
                    content: commentText,
                },
            ])
            setPost({ ...post, commentCount: post.commentCount + 1 })
            setCommentText('')
        } catch (e) {
            console.error('Comment submit failed:', e)
        } finally {
            setSubmitting(false)
        }
    }

    useEffect(() => {
        loadPost()
    }, [postId])

    if (loading) {
        return <div className="muted text-center py-24">加载中...</div>
    }

    if (!post) {
        return (
            <section className="paper-card card-pad">
                <div className="empty-box">帖子不存在</div>
                <button className="btn-primary mt-16" onClick={() => navigate('/app/community')}>
                    返回社区
                </button>
            </section>
        )
    }

    return (
        <div>
            {/* 返回按钮 */}
            <button className="btn-ghost mb-12" onClick={() => navigate('/app/community')}>
                ← 返回
            </button>

            {/* 帖子内容 */}
            <section className="paper-card mb-12" style={{ padding: 0, overflow: 'hidden' }}>
                {/* 用户信息区域 */}
                <div style={{ padding: '16px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                    <UserAvatar
                        userId={post.authorId}
                        nickname={post.authorNickname}
                        timestamp={post.createdAt}
                        size="large"
                    />
                </div>

                {/* 帖子内容区域 */}
                <div style={{ padding: '16px 20px' }}>
                    <h2 className="mt-0 mb-12">{post.title || '(无标题)'}</h2>

                    {/* 标签 */}
                    {post.tags && post.tags.length > 0 && (
                        <div className="row-start gap-4 mb-12 flex-wrap">
                            {post.tags.map((tag, idx) => (
                                <span key={idx} className="badge badge-light">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* 帖子正文 */}
                    <div className="prose mb-16">
                        <p className="whitespace-pre-wrap">{post.content}</p>
                    </div>

                    {/* 附件 */}
                    {post.attachments && post.attachments.length > 0 && (
                        <div className="mb-16">
                            <h4>附件</h4>
                            <ul>
                                {post.attachments.map((att, idx) => (
                                    <li key={idx}>
                                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                                            {att.url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* 互动按钮 */}
                    <div className="row-start gap-12 pt-12 border-top">
                        <button
                            className={`btn-ghost text-14 ${liked ? 'fw-600' : ''}`}
                            onClick={handleLike}
                            disabled={liking}
                        >
                            👍 {post.likeCount}
                        </button>
                        <span className="text-14 muted">💬 {post.commentCount}</span>
                    </div>
                </div>
            </section>

            {/* 评论区 */}
            <section className="paper-card card-pad">
                <h3 className="mt-0 mb-12">评论 ({post.commentCount})</h3>

                {/* 评论输入框 */}
                <form onSubmit={handleCommentSubmit} className="mb-16 pb-16 border-bottom">
                    <textarea
                        placeholder="写下你的评论..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="w-100 mb-8"
                        rows={3}
                    />
                    <div className="row-end">
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!commentText.trim() || submitting}
                        >
                            {submitting ? '发送中...' : '发送评论'}
                        </button>
                    </div>
                </form>

                {/* 评论列表 */}
                {comments.length === 0 ? (
                    <div className="muted">暂无评论</div>
                ) : (
                    <div className="col gap-12">
                        {comments.map((comment) => (
                            <div key={comment.id} className="paper-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* 评论者信息 */}
                                <div style={{ padding: '10px 12px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
                                    <UserAvatar
                                        userId={comment.authorId || 0}
                                        nickname={comment.authorNickname}
                                        timestamp={comment.createdAt}
                                        size="small"
                                    />
                                </div>
                                {/* 评论内容 */}
                                <div style={{ padding: '12px' }}>
                                    <p className="mt-0 mb-0 whitespace-pre-wrap">{comment.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
