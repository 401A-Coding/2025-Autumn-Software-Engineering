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
    content?: string
    excerpt?: string
    authorId?: number
    authorNickname?: string
    authorAvatar?: string | null
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
    const [total, setTotal] = useState(0)
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
        <div className="app-page">
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
                        {likes.map((item) => (
                            <div
                                key={`${item.type}-${item.id}`}
                                className="like-item"
                                onClick={() => handleItemClick(item)}
                            >
                                <div className="like-item-header">
                                    <div className="simple-avatar">
                                        <div className="avatar-image" title={item.authorNickname}>
                                            {item.authorAvatar ? (
                                                <img src={item.authorAvatar} alt={item.authorNickname} />
                                            ) : (
                                                item.authorNickname?.[0] ?? '?'
                                            )}
                                        </div>
                                    </div>
                                    <div className="like-item-meta">
                                        <div className="like-item-author">{item.authorNickname}</div>
                                        <div className="like-item-date">
                                            {formatDate(item.createdAt)}
                                        </div>
                                    </div>
                                    <span className="like-type-badge">
                                        {item.type === 'post' ? '主贴' : '回帖'}
                                    </span>
                                </div>
                                <div className="like-item-content">
                                    {item.type === 'post' ? (
                                        <>
                                            <div className="like-item-title">{item.title || '(无标题)'}</div>
                                            <div className="like-item-excerpt">{item.excerpt}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="like-item-post-title">
                                                来自：{item.postTitle || '(无标题)'}
                                            </div>
                                            <div className="like-item-comment-content">{item.content}</div>
                                        </>
                                    )}
                                </div>
                                <div className="like-item-footer">
                                    点赞于 {formatDate(item.likedAt)}
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
