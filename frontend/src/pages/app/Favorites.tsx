import { useNavigate } from 'react-router-dom'
import Segmented from '../../components/Segmented'
import './app-pages.css'

export default function Favorites() {
    const navigate = useNavigate()
    return (
        <div>
            <div className="row-between mb-8">
                <h3 className="mt-0">收藏对局</h3>
                <Segmented
                    labels={["记录", "收藏"]}
                    activeIndex={1}
                    onChange={(i) => navigate(i === 0 ? '/app/history' : '/app/favorites')}
                />
            </div>

            <section className="paper-card card-pad">
                <div className="empty-box">暂无收藏</div>
            </section>
        </div>
    )
}
