import { useMemo, useState } from 'react'
import type { PieceRuleConfig } from '../features/chess/ruleEngine'

type RiverView = 'pre' | 'post'

interface RuleViewerModalProps {
    title: string
    rule: PieceRuleConfig
    onClose: () => void
}

export default function RuleViewerModal({ title, rule, onClose }: RuleViewerModalProps) {
    const [riverView, setRiverView] = useState<RiverView>('pre')
    const gridRows = 17
    const gridCols = 17
    const centerRow = Math.floor(gridRows / 2)
    const centerCol = Math.floor(gridCols / 2)

    const cells = useMemo(() => {
        const pre = new Set<string>()
        const post = new Set<string>()
        const push = (set: Set<string>, r: number, c: number) => {
            if (r >= 0 && r < gridRows && c >= 0 && c < gridCols && !(r === centerRow && c === centerCol)) {
                set.add(`${r}-${c}`)
            }
        }

        const patterns: any[] = []
        if (Array.isArray(rule.movePatterns)) patterns.push(...rule.movePatterns)
        if (rule.captureRules && Array.isArray((rule as any).captureRules.capturePattern)) {
            patterns.push(...((rule as any).captureRules.capturePattern as any[]))
        }

        // 显示基准：兵以红方为基准，其他默认黑方（与编辑器一致）
        const baseIsRed = title.includes('兵')

        for (const pat of patterns) {
            const conds = pat.conditions || []
            let isPre = false
            let isPost = false
            for (const c of conds) {
                if ((c as any).notCrossedRiver) isPre = true
                if ((c as any).crossedRiver) isPost = true
            }
            if (!isPre && !isPost) { isPre = true; isPost = true }

            const visualDy = baseIsRed ? -(pat.dy || 0) : (pat.dy || 0)
            if (pat.repeat) {
                const stepX = pat.dx === 0 ? 0 : (pat.dx > 0 ? 1 : -1)
                const stepY = visualDy === 0 ? 0 : (visualDy > 0 ? 1 : -1)
                let r = centerRow + stepY
                let c = centerCol + stepX
                while (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
                    if (isPre) push(pre, r, c)
                    if (isPost) push(post, r, c)
                    r += stepY
                    c += stepX
                }
            } else {
                const r = centerRow + visualDy
                const c = centerCol + (pat.dx || 0)
                if (isPre) push(pre, r, c)
                if (isPost) push(post, r, c)
            }
        }

        return { pre, post }
    }, [rule, title])

    const activeSet = riverView === 'pre' ? cells.pre : cells.post

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width: 520, maxWidth: '90vw', background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <button className="btn-ghost" onClick={onClose}>关闭</button>
                </div>
                <div style={{ padding: 12 }}>
                    <div className="row gap-8 mb-8">
                        <button className={`btn-compact ${riverView === 'pre' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRiverView('pre')}>过河前</button>
                        <button className={`btn-compact ${riverView === 'post' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRiverView('post')}>过河后</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateRows: `repeat(${gridRows}, 16px)`, gridTemplateColumns: `repeat(${gridCols}, 16px)`, gap: 2, justifyContent: 'center' }}>
                        {Array.from({ length: gridRows }).map((_, r) => (
                            Array.from({ length: gridCols }).map((_, c) => {
                                const key = `${r}-${c}`
                                const isCenter = r === Math.floor(gridRows / 2) && c === Math.floor(gridCols / 2)
                                const isActive = activeSet.has(key)
                                const bg = isCenter ? '#ffd54f' : isActive ? '#4fc3f7' : '#fafafa'
                                const bd = isCenter ? '2px solid #ffb300' : isActive ? '1px solid #29b6f6' : '1px solid #eee'
                                return <div key={key} style={{ width: 16, height: 16, background: bg, border: bd, borderRadius: 3 }} />
                            })
                        ))}
                    </div>
                    <div className="text-12 text-gray mt-8">黄色为棋子所在中心格；蓝色格表示本视图可达的走法。</div>

                    <div className="mt-12">
                        <div className="fw-600 mb-6">限制与说明</div>
                        <div className="text-13">
                            <div>可跳跃：{rule.restrictions?.canJump ? '是' : '否'}</div>
                            <div>可过河：{rule.restrictions?.canCrossRiver ? '是' : '否'}</div>
                            <div>需留九宫：{rule.restrictions?.mustStayInPalace ? '是' : '否'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
