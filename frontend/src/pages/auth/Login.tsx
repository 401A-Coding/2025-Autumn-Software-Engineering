import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import http from '../../lib/http'
import { setTokens } from '../../lib/auth'
import type { operations } from '../../types/api'
import './auth.css'

const phoneRegex = /^1[3-9]\d{9}$/

export default function Login() {
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!phoneRegex.test(phone)) return setError('请输入合法的手机号')
        if (password.length < 6) return setError('密码至少 6 位')
        setError(null); setLoading(true)
        try {
            type LoginReq = operations['authLogin']['requestBody']['content']['application/json']
            type LoginData = operations['authLogin']['responses'][200]['content']['application/json']['data']
            const body: LoginReq = { type: 'phone', phone, password }
            const res = await http.post<LoginData>('/api/v1/auth/login', body)
            const data = res.data
            if (data?.accessToken && data?.refreshToken) setTokens(data)
            if (remember) {
                try { localStorage.setItem('rememberLogin', JSON.stringify({ phone, password })) } catch { }
            } else {
                try { localStorage.removeItem('rememberLogin') } catch { }
            }
            navigate('/app/home', { replace: true })
        } catch (e: any) {
            // 更明确的失败原因映射（避免展示技术性后端报错）
            const status: number | undefined = e?.status ?? e?.response?.status
            let msg = '登录失败'
            if (status === 401) msg = '账号或密码错误，请确认后重试'
            else if (status === 400 || status === 422) msg = '请求参数有误：请检查手机号格式与密码长度'
            else if (status === 429) msg = '请求过于频繁，请稍后再试'
            else if (typeof status === 'number' && status >= 500) msg = '服务器开小差了，请稍后再试'
            else if (!status) msg = '网络或跨域配置异常：请检查后端地址和网络连接'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        try {
            const raw = localStorage.getItem('rememberLogin')
            if (raw) {
                const obj = JSON.parse(raw)
                if (obj?.phone) setPhone(obj.phone)
                if (obj?.password) setPassword(obj.password)
                setRemember(true)
            }
        } catch {
            // ignore
        }
    }, [])

    return (
        <div className="auth-container">
            <div className="paper-card auth-card">
                <h2 className="auth-title">登录</h2>
                <form onSubmit={onSubmit} className="auth-form">
                    <label>
                        手机号
                        <input
                            className="auth-input"
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value.trim())}
                            placeholder="请输入手机号"
                            maxLength={11}
                        />
                    </label>
                    <label className="auth-label">
                        密码
                        <input
                            className="auth-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="至少 6 位"
                        />
                    </label>
                    <div className="row-between" style={{ alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                            记住密码
                        </label>
                        <Link to="/forgot-password" className="muted">忘记密码？</Link>
                    </div>
                    {error && <div className="auth-error">{error}</div>}
                    <button type="submit" disabled={loading} className="btn-primary auth-submit">
                        {loading ? '请稍候…' : '登录'}
                    </button>
                </form>
                <div className="auth-bottom">
                    没有账号？<Link to="/register">去注册</Link>
                </div>
            </div>
        </div>
    )
}
