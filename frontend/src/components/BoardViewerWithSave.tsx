/**
 * 棋盘查看器 - 带有保存为模板功能
 * 用于在社区帖子中展示棋盘残局，支持保存到个人模板库
 */
import { useState } from 'react'
import BoardViewer from '../features/chess/BoardViewer'
import { boardApi } from '../services/api'
import type { MoveRecord } from '../features/records/types'
import type { Side } from '../features/chess/types'

interface BoardViewerWithSaveProps {
    boardId?: number // 如果是从Board模板展示
    initialLayout?: { pieces?: { type: string; side: Side; x: number; y: number }[] }
    title?: string
}

export default function BoardViewerWithSave({ boardId, initialLayout, title }: BoardViewerWithSaveProps) {
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleSaveAsTemplate() {
        if (!initialLayout?.pieces) {
            alert('无有效的棋盘数据')
            return
        }

        setSaving(true)
        try {
            const newBoardName = prompt('请输入模板名称：', title || '我的残局模板')
            if (!newBoardName) {
                setSaving(false)
                return
            }

            // 创建新的棋盘模板
            await boardApi.create({
                name: newBoardName,
                description: `从社区帖子保存: ${title || '残局'}`,
                layout: initialLayout,
                rules: {}, // 使用默认规则
                isTemplate: true,
            })

            setSaved(true)
            alert(`成功保存为模板: ${newBoardName}`)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error('保存模板失败:', err)
            alert('保存失败，请重试')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="border rounded-lg p-3 bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            {title && (
                <div className="fw-600 mb-8">
                    {title}
                </div>
            )}

            <BoardViewer moves={[]} step={0} initialLayout={initialLayout} />

            <div className="row-start gap-8 mt-8">
                <button
                    onClick={handleSaveAsTemplate}
                    disabled={saving || saved || !initialLayout?.pieces}
                    className={`btn-primary text-13 ${saved ? 'opacity-50' : ''}`}
                    title="保存此棋盘为您的残局模板"
                >
                    {saved ? '✓ 已保存' : saving ? '保存中...' : '💾 保存为模板'}
                </button>
                {saved && (
                    <span className="text-13 muted">已保存到您的模板库</span>
                )}
            </div>
        </div>
    )
}
