import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { boardApi } from '../../services/api'
import './app-pages.css'

export default function EndgameSaved() {
    const [boards, setBoards] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectMode, setSelectMode] = useState(false)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const nav = useNavigate()

    useEffect(() => {
        (async () => {
            try {
                const templates = await boardApi.getTemplates()
                setBoards(Array.isArray(templates) ? templates : [])
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    async function handleBatchDelete() {
        if (!selectedIds.length) return
        const ok = window.confirm(`确定删除选中的 ${selectedIds.length} 个残局模板？此操作无法撤销`)
        if (!ok) return
        try {
            // 简单串行删除，后续可优化并发
            for (const id of selectedIds) {
                await boardApi.delete(id)
            }
            setBoards(prev => prev.filter(b => !selectedIds.includes(b.id)))
            setSelectedIds([])
            setSelectMode(false)
        } catch (e) {
            alert('批量删除失败，请稍后再试或检查登录状态')
            console.error('批量删除模板失败', e)
        }
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    function selectAll() {
        setSelectedIds(boards.map(b => b.id))
    }

    function clearSelection() {
        setSelectedIds([])
    }

    return (
        <section className="paper-card card-pad">
            <h2 className="mt-0">保存的残局（模板）</h2>
            <div className="row-start gap-8 mt-8">
                <button className={selectMode ? 'btn-primary' : 'btn-ghost'} onClick={() => setSelectMode(m => !m)}>{selectMode ? '退出选择' : '批量选择'}</button>
                {selectMode && (
                    <>
                        <button className="btn-ghost" onClick={selectAll}>全选</button>
                        <button className="btn-ghost" onClick={clearSelection}>清空选择</button>
                        <button className="btn-danger" disabled={!selectedIds.length} onClick={handleBatchDelete}>删除所选（{selectedIds.length}）</button>
                    </>
                )}
            </div>
            {loading ? (
                <div className="empty-box">加载中…</div>
            ) : !boards.length ? (
                <div className="empty-box">暂无保存的残局</div>
            ) : (
                <div className="col gap-8 mt-12">
                    {boards.map((b) => (
                        <div key={b.id} className="paper-card pad-8 row-between" style={{ textAlign: 'left' }}>
                            <div className="row-start gap-8 align-center">
                                {selectMode && (
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(b.id)}
                                        onChange={() => toggleSelect(b.id)}
                                        aria-label={`选择模板 ${b.name || b.id}`}
                                    />
                                )}
                                <button
                                    className="btn-ghost"
                                    onClick={() => nav('/app/endgame/setup', { state: { layout: b.layout, name: b.name } })}
                                    title="打开并编辑该残局"
                                >
                                    <div>
                                        <div className="fw-600">{b.name || `残局 #${b.id}`}</div>
                                        <div className="muted text-13">{new Date(b.updatedAt || b.createdAt).toLocaleString()}</div>
                                    </div>
                                </button>
                            </div>
                            <div className="row-start gap-8">
                                <button
                                    className="btn-ghost"
                                    onClick={() => nav('/app/endgame/setup', { state: { layout: b.layout, name: b.name } })}
                                >打开</button>
                                <button
                                    className="btn-ghost"
                                    title="以该残局模板创建好友房，邀请在线对战"
                                    onClick={() => {
                                        if (!b.id) return
                                        nav(`/app/live-battle?action=create&initialBoardId=${b.id}`)
                                    }}
                                >邀请对战</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
