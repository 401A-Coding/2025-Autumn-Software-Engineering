/**
 * 资源引用选择器组件
 * 支持选择无引用、引用对局记录、引用自定义棋局
 */

import { useState, useEffect } from 'react'
import { recordsApi, boardApi, userApi } from '../services/api'
import Segmented from './Segmented'
import UserAvatar from './UserAvatar'

type ShareType = 'NONE' | 'RECORD' | 'BOARD'

interface CurrentUser {
    id: number
    nickname?: string
    avatarUrl?: string
}

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
    const [recordProfiles, setRecordProfiles] = useState<Record<number, any>>({})
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        (async () => {
            try {
                const me = await userApi.getMe()
                setCurrentUser({
                    id: me.id as number,
                    nickname: (me as any).nickname || '匿名用户',
                    avatarUrl: (me as any).avatarUrl,
                })
            } catch { }
        })()
    }, [])


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
            const items = data.items || []
            setRecords(items)

            // 预加载对手信息
            const profiles: Record<number, any> = {}
            for (const r of items) {
                if (r.opponent && /^\d+$/.test(String(r.opponent))) {
                    try {
                        const info = await userApi.getById(Number(r.opponent))
                        profiles[Number(r.opponent)] = info
                    } catch { }
                }
            }
            setRecordProfiles(profiles)
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

    // 渲染改进过的战绩卡片
    const renderRecordCard = (record: any) => {
        const sourceLabel = (record.keyTags || []).includes('在线匹配') ? '在线匹配' : (record.keyTags || []).includes('好友对战') ? '好友对战' : '本地对局'
        const rounds = (record.moves || []).length

        const mySide = (record.keyTags || []).find((t: string) => t.startsWith('我方:'))?.split(':')[1] || 'red'
        const isRedSide = mySide === '红'

        const oppId = record.opponent && /^\d+$/.test(String(record.opponent)) ? Number(record.opponent) : null

        const me = currentUser || { id: 0, nickname: '匿名用户', avatarUrl: undefined }

        // 本地对战自己对自己的情况，对手就是自己
        let opponent: any
        if (oppId) {
            // 对手存在，从缓存中获取或使用默认值
            if (currentUser && oppId === currentUser.id) {
                opponent = currentUser
            } else {
                const oppProfile = recordProfiles[oppId]
                opponent = oppProfile || { id: oppId, nickname: '对手', avatarUrl: undefined }
            }
        } else {
            // 对手不存在，说明是自己对自己（本地对局）
            opponent = currentUser || { id: 0, nickname: '匿名用户', avatarUrl: undefined }
        }

        const leftProfile = isRedSide ? me : opponent
        const rightProfile = isRedSide ? opponent : me

        const resultDisplay = record.result === 'red' ? '先胜' : record.result === 'black' ? '先负' : record.result === 'draw' ? '平局' : '未结束'

        const isSelected = value.shareRefId === record.id
        const borderColor = isSelected ? '#3b82f6' : '#cbd5e1'
        const bgColor = isSelected ? '#e2f2ff' : '#f9fafb'
        const boxShadow = isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.25), 0 4px 10px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(15, 23, 42, 0.05)'

        return (
            <div
                key={record.id}
                role="button"
                className="cursor-pointer transition"
                style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor,
                    backgroundColor: bgColor,
                    boxShadow,
                }}
                onClick={() => handleSelectRecord(record.id)}
            >
                <div className="row-between align-center" style={{ marginBottom: 8 }}>
                    <div className="muted" style={{ fontSize: 12 }}>{sourceLabel}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{new Date(record.startedAt).toLocaleString()}</div>
                </div>

                {/* 红方（先手）在左，黑方（后手）在右 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {leftProfile && (
                            <UserAvatar
                                userId={leftProfile.id}
                                nickname={leftProfile.nickname}
                                avatarUrl={leftProfile.avatarUrl}
                                size="small"
                                showTime={false}
                            />
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div className="fw-600" style={{ fontSize: 14 }}>{resultDisplay}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{rounds} 回合</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {rightProfile && (
                            <UserAvatar
                                userId={rightProfile.id}
                                nickname={rightProfile.nickname}
                                avatarUrl={rightProfile.avatarUrl}
                                size="small"
                                showTime={false}
                            />
                        )}
                    </div>
                </div>

                {/* 标签 */}
                {Array.isArray(record.keyTags) && record.keyTags.length > 0 && (
                    <div className="row-start wrap gap-4" style={{ fontSize: 11 }}>
                        {(record.keyTags as string[]).filter(t => !t.startsWith('我方:')).slice(0, 2).map((t: string, idx: number) => (
                            <span key={`${record.id}-tag-${idx}`} style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 6px' }}>{t}</span>
                        ))}
                        {(record.keyTags as string[]).filter(t => !t.startsWith('我方:')).length > 2 && (
                            <span className="muted" style={{ background: '#f5f5f5', borderRadius: 999, padding: '2px 6px' }}>
                                +{(record.keyTags as string[]).filter(t => !t.startsWith('我方:')).length - 2}
                            </span>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const radius = 12
    const containerStyle = { backgroundColor: '#eef1f7', border: '1px solid #cdd6e5', borderRadius: radius }
    const cardBaseStyle = {
        backgroundColor: '#f9fafb',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: radius,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
    }
    const boardSelectedStyle = {
        backgroundColor: '#e8fff2',
        borderColor: '#10b981',
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: radius,
        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25), 0 4px 10px rgba(16, 185, 129, 0.15)',
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
                        <div
                            style={{
                                ...containerStyle,
                                maxHeight: 300,
                                overflowY: 'auto',
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                            }}
                        >
                            {records.map((record) => renderRecordCard(record))}
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
                        <div
                            style={{
                                ...containerStyle,
                                maxHeight: 300,
                                overflowY: 'auto',
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                            }}
                        >
                            {boards.map((board) => (
                                <div
                                    key={board.id}
                                    role="button"
                                    className={`p-3 rounded-lg cursor-pointer transition ${value.shareRefId === board.id
                                        ? 'hover:shadow-md'
                                        : 'hover:border-emerald-300 hover:shadow'
                                        }`}
                                    style={value.shareRefId === board.id ? boardSelectedStyle : cardBaseStyle}
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
