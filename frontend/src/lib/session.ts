import http from './http'
import type { operations } from '../types/api'
import { clearTokens, redirectToLogin } from './auth'

export async function logout() {
    try {
        type LogoutData = operations['authLogout']['responses'][200]['content']['application/json']['data']
        await http.post<LogoutData>('/api/v1/auth/logout')
    } catch {
        // ignore network/server errors to keep logout idempotent
    } finally {
        clearTokens()
        redirectToLogin()
    }
}
