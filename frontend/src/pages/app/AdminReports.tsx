import React, { useEffect, useState } from 'react'
import { adminApi } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function AdminReports() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [removingId, setRemovingId] = useState<number | null>(null)
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all')
    const [page, setPage] = useState<number>(1)
    const [pageSize] = useState<number>(20)
    const [total, setTotal] = useState<number>(0)
    const navigate = useNavigate()

    async function load(status?: string, p = 1) {
        setLoading(true)
        try {
            const opts: any = { page: p, pageSize }
            if (status && status !== 'all') opts.status = status
            const data = await adminApi.listReports(opts)
            setItems(data?.items || [])
            setTotal(data?.total || 0)
            setPage(data?.page || p)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load(filterStatus === 'all' ? undefined : filterStatus, 1) }, [filterStatus])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="p-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="text-xl mb-3">举报列表</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 13, color: '#666' }}>筛选：</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                        <option value="all">全部</option>
                        <option value="open">未处理</option>
                        <option value="resolved">已处理</option>
                    </select>
                    <button className="btn-ghost" onClick={() => load(filterStatus === 'all' ? undefined : filterStatus, page)}>刷新</button>
                </div>
            </div>
            {loading ? (
                <div>加载中…</div>
            ) : (
                <>
                    <table className="w-full table-auto table-horizontal">
                        <thead>
                            <tr>
                                <th>举报ID</th>
                                <th>举报者</th>
                                <th>帖子ID</th>
                                <th>帖子摘要</th>
                                <th>时间</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(r => (
                                <tr key={r.id} style={r.status === 'resolved' ? { backgroundColor: '#f7f7f7' } : undefined}>
                                    <td>{r.id}</td>
                                    <td>{r.reporter?.username ?? r.reporterId}</td>
                                    <td>{r.targetType === 'POST' ? r.targetId : '-'}</td>
                                    <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.targetType === 'POST' ? (r.postTitle || '') : ''}</td>
                                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                                    <td>
                                        {r.status === 'resolved' ? (
                                            <span style={{ color: '#888' }}>已处理</span>
                                        ) : (
                                            <span style={{ color: '#d9534f', fontWeight: 600 }}>未处理</span>
                                        )}
                                    </td>
                                    <td>
                                        {r.targetType === 'POST' ? (
                                            <>
                                                <button className="btn-ghost" onClick={() => navigate(`/app/community/${r.targetId}`)}>查看帖子</button>
                                                <button
                                                    className="btn-ghost"
                                                    onClick={async () => {
                                                        if (!window.confirm('确定下架该被举报的帖子吗？此操作会被记录。')) return
                                                        try {
                                                            setRemovingId(r.targetId)
                                                            await adminApi.removePost(r.targetId)
                                                            await load(filterStatus === 'all' ? undefined : filterStatus, page)
                                                        } catch (e) {
                                                            console.error('Remove post failed', e)
                                                            alert('下架失败')
                                                        } finally {
                                                            setRemovingId(null)
                                                        }
                                                    }}
                                                    disabled={removingId === r.targetId}
                                                    style={{ marginLeft: 8 }}
                                                >
                                                    {removingId === r.targetId ? '处理中…' : '下架帖子'}
                                                </button>
                                            </>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>共 {total} 条</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button className="btn-ghost" onClick={() => { if (page > 1) load(filterStatus === 'all' ? undefined : filterStatus, page - 1) }} disabled={page <= 1}>上一页</button>
                            <span>第 {page} / {totalPages} 页</span>
                            <button className="btn-ghost" onClick={() => { if (page < totalPages) load(filterStatus === 'all' ? undefined : filterStatus, page + 1) }} disabled={page >= totalPages}>下一页</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
