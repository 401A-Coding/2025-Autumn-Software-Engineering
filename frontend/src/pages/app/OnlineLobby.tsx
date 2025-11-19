import { useNavigate } from 'react-router-dom'
import './app-pages.css'

export default function OnlineLobby() {
    const navigate = useNavigate()
    return (
        <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
            <h2 className="mt-0">在线对战</h2>
            <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>请选择开始方式</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=create')}>创建房间</button>
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=join')}>加入房间</button>
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=match')}>快速匹配</button>
            </div>
            <div style={{ marginTop: 16 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>返回主页</button>
            </div>
        </section>
    )
}
