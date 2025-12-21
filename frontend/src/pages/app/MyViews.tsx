import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi } from '../../services/api'
import './app-pages.css'

interface ViewItem {
    postId: number
    postTitle: string | null
    postStatus: string | null
    viewedAt: string
}

export default function MyViews() {
    const navigate = useNavigate()
    const [views, setViews] = useState<ViewItem[]>([])
    const [loading, setLoading] = useState(false)
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

    const loadViews = useCallback(async (p: number) => {
        try {
            setLoading(true)
            setError(null)
            const data = await communityApi.getMyViews(p, pageSize)
            setViews(data.items || [])
            setTotal(data.total || 0)
        } catch (e) {
            console.error('加载浏览历史失败:', e)
            setError(e instanceof Error ? e.message : '加载失败')
            setViews([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }, [pageSize])

    useEffect(() => {
        loadViews(page)
    }, [page, loadViews])

    const handleClear = async () => {
        if (!confirm('确定要清空全部浏览历史吗？')) return
        try {
            await communityApi.clearMyViews()
            setViews([])
            setTotal(0)
            setPage(1)
        } catch (e) {
            setError(e instanceof Error ? e.message : '清空失败')
        }
    }

    const handlePostClick = (item: ViewItem) => {
        if (item.postStatus !== 'PUBLISHED') return
        navigate(`/app/community/${item.postId}`, { state: { from: '/app/my-views' } })
    }

    return (
        <div className="app-page">
            <div className="app-page-header">
                <button onClick={() => navigate('/app/profile')} className="back-button">
                    ← 返回
                </button>
                <h2>浏览历史</h2>
                <button onClick={handleClear} className="action-button" disabled={views.length === 0}>
                    清空
                </button>
            </div>

            <div className="app-page-content">
                {loading && <div className="loading-message">加载中...</div>}
                {error && <div className="error-message">{error}</div>}

                {!loading && views.length === 0 && (
                    <div className="empty-message">暂无浏览记录</div>
                )}

                {!loading && views.length > 0 && (
                    <div className="view-list">
                        {views.map((item) => {
                            const isDeleted = item.postStatus !== 'PUBLISHED'
                            return (
                                <div
                                    key={item.postId}
                                    className={`view-item ${isDeleted ? 'deleted' : 'clickable'}`}
                                    onClick={() => handlePostClick(item)}
                                >
                                    <div className="view-title">
                                        {item.postTitle || '(无标题)'}
                                        {isDeleted && <span className="deleted-tag"> [已删除]</span>}
                                    </div>
                                    <div className="view-date">
                                        最近访问：{formatDate(item.viewedAt)}
                                    </div>
                                </div>
                            )
                        })}
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
