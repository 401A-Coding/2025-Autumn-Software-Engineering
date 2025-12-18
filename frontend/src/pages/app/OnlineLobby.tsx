import { useNavigate } from 'react-router-dom'
import './app-pages.css'

export default function OnlineLobby() {
    const navigate = useNavigate()
    return (
        <section className="paper-card card-pad text-center">
            <div style={{ position: 'relative', paddingBottom: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/app')} style={{ position: 'absolute', left: 0, top: 0 }}>
                    返回
                </button>
                <h2 className="mt-0" style={{ margin: 0 }}>在线对战</h2>
            </div>
            <div className="muted text-14 mb-12">请选择开始方式</div>
            <div className="col gap-12">
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=create')}>创建房间</button>
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=join')}>加入房间</button>
                <button className="btn-ghost" onClick={() => navigate('/app/live-battle?action=match')}>快速匹配</button>
            </div>
            <div className="mt-16">
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>返回主页</button>
            </div>
        </section>
    )
}
