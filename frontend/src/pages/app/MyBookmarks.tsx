import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi } from '../../services/api'
import './app-pages.css'

interface BookmarkItem {
    postId: number
    title: string
    excerpt: string
    authorId?: number
    authorNickname?: string
    authorAvatar?: string | null
    likeCount: number
    commentCount: number
    bookmarkedAt: string
    createdAt: string
}

export default function MyBookmarks() {
    const navigate = useNavigate()
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [editMode, setEditMode] = useState(false)
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

    const loadBookmarks = useCallback(async (p: number) => {
        try {
            setLoading(true)
            setError(null)
            const data = await communityApi.getMyBookmarks(p, pageSize)
            setBookmarks(data.items || [])
            setTotal(data.total || 0)
        } catch (e) {
            console.error('加载收藏列表失败:', e)
            setError(e instanceof Error ? e.message : '加载失败')
            setBookmarks([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [pageSize])

    useEffect(() => {
        loadBookmarks(page)
    }, [page, loadBookmarks])

    const handleRemoveBookmark = async (postId: number) => {
        try {
            await communityApi.unbookmarkPost(postId)
            setBookmarks(prev => prev.filter(b => b.postId !== postId))
            setTotal(prev => prev - 1)
        } catch (e) {
            setError(e instanceof Error ? e.message : '取消收藏失败')
        }
    }

    const handlePostClick = (postId: number) => {
        if (editMode) return
        navigate(`/app/community/${postId}`, { state: { from: '/app/my-bookmarks' } })
    }

    return (
        <div className="app-page no-root-scroll">
            <div className="app-page-header">
                <button onClick={() => navigate('/app/profile')} className="back-button">
                    ← 返回
                </button>
                <h2>我的收藏</h2>
                <button
                    onClick={() => setEditMode(!editMode)}
                    className="action-button"
                    disabled={bookmarks.length === 0}
                >
                    {editMode ? '完成' : '取消收藏'}
                </button>
            </div>

            <div className="app-page-content">
                {loading && <div className="loading-message">加载中...</div>}
                {error && <div className="error-message">{error}</div>}

                {!loading && bookmarks.length === 0 && (
                    <div className="empty-message">暂无收藏</div>
                )}

                {!loading && bookmarks.length > 0 && (
                    <div className="bookmark-list">
                        {bookmarks.map((item) => (
                            <div
                                key={item.postId}
                                className={`bookmark-item ${editMode ? 'edit-mode' : ''}`}
                                onClick={() => handlePostClick(item.postId)}
                            >
                                {editMode && (
                                    <button
                                        className="remove-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemoveBookmark(item.postId)
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                                <div className="bookmark-item-header">
                                    <div className="simple-avatar">
                                        <div className="avatar-image" title={item.authorNickname}>
                                            {item.authorAvatar ? (
                                                <img src={item.authorAvatar} alt={item.authorNickname} />
                                            ) : (
                                                item.authorNickname?.[0] ?? '?'
                                            )}
                                        </div>
                                    </div>
                                    <div className="bookmark-item-meta">
                                        <div className="bookmark-item-author">{item.authorNickname}</div>
                                        <div className="bookmark-item-date">
                                            {formatDate(item.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="bookmark-item-content">
                                    <div className="bookmark-item-title">{item.title || '(无标题)'}</div>
                                    <div className="bookmark-item-excerpt">{item.excerpt}</div>
                                </div>
                                <div className="bookmark-item-footer">
                                    <span>👍 {item.likeCount}</span>
                                    <span>💬 {item.commentCount}</span>
                                    <span className="bookmark-date">
                                        收藏于 {formatDate(item.bookmarkedAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && total > pageSize && (
                    <div className="pagination">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            上一页
                        </button>
                        <span>第 {page} 页，共 {Math.ceil(total / pageSize)} 页</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(total / pageSize)}
                        >
                            下一页
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
