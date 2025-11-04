import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const base = import.meta.env.VITE_API_BASE || ''

export default function Register() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch(`${base}/api/v1/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'phone', phone, password }),
            });
            if (!res.ok) throw new Error('注册失败');
            navigate('/login', { replace: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '注册失败'
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 420, margin: '32px auto', padding: 16 }}>
            <div className="paper-card" style={{ padding: 20 }}>
                <h2 style={{ textAlign: 'center', marginTop: 0 }}>注册</h2>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    <label>
                        手机号
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="请输入手机号"
                            required
                            style={{ width: '100%', padding: 8, marginTop: 6 }}
                        />
                    </label>
                    <label>
                        密码
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            required
                            style={{ width: '100%', padding: 8, marginTop: 6 }}
                        />
                    </label>
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? '注册中…' : '注册'}
                    </button>
                </form>
                {error && <p style={{ color: 'red', marginTop: 12 }}>错误：{error}</p>}
                <p style={{ marginTop: 12 }}>
                    已有账号？<Link to="/login">去登录</Link>
                </p>
            </div>
        </div>
    );
}
