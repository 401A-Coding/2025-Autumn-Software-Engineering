import { Link, useNavigate } from 'react-router-dom'
import EndgameSaved from './EndgameSaved'
import './app-pages.css'

export default function EndgameHome() {
    const nav = useNavigate()
    return (
        <div>
            <div className="row align-center mb-12">
                <button className="btn-ghost" onClick={() => nav('/app')}>← 返回</button>
                <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>残局对战</h2>
                <div style={{ width: 64 }} />
            </div>
            <section className="paper-card card-pad">
                <div className="row-start gap-12 mt-12">
                    <Link to="/app/endgame/setup" className="btn-primary" title="从零或导出局面来布置残局">布置残局</Link>
                    <button
                        className="btn-primary"
                        title="前往加入好友房页面"
                        onClick={() => {
                            // 直接跳转到在线对战页面的加入模式，不弹窗
                            nav('/app/live-battle?action=join')
                        }}
                    >加入好友房</button>
                </div>
                <div className="note-muted mt-16 text-14">从复盘中任意一步可“残局导出”并跳转到这里进行本地推演。</div>

                <div className="mt-16">
                    <EndgameSaved />
                </div>
            </section>
        </div>
    )
}
