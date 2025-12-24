import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { IconHome, IconFun, IconProfile, IconCommunity } from '../components/icons'
import './app-layout.css'

export default function AppLayout() {
    const location = useLocation()
    const path = location.pathname
    const showTabbar = ['/app/home', '/app/community', '/app/fun', '/app/profile'].includes(path)
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
                </nav>
            )}
        </div>
    )
}
