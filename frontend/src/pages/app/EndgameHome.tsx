import { Link } from 'react-router-dom'
import EndgameSaved from './EndgameSaved'
import './app-pages.css'

export default function EndgameHome() {
    return (
        <section className="paper-card card-pad">
            <h2 className="mt-0">残局对战</h2>
            <div className="row-start gap-12 mt-12">
                <Link to="/app/endgame/setup" className="btn-primary">布置残局</Link>
            </div>
            <div className="note-muted mt-16 text-14">从复盘中任意一步可“残局导出”并跳转到这里进行本地推演。</div>

            <div className="mt-16">
                <EndgameSaved />
            </div>
        </section>
    )
}
