import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { userApi } from '../services/api'

export default function AdminRoute() {
    const location = useLocation()
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const [allowed, setAllowed] = useState<boolean | null>(null)

    useEffect(() => {
        if (!token) {
            setAllowed(false)
            return
        }
        let mounted = true
        userApi.getMe().then(u => {
            if (!mounted) return
            setAllowed(u?.role === 'ADMIN')
        }).catch(() => {
            if (!mounted) return
            setAllowed(false)
        })
        return () => { mounted = false }
    }, [token])

    if (!token) return <Navigate to="/login" replace state={{ from: location }} />
    if (allowed === null) return null
    if (!allowed) return <Navigate to="/app/home" replace />
    return <Outlet />
}
