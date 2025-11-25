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
        <div className="pad-16">
            <div className="row-between mb-8">
                <button className="btn-ghost" onClick={handleExitClick}>退出对局</button>
                <div className="fw-700">本地对战</div>
                <div className="w-64" />
            </div>

            <div className="row-center">
                <div>
                    <Board
                        onMove={(m) => setMoves((prev) => [...prev, m])}
                        onGameOver={(result) => {
                            persistRecord(result || undefined)
                        }}
                    />
                </div>
            </div>

            <div className="tip-box">
                💡 提示：退出对局时可选择保存当前对局；后续将对接后端保存与记录列表。
            </div>

            {showExitConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="exit-title"
                    className="modal-mask"
                >
                    <div className="paper-card modal-card mw-360">
                        <h4 id="exit-title" className="mt-0 mb-8">是否保存当前对局？</h4>
                        <div className="muted text-14 mb-12">
                            保存后可在“历史记录”中查看与复盘。
                        </div>
                        <div className="row-between gap-8">
                            <button className="btn-ghost" onClick={handleCancel}>取消</button>
                            <div className="row-start gap-8">
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
