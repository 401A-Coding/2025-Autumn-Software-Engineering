import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const phoneRegex = /^1[3-9]\d{9}$/
const base = import.meta.env.VITE_API_BASE || ''

export default function Login() {
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phoneRegex.test(phone)) return setError('请输入合法的手机号')
        if (password.length < 6) return setError('密码至少 6 位')
        setError(null); setLoading(true)
        try {
            const res = await fetch(`${base}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'phone', phone, password }),
            })
            if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
            const json = await res.json().catch(() => ({}))
            const data = json?.data || json
            if (data?.accessToken) localStorage.setItem('token', data.accessToken)
            navigate('/app/home', { replace: true })
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : '登录失败'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: 420, margin: '32px auto', padding: 16 }}>
            <div className="paper-card" style={{ padding: 20 }}>
                <h2 style={{ textAlign: 'center', marginTop: 0 }}>登录</h2>
                <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
                    <label>手机号
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.trim())}
                            placeholder="请输入手机号" style={{ width: '100%', padding: 8, marginTop: 6 }} maxLength={11} />
                    </label>
                    <label style={{ display: 'block', marginTop: 12 }}>密码
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="至少 6 位" style={{ width: '100%', padding: 8, marginTop: 6 }} />
                    </label>
                    {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
                    <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: 12 }}>
                        {loading ? '请稍候…' : '登录'}
                    </button>
                </form>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    没有账号？<Link to="/register">去注册</Link>
                </div>
            </div>
        </div>
    )
}
