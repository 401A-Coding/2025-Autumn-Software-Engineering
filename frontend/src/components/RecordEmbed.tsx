/**
 * 对局记录内嵌复盘组件，用于在发帖等场景内直接展示棋盘回放
 */
import { useEffect, useMemo, useState } from 'react'
import BoardViewer from '../features/chess/BoardViewer'
import { recordStore } from '../features/records/recordStore'
import type { ChessRecord } from '../features/records/types'

interface RecordEmbedProps {
    recordId: number
}

export default function RecordEmbed({ recordId }: RecordEmbedProps) {
    const [record, setRecord] = useState<ChessRecord | null>(null)
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                setLoading(true)
                setError(null)
                const rec = await recordStore.get(String(recordId))
                if (!mounted) return
                if (!rec) {
                    setError('记录不存在或无权限访问')
                    setRecord(null)
                    return
                }
                setRecord(rec)
                setStep(rec.moves.length) // 默认展示终局
            } catch (e) {
                if (!mounted) return
                setError('加载记录失败')
                setRecord(null)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => {
            mounted = false
        }
    }, [recordId])

    const total = record?.moves.length ?? 0

    const title = useMemo(() => {
        if (!record) return '对局记录'
        if (record.result === 'red') return '红方胜'
        if (record.result === 'black') return '黑方胜'
        if (record.result === 'draw') return '平局'
        return '未结束'
    }, [record])

    if (loading) {
        return (
            <div className="border rounded-lg p-4 bg-gray-50 text-sm text-gray-600">加载中...</div>
        )
    }

    if (error || !record) {
        return (
            <div className="border rounded-lg p-4 bg-red-50 text-sm text-red-600">
                {error || '记录不可用'}
            </div>
        )
    }

    return (
        <div className="border rounded-lg p-3 bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="row-between align-center mb-8">
                <div className="fw-600">{title}</div>
                <div className="text-12 muted">
                    步数：{total} · 对手：{record.opponent || '未知'}
                </div>
            </div>

            <BoardViewer moves={record.moves} step={step} initialLayout={record.initialLayout as any} />

            <div className="row-start gap-8 mt-8 text-13">
                <button className="btn-ghost" disabled={step <= 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                    ◀ 上一步
                </button>
                <button className="btn-ghost" disabled={step >= total} onClick={() => setStep((s) => Math.min(total, s + 1))}>
                    下一步 ▶
                </button>
                <div className="text-13 muted">{step} / {total}</div>
                <button className="btn-ghost" onClick={() => setStep(0)}>
                    开局
                </button>
                <button className="btn-ghost" onClick={() => setStep(total)}>
                    终局
                </button>
            </div>
        </div>
    )
}
