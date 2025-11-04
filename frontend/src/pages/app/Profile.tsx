import { useNavigate } from 'react-router-dom';

const base = import.meta.env.VITE_API_BASE || '';

export default function Profile() {
    const navigate = useNavigate();

    const onLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Call logout API
                await fetch(`${base}/api/v1/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                }).catch(() => {
                    // Ignore network errors, proceed with local logout
                });
            }
        } finally {
            localStorage.removeItem('token');
            navigate('/login', { replace: true });
        }
    };

    return (
        <div>
            <section className="paper-card" style={{ padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>个人信息</h3>
                <p style={{ color: 'var(--muted)' }}>调试中：此处展示用户信息（待接入）。</p>
                <button className="btn-ghost" onClick={onLogout} style={{ marginTop: 8 }}>退出登录</button>
            </section>
        </div>
    );
}
