import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { userApi, communityApi } from '../../services/api'
import PostPreview from '../../features/community/PostPreview'

export default function AdminUserView() {
    const { userId } = useParams<{ userId: string }>()
    const navigate = useNavigate()
    const [user, setUser] = useState<any | null>(null)
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function load() {
            if (!userId) return
            setLoading(true)
            try {
                const u = await userApi.getById(Number(userId))
                if (!mounted) return
                setUser(u)
                const res = await communityApi.listPosts({ authorId: Number(userId), page: 1, pageSize: 20 })
                const items = (res as any).items || []
                if (!mounted) return
                setPosts(items)
            } catch (e) {
                console.error(e)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [userId])

    if (loading) return <div className="muted text-center py-24">加载中...</div>
    if (!user) return (
        <section className="paper-card card-pad">
            <div className="empty-box">用户不存在或无法加载</div>
            <button className="btn-primary mt-16" onClick={() => navigate(-1)}>返回</button>
        </section>
    )

    return (
        <div>
            <div className="mb-12">
                <div className="muted">管理员只读视图（不可执行写操作）</div>
            </div>

            <div className="audit-banner">注意：管理员查看/操作会被记录并写入审计日志。</div>

            <section className="paper-card card-pad">
                <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: user.avatarUrl ? 'transparent' : '#e0e0e0' }}>
                        {user.avatarUrl ? <img src={user.avatarUrl} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: 16, fontSize: 20 }}>{(user.nickname || 'U').slice(0, 2).toUpperCase()}</div>}
                    </div>
                    <div>
                        <h2 style={{ margin: 0 }}>{user.nickname}</h2>
                        <div className="muted">UID: {user.id} · 角色: {user.role}</div>
                        <div className="muted">加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                </div>
            </section>

            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0 mb-12">公开帖子</h3>
                {posts.length === 0 ? (
                    <div className="empty-box">暂无公开帖子</div>
                ) : (
                    <div className="col gap-12">
                        {posts.map(p => (
                            <PostPreview key={p.id} post={p} onClick={() => navigate(`/app/admin/posts/${p.id}`)} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
