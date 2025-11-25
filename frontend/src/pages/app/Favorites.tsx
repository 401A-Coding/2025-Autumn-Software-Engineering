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
                    options={[{ label: '记录', value: 'history' }, { label: '收藏', value: 'favorites' }]}
                    value={'favorites'}
                    onChange={(v) => navigate(v === 'history' ? '/app/history' : '/app/favorites')}
                />
            </div>

            <section className="paper-card card-pad">
                <div className="empty-box">暂无收藏</div>
            </section>
        </div>
    )
}
