export default function Home() {
    return (
        <div>
            <section className="paper-card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>本地对战</h3>
                <p style={{ color: 'var(--muted)', marginTop: 6 }}>与身边的朋友在同一设备上对弈。</p>
                <a className="btn-primary" style={{ display: 'inline-block', marginTop: 8 }} href="/app/play">
                    开始对战
                </a>
            </section>

            <section className="paper-card" style={{ padding: 16, marginTop: 12 }}>
                <h3 style={{ marginTop: 0 }}>精选推荐</h3>
                <ul style={{ margin: 6, paddingLeft: 18, color: 'var(--muted)' }}>
                    <li>残局闯关（敬请期待）</li>
                    <li>限时快棋（敬请期待）</li>
                    <li>趣味挑战（敬请期待）</li>
                </ul>
            </section>
        </div>
    );
}
