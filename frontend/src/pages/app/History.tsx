export default function History() {
    return (
        <div>
            <section className="paper-card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>对局记录</h3>
                <div style={{
                    border: '1px dashed var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    color: 'var(--muted)'
                }}>
                    暂无记录
                </div>
            </section>
        </div>
    );
}
