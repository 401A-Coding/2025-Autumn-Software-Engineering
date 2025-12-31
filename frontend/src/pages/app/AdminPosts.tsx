import React, { useEffect, useState } from 'react'
import { adminApi } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function AdminPosts() {
    const [posts, setPosts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')

    async function load(q?: string) {
        setLoading(true)
        try {
            const data = await adminApi.listPosts(q)
            setPosts(data || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const navigate = useNavigate()

    async function remove(id: number) {
        const ok = window.confirm('确定下架该帖子吗？此操作会被记录。')
        if (!ok) return
        try {
            await adminApi.removePost(id)
            load()
        } catch (e: any) {
            alert(`操作失败：${e?.message || e}`)
        }
    }

    async function restore(id: number) {
        const ok = window.confirm('确定恢复该帖子吗？此操作会被记录。')
        if (!ok) return
        try {
            await adminApi.restorePost(id)
            load()
        } catch (e: any) {
            alert(`操作失败：${e?.message || e}`)
        }
    }

    return (
        <div className="p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="text-xl mb-3">帖子管理</h2>
                <div>
                    <button className="btn-ghost" onClick={() => navigate('/app/admin/reports')}>查看被举报帖子</button>
                </div>
            </div>
            <form onSubmit={async (e) => { e.preventDefault(); await load(query.trim() || undefined) }} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input placeholder="按标题搜索帖子" value={query} onChange={e => setQuery(e.target.value)} />
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
                            <th>作者</th>
                            <th>标题</th>
                            <th>状态</th>
                            <th>创建时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((p) => (
                            <tr key={p.id}>
                                <td>{p.id}</td>
                                <td>
                                    {p.author?.username ?? p.authorId}
                                </td>
                                <td>{p.title || p.content?.slice(0, 60)}</td>
                                <td>{p.status}</td>
                                <td>{new Date(p.createdAt).toLocaleString()}</td>
                                <td>
                                    <button className="btn-ghost" style={{ marginRight: 8 }} onClick={() => navigate(`/app/admin/posts/${p.id}`)}>
                                        查看帖子
                                    </button>
                                    {p.status !== 'REMOVED' ? (
                                        <button onClick={() => remove(p.id)}>下架</button>
                                    ) : (
                                        <button onClick={() => restore(p.id)}>恢复</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
