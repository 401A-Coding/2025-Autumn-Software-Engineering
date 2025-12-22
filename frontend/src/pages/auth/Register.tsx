import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import http from '../../lib/http'
import type { operations } from '../../types/api'
import './auth.css'

export default function Register() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const phoneRegex = /^1[3-9]\d{9}$/

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        // 基础校验
        if (!phoneRegex.test(phone)) {
            setError('请输入合法的手机号');
            return;
        }
        if ((password || '').length < 6) {
            setError('密码至少 6 位');
            return;
        }
        if (password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }
        setLoading(true);
        try {
            type RegisterReq = operations['authRegister']['requestBody']['content']['application/json']
            type RegisterData = operations['authRegister']['responses'][200]['content']['application/json']['data']
            const body: RegisterReq = { type: 'phone', phone, password }
            // 响应 data 为 AuthTokens，但此处不直接使用，仅作类型校验
            await http.post<RegisterData>('/api/v1/auth/register', body)
            navigate('/login', { replace: true });
        } catch (err: any) {
            // 将服务端/网络错误转换为明确提示
            const status: number | undefined = err?.status ?? err?.response?.status
            const serverMsg: string | undefined = err?.serverMessage
            let msg = serverMsg || err?.message || '注册失败'
            if (status === 409) msg = '该手机号已注册，请直接登录或更换手机号'
            else if (status === 400) {
                // 部分后端会用 400 表示唯一约束冲突或“已注册”
                const lower = (serverMsg || '').toLowerCase()
                if (/已注册|已存在|存在|重复|duplicate|unique|used/.test(serverMsg || '')) {
                    msg = '该手机号已注册，请直接登录或更换手机号'
                } else {
                    msg = '请求参数有误：请检查手机号格式与密码长度'
                }
            }
            else if (status === 422) msg = '请求参数有误：请检查手机号格式与密码长度'
            else if (status === 429) msg = '请求过于频繁，请稍后再试'
            else if (typeof status === 'number' && status >= 500) msg = '服务器开小差了，请稍后再试'
            else if (!status) msg = '网络或跨域配置异常：请检查后端地址和网络连接'
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
                    <label>
                        确认密码
                        <input
                            className="auth-input"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="请再次输入密码"
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
