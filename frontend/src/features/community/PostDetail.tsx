import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import { communityApi, userApi } from '../../services/api'
import UserAvatar from '../../components/UserAvatar'
import DropdownMenu, { type MenuAction } from '../../components/DropdownMenu'

import { useRef } from 'react'
import BoardPreview from '../../components/BoardPreview'
import RecordEmbed from '../../components/RecordEmbed'

type Post = {
    id: number
    authorId: number
    authorNickname?: string
    authorAvatar?: string | null
    title: string | null
    content: string
    shareType?: string | null // backend returns lower-case, e.g. 'record' | 'board'
    shareRefId?: number | null
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
    authorAvatar?: string | null
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
    const [bookmarked, setBookmarked] = useState(false)
    const [expandedComment, setExpandedComment] = useState(false)
    const commentsRef = useRef<HTMLDivElement>(null)
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)

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

    async function loadComments() {
        if (!postId) return
        const id = Number(postId)
        if (Number.isNaN(id)) return
        try {
            const res = await communityApi.getComments(id, 1, 20)
            setComments((res as any).items || [])
        } catch (e) {
            console.error('Failed to load comments:', e)
            setComments([])
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
                    authorId: (res as any).authorId,
                    authorNickname: (res as any).authorNickname,
                    authorAvatar: (res as any).authorAvatar ?? null,
                    content: commentText,
                    createdAt: (res as any).createdAt || new Date().toISOString(),
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
        loadComments()
        loadCurrentUser()
    }, [postId])

    async function loadCurrentUser() {
        try {
            const me = await userApi.getMe()
            setCurrentUserId(me.id as number)
        } catch (e) {
            console.error('Failed to get current user:', e)
            setCurrentUserId(null)
        }
    }

    function getPostActions(): MenuAction[] {
        const actions: MenuAction[] = []

        if (currentUserId && post && currentUserId === post.authorId) {
            actions.push({
                label: '编辑',
                onClick: () => handleEditPost(),
            })
            actions.push({
                label: '删除',
                onClick: () => handleDeletePost(),
                danger: true,
            })
        }

        actions.push({
            label: '举报',
            onClick: () => handleReportPost(),
        })

        return actions
    }

    function getCommentActions(comment: Comment): MenuAction[] {
        const actions: MenuAction[] = []

        if (currentUserId && comment.authorId && currentUserId === comment.authorId) {
            actions.push({
                label: '删除',
                onClick: () => handleDeleteComment(comment.id),
                danger: true,
            })
        }

        actions.push({
            label: '举报',
            onClick: () => handleReportComment(comment.id),
        })

        return actions
    }

    async function handleDeletePost() {
        if (!post || !window.confirm('确定要删除这篇帖子吗?')) return
        try {
            await communityApi.deletePost(post.id)
            alert('帖子已删除')
            navigate('/app/community')
        } catch (e) {
            console.error('Delete post failed:', e)
            alert('删除失败')
        }
    }

    function handleEditPost() {
        // TODO: Implement edit mode
        alert('编辑功能即将推出')
    }

    function handleReportPost() {
        alert('举报功能即将推出')
    }

    async function handleDeleteComment(commentId: number) {
        if (!window.confirm('确定要删除这条评论吗?')) return
        try {
            await communityApi.deleteComment(commentId)
            setComments(comments.filter(c => c.id !== commentId))
            if (post) {
                setPost({ ...post, commentCount: Math.max(0, post.commentCount - 1) })
            }
            alert('评论已删除')
        } catch (e) {
            console.error('Delete comment failed:', e)
            alert('删除失败')
        }
    }

    function handleReportComment(_commentId: number) {
        alert('举报功能即将推出')
    }

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
        <div style={{ paddingBottom: expandedComment ? '400px' : '90px' }}>
            {/* 返回按钮 */}
            <button className="btn-ghost mb-12" onClick={() => navigate('/app/community')}>
                ← 返回
            </button>

            {/* 帖子内容 */}
            <section className="paper-card mb-12" style={{ padding: 0, overflow: 'hidden' }}>
                {/* 用户信息区域 */}
                <div style={{ padding: '16px 20px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <UserAvatar
                        userId={post.authorId}
                        nickname={post.authorNickname}
                        avatarUrl={post.authorAvatar ?? undefined}
                        timestamp={post.createdAt}
                        size="large"
                    />
                    <DropdownMenu actions={getPostActions()} />
                </div>

                {/* 帖子内容区域 */}
                <div style={{ padding: '16px 20px' }}>
                    <h2 className="mt-0 mb-12" style={{ textAlign: 'left' }}>{post.title || '(无标题)'}</h2>

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
                    <div className="prose mb-16" style={{ textAlign: 'left' }}>
                        <p className="whitespace-pre-wrap" style={{ textAlign: 'left' }}>{post.content}</p>
                    </div>

                    {/* 引用资源预览 */}
                    {post.shareType === 'record' && post.shareRefId && (
                        <div className="mb-16">
                            <RecordEmbed recordId={post.shareRefId} />
                        </div>
                    )}
                    {post.shareType === 'board' && post.shareRefId && (
                        <div className="mb-16">
                            <BoardPreview
                                boardId={post.shareRefId}
                                onClick={() => navigate(`/app/boards/${post.shareRefId}`)}
                            />
                        </div>
                    )}

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
            <section className="paper-card card-pad" ref={commentsRef}>
                <h3 className="mt-0 mb-12">评论 ({post.commentCount})</h3>

                {/* 评论列表 */}
                {comments.length === 0 ? (
                    <div className="muted">暂无评论</div>
                ) : (
                    <div className="col gap-12">
                        {comments.map((comment) => (
                            <div key={comment.id} className="paper-card" style={{ padding: 0, overflow: 'hidden' }}>
                                {/* 评论者信息 */}
                                <div style={{ padding: '10px 12px', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <UserAvatar
                                        userId={comment.authorId || 0}
                                        nickname={comment.authorNickname}
                                        avatarUrl={comment.authorAvatar ?? undefined}
                                        timestamp={comment.createdAt}
                                        size="small"
                                    />                                    <DropdownMenu actions={getCommentActions(comment)} />                                    <DropdownMenu actions={getCommentActions(comment)} />
                                </div>
                                {/* 评论内容 */}
                                <div style={{ padding: '12px', textAlign: 'left' }}>
                                    <p className="mt-0 mb-0 whitespace-pre-wrap" style={{ textAlign: 'left' }}>{comment.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 底部交互栏 - 固定 */}
            <div
                className="post-detail-bottom-bar"
                style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    borderTop: '1px solid #e0e0e0',
                    zIndex: 1000,
                    transition: 'all 0.3s ease',
                    maxHeight: expandedComment ? '90vh' : '90px',
                    overflowY: expandedComment ? 'auto' : 'visible',
                }}
            >
                {!expandedComment ? (
                    // 收起状态：隐式评论输入 + 交互按钮
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            height: '90px',
                        }}
                    >
                        {/* 隐式评论输入框 */}
                        <div
                            onClick={() => setExpandedComment(true)}
                            className="comment-input-collapsed"
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                borderRadius: '20px',
                                backgroundColor: '#f5f5f5',
                                cursor: 'pointer',
                                color: '#999',
                                fontSize: '14px',
                                transition: 'all 0.2s ease',
                                userSelect: 'none',
                            }}
                        >
                            写下你的评论...
                        </div>

                        {/* 交互按钮组 */}
                        <button
                            className="interaction-btn"
                            title="评论"
                            onClick={() => {
                                if (commentsRef.current) {
                                    commentsRef.current.scrollIntoView({ behavior: 'smooth' })
                                }
                            }}
                            style={{
                                flex: 0,
                                background: 'none',
                                border: 'none',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '8px 10px',
                            }}
                        >
                            💬 <span style={{ fontSize: '12px', marginLeft: '2px' }}>{post.commentCount}</span>
                        </button>

                        <button
                            className={`interaction-btn ${liked ? 'active' : ''}`}
                            title="点赞"
                            onClick={handleLike}
                            disabled={liking}
                            style={{
                                flex: 0,
                                background: 'none',
                                border: 'none',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '8px 10px',
                                opacity: liked ? 1 : 0.7,
                                fontWeight: liked ? '600' : '400',
                            }}
                        >
                            👍 <span style={{ fontSize: '12px', marginLeft: '2px' }}>{post.likeCount}</span>
                        </button>

                        <button
                            className={`interaction-btn ${bookmarked ? 'active' : ''}`}
                            title="收藏"
                            onClick={() => setBookmarked(!bookmarked)}
                            style={{
                                flex: 0,
                                background: 'none',
                                border: 'none',
                                fontSize: '18px',
                                cursor: 'pointer',
                                padding: '8px 10px',
                                opacity: bookmarked ? 1 : 0.7,
                                fontWeight: bookmarked ? '600' : '400',
                            }}
                        >
                            {bookmarked ? '🔖' : '☆'}
                        </button>
                    </div>
                ) : (
                    // 展开状态：完整评论输入框
                    <form
                        onSubmit={handleCommentSubmit}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '16px',
                            gap: '8px',
                        }}
                    >
                        <textarea
                            autoFocus
                            placeholder="写下你的评论..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                fontFamily: 'inherit',
                                fontSize: '14px',
                                resize: 'vertical',
                            }}
                        />
                        <div
                            style={{
                                display: 'flex',
                                gap: '8px',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setExpandedComment(false)
                                    setCommentText('')
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #ddd',
                                    background: '#fff',
                                    color: '#666',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                }}
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={!commentText.trim() || submitting}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: commentText.trim() && !submitting ? '#5c9cff' : '#ccc',
                                    color: '#fff',
                                    cursor: commentText.trim() && !submitting ? 'pointer' : 'not-allowed',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                }}
                            >
                                {submitting ? '发送中...' : '发表'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
