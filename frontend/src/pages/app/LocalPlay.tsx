import Board from '../../features/chess/Board'
import { useNavigate } from 'react-router-dom'
import './app-pages.css'

export default function LocalPlay() {
    const navigate = useNavigate()
    return (
        <div>
            <div className="row-between mb-8">
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>退出对局</button>
            </div>
            <Board />

            {/* TODO: 保存棋局功能 - 需要后端实现 Board API */}
            <div className="tip-box">
                💡 提示：保存自定义棋局功能需要登录并调用后端 API（/api/v1/boards）
            </div>
        </div>
    )
}
