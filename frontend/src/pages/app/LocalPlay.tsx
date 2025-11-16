import Board from '../../features/chess/Board'
import { useNavigate } from 'react-router-dom'

export default function LocalPlay() {
    const navigate = useNavigate()
    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>← 退出对局</button>
                <div style={{ fontWeight: 700 }}>本地对战</div>
                <div style={{ width: 64 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 10, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
                    <Board />
                </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button className="btn-ghost" onClick={() => window.location.reload()}>重新开始</button>
                <button className="btn-primary" onClick={() => navigate('/app/home')}>返回首页</button>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: 'var(--muted-bg)', borderRadius: 6, fontSize: 14, color: 'var(--muted)' }}>
                💡 提示：保存自定义棋局功能需要登录并调用后端 API（/api/v1/boards）
            </div>
        </div>
    )
}
