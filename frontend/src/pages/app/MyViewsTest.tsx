import { useNavigate } from 'react-router-dom'

export default function MyViewsTest() {
    const navigate = useNavigate()

    return (
        <div style={{ padding: '20px' }}>
            <h1>浏览历史测试页面</h1>
            <p>如果你看到这个页面，说明路由配置是正确的！</p>
            <button onClick={() => navigate('/app/profile')}>返回个人资料</button>
        </div>
    )
}
