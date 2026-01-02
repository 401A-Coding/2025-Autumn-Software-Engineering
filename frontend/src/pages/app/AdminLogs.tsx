import { useEffect, useState } from 'react'
import { adminApi } from '../../services/api'

export default function AdminLogs() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const data = await adminApi.listLogs()
            setLogs(data || [])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    return (
        <div className="p-4">
            <h2 className="text-xl mb-3">管理操作审计</h2>
            {loading ? (
                <div>加载中…</div>
            ) : (
                <table className="w-full table-auto admin-logs-table">
                    <thead>
                        <tr>
                            <th>id</th>
                            <th className="cell--nowrap">管理员</th>
                            <th className="cell--nowrap">操作</th>
                            <th>目标</th>
                            <th>时间</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((l) => (
                            <tr key={l.id}>
                                <td>{l.id}</td>
                                <td className="cell--nowrap">{l.adminId}</td>
                                <td className="cell--nowrap">{formatAction(l.action)}</td>
                                <td>{l.targetType}:{l.targetId}</td>
                                <td>{new Date(l.createdAt).toLocaleString()}</td>
                                <td>{formatDescription(l.action, l.payload)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

function formatAction(action: string) {
    switch (action) {
        case 'ban_user': return '封禁用户'
        case 'unban_user': return '解封用户'
        case 'update_user_role': return '修改用户角色'
        case 'remove_post': return '删除帖子'
        case 'restore_post': return '恢复帖子'
        case 'forbidden_self_action': return '禁止的自我操作'
        default: return action
    }
}

function formatDescription(action: string, payload: any) {
    payload = payload || {}
    switch (action) {
        case 'ban_user': {
            const days = payload.days
            const reason = payload.reason
            const when = days ? `封禁 ${days} 天` : '永久封禁'
            return reason ? `${when}（原因：${reason}）` : when
        }
        case 'unban_user': return '解除封禁'
        case 'update_user_role': return payload.newRole ? `变更为 ${payload.newRole}` : '变更角色'
        case 'remove_post': return '管理员删除了帖子'
        case 'restore_post': return '管理员恢复了帖子'
        case 'forbidden_self_action': return payload.op ? `尝试执行被禁止的自我操作：${payload.op}` : '尝试执行被禁止的自我操作'
        default:
            try {
                const s = JSON.stringify(payload)
                return s === '{}' ? '-' : s
            } catch (e) {
                return '-'
            }
    }
}
