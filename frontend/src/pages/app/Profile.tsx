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

    const [moderations, setModerations] = useState<any[] | null>(null)
    const [loadingModerations, setLoadingModerations] = useState(false)
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})

    // Normalize moderation records returned by different backend shapes
    function normalizeModeration(m: any) {
        const rawAction = m.action || m.actionType || ''
        const targetType = m.targetType || m.target || ''

        // Map backend actionType + targetType to frontend action keys
        let action = rawAction
        if (!m.action && m.actionType) {
            if (m.actionType === 'ban' && String(targetType).toUpperCase() === 'USER') action = 'ban_user'
            else if (m.actionType === 'remove' && String(targetType).toUpperCase() === 'POST') action = 'remove_post'
            else if (m.actionType === 'remove' && String(targetType).toUpperCase() === 'COMMENT') action = 'remove_comment'
            else if (m.actionType === 'restore' && String(targetType).toUpperCase() === 'POST') action = 'restore_post'
            else if (m.actionType === 'unban') action = 'unban_user'
            else action = m.actionType
        }

        // Build payload: prefer explicit payload, then metadata; always merge top-level reason/days
        let payload: any = null
        if (m.payload) payload = m.payload
        else if (m.metadata) payload = m.metadata
        else payload = {}

        if (m.reason && (!payload || typeof payload !== 'object' || !('reason' in payload))) {
            payload = { ...(payload || {}), reason: m.reason }
        }
        if ((m as any).days && (!payload || typeof payload !== 'object' || !('days' in payload))) {
            payload = { ...(payload || {}), days: (m as any).days }
        }

        // ensure payload is at least an object
        if (!payload) payload = {}
        return { action, payload }
    }
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
                // bio 字段类型未在 types/api.d.ts 里声明，实际后端已支持
                setNewBio((data as { bio?: string | null }).bio || '')
            } catch (e) {
                setError(e instanceof Error ? e.message : '加载失败')
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    useEffect(() => {
        (async () => {
            setLoadingModerations(true)
            try {
                const list = await userApi.getModerationActions()
                setModerations(list || [])
            } catch (e) {
                // ignore silently for now
            } finally {
                setLoadingModerations(false)
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
            // bio 字段类型未在 types/api.d.ts 里声明，实际后端已支持
            const updated = await userApi.updateMe({ nickname: newNickname, bio: newBio || null } as { nickname: string; bio?: string | null }) as Me
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
                                <div className="mt-6"><strong>签名：</strong>{(me as { bio?: string | null }).bio || '-'}</div>
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

            {((moderations && moderations.length > 0) || (me && ((me as any).isBanned))) && (
                <section className="paper-card card-pad mt-12">
                    <div className="row-between align-center mb-8">
                        <h3 className="mt-0 mb-0">处理记录</h3>
                        <span className="muted text-12">管理员对您账号或内容的操作历史</span>
                    </div>

                    {loadingModerations ? (
                        <p className="muted">加载中…</p>
                    ) : (
                        <div>
                            {/* 若账号被封禁，优先展示封禁提示 */}
                            {me && (me as any).isBanned && (
                                <div style={{ borderLeft: '4px solid #f56', padding: 12, marginBottom: 12, background: '#fff8f8' }}>
                                    {(() => {
                                        const until = (me as any).bannedUntil
                                        if (!until) return '您的账号已被永久封禁，期间无法在线匹配或进入社区模块。'
                                        try {
                                            const days = Math.ceil((new Date(until).getTime() - Date.now()) / (24 * 3600 * 1000))
                                            if (days <= 0) return '您的账号封禁即将结束，某些功能可能仍受限。'
                                            return `您的账号已被封禁，剩余 ${days} 天，期间无法在线匹配或进入社区模块。`
                                        } catch {
                                            return '您的账号已被封禁，期间无法在线匹配或进入社区模块。'
                                        }
                                    })()}
                                </div>
                            )}

                            {!moderations || moderations.length === 0 ? (
                                <div className="muted">暂无处理记录</div>
                            ) : (
                                <table className="w-full table-auto">
                                    <thead>
                                        <tr>
                                            <th>时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {moderations.map((m: any) => {
                                            const { action, payload } = normalizeModeration(m)
                                            return (
                                                <tr key={m.id}>
                                                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <span>{formatModActionWithPayload(action, payload)}</span>
                                                        <button
                                                            className="btn-ghost btn-compact"
                                                            style={{ marginLeft: 8 }}
                                                            onClick={() => setExpandedRows(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                                                        >{expandedRows[m.id] ? '收起原因' : '查看原因'}</button>

                                                        {expandedRows[m.id] && (
                                                            <div className="muted text-12 mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                                                                {payload && payload.reason ? `原因：${payload.reason}` : '无详细说明'}
                                                                {payload && payload.days ? '\n' + `封禁时长：${payload.days} 天` : ''}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </section>
            )}

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

function formatModAction(action: string) {
    switch (action) {
        case 'ban_user': return '封禁账号'
        case 'unban_user': return '解除封禁'
        case 'remove_post': return '帖子被删除'
        case 'restore_post': return '帖子已恢复'
        case 'remove_comment': return '评论被删除'
        default: return action
    }
}

function formatModDescription(action: string, payload: any) {
    payload = payload || {}
    try {
        switch (action) {
            case 'ban_user': {
                const days = payload.days
                const reason = payload.reason
                const when = days ? `封禁 ${days} 天` : '永久封禁'
                return reason ? `${when}（原因：${reason}）` : when
            }
            case 'unban_user': return '账号已解除封禁'
            case 'remove_post': return payload.reason ? `帖子被删除（原因：${payload.reason}）` : '帖子被删除'
            case 'restore_post': return '帖子已恢复'
            case 'remove_comment': return payload.reason ? `评论被删除（原因：${payload.reason}）` : '评论被删除'
            default: {
                const s = JSON.stringify(payload)
                return s === '{}' ? '-' : s
            }
        }
    } catch (e) {
        return '-'
    }
}

function formatModActionWithPayload(action: string, payload: any) {
    // Combine short action label with important payload info (e.g., ban days)
    const base = formatModAction(action)
    if (!payload) return base
    try {
        switch (action) {
            case 'ban_user': {
                const days = payload.days
                return days ? `${base} — ${days} 天` : `${base} — 永久`
            }
            case 'remove_post': {
                if (payload.reason) return `${base} — ${payload.reason}`
                return base
            }
            case 'remove_comment': {
                if (payload.reason) return `${base} — ${payload.reason}`
                return base
            }
            default:
                return base
        }
    } catch {
        return base
    }
}
