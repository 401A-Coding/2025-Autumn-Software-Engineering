import Board from '../../features/chess/Board'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import type { MoveRecord, ChessRecord } from '../../features/records/types'

export default function LocalPlay() {
    const navigate = useNavigate()
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [moves, setMoves] = useState<MoveRecord[]>([])
    const [startedAt] = useState<string>(new Date().toISOString())

    function handleExitClick() {
        setShowExitConfirm(true)
    }

    function handleCancel() {
        setShowExitConfirm(false)
    }

    function handleExitWithoutSave() {
        // 仅 UI：不保存直接退出
        navigate('/app/home')
    }

    function persistRecord(result?: 'red' | 'black' | 'draw') {
        const rec: Omit<ChessRecord, 'id'> = {
            startedAt,
            endedAt: new Date().toISOString(),
            opponent: '本地',
            result,
            keyTags: [],
            favorite: false,
            moves,
            bookmarks: [],
            notes: [],
        }
        recordStore.saveNew(rec)
    }

    function handleSaveAndExit() {
        persistRecord(undefined)
        navigate('/app/home')
    }
    return (
        <div>
            <div className="row-between mb-8">
                <button className="btn-ghost" onClick={handleExitClick}>退出对局</button>
            </div>
            <Board
                onMove={(m) => setMoves((prev) => [...prev, m])}
                onGameOver={(result) => {
                    // 自动保存
                    persistRecord(result || undefined)
                }}
            />

            {/* TODO: 保存棋局功能 - 需要后端实现 Board API */}
            <div className="tip-box">
                💡 提示：保存自定义棋局功能需要登录并调用后端 API（/api/v1/boards）
            </div>

            {showExitConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exit-title"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: 16,
                    }}
                >
                    <div
                        className="paper-card"
                        style={{
                            width: '100%',
                            maxWidth: 360,
                            padding: 16,
                            borderRadius: 10,
                            textAlign: 'left',
                        }}
                    >
                        <h4 id="exit-title" style={{ margin: '0 0 8px 0' }}>是否保存当前对局？</h4>
                        <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
                            保存后可在“历史记录”中查看与复盘。
                        </div>
                        <div className="row-between" style={{ gap: 8 }}>
                            <button className="btn-ghost" onClick={handleCancel}>取消</button>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn-ghost" onClick={handleExitWithoutSave}>不保存退出</button>
                                <button className="btn-primary" onClick={handleSaveAndExit}>保存并退出</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
