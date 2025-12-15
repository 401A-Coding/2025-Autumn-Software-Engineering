import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './app-pages.css'
import { userApi } from '../../services/api'

type UserProfile = {
    id: number
    nickname: string
    avatarUrl?: string | null
    role: string
    createdAt: string
    stats?: {
        posts: number
        comments: number
        likes: number
    }
    posts?: {
        id: number
        title: string
        excerpt: string
        createdAt: string
        likeCount: number
        commentCount: number
    }[]
}

export default function UserProfile() {
    const navigate = useNavigate()
    const { userId } = useParams<{ userId: string }>()
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let alive = true
        const fetchUser = async () => {
            if (!userId) return
            setLoading(true)
            setError('')
            try {
                const data = await userApi.getById(Number(userId))
                if (!alive) return
                setUser(data as unknown as UserProfile)
            } catch (e: any) {
                if (!alive) return
                setError(e?.message || '加载用户信息失败')
                setUser(null)
            } finally {
                if (alive) setLoading(false)
            }
        }
        fetchUser()
        return () => {
            alive = false
        }
    }, [userId])

    if (loading) {
        return <div className="muted text-center py-24">加载中...</div>
    }

    if (!user) {
        return (
            <section className="paper-card card-pad">
                <div className="empty-box">{error || '用户不存在'}</div>
                <button className="btn-primary mt-16" onClick={() => navigate(-1)}>
                    返回
                </button>
            </section>
        )
    }

    return (
        <div>
            {/* 返回按钮 */}
            <button className="btn-ghost mb-12" onClick={() => navigate(-1)}>
                ← 返回
            </button>

            {/* 用户信息卡片 */}
            <section className="paper-card card-pad">
                <div className="row-start gap-16 align-start mb-16">
                    {/* 头像 */}
                    <div
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            backgroundColor: user.avatarUrl ? 'transparent' : '#e0e0e0',
                            overflow: 'hidden',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={user.nickname}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <span style={{ fontSize: 28, fontWeight: 600, color: '#666' }}>
                                {user.nickname.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* 用户信息 */}
                    <div className="flex-1">
                        <h2 className="mt-0 mb-4">{user.nickname}</h2>
                        <div className="text-14 muted mb-2">用户ID：{user.id}</div>
                        <div className="text-14 muted">
                            📅 加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                    </div>
                </div>

                {/* 统计信息 */}
                <div className="row-start gap-16 pt-16 border-top">
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">{user.stats?.posts ?? 0}</div>
                        <div className="text-12 muted">帖子</div>
                    </div>
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">{user.stats?.comments ?? 0}</div>
                        <div className="text-12 muted">评论</div>
                    </div>
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">{user.stats?.likes ?? 0}</div>
                        <div className="text-12 muted">获赞</div>
                    </div>
                </div>
            </section>

            {/* 用户的帖子 */}
            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0 mb-12">Ta 的帖子</h3>
                {user.posts && user.posts.length > 0 ? (
                    <div className="col gap-8">
                        {user.posts.map((p) => (
                            <div key={p.id} className="paper-card pad-12">
                                <div className="row-between align-start">
                                    <div>
                                        <div className="fw-600 mb-4">{p.title}</div>
                                        <div className="muted text-13 line-clamp-2 mb-6">{p.excerpt || '(无内容)'}</div>
                                        <div className="text-12 muted row-start gap-10">
                                            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                            <span>👍 {p.likeCount}</span>
                                            <span>💬 {p.commentCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-box">暂无帖子</div>
                )}
            </section>
        </div>
    )
}
