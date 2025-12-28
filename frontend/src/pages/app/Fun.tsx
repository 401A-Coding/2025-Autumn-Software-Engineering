import './app-pages.css'

export default function Fun() {
    return (
        <div>
            <section className="paper-card card-pad">
                <h3 className="mt-0">🎮 自定义棋局</h3>
                <p className="muted mt-6">自定义棋子规则，创造属于你的象棋玩法！</p>
                <div className="row-start gap-8 mt-12 justify-center">
                    <a className="btn-primary inline-block" href="/app/visual-editor">
                        🎨 可视化编辑器
                    </a>
                    <a className="btn-secondary inline-block" href="/app/custom-online-lobby">
                        ⚔️ 自定义在线对战
                    </a>
                </div>
            </section>

            <section className="paper-card card-pad mt-12">
                <h3 className="mt-0">娱乐玩法</h3>
                <p className="muted">更多趣味模式敬请期待。</p>
                <ul className="list-muted mt-8">
                    <li>残局闯关</li>
                    <li>限时快棋</li>
                    <li>趣味挑战</li>
                </ul>
            </section>
        </div>
    );
}
