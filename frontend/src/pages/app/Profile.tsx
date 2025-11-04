import { logout } from '../../lib/session'
import './app-pages.css'

export default function Profile() {

    const onLogout = async () => {
        await logout();
    };

    return (
        <div>
            <section className="paper-card card-pad">
                <h3 className="mt-0">个人信息</h3>
                <p className="muted">调试中：此处展示用户信息（待接入）。</p>
                <button className="btn-ghost mt-8" onClick={onLogout}>退出登录</button>
            </section>
        </div>
    );
}
