import { Link, useNavigate } from 'react-router-dom'
import EndgameSaved from './EndgameSaved'
import './app-pages.css'

export default function EndgameHome() {
    const nav = useNavigate()
    return (
        <section className="paper-card card-pad">
            <h2 className="mt-0">残局对战</h2>
            <div className="row-start gap-12 mt-12">
                <Link to="/app/endgame/setup" className="btn-primary" title="从零或导出局面来布置残局">布置残局</Link>
                <button
                    className="btn-primary"
                    title="输入好友房房间号加入残局对战"
                    onClick={() => {
                        const rid = window.prompt('输入好友房房间号：')
                        if (!rid) return
                        const num = Number(rid)
                        if (!Number.isFinite(num) || num <= 0) { alert('房间号不合法'); return }
                        // 跳转到在线对战页，标记为残局房
                        nav('/app/live-battle', { state: { roomId: num, type: 'endgame' } })
                    }}
                >加入好友房</button>
            </div>
            <div className="note-muted mt-16 text-14">从复盘中任意一步可“残局导出”并跳转到这里进行本地推演。</div>

            <div className="mt-16">
                <EndgameSaved />
            </div>
        </section>
    )
}
