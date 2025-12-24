import { useNavigate } from 'react-router-dom'
import './app-pages.css'

export default function OnlineLobby() {
    const navigate = useNavigate()
    return (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '16px 0' }}>
            <div style={{ position: 'relative', paddingBottom: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/app')} style={{ position: 'absolute', left: 0, top: 0 }}>
                    返回
                </button>
                <h2 className="mt-0" style={{ margin: 0, textAlign: 'center' }}>在线对战</h2>
            </div>
            <div className="muted text-14 mb-16" style={{ textAlign: 'center' }}>请选择对战方式</div>
            <div className="col gap-16">
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">创建房间</div>
                    <div className="muted text-13 mb-8">将创建一个房间，可通过房间号邀请好友对战</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=create')}>创建房间</button>
                </section>
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">加入房间</div>
                    <div className="muted text-13 mb-8">输入好友提供的房间号，加入对方房间进行对战</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=join')}>加入房间</button>
                </section>
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">快速匹配</div>
                    <div className="muted text-13 mb-8">系统将自动为你匹配一位在线玩家，立即开局</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=match')}>快速匹配</button>
                </section>
            </div>
        </div>
    )
}
