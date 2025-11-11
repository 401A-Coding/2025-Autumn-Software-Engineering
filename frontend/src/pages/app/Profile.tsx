import { useEffect, useState } from 'react'
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
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const data = await userApi.getMe()
                setMe(data)
                setNewNickname(data.nickname || '')
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

    const onSaveNickname = async () => {
        if (!newNickname || saving) return
        setSaving(true)
        setError(null)
        try {
            const updated = await userApi.updateMe({ nickname: newNickname })
            setMe(updated)
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
                    <div className="row-start gap-12">
                        {me.avatarUrl ? (
                            <img className="avatar-64" src={me.avatarUrl || ''} alt="avatar" />
                        ) : (
                            <div className="avatar-64" aria-label="avatar">
                                {(me.nickname || me.phone || '?').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div>
                                <strong>昵称：</strong>
                                <input
                                    value={newNickname}
                                    onChange={(e) => setNewNickname(e.target.value)}
                                    placeholder="输入新昵称"
                                />
                                <button className="btn-ghost mt-6" disabled={saving} onClick={onSaveNickname}>
                                    {saving ? '保存中…' : '保存'}
                                </button>
                            </div>
                            <div className="mt-6">
                                <strong>头像：</strong>
                                <label className="inline-block">
                                    <span className="sr-only">选择头像图片</span>
                                    <input
                                        aria-label="选择头像图片"
                                        title="选择头像图片"
                                        type="file"
                                        accept="image/*"
                                        onChange={onAvatarChange}
                                        disabled={uploading}
                                    />
                                </label>
                                {uploading && <span className="muted inline-block mt-6">上传中…</span>}
                            </div>
                            <div className="mt-6"><strong>手机号：</strong>{me.phone}</div>
                        </div>
                    </div>
                )}

                <button className="btn-ghost mt-8" onClick={onLogout}>退出登录</button>
            </section>
        </div>
    );
}
