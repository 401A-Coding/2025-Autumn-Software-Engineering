/// <reference types="vite/client" />
import axios from 'axios'
import type { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, redirectToLogin, setTokens } from './auth'
import type { operations } from '../types/api'

const baseURL: string = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

const http: AxiosInstance = axios.create({ baseURL })

// Attach Authorization header
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken()
    if (token) {
        config.headers = config.headers ?? {}
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

let refreshing: Promise<void> | null = null

async function runRefreshOnce() {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('NO_REFRESH_TOKEN')
    type RefreshReq = operations['authRefresh']['requestBody']['content']['application/json']
    type RefreshEnvelope = operations['authRefresh']['responses'][200]['content']['application/json']
    const body: RefreshReq = { refreshToken }
    const res: AxiosResponse<RefreshEnvelope> = await axios.post(`${baseURL}/api/v1/auth/refresh`, body)
    const data = (res?.data as RefreshEnvelope)?.data || (res?.data as unknown)
    if (!data?.accessToken || !data?.refreshToken) throw new Error('BAD_REFRESH_RESPONSE')
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn })
}

// Unwrap unified envelope and handle 401 auto-refresh
http.interceptors.response.use(
    (response: AxiosResponse) => {
        const payload: unknown = response.data
        if (payload && typeof payload === 'object' && 'code' in (payload as Record<string, unknown>)) {
            const env = payload as { code: number; message?: string; data?: unknown }
            if (env.code === 0) {
                (response as AxiosResponse).data = env.data as unknown
                return response
            }
            const err: any = new Error(env.message || '请求失败')
            err.status = response.status
            err.code = env.code
            err.serverMessage = env.message
            err.envelope = env
            return Promise.reject(err)
        }
        return response
    },
    async (error: AxiosError) => {
        const response = error.response
        const original = (error.config || {}) as AxiosRequestConfig & { _retry?: boolean }
        const url = String(original?.url || '')
        const isAuthEndpoint = /\/api\/v1\/auth\/(login|register|sms|reset|request-reset)/.test(url)
        // 401 自动刷新仅在非认证端点触发，避免登录/注册时被强制重定向导致错误提示一闪而过
        if (response?.status === 401 && !original._retry && !isAuthEndpoint) {
            original._retry = true
            try {
                if (!refreshing) refreshing = runRefreshOnce().finally(() => { refreshing = null })
                await refreshing
                const token = getAccessToken()
                original.headers = original.headers ?? {}
                if (token) (original.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
                return http(original)
            } catch (e) {
                clearTokens()
                redirectToLogin()
                return Promise.reject(e)
            }
        }
        const norm: any = error
        norm.status = response?.status
        // Try to extract server-provided code/message from envelope or raw error body
        try {
            const data: any = response?.data
            if (data && typeof data === 'object') {
                // If the backend returned the unified envelope even for error cases
                if ('code' in data) norm.code = (data as any).code
                if ('message' in data) {
                    const m = (data as any).message
                    norm.serverMessage = Array.isArray(m) ? m.join('；') : m
                }
                if ('error' in data) norm.serverMessage = ((data as any).error?.message) || norm.serverMessage
                // Extract detailed validation messages for 400 from envelope data.details
                const envData = (data as any).data
                if (envData && typeof envData === 'object' && Array.isArray(envData.details)) {
                    const details = (envData.details as unknown[]).filter((d): d is string => typeof d === 'string')
                    if (details.length) {
                        norm.serverMessage = details.join('；')
                    }
                }
            } else if (typeof data === 'string') {
                norm.serverMessage = data
            }
        } catch { }
        return Promise.reject(norm)
    },
)

export default http
