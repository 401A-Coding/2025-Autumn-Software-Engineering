/**
 * 通用棋盘嵌入组件：负责拉取棋盘数据并渲染静态棋盘，
 * 可选显示“保存为模板”按钮。
 */
import { useEffect, useState } from 'react'
import BoardViewerWithSave from './BoardViewerWithSave'
import { boardApi } from '../services/api'

interface BoardEmbedProps {
    boardId: number
    enableSave?: boolean
    titleOverride?: string
}

export default function BoardEmbed({ boardId, enableSave = true, titleOverride }: BoardEmbedProps) {
    const [board, setBoard] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function loadBoard() {
            try {
                setLoading(true)
                setError(null)
                const data = await boardApi.get(boardId)
                if (!mounted) return
                setBoard(data)
            } catch (err: any) {
                console.error('Failed to load board:', err)
                if (!mounted) return
                setError(err?.message || '加载棋局失败')
            } finally {
                if (!mounted) return
                setLoading(false)
            }
        }
        loadBoard()
        return () => {
            mounted = false
        }
    }, [boardId])

    if (loading) {
        return (
            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
            </div>
        )
    }

    if (error || !board) {
        return (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 text-sm text-red-600">
                {error || '棋局不可用'}
            </div>
        )
    }

    return (
        <BoardViewerWithSave
            boardId={boardId}
            initialLayout={board.layout}
            title={titleOverride ?? board.name}
            enableSave={enableSave}
        />
    )
}
