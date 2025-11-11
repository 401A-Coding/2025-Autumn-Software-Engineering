import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import http from '../../lib/http'
import type { operations } from '../../types/api'
import './auth.css'

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
            type RegisterReq = operations['authRegister']['requestBody']['content']['application/json']
            type RegisterData = operations['authRegister']['responses'][200]['content']['application/json']['data']
            const body: RegisterReq = { type: 'phone', phone, password }
            // 响应 data 为 AuthTokens，但此处不直接使用，仅作类型校验
            await http.post<RegisterData>('/api/v1/auth/register', body)
            navigate('/login', { replace: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '注册失败'
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="paper-card auth-card">
                <h2 className="auth-title">注册</h2>
                <form onSubmit={onSubmit} className="auth-form auth-form--register">
                    <label>
                        手机号
                        <input
                            className="auth-input"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="请输入手机号"
                            required
                        />
                    </label>
                    <label>
                        密码
                        <input
                            className="auth-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            required
                        />
                    </label>
                    <button type="submit" disabled={loading} className="btn-primary auth-submit">
                        {loading ? '注册中…' : '注册'}
                    </button>
                </form>
                {error && <p className="auth-error">错误：{error}</p>}
                <p className="auth-bottom">
                    已有账号？<Link to="/login">去登录</Link>
                </p>
            </div>
        </div>
    );
}
