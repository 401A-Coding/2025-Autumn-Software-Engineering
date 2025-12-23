import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import http from '../../lib/http'
import './auth.css'

export default function ForgotPassword() {
    const [phone, setPhone] = useState('')
    const [requestId, setRequestId] = useState<string | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState<string | null>(null)
    const navigate = useNavigate()

    const handleRequest = async () => {
        setMsg(null)
        setLoading(true)
        try {
            const res = await http.post('/api/v1/auth/request-reset', { phone })
            const data = res.data as any
            if (data?.requestId) {
                setRequestId(data.requestId)
                setMsg('已发送重置令牌（开发模式），请输入新密码')
            } else {
                setMsg('若手机号存在，已发送重置指令，请留意。')
            }
        } catch (e: any) {
            const resp = e?.response?.data
            if (resp && resp.message) {
                // Global exception filter returns { code, message, data }
                if (resp.data && resp.data.details) setMsg(String(resp.data.details.join('; ')))
                else setMsg(String(resp.message))
            } else {
                setMsg(e?.message || '请求失败')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        if (!requestId) return setMsg('请先发送重置请求')
        if (newPassword.length < 6) return setMsg('密码至少 6 位')
        if (newPassword !== confirm) return setMsg('两次输入的密码不一致')
        setLoading(true); setMsg(null)
        try {
            await http.post('/api/v1/auth/reset', { phone, requestId, newPassword })
            alert('密码已重置，请使用新密码登录')
            navigate('/login')
        } catch (e: any) {
            const resp = e?.response?.data
            if (resp && resp.message) {
                if (resp.data && resp.data.details) setMsg(String(resp.data.details.join('; ')))
                else setMsg(String(resp.message))
            } else {
                setMsg(e?.message || '重置失败')
            }
        } finally { setLoading(false) }
    }

    return (
        <div className="auth-container">
            <div className="paper-card auth-card">
                <h2 className="auth-title">找回密码</h2>
                <div className="auth-form">
                    <label>
                        手机号
                        <input className="auth-input" value={phone} onChange={e => setPhone(e.target.value.trim())} placeholder="请输入手机号" />
                    </label>
                    {!requestId && (
                        <div className="row-between" style={{ marginTop: 8 }}>
                            <button className="btn-ghost" onClick={handleRequest} disabled={loading || !phone}>发送重置令牌</button>
                        </div>
                    )}

                    {requestId && (
                        <>
                            <label className="auth-label">
                                新密码
                                <input className="auth-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 6 位" />
                            </label>
                            <label className="auth-label">
                                确认新密码
                                <input className="auth-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="请再次输入密码" />
                            </label>
                            <div className="row-between" style={{ marginTop: 8 }}>
                                <button className="btn-ghost" onClick={() => { setRequestId(null); setMsg(null); }}>重新发送</button>
                                <button className="btn-primary" onClick={handleReset} disabled={loading}>{loading ? '请稍候…' : '重置密码'}</button>
                            </div>
                        </>
                    )}

                    {msg && <div className="auth-error" style={{ marginTop: 8 }}>{msg}</div>}
                </div>
            </div>
        </div>
    )
}
