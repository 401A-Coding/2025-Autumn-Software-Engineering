import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import '../../pages/app/app-pages.css'
import '../../pages/app/community.css'
import { communityApi, userApi } from '../../services/api'
import UserAvatar from '../../components/UserAvatar'
import DropdownMenu, { type MenuAction } from '../../components/DropdownMenu'

import { useRef } from 'react'
import BoardEmbed from '../../components/BoardEmbed'
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
    bookmarkCount?: number
    bookmarked?: boolean
    createdAt: string
    updatedAt?: string
}

type Comment = {
    authorId?: number
    authorNickname?: string
    authorAvatar?: string | null
    id: number
    type?: string
    createdAt?: string
    content: string
    likeCount: number
    replyCount: number
    replies: Reply[]
}

type Reply = {
    id: number
    parentId?: number | null
    authorId?: number
    authorNickname?: string
    authorAvatar?: string | null
    replyToId?: number | null
    replyToNickname?: string | null
    content: string
    likeCount: number
    createdAt?: string
}

export default function PostDetail() {
    const navigate = useNavigate()
    const location = useLocation()
    const { postId } = useParams<{ postId: string }>()
    const fromPage = (location.state as { from?: string })?.from
    const targetCommentId = (location.state as { commentId?: number })?.commentId
    const returnTab = (location.state as { tab?: 'posts' | 'comments' })?.tab

    const handleBack = () => {
        // If user came from a known in-app location, go back in history to preserve navigation stack
        if (returnTab && fromPage === '/app/my-posts') {
            // preserve the original behavior for my-posts with tab state
            navigate(fromPage, { state: { tab: returnTab } })
            return
        }

        if (fromPage) {
            // go back one entry instead of pushing the fromPage again
            navigate(-1)
            return
        }

        // fallback to community home
        navigate('/app/community')
    }
    const [post, setPost] = useState<Post | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [liking, setLiking] = useState(false)
    const [bookmarking, setBookmarking] = useState(false)
    const [liked, setLiked] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [bookmarked, setBookmarked] = useState(false)
    const [expandedComment, setExpandedComment] = useState(false)
    const commentsRef = useRef<HTMLDivElement>(null)
    const commentInputRef = useRef<HTMLDivElement>(null)
    const replyInputRefs = useRef<Map<number, HTMLDivElement>>(new Map())
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [commentLikes, setCommentLikes] = useState<Record<number, boolean>>({})
    const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({})
    const [replyingOnComment, setReplyingOnComment] = useState<number | null>(null)
    const [replyingTo, setReplyingTo] = useState<number | null>(null)
    const [replyText, setReplyText] = useState('')
    const [replyTargetLabel, setReplyTargetLabel] = useState<string>('楼主')
    const [replyTargetContent, setReplyTargetContent] = useState<string>('')
    const [replyLikes, setReplyLikes] = useState<Record<number, boolean>>({})

    async function loadPost() {
        if (!postId) return
        const id = Number(postId)
        if (Number.isNaN(id)) return
        setLoading(true)
        try {
            const data = await communityApi.getPost(id)
            if (data) {
                setPost(data as Post)
                // 设置收藏状态
                setBookmarked((data as any).bookmarked ?? false)
                // 记录浏览历史
                try {
                    await communityApi.recordPostView(id)
                } catch (err) {
                    // 记录浏览失败不影响主流程，仅记录错误
                    console.error('Failed to record post view:', err)
                }
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
                    likeCount: 0,
                    replyCount: 0,
                    replies: [],
                },
            ])
            setPost({ ...post, commentCount: post.commentCount + 1 })
            setCommentText('')
            // 发表后自动收起主楼回复框
            setExpandedComment(false)
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

    // 处理主评论框失焦收起
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (expandedComment && commentInputRef.current && !commentInputRef.current.contains(event.target as Node)) {
                setExpandedComment(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [expandedComment])

    // 处理楼中楼回复框失焦收起
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (replyingOnComment !== null) {
                const replyBox = replyInputRefs.current.get(replyingOnComment)
                if (replyBox && !replyBox.contains(event.target as Node)) {
                    setReplyingOnComment(null)
                    setReplyingTo(null)
                    setReplyText('')
                    setReplyTargetLabel('楼主')
                    setReplyTargetContent('')
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [replyingOnComment])

    // 当评论加载完成且有目标评论ID时，滚动到该评论
    useEffect(() => {
        if (targetCommentId && comments.length > 0) {
            // 首先检查是否是楼中楼评论，如果是，先展开父评论
            let needExpand = false
            let parentCommentId = null

            for (const comment of comments) {
                const isTargetReply = comment.replies?.some((r: any) => r.id === targetCommentId)
                if (isTargetReply) {
                    needExpand = true
                    parentCommentId = comment.id
                    break
                }
            }

            if (needExpand && parentCommentId) {
                // 展开父评论
                setExpandedReplies(prev => ({ ...prev, [parentCommentId]: true }))

                // 等待DOM更新后再滚动
                setTimeout(() => {
                    const targetComment = document.getElementById(`comment-${targetCommentId}`)
                    if (targetComment) {
                        targetComment.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                }, 300)
            } else {
                // 主评论直接滚动
                const targetComment = document.getElementById(`comment-${targetCommentId}`)
                if (targetComment) {
                    setTimeout(() => {
                        targetComment.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 100)
                }
            }
        }
    }, [comments, targetCommentId])

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
        if (post) {
            navigate(`/app/community/${post.id}/edit`)
        }
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

    async function handleLikeComment(commentId: number) {
        try {
            const isLiked = commentLikes[commentId]
            if (!isLiked) {
                await communityApi.likeComment(commentId)
                setCommentLikes({ ...commentLikes, [commentId]: true })
                setComments(comments.map(c =>
                    c.id === commentId ? { ...c, likeCount: c.likeCount + 1 } : c
                ))
            } else {
                await communityApi.unlikeComment(commentId)
                setCommentLikes({ ...commentLikes, [commentId]: false })
                setComments(comments.map(c =>
                    c.id === commentId ? { ...c, likeCount: Math.max(0, c.likeCount - 1) } : c
                ))
            }
        } catch (e) {
            console.error('Comment like failed:', e)
        }
    }

    function toggleReplies(commentId: number) {
        setExpandedReplies({ ...expandedReplies, [commentId]: !expandedReplies[commentId] })
    }

    async function handleReplySubmit(commentId: number) {
        if (!replyText.trim()) return
        try {
            const targetId = replyingTo ?? commentId
            await communityApi.addComment(post!.id, { content: replyText, parentId: targetId } as any)
            // 重新加载评论以获取更新的回复
            await loadComments()
            setReplyText('')
            setReplyingTo(null)
            setReplyingOnComment(null)
            setReplyTargetLabel('楼主')
        } catch (e) {
            console.error('Reply submit failed:', e)
        }
    }
    async function handleLikeReply(replyId: number) {
        try {
            const isLiked = replyLikes[replyId]
            if (!isLiked) {
                await communityApi.likeComment(replyId)
                setReplyLikes({ ...replyLikes, [replyId]: true })
                // 更新回复的点赞数 - 找到对应的回复并更新
                setComments(comments.map(c => ({
                    ...c,
                    replies: c.replies.map(r =>
                        r.id === replyId ? { ...r, likeCount: r.likeCount + 1 } : r
                    )
                })))
            } else {
                await communityApi.unlikeComment(replyId)
                setReplyLikes({ ...replyLikes, [replyId]: false })
                setComments(comments.map(c => ({
                    ...c,
                    replies: c.replies.map(r =>
                        r.id === replyId ? { ...r, likeCount: Math.max(0, r.likeCount - 1) } : r
                    )
                })))
            }
        } catch (e) {
            console.error('Reply like failed:', e)
        }
    }

    async function handleDeleteReply(replyId: number) {
        if (!window.confirm('确定要删除这条回复吗?')) return
        try {
            await communityApi.deleteComment(replyId)
            // 重新加载评论以获取更新的回复列表
            await loadComments()
        } catch (e) {
            console.error('Delete reply failed:', e)
            alert('删除失败')
        }
    }

    function getReplyActions(reply: Reply): MenuAction[] {
        const actions: MenuAction[] = []
        if (currentUserId && reply.authorId && currentUserId === reply.authorId) {
            actions.push({
                label: '删除',
                onClick: () => handleDeleteReply(reply.id),
                danger: true,
            })
        }
        actions.push({
            label: '举报',
            onClick: () => alert('举报功能即将推出'),
        })
        return actions
    }
    if (loading) {
        return <div className="muted text-center py-24">加载中...</div>
    }

    if (!post) {
        return (
            <section className="paper-card card-pad">
                <div className="empty-box">帖子不存在</div>
                <button className="btn-primary mt-16" onClick={handleBack}>
                    返回
                </button>
            </section>
        )
    }

    return (
        <div className="community-page">
            <div className="row align-center mb-12 topbar-sticky">
                <button className="btn-ghost" onClick={handleBack}>
                    ← 返回
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        className="btn-ghost"
                        title="搜索帖子内容"
                        onClick={() => navigate('/app/community/search')}
                    >🔍</button>
                    <DropdownMenu actions={getPostActions()} />
                </div>
            </div>

            <div style={{ paddingBottom: expandedComment ? '400px' : '90px' }}>
                {/* 帖子内容 */}
                <section className="paper-card mb-12" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* 用户信息区域 */}
                    <div style={{ padding: '16px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <UserAvatar
                            userId={post.authorId}
                            nickname={post.authorNickname}
                            avatarUrl={post.authorAvatar ?? undefined}
                            timestamp={post.createdAt}
                            size="large"
                        />
                    </div>

                    {/* 帖子内容区域 */}
                    <div style={{ padding: '16px 20px' }}>
                        <h2 className="mt-0 mb-12" style={{ textAlign: 'left' }}>{post.title || '(无标题)'}</h2>

                        {/* 帖子正文 */}
                        <div className="prose mb-16" style={{ textAlign: 'left' }}>
                            <p className="whitespace-pre-wrap" style={{ textAlign: 'left' }}>{post.content}</p>
                        </div>

                        {/* 引用资源预览 */}
                        {post.shareType === 'record' && post.shareRefId && (
                            <div className="mb-16 community-board-embed">
                                {/* 传入 shareReference 作为无权限时的回退快照；若无快照则不再请求记录接口，避免 404 */}
                                <RecordEmbed
                                    recordId={post.shareRefId}
                                    recordSnapshot={post.shareReference}
                                    allowFetch={!!post.shareReference}
                                />
                            </div>
                        )}
                        {post.shareType === 'board' && post.shareRefId && (
                            <div className="mb-16 community-board-embed">
                                <BoardEmbed boardId={post.shareRefId} enableSave titleOverride={post.shareReference?.name} />
                            </div>
                        )}

                        {/* 标签 */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="mb-16" style={{
                                borderTop: '1px solid #e0e0e0',
                                paddingTop: '12px',
                                marginTop: '8px'
                            }}>
                                <div className="row-start gap-6 flex-wrap">
                                    {post.tags.map((tag, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => navigate(`/app/community/search?tag=${encodeURIComponent(tag)}`)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 10px',
                                                backgroundColor: '#fff',
                                                border: '1px solid #dcdcdc',
                                                borderRadius: '12px',
                                                fontSize: '13px',
                                                color: '#555',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5'
                                                e.currentTarget.style.borderColor = '#cfcfcf'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#fff'
                                                e.currentTarget.style.borderColor = '#dcdcdc'
                                            }}
                                        >
                                            <span style={{ marginRight: '2px', fontWeight: 600 }}>#</span>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
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

                        {/* 互动按钮与统计 */}
                        <div className="row-start gap-12 pt-12 border-top">
                            <button
                                className={`btn-ghost text-14 ${liked ? 'fw-600' : ''}`}
                                onClick={handleLike}
                                disabled={liking}
                            >
                                👍 {post.likeCount}
                            </button>
                            <span className="text-14 muted">💬 {post.commentCount}</span>
                            <button
                                className={`btn-ghost text-14 ${bookmarked ? 'fw-600' : ''}`}
                                onClick={async () => {
                                    if (!post || bookmarking) return
                                    setBookmarking(true)
                                    try {
                                        if (bookmarked) {
                                            await communityApi.unbookmarkPost(post.id)
                                        } else {
                                            await communityApi.bookmarkPost(post.id)
                                        }
                                        setBookmarked(!bookmarked)
                                        setPost(prev => prev ? ({
                                            ...prev,
                                            bookmarkCount: Math.max(0, (prev.bookmarkCount ?? 0) + (bookmarked ? -1 : 1))
                                        }) : prev)
                                    } catch (err) {
                                        console.error('Failed to toggle bookmark:', err)
                                    } finally {
                                        setBookmarking(false)
                                    }
                                }}
                                disabled={bookmarking}
                            >
                                🔖 {post.bookmarkCount ?? 0}
                            </button>
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
                                <div key={comment.id} id={`comment-${comment.id}`} className="paper-card" style={{ padding: 0, overflow: 'hidden' }}>
                                    {/* 评论者信息 */}
                                    <div style={{ padding: '10px 12px', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <UserAvatar
                                            userId={comment.authorId || 0}
                                            nickname={comment.authorNickname}
                                            avatarUrl={comment.authorAvatar ?? undefined}
                                            timestamp={comment.createdAt}
                                            size="small"
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* 点赞按钮 */}
                                            <button
                                                onClick={() => handleLikeComment(comment.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    color: commentLikes[comment.id] ? '#5c9cff' : '#666',
                                                    padding: '4px 8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}
                                            >
                                                👍 <span>{comment.likeCount}</span>
                                            </button>
                                            <DropdownMenu actions={getCommentActions(comment)} />
                                        </div>
                                    </div>
                                    {/* 评论内容 */}
                                    <div style={{ padding: '12px', textAlign: 'left' }}>
                                        {(comment as any).isDeleted ? (
                                            <p className="mt-0 mb-0" style={{ color: '#999', fontStyle: 'italic' }}>该回复已被作者删除</p>
                                        ) : (
                                            <p className="mt-0 mb-0 whitespace-pre-wrap" style={{ textAlign: 'left' }}>{comment.content}</p>
                                        )}
                                    </div>

                                    {/* 楼中楼回复区域 */}
                                    {comment.replyCount > 0 && (
                                        <div
                                            className="community-nested-reply"
                                            style={{
                                                padding: '12px',
                                                borderTop: '1px solid #e0e0e0',
                                                cursor: !expandedReplies[comment.id] ? 'pointer' : 'default',
                                            }}
                                            onClick={() => !expandedReplies[comment.id] && toggleReplies(comment.id)}
                                        >
                                            {!expandedReplies[comment.id] ? (
                                                // 折叠状态：简化展示
                                                <div style={{ textAlign: 'left' }}>
                                                    {comment.replies.slice(0, 2).map((reply) => (
                                                        <div
                                                            key={reply.id}
                                                            style={{
                                                                padding: '6px 0',
                                                                textAlign: 'left',
                                                                fontSize: '13px',
                                                                color: '#555',
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 600 }}>{reply.authorNickname || '匿名'}</span>
                                                            {reply.parentId && reply.parentId !== comment.id && reply.replyToNickname ? (
                                                                <span>
                                                                    {' '}
                                                                    回复{' '}
                                                                    <a
                                                                        href={reply.replyToId ? `/app/users/${reply.replyToId}` : '#'}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{ color: '#1a73e8', textDecoration: 'none' }}
                                                                    >
                                                                        {reply.replyToNickname}
                                                                    </a>
                                                                    ：
                                                                </span>
                                                            ) : (
                                                                <span>：</span>
                                                            )}
                                                            <span>
                                                                {(reply as any).isDeleted ? (
                                                                    <span style={{ color: '#999', fontStyle: 'italic' }}>该回复已被作者删除</span>
                                                                ) : (
                                                                    reply.content
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {comment.replyCount > 2 && (
                                                        <div
                                                            style={{
                                                                marginTop: '8px',
                                                                fontSize: '13px',
                                                                color: '#5c9cff',
                                                                fontWeight: 500,
                                                            }}
                                                        >
                                                            查看全部 {comment.replyCount} 条回复 ▼
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                // 展开状态：详细展示
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    {comment.replies.map((reply) => (
                                                        <div
                                                            key={reply.id}
                                                            id={`comment-${reply.id}`}
                                                            style={{
                                                                padding: '12px',
                                                                borderBottom: '1px solid #e8e8e8',
                                                                backgroundColor: '#fff',
                                                            }}
                                                        >
                                                            {/* 回复头部：用户信息和操作按钮 */}
                                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                                    <img
                                                                        src={reply.authorAvatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect fill=%22%23ddd%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E'}
                                                                        alt="avatar"
                                                                        style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0 }}
                                                                    />
                                                                    <div>
                                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>{reply.authorNickname || '匿名'}</div>
                                                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : ''}</div>
                                                                    </div>
                                                                </div>
                                                                {/* 右上角操作区：点赞 + 菜单 */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                                    <button
                                                                        onClick={() => handleLikeReply(reply.id)}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px',
                                                                            color: replyLikes[reply.id] ? '#5c9cff' : '#999',
                                                                            padding: '4px 6px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                        }}
                                                                    >
                                                                        👍 <span>{reply.likeCount}</span>
                                                                    </button>
                                                                    <DropdownMenu actions={getReplyActions(reply)} />
                                                                </div>
                                                            </div>

                                                            {/* 回复内容 */}
                                                            <p style={{ margin: '0', fontSize: '13px', color: '#555', textAlign: 'left' }}>
                                                                {(reply as any).isDeleted ? (
                                                                    <span style={{ color: '#999', fontStyle: 'italic' }}>该回复已被作者删除</span>
                                                                ) : reply.parentId && reply.parentId !== comment.id && reply.replyToNickname ? (
                                                                    <>
                                                                        回复{' '}
                                                                        <a
                                                                            href={reply.replyToId ? `/app/users/${reply.replyToId}` : '#'}
                                                                            style={{ color: '#1a73e8', textDecoration: 'none' }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {reply.replyToNickname}
                                                                        </a>
                                                                        ：{reply.content}
                                                                    </>
                                                                ) : (
                                                                    reply.content
                                                                )}
                                                            </p>

                                                            <div style={{ marginTop: '8px' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        setExpandedReplies({ ...expandedReplies, [comment.id]: true })
                                                                        setReplyingOnComment(comment.id)
                                                                        setReplyingTo(reply.id)
                                                                        setReplyTargetLabel(reply.authorNickname || '匿名')
                                                                        setReplyTargetContent(reply.content || '')
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        color: '#5c9cff',
                                                                        padding: 0,
                                                                    }}
                                                                >
                                                                    回复
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => toggleReplies(comment.id)}
                                                        style={{
                                                            marginTop: '8px',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                            color: '#5c9cff',
                                                            padding: 0,
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        收起回复 ▲
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 回复输入框 */}
                                    <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0' }}>
                                        {replyingOnComment === comment.id ? (
                                            <div ref={(el) => { if (el) replyInputRefs.current.set(comment.id, el) }}>
                                                {/* 回复提示 */}
                                                {replyTargetContent && (
                                                    <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', lineHeight: '1.5', textAlign: 'left' }}>
                                                        回复 {replyTargetLabel}：{replyTargetContent.length > 50 ? replyTargetContent.slice(0, 50) + '...' : replyTargetContent}
                                                    </div>
                                                )}
                                                <textarea
                                                    autoFocus
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    placeholder="写下你的回复..."
                                                    style={{
                                                        width: '100%',
                                                        minHeight: '60px',
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #ddd',
                                                        fontSize: '13px',
                                                        resize: 'vertical',
                                                    }}
                                                />
                                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => {
                                                            setReplyingOnComment(null)
                                                            setReplyingTo(null)
                                                            setReplyText('')
                                                            setReplyTargetLabel('楼主')
                                                            setReplyTargetContent('')
                                                        }}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '4px',
                                                            border: '1px solid #ddd',
                                                            background: '#fff',
                                                            cursor: 'pointer',
                                                            fontSize: '13px',
                                                        }}
                                                    >
                                                        取消
                                                    </button>
                                                    <button
                                                        onClick={() => handleReplySubmit(comment.id)}
                                                        disabled={!replyText.trim()}
                                                        style={{
                                                            padding: '6px 16px',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            background: replyText.trim() ? '#5c9cff' : '#ccc',
                                                            color: '#fff',
                                                            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                                                            fontSize: '13px',
                                                        }}
                                                    >
                                                        回复
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setReplyingOnComment(comment.id)
                                                    setReplyingTo(comment.id)
                                                    setReplyTargetLabel(comment.authorNickname || '楼主')
                                                    setReplyTargetContent(comment.content || '')
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '13px',
                                                    color: '#5c9cff',
                                                    padding: 0,
                                                }}
                                            >
                                                💬 回复
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* 底部交互栏 - 固定 */}
            <div
                ref={commentInputRef}
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
                                backgroundColor: '#fff',
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
                            onClick={async () => {
                                if (!post || bookmarking) return
                                setBookmarking(true)
                                try {
                                    if (bookmarked) {
                                        await communityApi.unbookmarkPost(post.id)
                                    } else {
                                        await communityApi.bookmarkPost(post.id)
                                    }
                                    // 更新本地 UI 状态
                                    setBookmarked(!bookmarked)
                                    setPost(prev => prev ? ({
                                        ...prev,
                                        bookmarkCount: Math.max(0, (prev.bookmarkCount ?? 0) + (bookmarked ? -1 : 1))
                                    }) : prev)
                                } catch (err) {
                                    console.error('Failed to toggle bookmark:', err)
                                } finally {
                                    setBookmarking(false)
                                }
                            }}
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span>{bookmarked ? '🔖' : '☆'}</span>
                                <span style={{ fontSize: '12px' }}>{post.bookmarkCount ?? 0}</span>
                            </div>
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
                            placeholder={`回复 ${replyTargetLabel}...`}
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
