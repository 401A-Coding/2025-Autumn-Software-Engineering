/**
 * 资源引用选择器组件
 * 支持选择无引用、引用对局记录、引用自定义棋局
 */

import { useState, useEffect } from 'react'
import { recordsApi, boardApi } from '../services/api'
import Segmented from './Segmented'

type ShareType = 'NONE' | 'RECORD' | 'BOARD'

interface ResourceSelectorProps {
    value: {
        shareType: ShareType
        shareRefId: number | null
    }
    onChange: (value: { shareType: ShareType; shareRefId: number | null }) => void
}

export default function ResourceSelector({ value, onChange }: ResourceSelectorProps) {
    const [records, setRecords] = useState<any[]>([])
    const [boards, setBoards] = useState<any[]>([])
    const [loadingRecords, setLoadingRecords] = useState(false)
    const [loadingBoards, setLoadingBoards] = useState(false)
    const [boardCategory, setBoardCategory] = useState<'board' | 'endgame'>('board')

    useEffect(() => {
        if (value.shareType === 'RECORD') {
            loadRecords()
        } else if (value.shareType === 'BOARD') {
            loadBoards(boardCategory)
        }
    }, [value.shareType, boardCategory])

    async function loadRecords() {
        try {
            setLoadingRecords(true)
            const data = await recordsApi.list(1, 50)
            setRecords(data.items || [])
        } catch (err) {
            console.error('Failed to load records:', err)
        } finally {
            setLoadingRecords(false)
        }
    }

    async function loadBoards(category: 'board' | 'endgame' = 'board') {
        try {
            setLoadingBoards(true)
            if (category === 'endgame') {
                const endgameData = await boardApi.getMyEndgames(1, 50)
                const endgames = (endgameData as any).items || endgameData || []
                setBoards(endgames)
                return
            }

            // 加载我的棋盘（包括自己创建的模板）
            const myData = await boardApi.getMine(1, 50)
            const myBoards = (myData as any).items || myData || []

            // 也尝试加载公共模板
            try {
                const templates = await boardApi.getTemplates()
                const allBoards = [...myBoards, ...(Array.isArray(templates) ? templates : [])]
                // 去重（基于ID）
                const uniqueBoards = Array.from(
                    new Map(allBoards.map(b => [b.id, b])).values()
                )
                setBoards(uniqueBoards)
            } catch (e) {
                // 如果获取模板失败，至少显示我的棋盘
                setBoards(myBoards)
            }
        } catch (err) {
            console.error('Failed to load boards:', err)
            setBoards([])
        } finally {
            setLoadingBoards(false)
        }
    }

    const handleTypeChange = (type: string) => {
        const shareType = type as ShareType
        onChange({
            shareType,
            shareRefId: null,
        })
    }

    const handleSelectRecord = (recordId: number) => {
        onChange({
            shareType: 'RECORD',
            shareRefId: recordId,
        })
    }

    const handleSelectBoard = (boardId: number) => {
        onChange({
            shareType: 'BOARD',
            shareRefId: boardId,
        })
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    引用类型
                </label>
                <Segmented
                    options={[
                        { label: '无引用', value: 'NONE' },
                        { label: '引用对局记录', value: 'RECORD' },
                        { label: '引用自定义棋局', value: 'BOARD' },
                    ]}
                    value={value.shareType}
                    onChange={handleTypeChange}
                />
            </div>

            {value.shareType === 'RECORD' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择对局记录
                    </label>
                    {loadingRecords ? (
                        <div className="text-sm text-gray-500">加载中...</div>
                    ) : records.length === 0 ? (
                        <div className="text-sm text-gray-500">
                            暂无对局记录，请先完成一场对局
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            {records.map((record) => (
                                <div
                                    key={record.id}
                                    role="button"
                                    className={`p-3 rounded-lg border cursor-pointer transition shadow-sm ${value.shareRefId === record.id
                                        ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-200 shadow-md'
                                        : 'bg-white border-slate-300 hover:border-blue-300 hover:shadow-sm'
                                        }`}
                                    onClick={() => handleSelectRecord(record.id)}
                                >
                                    <div className="font-medium text-gray-900">
                                        {record.title || '对局记录'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(record.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {value.shareType === 'BOARD' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        选择自定义棋局 / 残局
                    </label>

                    <div className="row-start gap-8 mb-8">
                        <button
                            type="button"
                            className={`btn ${boardCategory === 'board' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => {
                                setBoardCategory('board')
                                if (value.shareType === 'BOARD') {
                                    onChange({ shareType: 'BOARD', shareRefId: null })
                                }
                            }}
                        >
                            自定义/模板
                        </button>
                        <button
                            type="button"
                            className={`btn ${boardCategory === 'endgame' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => {
                                setBoardCategory('endgame')
                                if (value.shareType === 'BOARD') {
                                    onChange({ shareType: 'BOARD', shareRefId: null })
                                }
                            }}
                        >
                            残局
                        </button>
                    </div>

                    {loadingBoards ? (
                        <div className="text-sm text-gray-500">加载中...</div>
                    ) : boards.length === 0 ? (
                        <div className="text-sm text-gray-500">
                            {boardCategory === 'endgame' ? '暂无残局，请先创建或保存一个残局' : '暂无自定义棋局，请先创建一个'}
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            {boards.map((board) => (
                                <div
                                    key={board.id}
                                    role="button"
                                    className={`p-3 rounded-lg border cursor-pointer transition shadow-sm ${value.shareRefId === board.id
                                        ? 'bg-emerald-100 border-emerald-600 ring-2 ring-emerald-200 shadow-md'
                                        : 'bg-white border-slate-300 hover:border-emerald-300 hover:shadow-sm'
                                        }`}
                                    onClick={() => handleSelectBoard(board.id)}
                                >
                                    <div className="font-medium text-gray-900 row-start gap-6">
                                        <span>{board.name || '自定义棋局'}</span>
                                        {board.isEndgame && <span className="badge badge-light">残局</span>}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {new Date(board.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
