import { useEffect, useState } from 'react'
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
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
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

    // 聚合举报：按 targetType + targetId 分组
    const groups = (() => {
        const map: Record<string, any> = {}
        for (const r of items) {
            const key = `${r.targetType}:${r.targetId}`
            if (!map[key]) {
                map[key] = {
                    key,
                    targetType: r.targetType,
                    targetId: r.targetId,
                    postTitle: r.postTitle || null,
                    reports: [] as any[],
                }
            }
            map[key].reports.push(r)
        }
        const arr = Object.values(map)
        for (const g of arr) {
            g.count = g.reports.length
            g.lastTime = Math.max(...g.reports.map((rr: any) => new Date(rr.createdAt).getTime()))
            g.status = g.reports.some((rr: any) => rr.status !== 'resolved') ? 'open' : 'resolved'
        }
        // 按最新举报时间降序
        arr.sort((a: any, b: any) => b.lastTime - a.lastTime)
        return arr
    })()

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
                                <th>目标类型</th>
                                <th>目标ID</th>
                                <th>帖子摘要</th>
                                <th>举报数</th>
                                <th>最新时间</th>
                                <th>状态</th>
                                <th>操作</th>
                                <th>详情</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map(g => (
                                <>
                                    <tr key={g.key} style={g.status === 'resolved' ? { backgroundColor: '#f7f7f7' } : undefined}>
                                        <td>{g.targetType}</td>
                                        <td>{g.targetId}</td>
                                        <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.targetType === 'POST' ? (g.postTitle || '') : ''}</td>
                                        <td>{g.count}</td>
                                        <td>{new Date(g.lastTime).toLocaleString()}</td>
                                        <td>
                                            {g.status === 'resolved' ? (
                                                <span style={{ color: '#888' }}>已处理</span>
                                            ) : (
                                                <span style={{ color: '#d9534f', fontWeight: 600 }}>未处理</span>
                                            )}
                                        </td>
                                        <td>
                                            {g.targetType === 'POST' ? (
                                                <>
                                                    <button className="btn-ghost" onClick={() => navigate(`/app/community/${g.targetId}`)}>查看帖子</button>
                                                    <button
                                                        className="btn-ghost"
                                                        onClick={async () => {
                                                            if (!window.confirm('确定下架该被举报的帖子吗？此操作会被记录。')) return
                                                            try {
                                                                setRemovingId(g.targetId)
                                                                await adminApi.removePost(g.targetId)
                                                                await load(filterStatus === 'all' ? undefined : filterStatus, page)
                                                            } catch (e) {
                                                                console.error('Remove post failed', e)
                                                                alert('下架失败')
                                                            } finally {
                                                                setRemovingId(null)
                                                            }
                                                        }}
                                                        disabled={removingId === g.targetId}
                                                        style={{ marginLeft: 8 }}
                                                    >
                                                        {removingId === g.targetId ? '处理中…' : '下架帖子'}
                                                    </button>
                                                </>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </td>
                                        <td>
                                            <button className="btn-ghost" onClick={() => setExpanded(prev => ({ ...prev, [g.key]: !prev[g.key] }))}>
                                                {expanded[g.key] ? '收起' : '展开'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expanded[g.key] && (
                                        <tr key={g.key + '-details'}>
                                            <td colSpan={8}>
                                                <div style={{ padding: '8px 12px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
                                                    <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>举报详情：</div>
                                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                        {g.reports.map((rr: any) => (
                                                            <li key={rr.id} style={{ marginBottom: 4 }}>
                                                                <span style={{ color: '#333' }}>{rr.reason || '未提供理由'}</span>
                                                                <span style={{ color: '#888', marginLeft: 8 }}>— {rr.reporter?.username ?? rr.reporterId}，{new Date(rr.createdAt).toLocaleString()}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
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
