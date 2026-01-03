import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { battleApi } from '../../services/api'
import './app-pages.css'

export default function OnlineLobby() {
    const navigate = useNavigate()
    const PERSIST_KEY = 'livebattle.activeBattleId'
    const [resumeInfo, setResumeInfo] = useState<{ battleId: number; source?: string; status?: string } | null>(null)
    const [resumeLoading, setResumeLoading] = useState(false)

    const clearPersistBattleId = () => {
        try { localStorage.removeItem(PERSIST_KEY) } catch { /* ignore */ }
    }

    // 检测本地是否有未完成对局，提供“继续对局”入口
    useEffect(() => {
        const saved = (() => {
            try { return localStorage.getItem(PERSIST_KEY) } catch { return null }
        })()
        if (!saved) return
        const id = Number(saved)
        if (!id) {
            clearPersistBattleId()
            return
        }
        let alive = true
        setResumeLoading(true)
            ; (async () => {
                try {
                    const snap = await battleApi.snapshot(id)
                    if (!alive) return
                    if ((snap as any)?.status === 'finished') {
                        clearPersistBattleId()
                        setResumeInfo(null)
                        return
                    }
                    setResumeInfo({ battleId: id, source: (snap as any)?.source, status: (snap as any)?.status })
                } catch (e) {
                    console.error('[OnlineLobby] fetch resume snapshot failed', e)
                    clearPersistBattleId()
                    if (alive) setResumeInfo(null)
                } finally {
                    if (alive) setResumeLoading(false)
                }
            })()
        return () => { alive = false }
    }, [])

    return (
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '16px 0' }}>
            <div style={{ position: 'relative', paddingBottom: 8 }}>
                <button className="btn-ghost" onClick={() => navigate('/app')} style={{ position: 'absolute', left: 0, top: 0 }}>
                    返回
                </button>
                <h2 className="mt-0" style={{ margin: 0, textAlign: 'center' }}>在线对战</h2>
            </div>
            <div className="muted text-14 mb-16" style={{ textAlign: 'center' }}>请选择对战方式</div>
            <div className="col gap-16">
                {resumeLoading && (
                    <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                        <div className="fw-700 mb-4">检查未完成对局…</div>
                        <div className="muted text-13">正在读取上次对局信息</div>
                    </section>
                )}
                {!resumeLoading && resumeInfo && (
                    <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                        <div className="fw-700 mb-4">继续未完成对局</div>
                        <div className="muted text-13 mb-8">
                            房间号 {resumeInfo.battleId} · {resumeInfo.source === 'match' ? '快速匹配' : '好友房'} · {resumeInfo.status === 'playing' ? '对局中' : '等待中'}
                        </div>
                        <div className="row gap-8" style={{ justifyContent: 'center' }}>
                            <button className="btn-primary" onClick={() => navigate('/app/live-battle')}>继续对局</button>
                            <button
                                className="btn-ghost"
                                onClick={async () => {
                                    if (!resumeInfo) return
                                    try {
                                        // 若处于等待房间，走 leave；对局中则认输结算，保证对手收到提示且生成战绩
                                        if (resumeInfo.status === 'waiting') {
                                            await battleApi.leave(resumeInfo.battleId)
                                        } else {
                                            await battleApi.resign(resumeInfo.battleId)
                                        }
                                    } catch (e) {
                                        console.error('[OnlineLobby] give up battle failed', e)
                                        // 即使失败也清理本地，避免卡死
                                    }
                                    clearPersistBattleId()
                                    setResumeInfo(null)
                                }}
                            >
                                放弃本局
                            </button>
                        </div>
                    </section>
                )}
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">创建房间</div>
                    <div className="muted text-13 mb-8">将创建一个房间，可通过房间号邀请好友对战</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=create')}>创建房间</button>
                </section>
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">加入房间</div>
                    <div className="muted text-13 mb-8">输入好友提供的房间号，加入对方房间进行对战</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=join')}>加入房间</button>
                </section>
                <section className="paper-card card-pad" style={{ textAlign: 'center' }}>
                    <div className="fw-700 mb-4">快速匹配</div>
                    <div className="muted text-13 mb-8">系统将自动为你匹配一位在线玩家，立即开局</div>
                    <button className="btn-primary w-100" onClick={() => navigate('/app/live-battle?action=match')}>快速匹配</button>
                </section>
            </div>
        </div>
    )
}
