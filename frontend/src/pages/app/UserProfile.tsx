import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './app-pages.css'

type UserProfile = {
    id: number
    username: string
    nickname?: string
    email?: string
    avatarUrl?: string
    role: string
    createdAt: string
}

export default function UserProfile() {
    const navigate = useNavigate()
    const { userId } = useParams<{ userId: string }>()
    const [user, setUser] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // TODO: 实现用户信息获取 API
        // 目前使用模拟数据
        setLoading(true)
        setTimeout(() => {
            setUser({
                id: parseInt(userId || '0'),
                username: 'user_' + userId,
                nickname: '用户 ' + userId,
                email: 'user@example.com',
                role: 'USER',
                createdAt: new Date().toISOString(),
            })
            setLoading(false)
        }, 500)
    }, [userId])

    if (loading) {
        return <div className="muted text-center py-24">加载中...</div>
    }

    if (!user) {
        return (
            <section className="paper-card card-pad">
                <div className="empty-box">用户不存在</div>
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
                                alt={user.nickname || user.username}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <span style={{ fontSize: 28, fontWeight: 600, color: '#666' }}>
                                {(user.nickname || user.username).slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* 用户信息 */}
                    <div className="flex-1">
                        <h2 className="mt-0 mb-4">{user.nickname || user.username}</h2>
                        <div className="text-14 muted mb-2">@{user.username}</div>
                        {user.email && <div className="text-14 muted mb-2">📧 {user.email}</div>}
                        <div className="text-14 muted">
                            📅 加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                    </div>
                </div>

                {/* 统计信息 */}
                <div className="row-start gap-16 pt-16 border-top">
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">0</div>
                        <div className="text-12 muted">帖子</div>
                    </div>
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">0</div>
                        <div className="text-12 muted">评论</div>
                    </div>
                    <div className="text-center">
                        <div className="text-20 fw-600 mb-4">0</div>
                        <div className="text-12 muted">获赞</div>
                    </div>
                </div>
            </section>

            {/* 用户的帖子 */}
            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0 mb-12">Ta 的帖子</h3>
                <div className="empty-box">暂无帖子</div>
            </section>
        </div>
    )
}
