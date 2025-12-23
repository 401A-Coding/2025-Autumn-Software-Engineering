import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../lib/session'
import { userApi } from '../../services/api'
import type { operations } from '../../types/api'
import './app-pages.css'

export default function Profile() {
    type Me = NonNullable<
        operations['usersMe']['responses'][200]['content']['application/json']['data']
    >

    const [me, setMe] = useState<Me | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [newNickname, setNewNickname] = useState<string>('')
    const [newBio, setNewBio] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [showEdit, setShowEdit] = useState(false)
    const fileInputId = 'avatar-upload-input'
    const navigate = useNavigate()

    const battleLinks = [
        { title: '战绩', description: '查看全部对局记录', to: '/app/history' },
        { title: '收藏', description: '我的收藏对局', to: '/app/favorites' },
    ]

    const communityLinks = [
        { title: '我的发帖', description: '我发布的帖子', to: '/app/my-posts', state: { tab: 'posts' } },
        { title: '我的回帖', description: '我参与的评论', to: '/app/my-posts', state: { tab: 'comments' } },
        { title: '浏览历史', description: '我看过的帖子', to: '/app/my-views' },
        { title: '我的点赞', description: '我点过赞的帖子', to: '/app/my-likes' },
        { title: '我的收藏', description: '我收藏的帖子', to: '/app/my-bookmarks' },
    ]

    function formatDate(iso?: string | Date | null) {
        if (!iso) return '-'
        const d = typeof iso === 'string' ? new Date(iso) : iso
        if (Number.isNaN(d.getTime())) return '-'
        return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    useEffect(() => {
        (async () => {
            try {
                const data = await userApi.getMe()
                setMe(data)
                setNewNickname(data.nickname || '')
                setNewBio((data as any).bio || '')
            } catch (e) {
                setError(e instanceof Error ? e.message : '加载失败')
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    const onLogout = async () => {
        await logout();
    };

    const handleSaveProfile = async () => {
        if (!newNickname || saving) return
        setSaving(true)
        setError(null)
        try {
            const updated = await userApi.updateMe({ nickname: newNickname, bio: newBio || null } as any) as Me
            setMe(updated)
            setShowEdit(false)
        } catch (e) {
            setError(e instanceof Error ? e.message : '保存失败')
        } finally {
            setSaving(false)
        }
    }

    const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || uploading) return
        setUploading(true)
        setError(null)
        try {
            const { url } = await userApi.uploadAvatar(file)
            setMe((prev) => (prev ? { ...prev, avatarUrl: url } as Me : prev))
        } catch (e) {
            setError(e instanceof Error ? e.message : '上传失败')
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    return (
        <div>
            <section className="paper-card card-pad">
                <h3 className="mt-0">个人信息</h3>

                {loading && <p className="muted">加载中…</p>}
                {error && <p className="muted">{error}</p>}

                {!loading && !error && me && (
                    <div className="row gap-16 align-center wrap">
                        {/* 左侧头像，仅展示 */}
                        <div className="col align-center gap-8">
                            {me.avatarUrl ? (
                                <img className="avatar-64" src={me.avatarUrl || ''} alt="avatar" />
                            ) : (
                                <div className="avatar-64" aria-label="avatar">
                                    {(me.nickname || me.phone || '?').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* 右侧信息，仅展示 */}
                        <div className="minw-220 flex-1">
                            <div className="profile-meta">
                                <div className="mt-6"><strong>昵称：</strong>{me.nickname || '-'}</div>
                                <div className="mt-6"><strong>手机号：</strong>{me.phone || '-'}</div>
                                <div className="mt-6"><strong>签名：</strong>{(me as any).bio || '-'}</div>
                                <div className="mt-6"><strong>创建时间：</strong>{formatDate((me as any).createdAt)}</div>
                            </div>

                            {/* 操作按钮移至节底部的统一区域，避免在错误态无退出入口 */}
                        </div>
                    </div>
                )}

                {/* 操作区：在任意状态下都提供退出登录；有资料时一起提供编辑入口 */}
                <div className="mt-8 row-start gap-12 wrap">
                    {!loading && !error && me && (
                        <button className="btn-ghost" onClick={() => setShowEdit(true)}>编辑我的个人资料</button>
                    )}
                    <button className="btn-ghost" onClick={onLogout}>退出登录</button>
                </div>
            </section>

            <section className="paper-card card-pad mt-12">
                <div className="row-between align-center mb-8">
                    <h3 className="mt-0 mb-0">对战信息</h3>
                    <span className="muted text-12">从这里快速进入记录模块</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    {battleLinks.map((item) => (
                        <button
                            key={item.title}
                            type="button"
                            className="btn-ghost"
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                background: '#f8fafc',
                                padding: '12px 14px',
                                textAlign: 'left',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(item.to)}
                        >
                            <div className="fw-600">{item.title}</div>
                            <div className="muted text-12 mt-4">{item.description}</div>
                        </button>
                    ))}
                </div>
            </section>

            <section className="paper-card card-pad mt-12">
                <div className="row-between align-center mb-8">
                    <h3 className="mt-0 mb-0">社区信息</h3>
                    <span className="muted text-12">我的互动和收藏</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    {communityLinks.map((item) => (
                        <button
                            key={item.title}
                            type="button"
                            className="btn-ghost"
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                background: '#f9f9f9',
                                padding: '12px 14px',
                                textAlign: 'left',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                if (item.state) {
                                    navigate(item.to, { state: item.state })
                                } else {
                                    navigate(item.to)
                                }
                            }}
                        >
                            <div className="fw-600">{item.title}</div>
                            <div className="muted text-12 mt-4">{item.description}</div>
                        </button>
                    ))}
                </div>
            </section>

            {/* 编辑资料弹窗 */}
            {showEdit && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-profile-title"
                    className="modal-mask"
                >
                    <div className="paper-card modal-card mw-420">
                        <h4 id="edit-profile-title" className="mt-0">编辑我的个人资料</h4>

                        <div className="row gap-16 align-center wrap">
                            {/* 头像更换 */}
                            <div className="col align-center gap-8">
                                {me?.avatarUrl ? (
                                    <img className="avatar-64" src={me.avatarUrl || ''} alt="avatar" />
                                ) : (
                                    <div className="avatar-64" aria-label="avatar">
                                        {(me?.nickname || me?.phone || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="avatar-actions">
                                    <input
                                        id={fileInputId}
                                        className="sr-only"
                                        aria-label="选择头像图片"
                                        title="选择头像图片"
                                        type="file"
                                        accept="image/*"
                                        onChange={onAvatarChange}
                                        disabled={uploading}
                                    />
                                    <label htmlFor={fileInputId} className="btn-ghost btn-compact">
                                        {uploading ? '上传中…' : '更换头像'}
                                    </label>
                                </div>
                            </div>

                            {/* 昵称编辑 */}
                            <div className="minw-220 flex-1">
                                <div className="row-start gap-8 mb-8">
                                    <strong>昵称：</strong>
                                    <input
                                        value={newNickname}
                                        onChange={(e) => setNewNickname(e.target.value)}
                                        placeholder="输入新昵称"
                                    />
                                </div>
                                <div className="row-start gap-8">
                                    <strong>签名：</strong>
                                    <textarea
                                        value={newBio}
                                        onChange={(e) => setNewBio(e.target.value)}
                                        placeholder="输入签名或自我介绍"
                                        style={{ minHeight: 80, resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && <div className="muted mt-6">{error}</div>}

                        <div className="row-between mt-8 gap-8">
                            <button className="btn-ghost" onClick={() => setShowEdit(false)}>取消</button>
                            <button className="btn-primary" disabled={saving} onClick={handleSaveProfile}>
                                {saving ? '保存中…' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
