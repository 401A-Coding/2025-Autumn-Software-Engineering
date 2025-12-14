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

    useEffect(() => {
        if (value.shareType === 'RECORD') {
            loadRecords()
        } else if (value.shareType === 'BOARD') {
            loadBoards()
        }
    }, [value.shareType])

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

    async function loadBoards() {
        try {
            setLoadingBoards(true)
            const data = await boardApi.getMine(1, 50)
            setBoards(data.items || [])
        } catch (err) {
            console.error('Failed to load boards:', err)
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
                        <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                            {records.map((record) => (
                                <div
                                    key={record.id}
                                    className={`p-3 rounded-lg border cursor-pointer transition ${value.shareRefId === record.id
                                            ? 'bg-blue-100 border-blue-300'
                                            : 'bg-white border-gray-200 hover:border-blue-200'
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
                        选择自定义棋局
                    </label>
                    {loadingBoards ? (
                        <div className="text-sm text-gray-500">加载中...</div>
                    ) : boards.length === 0 ? (
                        <div className="text-sm text-gray-500">
                            暂无自定义棋局，请先创建一个
                        </div>
                    ) : (
                        <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                            {boards.map((board) => (
                                <div
                                    key={board.id}
                                    className={`p-3 rounded-lg border cursor-pointer transition ${value.shareRefId === board.id
                                            ? 'bg-green-100 border-green-300'
                                            : 'bg-white border-gray-200 hover:border-green-200'
                                        }`}
                                    onClick={() => handleSelectBoard(board.id)}
                                >
                                    <div className="font-medium text-gray-900">
                                        {board.name || '自定义棋局'}
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
