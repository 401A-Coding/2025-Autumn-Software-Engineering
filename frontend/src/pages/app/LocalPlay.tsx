import Board from '../../features/chess/Board'
import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './app-pages.css'
import { recordStore } from '../../features/records/recordStore'
import type { MoveRecord, ChessRecord } from '../../features/records/types'

export default function LocalPlay() {
    const navigate = useNavigate()
    const location = useLocation() as any
    const injectedInitialBoard = location.state?.initialBoard
    const injectedInitialTurn = (location.state?.turn as ('red' | 'black' | undefined))
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [moves, setMoves] = useState<MoveRecord[]>([])
    const [startedAt] = useState<string>(new Date().toISOString())
    const [saving, setSaving] = useState(false)

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

    async function persistRecord(result?: 'red' | 'black' | 'draw'): Promise<boolean> {
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
        // 如果是从残局/自定义进入的本地对战，附带初始布局，供后续复盘正确还原开局
        if (injectedInitialBoard) {
            const pieces: any[] = []
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 9; x++) {
                    const p: any = injectedInitialBoard[y]?.[x]
                    if (p) pieces.push({ type: p.type, side: p.side, x, y })
                }
            }
            ; (rec as any).initialLayout = { pieces, turn: injectedInitialTurn ?? 'red' }
        }
        setSaving(true)
        try {
            const res = await recordStore.saveNew(rec)
            if (!res.savedToServer) {
                // server 保存失败（例如未登录或网络异常），提醒用户但已本地保存
                // 这里使用简单 alert 提示，UI 后续可替换为更友好的通知组件
                alert('对局已保存在本地，未能同步到服务器（未登录或网络问题）。')
            }
            return res.savedToServer
        } catch (e) {
            console.error('保存对局到后端/本地失败：', e)
            return false
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveAndExit() {
        // 即便保存失败也应导航退出，不让用户被卡住
        try {
            await persistRecord(undefined)
        } catch (e) {
            // persistRecord 内部已捕获错误，但保底处理
            console.error(e)
        }
        // 跳转到历史页面，用户可立即查看刚保存的对局
        navigate('/app/history')
    }
    return (
        <div className="pad-16 local-play">
            <div className="row-center">
                <div>
                    <div className="row-between mb-8">
                        <button className="btn-ghost" onClick={handleExitClick}>退出对局</button>
                        <div className="fw-700">本地对战</div>
                        <div className="w-64" />
                    </div>

                    <Board
                        initialBoard={injectedInitialBoard}
                        initialTurn={injectedInitialTurn}
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
                                <button className="btn-primary" onClick={handleSaveAndExit} disabled={saving}>{saving ? '保存中...' : '保存并退出'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
