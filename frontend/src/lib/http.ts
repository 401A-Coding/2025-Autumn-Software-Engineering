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
            return Promise.reject(new Error(env.message || '请求失败'))
        }
        return response
    },
    async (error: AxiosError) => {
        const response = error.response
        const original = (error.config || {}) as AxiosRequestConfig & { _retry?: boolean }
        if (response?.status === 401 && !original._retry) {
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
        return Promise.reject(error)
    },
)

export default http
