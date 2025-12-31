import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { IconHome, IconFun, IconProfile, IconCommunity, IconShield } from '../components/icons'
import './app-layout.css'
import { useEffect, useState } from 'react'
import { userApi } from '../services/api'

export default function AppLayout() {
    const location = useLocation()
    const path = location.pathname
    const showTabbar = ['/app/home', '/app/community', '/app/fun', '/app/profile'].includes(path)
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        let mounted = true
        userApi.getMe().then(u => {
            if (!mounted) return
            setIsAdmin(u?.role === 'ADMIN')
        }).catch(() => {
            // ignore
        })
        return () => { mounted = false }
    }, [])

    return (
        <div>
            <header className="header-bar with-safe-area">
                <div className="header-title">趣玩象棋</div>
            </header>

            <main className={"page-container" + (showTabbar ? '' : ' no-tabbar')}>
                <Outlet />
            </main>

            {showTabbar && (
                <nav className="tabbar with-safe-area">
                    <NavLink to="/app/home" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
                        <IconHome />
                        <span>主页</span>
                    </NavLink>
                    <NavLink to="/app/community" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
                        <IconCommunity />
                        <span>社区</span>
                    </NavLink>
                    <NavLink to="/app/fun" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
                        <IconFun />
                        <span>娱乐</span>
                    </NavLink>
                    <NavLink to="/app/profile" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
                        <IconProfile />
                        <span>我的</span>
                    </NavLink>
                    {isAdmin && (
                        <NavLink to="/app/admin/users" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
                            <IconShield />
                            <span>管理</span>
                        </NavLink>
                    )}
                </nav>
            )}
        </div>
    )
}
