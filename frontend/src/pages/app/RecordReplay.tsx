import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import BoardViewer from '../../features/chess/BoardViewer'
import { recordStore } from '../../features/records/recordStore'
import type { ChessRecord, Bookmark } from '../../features/records/types'
import './app-pages.css'

export default function RecordReplay() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [record, setRecord] = useState<ChessRecord | null>(null)
    const [step, setStep] = useState(0)
    // 书签/笔记输入已移除
    const [isPlaying, setIsPlaying] = useState(false)
    const [intervalMs, setIntervalMs] = useState(2000)
    // 书签底部弹窗状态
    const [showBookmarkSheet, setShowBookmarkSheet] = useState(false)
    const [editingBm, setEditingBm] = useState<Bookmark | null>(null)
    const [bmLabel, setBmLabel] = useState('')
    // 速度设置弹窗
    const [showSpeedSheet, setShowSpeedSheet] = useState(false)

    // 计算总步数（在 hooks 之前，避免条件 hooks）
    const total = record?.moves.length ?? 0

    useEffect(() => {
        if (!id) return
        const r = recordStore.get(id)
        if (!r) {
            setRecord(null)
        } else {
            setRecord(r)
            setStep(r.moves.length) // 默认展示最终局面
        }
    }, [id])

    // 自动播放（保持 hooks 顺序稳定）
    useEffect(() => {
        if (!isPlaying) return
        if (total <= 0) { setIsPlaying(false); return }
        if (step >= total) { setIsPlaying(false); return }
        const t = window.setInterval(() => {
            setStep((s) => {
                if (s >= total) { window.clearInterval(t); return s }
                return Math.min(total, s + 1)
            })
        }, intervalMs)
        return () => window.clearInterval(t)
    }, [isPlaying, step, total, intervalMs])

    if (!record) {
        return (
            <section className="paper-card card-pad">
                <h3 className="mt-0">复盘</h3>
                <div className="empty-box">记录不存在或已被清理</div>
                <button className="btn-ghost mt-8" onClick={() => navigate('/app/history')}>返回列表</button>
            </section>
        )
    }

    // 旧的添加方法已替换为 prompt 交互，保留位置注释避免误用

    // 胜负标题与颜色
    const result = record.result
    let titleText = '平局'
    let titleColor = '#666'
    if (result === 'red') { titleText = '红方胜'; titleColor = '#b30000' }
    else if (result === 'black') { titleText = '黑方胜'; titleColor = '#222' }
    else if (!result) { titleText = '进行中'; titleColor = '#666' }

    return (
        <div>
            <section className="paper-card card-pad" style={{ position: 'relative' }}>
                <h2 className="mt-0" style={{ color: titleColor }}>{titleText}</h2>

                <div className="muted" style={{ fontSize: 13 }}>
                    开始：{new Date(record.startedAt).toLocaleString()} · 结束：{record.endedAt ? new Date(record.endedAt).toLocaleString() : '—'}
                </div>

                <div style={{ marginTop: 12 }}>
                    <BoardViewer moves={record.moves} step={step} />
                </div>

                {/* 步数控制 */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn-ghost" disabled={step <= 0} onClick={() => setStep(s => Math.max(0, s - 1))}>◀</button>
                    <div style={{ minWidth: 80, textAlign: 'center' }}>{step}/{total}</div>
                    <button className="btn-ghost" disabled={step >= total} onClick={() => setStep(s => Math.min(total, s + 1))}>▶</button>
                    <button className="btn-ghost" onClick={() => setStep(0)}>开局</button>
                    <button className="btn-ghost" onClick={() => setStep(total)}>终局</button>
                    <button className="btn-ghost" onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸ 暂停' : '▶ 自动'}</button>
                    <div style={{ marginLeft: 'auto' }}>
                        <button className="btn-ghost" onClick={() => setShowSpeedSheet(true)}>修改播放速度</button>
                    </div>
                </div>

                {/* 书签操作：改为按钮 prompt 编辑 */}
                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                    <button
                        className="btn-ghost"
                        onClick={() => {
                            setEditingBm(null)
                            setBmLabel('')
                            setShowBookmarkSheet(true)
                        }}
                    >添加书签</button>
                </div>

                {/* 已有书签 */}
                <div style={{ marginTop: 16 }}>
                    <strong>书签：</strong>
                    {!(record.bookmarks && record.bookmarks.length) ? (
                        <span className="muted"> 无</span>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {record.bookmarks!.map(b => (
                                <div key={b.id} className="paper-card" style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <button
                                        className="btn-ghost"
                                        style={{ padding: '2px 6px', fontSize: 12 }}
                                        onClick={() => setStep(b.step)}
                                    >步 {b.step}{b.label ? ' · ' + b.label : ''}</button>
                                    <button
                                        className="btn-ghost"
                                        title="编辑"
                                        style={{ padding: '2px 6px', fontSize: 12 }}
                                        onClick={() => {
                                            setEditingBm(b)
                                            setBmLabel(b.label || '')
                                            setShowBookmarkSheet(true)
                                        }}
                                    >✎</button>
                                    <button
                                        className="btn-ghost"
                                        aria-label="删除书签"
                                        title="删除"
                                        style={{ padding: '2px 6px', fontSize: 12 }}
                                        onClick={() => {
                                            recordStore.removeBookmark(record.id, b.id)
                                            const updated = recordStore.get(record.id)
                                            if (updated) setRecord(updated)
                                        }}
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ marginTop: 24 }}>
                    <button className="btn-ghost" onClick={() => navigate('/app/history')}>返回列表</button>
                </div>
            </section>
            {showBookmarkSheet && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="书签编辑"
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 60 }}
                    onClick={() => setShowBookmarkSheet(false)}
                >
                    <div
                        className="paper-card"
                        style={{
                            position: 'fixed',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            margin: '0 auto',
                            maxWidth: 520,
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12,
                            borderBottomLeftRadius: 0,
                            borderBottomRightRadius: 0,
                            padding: 16,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>{editingBm ? '编辑书签' : '添加书签'}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                placeholder="书签标签 (可留空)"
                                value={bmLabel}
                                onChange={(e) => setBmLabel(e.target.value)}
                                style={{ flex: 1 }}
                            />
                        </div>
                        <div className="row-between" style={{ marginTop: 12, gap: 8 }}>
                            <button className="btn-ghost" onClick={() => setShowBookmarkSheet(false)}>取消</button>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {editingBm && (
                                    <button
                                        className="btn-ghost"
                                        onClick={() => {
                                            recordStore.removeBookmark(record.id, editingBm.id)
                                            const updated = recordStore.get(record.id)
                                            if (updated) setRecord(updated)
                                            setShowBookmarkSheet(false)
                                        }}
                                    >删除</button>
                                )}
                                <button
                                    className="btn-primary"
                                    onClick={() => {
                                        const trimmed = bmLabel.trim()
                                        if (editingBm) {
                                            recordStore.updateBookmark(record.id, editingBm.id, trimmed ? trimmed : undefined)
                                        } else {
                                            recordStore.addBookmark(record.id, step, trimmed ? trimmed : undefined)
                                        }
                                        const updated = recordStore.get(record.id)
                                        if (updated) setRecord(updated)
                                        setShowBookmarkSheet(false)
                                    }}
                                >保存</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showSpeedSheet && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="播放速度"
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 60 }}
                    onClick={() => setShowSpeedSheet(false)}
                >
                    <div
                        className="paper-card"
                        style={{
                            position: 'fixed',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            margin: '0 auto',
                            maxWidth: 520,
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12,
                            borderBottomLeftRadius: 0,
                            borderBottomRightRadius: 0,
                            padding: 16,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>修改播放速度</div>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>以“秒/步”为单位，最小 1 秒</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ minWidth: 80 }}>速度：</span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={Math.max(1, Math.round(intervalMs / 1000))}
                                style={{ width: 100 }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const target = e.target as HTMLInputElement
                                        const sec = Math.max(1, parseInt(target.value || '1', 10) || 1)
                                        setIntervalMs(sec * 1000)
                                        setShowSpeedSheet(false)
                                    }
                                }}
                                id="speed-input"
                            />
                        </div>
                        <div className="row-between" style={{ marginTop: 12, gap: 8 }}>
                            <button className="btn-ghost" onClick={() => setShowSpeedSheet(false)}>取消</button>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    const el = document.getElementById('speed-input') as HTMLInputElement | null
                                    const sec = Math.max(1, parseInt(el?.value || '1', 10) || 1)
                                    setIntervalMs(sec * 1000)
                                    setShowSpeedSheet(false)
                                }}
                            >保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
