import './app-pages.css'

export default function Home() {
    return (
        <div>
            <section className="paper-card card-pad">
                <h3 className="mt-0">本地对战</h3>
                <p className="muted mt-6">与身边的朋友在同一设备上对弈。</p>
                <a className="btn-primary inline-block mt-8" href="/app/play">
                    开始对战
                </a>
            </section>

            <section className="paper-card" style={{ padding: 16, marginTop: 12 }}>
                <h3 className="mt-0">🎮 自定义棋局</h3>
                <p className="muted mt-6">自定义棋子规则，创造属于你的象棋玩法！</p>
                <div className="row-start gap-8 mt-12" style={{ justifyContent: 'center' }}>
                    <a className="btn-primary inline-block" href="/app/visual-editor">
                        🎨 可视化编辑器
                    </a>
                </div>
            </section>

            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0">在线对战</h3>
                <p className="muted mt-6">通过网络与其他玩家实时对弈（演示版）。</p>
                <a className="btn-primary inline-block mt-8" href="/app/online-lobby">
                    进入在线对战
                </a>
            </section>

            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0">精选推荐</h3>
                <ul className="list-muted">
                    <li>残局闯关（敬请期待）</li>
                    <li>限时快棋（敬请期待）</li>
                    <li>趣味挑战（敬请期待）</li>
                </ul>
            </section>
        </div>
    );
}
