/**
 * 自定义棋局预览卡片组件
 */

import { useState, useEffect } from 'react'
import { boardApi } from '../services/api'

interface BoardPreviewProps {
    boardId: number
    onClick?: () => void
}

export default function BoardPreview({ boardId, onClick }: BoardPreviewProps) {
    const [board, setBoard] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadBoard() {
            try {
                setLoading(true)
                setError(null)
                const data = await boardApi.get(boardId)
                setBoard(data)
            } catch (err) {
                console.error('Failed to load board:', err)
                setError('加载棋局失败')
            } finally {
                setLoading(false)
            }
        }
        loadBoard()
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
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="text-red-600 text-sm">
                    {error || '棋局不存在'}
                </div>
            </div>
        )
    }

    return (
        <div
            className="border rounded-lg p-4 bg-green-50 border-green-200 hover:bg-green-100 transition cursor-pointer"
            onClick={onClick}
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-green-200 rounded flex items-center justify-center text-green-700 font-bold text-lg mr-3">
                    ♟️
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                        {board.name || '自定义棋局'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                        {board.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>
                            {new Date(board.createdAt).toLocaleDateString()}
                        </span>
                        {board.templateName && (
                            <span>基于 {board.templateName}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
