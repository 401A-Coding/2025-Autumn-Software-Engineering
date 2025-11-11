import Board from '../../features/chess/Board'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './app-pages.css'

export default function LocalPlay() {
    const navigate = useNavigate()
    const [showExitConfirm, setShowExitConfirm] = useState(false)

    function handleExitClick() {
        setShowExitConfirm(true)
    }

    function handleDoNotSave() {
        setShowExitConfirm(false)
        navigate('/app/home')
    }

    function handleSave() {
        // 仅 UI：此处将来对接保存 API
        setShowExitConfirm(false)
        // 可替换为实际保存逻辑
        // eslint-disable-next-line no-alert
        alert('已保存（仅UI占位）')
        navigate('/app/home')
    }

    return (
        <div>
            <div className="row-between mb-8">
                <button className="btn-ghost" onClick={handleExitClick}>退出对局</button>
            </div>
            <Board />

            {/* TODO: 保存棋局功能 - 需要后端实现保存 API */}
            <div className="tip-box">
                💡 提示：退出对局时可选择保存当前对局；后续将对接后端保存与记录列表。
            </div>

            {showExitConfirm && (
                <div className="gameover-mask">
                    <div className="paper-card gameover-card">
                        <div className="gameover-title">是否保存当前对局？</div>
                        <div className="gameover-actions">
                            <button className="btn-ghost btn-wide" onClick={handleDoNotSave}>不保存</button>
                            <button className="btn-primary btn-wide" onClick={handleSave}>保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
