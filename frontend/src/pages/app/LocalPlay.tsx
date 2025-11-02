import Board from '../../features/chess/Board'
import { useNavigate } from 'react-router-dom'

export default function LocalPlay() {
    const navigate = useNavigate()
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/app/home')}>退出对局</button>
            </div>
            <Board />
        </div>
    )
}
