import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import './admin-layout.css'

export default function AdminLayout() {
    const navigate = useNavigate()

    function handleBack() {
        // 返回主页面
        navigate('/app')
    }

    return (
        <div>
            <header className="header-bar with-safe-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-ghost" onClick={handleBack}>← 返回主页</button>
                    <div className="header-title">管理后台</div>
                </div>
            </header>

            <main className="page-container admin-page">
                <aside className="admin-sidebar">
                    {/* 搜索栏已移动到各管理页面顶部 */}

                    <NavLink to="/app/admin/users" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
                        用户管理
                    </NavLink>
                    <NavLink to="/app/admin/posts" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
                        帖子管理
                    </NavLink>
                    <NavLink to="/app/admin/logs" className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}>
                        操作日志
                    </NavLink>
                </aside>

                <section className="admin-content">
                    <Outlet />
                </section>
            </main>
        </div>
    )
}
