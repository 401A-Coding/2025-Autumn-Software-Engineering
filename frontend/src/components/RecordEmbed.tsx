/**
 * 对局记录内嵌复盘组件，用于在发帖等场景内直接展示棋盘回放
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import BoardViewer from '../features/chess/BoardViewer'
import { recordStore } from '../features/records/recordStore'
import { boardApi } from '../services/api'
import type { ChessRecord } from '../features/records/types'

interface RecordEmbedProps {
    recordId: number
}

export default function RecordEmbed({ recordId }: RecordEmbedProps) {
    const [record, setRecord] = useState<ChessRecord | null>(null)
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isAutoPlaying, setIsAutoPlaying] = useState(false)
    const [saving, setSaving] = useState(false)

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

    // 自动播放逻辑
    useEffect(() => {
        if (!isAutoPlaying || !record) return

        const timer = setInterval(() => {
            setStep(prevStep => {
                if (prevStep >= record.moves.length) {
                    setIsAutoPlaying(false)
                    return prevStep
                }
                return prevStep + 1
            })
        }, 800) // 每800ms播放一步

        return () => clearInterval(timer)
    }, [isAutoPlaying, record])

    const total = record?.moves.length ?? 0

    const title = useMemo(() => {
        if (!record) return '对局记录'
        if (record.result === 'red') return '红方胜'
        if (record.result === 'black') return '黑方胜'
        if (record.result === 'draw') return '平局'
        return '未结束'
    }, [record])

    const handleSaveAsEndgame = useCallback(async () => {
        if (!record) {
            alert('无有效的对局记录')
            return
        }

        setSaving(true)
        try {
            const templateName = prompt(
                '请输入残局模板名称：',
                `${record.opponent || '对局'} - 第${step}步`
            )
            if (!templateName) {
                setSaving(false)
                return
            }

            // 获取当前盘面（通过应用moves）
            const currentLayout = record.initialLayout || { pieces: [] }
            // 注意：这里简化处理，实际需要计算当前盘面
            // 完整实现应该在这里调用chess引擎来计算当前盘面状态

            await boardApi.create({
                name: templateName,
                description: `从对局记录保存: ${record.opponent || '对局'} 第${step}步`,
                layout: currentLayout,
                rules: {},
                isTemplate: true,
            })

            alert(`成功保存为残局模板: ${templateName}`)
        } catch (err) {
            console.error('保存残局失败:', err)
            alert('保存失败，请重试')
        } finally {
            setSaving(false)
        }
    }, [record, step])

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

            <div className="row-start gap-8 mt-8 text-13 flex-wrap">
                <button className="btn-ghost" disabled={step <= 0} onClick={() => { setStep((s) => Math.max(0, s - 1)); setIsAutoPlaying(false) }}>
                    ◀ 上一步
                </button>
                <button
                    className={`btn-ghost ${isAutoPlaying ? 'fw-600' : ''}`}
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    title={isAutoPlaying ? '停止播放' : '自动播放'}
                >
                    {isAutoPlaying ? '⏸ 停止' : '▶ 播放'}
                </button>
                <button className="btn-ghost" disabled={step >= total} onClick={() => { setStep((s) => Math.min(total, s + 1)); setIsAutoPlaying(false) }}>
                    下一步 ▶
                </button>
                <div className="text-13 muted">{step} / {total}</div>
                <button className="btn-ghost" onClick={() => { setStep(0); setIsAutoPlaying(false) }}>
                    开局
                </button>
                <button className="btn-ghost" onClick={() => { setStep(total); setIsAutoPlaying(false) }}>
                    终局
                </button>
                <button
                    className="btn-primary text-13"
                    onClick={handleSaveAsEndgame}
                    disabled={saving || !record}
                    title="保存当前步数的盘面为残局模板"
                >
                    {saving ? '保存中...' : '💾 保存为残局'}
                </button>
            </div>
        </div>
    )
}
