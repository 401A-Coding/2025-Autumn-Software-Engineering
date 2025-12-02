import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import BoardViewer from '../../features/chess/BoardViewer'
import { recordStore } from '../../features/records/recordStore'
import type { ChessRecord, Bookmark } from '../../features/records/types'
// 书签即评论，统一用 bookmarks 展示
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
            ; (async () => {
                const r = await recordStore.get(id)
                if (!r) {
                    setRecord(null)
                } else {
                    setRecord(r)
                    setStep(r.moves.length) // 默认展示最终局面
                }
            })()
    }, [id])

    function jumpToBookmarkStep(bm: Bookmark) {
        setStep(Math.max(0, Math.min(bm.step, total)))
    }

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
    let titleClass = 'replay-title--draw'
    if (result === 'red') { titleText = '红方胜'; titleClass = 'replay-title--red' }
    else if (result === 'black') { titleText = '黑方胜'; titleClass = 'replay-title--black' }
    else if (!result || (record as any)?.result === 'unfinished') { titleText = '未结束'; titleClass = 'replay-title--ongoing' }

    return (
        <div>
            <section className="paper-card card-pad pos-rel">
                <h2 className={`mt-0 ${titleClass}`}>{titleText}</h2>

                <div className="muted text-13">
                    开始：{new Date(record.startedAt).toLocaleString()} · 结束：{record.endedAt ? new Date(record.endedAt).toLocaleString() : '—'}
                </div>

                {/* 未结束时提供选择操作 */}
                {(!record.result || (record as any).result === 'unfinished') && (
                    <div className="mt-12 row-start gap-8">
                        <button className="btn-primary" onClick={() => {/* 回顾对局：保持当前复盘视图 */ }}>回顾对局</button>
                        <button className="btn-ghost" onClick={() => {/* 继续对战：占位，后续实现跳转或恢复对局 */ }}>继续对战</button>
                    </div>
                )}

                <div className="mt-12">
                    <BoardViewer moves={record.moves} step={step} />
                </div>

                {/* 步数控制 */}
                <div className="mt-12 inline-controls">
                    <button className="btn-ghost" disabled={step <= 0} onClick={() => setStep(s => Math.max(0, s - 1))}>◀</button>
                    <div className="minw-80 text-center">{step}/{total}</div>
                    <button className="btn-ghost" disabled={step >= total} onClick={() => setStep(s => Math.min(total, s + 1))}>▶</button>
                    <button className="btn-ghost" onClick={() => setStep(0)}>开局</button>
                    <button className="btn-ghost" onClick={() => setStep(total)}>终局</button>
                    <button className="btn-ghost" onClick={() => setIsPlaying(p => !p)}>{isPlaying ? '⏸ 暂停' : '▶ 自动'}</button>
                    <div className="ml-auto">
                        <button className="btn-ghost" onClick={() => setShowSpeedSheet(true)}>修改播放速度</button>
                    </div>
                </div>

                {/* 书签操作：改为按钮 prompt 编辑 */}
                <div className="mt-16 row-start gap-12">
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
                <div className="mt-16">
                    <strong>书签 / 评论：</strong>
                    {!(record.bookmarks && record.bookmarks.length) ? (
                        <span className="muted"> 无</span>
                    ) : (
                        <div className="row-start wrap gap-6 mt-6">
                            {record.bookmarks!.map(b => (
                                <div key={b.id} className="paper-card pad-4-8 inline-flex align-center gap-6">
                                    <button
                                        className="btn-ghost btn-xs"
                                        onClick={() => jumpToBookmarkStep(b)}
                                        title={b.note ? b.note : undefined}
                                    >步 {b.step}{b.label ? ' · ' + b.label : ''}</button>
                                    {b.note && (
                                        <span className="text-12 muted">{b.note}</span>
                                    )}
                                    <button
                                        className="btn-ghost btn-xs"
                                        title="编辑"
                                        onClick={() => {
                                            setEditingBm(b)
                                            setBmLabel(b.label || '')
                                            setShowBookmarkSheet(true)
                                        }}
                                    >✎</button>
                                    <button
                                        className="btn-ghost btn-xs"
                                        aria-label="删除书签"
                                        title="删除"
                                        onClick={async () => {
                                            await recordStore.removeBookmark(record.id, b.id)
                                            const updated = await recordStore.get(record.id)
                                            if (updated) setRecord(updated)
                                        }}
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 评论与书签合并展示，见上方书签列表 */}

                <div className="mt-24">
                    <button className="btn-ghost" onClick={() => navigate('/app/history')}>返回列表</button>
                </div>
            </section>
            {showBookmarkSheet && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="书签编辑"
                    className="modal-mask"
                    onClick={() => setShowBookmarkSheet(false)}
                >
                    <div
                        className="paper-card sheet-bottom mw-520"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="fw-600 mb-8">{editingBm ? '编辑书签' : '添加书签'}</div>
                        <div className="row-start gap-8 align-center">
                            <input
                                placeholder="书签标签 (可留空)"
                                value={bmLabel}
                                onChange={(e) => setBmLabel(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                        <div className="row-between mt-12 gap-8">
                            <button className="btn-ghost" onClick={() => setShowBookmarkSheet(false)}>取消</button>
                            <div className="row-start gap-8">
                                {editingBm && (
                                    <button
                                        className="btn-ghost"
                                        onClick={async () => {
                                            await recordStore.removeBookmark(record.id, editingBm.id)
                                            const updated = await recordStore.get(record.id)
                                            if (updated) setRecord(updated)
                                            setShowBookmarkSheet(false)
                                        }}
                                    >删除</button>
                                )}
                                <button
                                    className="btn-primary"
                                    onClick={async () => {
                                        const trimmed = bmLabel.trim()
                                        if (editingBm) {
                                            await recordStore.updateBookmark(record.id, editingBm.id, trimmed ? trimmed : undefined, bmLabel ? bmLabel : undefined)
                                        } else {
                                            await recordStore.addBookmark(record.id, step, trimmed ? trimmed : undefined, bmLabel ? bmLabel : undefined)
                                        }
                                        const updated = await recordStore.get(record.id)
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
                    className="modal-mask"
                    onClick={() => setShowSpeedSheet(false)}
                >
                    <div
                        className="paper-card sheet-bottom mw-520"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="fw-600 mb-8">修改播放速度</div>
                        <div className="muted text-12 mb-6">以“秒/步”为单位，最小 1 秒</div>
                        <div className="row-start align-center gap-8">
                            <span className="minw-80">速度：</span>
                            <input
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={Math.max(1, Math.round(intervalMs / 1000))}
                                className="w-100"
                                placeholder="秒/步"
                                title="播放速度（秒/步）"
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
                        <div className="row-between mt-12 gap-8">
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
