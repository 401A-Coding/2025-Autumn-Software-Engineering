import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './app-pages.css'
import { userApi, communityApi } from '../../services/api'
import PostPreview from '../../features/community/PostPreview'

type UserProfile = {
    id: number
    nickname: string
    avatarUrl?: string | null
    role: string
    createdAt: string
    bio?: string | null
    stats?: {
        posts: number
        comments: number
        likes: number
    }
    // legacy: userApi.getById used to return latest 10 posts
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
    // posts pagination state (fetch from communityApi.listPosts)
    const [posts, setPosts] = useState<any[]>([])
    const [postsLoading, setPostsLoading] = useState(false)
    const [postsPage, setPostsPage] = useState(1)
    const [postsPageSize] = useState(10)
    const [postsTotal, setPostsTotal] = useState(0)

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
                // load first page of posts by this author
                loadPosts(1, Number(userId))
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

    async function loadPosts(pageNum = 1, uid?: number) {
        if (!userId && !uid) return
        const author = uid ?? Number(userId)
        setPostsLoading(true)
        try {
            const res = await communityApi.listPosts({ authorId: author, page: pageNum, pageSize: postsPageSize })
            const items = (res as any).items || []
            const total = (res as any).total || 0
            if (pageNum <= 1) {
                setPosts(items)
            } else {
                setPosts(prev => [...prev, ...items])
            }
            setPostsTotal(total)
            setPostsPage(pageNum)
        } catch (e) {
            console.error('Failed to load user posts:', e)
        } finally {
            setPostsLoading(false)
        }
    }

    const copyUid = async (uid: number) => {
        try {
            await navigator.clipboard.writeText(String(uid))
            alert('已复制UID')
        } catch {
            alert('复制失败')
        }
    }

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
            {/* 返回与搜索：同一行，返回在左，搜索在右 */}
            <div className="row-between mb-12">
                <div>
                    <button className="btn-ghost" onClick={() => navigate(-1)}>
                        ← 返回
                    </button>
                </div>
                <div>
                    <button
                        className="btn-ghost"
                        onClick={() => navigate(`/app/community/search?authorId=${user.id}&authorName=${encodeURIComponent(user.nickname)}`)}
                        title={`在社区中搜索 ${user.nickname} 的帖子`}
                    >
                        🔍
                    </button>
                </div>
            </div>

            {/* 用户信息卡片 */}
            <section className="paper-card card-pad">
                {/* 头像+用户信息同一行，右侧信息分三行 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
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

                    {/* 右侧信息分三行 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                        {/* 第一行：昵称 */}
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{user.nickname}</h2>
                        </div>
                        {/* 第二行：UID + 复制按钮 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#8a7f73' }}>
                            <span>UID：{user.id}</span>
                            <button className="btn-compact btn-ghost" onClick={() => copyUid(user.id)} style={{ padding: '2px 6px', fontSize: '12px' }}>
                                复制
                            </button>
                        </div>
                        {/* 第三行：加入时间 */}
                        <div style={{ fontSize: '14px', color: '#8a7f73' }}>
                            📅 加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                    </div>
                </div>

                {/* 签名/自我介绍 */}
                <div style={{ fontSize: '14px', color: '#555', lineHeight: '1.5', marginBottom: '12px' }}>
                    {user.bio && user.bio.trim().length > 0 ? user.bio : '该用户还没有填写签名...'}
                </div>

                {/* 统计信息：居中对齐，略微分散 */}
                <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: '12px', borderTop: '1px solid #e7d8b1' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{user.stats?.posts ?? 0}</div>
                        <div style={{ fontSize: '13px', color: '#8a7f73' }}>帖子</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{user.stats?.comments ?? 0}</div>
                        <div style={{ fontSize: '13px', color: '#8a7f73' }}>评论</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{user.stats?.likes ?? 0}</div>
                        <div style={{ fontSize: '13px', color: '#8a7f73' }}>获赞</div>
                    </div>
                </div>
            </section>

            {/* 用户的帖子（分页加载） */}
            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0 mb-12">Ta 的帖子</h3>
                {postsLoading && posts.length === 0 ? (
                    <div className="muted text-center py-12">加载中...</div>
                ) : posts.length === 0 ? (
                    <div className="empty-box">暂无帖子</div>
                ) : (
                    <>
                        <div className="col gap-12">
                            {posts.map((p) => (
                                <PostPreview
                                    key={p.id}
                                    post={p}
                                    onClick={() => navigate(`/app/community/${p.id}`, { state: { from: `/app/users/${userId}` } })}
                                />
                            ))}
                        </div>

                        {posts.length < postsTotal && (
                            <div className="row-center mt-12">
                                <button className="btn-ghost" disabled={postsLoading} onClick={() => loadPosts(postsPage + 1)}>
                                    {postsLoading ? '加载中...' : '加载更多'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}
