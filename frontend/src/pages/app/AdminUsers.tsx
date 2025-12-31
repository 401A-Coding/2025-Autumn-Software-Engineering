import React, { useEffect, useState } from 'react'
import { adminApi, userApi } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function AdminUsers() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [pending, setPending] = useState<Record<number, boolean>>({})
    const [currentUserId, setCurrentUserId] = useState<number | null>(null)
    const [query, setQuery] = useState('')
    const navigate = useNavigate()

    async function load(q?: string) {
        setLoading(true)
        try {
            const data = await adminApi.listUsers(q)
            setUsers(data || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    useEffect(() => {
        async function loadCurrent() {
            try {
                const me = await userApi.getMe()
                setCurrentUserId(me.id as number)
            } catch (e) {
                setCurrentUserId(null)
            }
        }
        loadCurrent()
    }, [])

    async function handleSearch(e?: React.FormEvent) {
        e?.preventDefault()
        await load(query.trim() || undefined)
    }

    // role change removed: admins no longer promote/demote users from this UI

    function viewAs(u: any) {
        // 打开管理员专用只读页面
        navigate(`/app/admin/users/${u.id}`)
    }

    // open in new tab removed

    return (
        <div className="p-4">
            <h2 className="text-xl mb-3">用户管理</h2>
            <form onSubmit={handleSearch} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="按 UID 或用户名搜索" value={query} onChange={e => setQuery(e.target.value)} />
                    <button className="btn-ghost" type="submit">搜索</button>
                    <button className="btn-ghost" type="button" onClick={() => { setQuery(''); load() }}>重置</button>
                </div>
            </form>
            {loading ? (
                <div>加载中…</div>
            ) : (
                <table className="w-full table-auto table-horizontal">
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>用户名</th>
                            <th>电话</th>
                            <th>角色</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.username}</td>
                                <td>{u.phone}</td>
                                <td>{u.role}{u.bannedUntil ? ` (已封禁至 ${new Date(u.bannedUntil).toLocaleString()})` : ''}</td>
                                <td>
                                    {/* role toggle removed from UI */}
                                    {u.bannedUntil ? (
                                        <button onClick={async () => {
                                            const ok = window.confirm(`确认解除对 ${u.username} 的封禁？`)
                                            if (!ok) return
                                            try {
                                                setPending(p => ({ ...p, [u.id]: true }))
                                                await adminApi.unbanUser(u.id)
                                                load()
                                            } catch (e: any) {
                                                alert(`操作失败：${e?.message || e}`)
                                            } finally {
                                                setPending(p => ({ ...p, [u.id]: false }))
                                            }
                                        }} style={{ marginRight: 8 }} disabled={u.id === currentUserId}>
                                            解除封禁
                                        </button>
                                    ) : (
                                        <button onClick={async () => {
                                            const daysStr = window.prompt('请输入封禁天数（留空表示永久）', '7')
                                            if (daysStr === null) return
                                            const days = daysStr.trim() === '' ? undefined : Number(daysStr)
                                            const reason = window.prompt('请输入封禁原因（可选）', '') || undefined
                                            const ok = window.confirm(`确认封禁用户 ${u.username}${days ? ` ${days} 天` : '（永久）'}？此操作会被审计。`)
                                            if (!ok) return
                                            try {
                                                setPending(p => ({ ...p, [u.id]: true }))
                                                await adminApi.banUser(u.id, { reason, days })
                                                load()
                                            } catch (e: any) {
                                                alert(`操作失败：${e?.message || e}`)
                                            } finally {
                                                setPending(p => ({ ...p, [u.id]: false }))
                                            }
                                        }} style={{ marginRight: 8 }} disabled={u.id === currentUserId}>
                                            封禁
                                        </button>
                                    )}
                                    <button onClick={() => viewAs(u)} style={{ marginRight: 8 }}>
                                        以用户身份查看
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
