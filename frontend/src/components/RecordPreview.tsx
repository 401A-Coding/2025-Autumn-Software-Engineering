/**
 * 对局记录预览卡片组件
 */

import { useState, useEffect } from 'react'
import { recordsApi } from '../services/api'

interface RecordPreviewProps {
    recordId: number
    onClick?: () => void
}

export default function RecordPreview({ recordId, onClick }: RecordPreviewProps) {
    const [record, setRecord] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadRecord() {
            try {
                setLoading(true)
                setError(null)
                const data = await recordsApi.get(recordId)
                setRecord(data)
            } catch (err) {
                console.error('Failed to load record:', err)
                setError('加载记录失败')
            } finally {
                setLoading(false)
            }
        }
        loadRecord()
    }, [recordId])

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

    if (error || !record) {
        return (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="text-red-600 text-sm">
                    {error || '记录不存在'}
                </div>
            </div>
        )
    }

    return (
        <div
            className="border rounded-lg p-4 bg-blue-50 border-blue-200 hover:bg-blue-100 transition cursor-pointer"
            onClick={onClick}
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-200 rounded flex items-center justify-center text-blue-700 font-bold text-lg mr-3">
                    📊
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">
                        {record.title || '对局记录'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                        {record.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>
                            {new Date(record.createdAt).toLocaleDateString()}
                        </span>
                        {record.moves && (
                            <span>{record.moves.length} 步</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
