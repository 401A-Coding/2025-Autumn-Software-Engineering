export type Tokens = {
    accessToken: string
    refreshToken: string
    expiresIn?: number
}

const ACCESS_KEY = 'token'
const REFRESH_KEY = 'refreshToken'

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(tokens: Tokens) {
    if (typeof window === 'undefined') return
    localStorage.setItem(ACCESS_KEY, tokens.accessToken)
    if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
}

export function clearTokens() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
}

export function redirectToLogin() {
    if (typeof window !== 'undefined') {
        window.location.href = '/login'
    }
}
