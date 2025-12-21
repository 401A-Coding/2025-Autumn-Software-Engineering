import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { boardApi } from '../../services/api'
import '../../features/chess/board.css'
import './app-pages.css'
import MobileFrame from '../../components/MobileFrame'

// EndgameSetup receives initial layout via route state { layout, name }
export default function EndgameSetup() {
    const nav = useNavigate()
    const loc = useLocation() as any
    const initialLayout = loc.state?.layout as any | undefined
    const [name, setName] = useState<string>(loc.state?.name || '')
    const [turn, setTurn] = useState<'red' | 'black'>(loc.state?.turn || 'red')

    type Side = 'red' | 'black'
    type PieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'soldier'
    type Piece = { type: PieceType; side: Side; x: number; y: number }

    const [pieces, setPieces] = useState<Piece[]>(Array.isArray(initialLayout?.pieces) ? initialLayout.pieces : [])
    const [brushSide, setBrushSide] = useState<Side>('red')
    const [brushType, setBrushType] = useState<PieceType>('soldier')
    const [mode, setMode] = useState<'place' | 'erase'>('place')
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<string>('')

    useEffect(() => {
        if (Array.isArray(initialLayout?.pieces)) {
            setPieces(initialLayout.pieces)
        }
    }, [initialLayout])

    const layout = useMemo(() => ({ pieces }), [pieces])

    // build a 10x9 board for Board component
    function buildInitialBoard() {
        const b: any[][] = Array.from({ length: 10 }, () => Array(9).fill(null))
        const ts = Date.now()
        pieces.forEach((p, i) => {
            if (p.x >= 0 && p.x < 9 && p.y >= 0 && p.y < 10) {
                b[p.y][p.x] = { id: `eg-${ts}-${i}`, type: p.type, side: p.side }
            }
        })
        return b
    }

    // Render the board from layout.pieces
    const BoardEditor = ({ pieces, onCellClick }: { pieces: Piece[]; onCellClick: (x: number, y: number) => void }) => {
        const glyph = (type: PieceType, side: Side) => {
            if (type === 'general') return side === 'red' ? '帥' : '將'
            if (type === 'advisor') return side === 'red' ? '仕' : '士'
            if (type === 'elephant') return side === 'red' ? '相' : '象'
            if (type === 'soldier') return side === 'red' ? '兵' : '卒'
            if (type === 'horse') return '馬'
            if (type === 'rook') return '車'
            if (type === 'cannon') return '炮'
            return '?'
        }
        return (
            <div className="board board-center">
                {Array.from({ length: 10 }).map((_, row) => (
                    <div key={'h' + row} className={`grid-h row-${row}`} />
                ))}
                {Array.from({ length: 9 }).map((_, col) => (
                    <div key={'v' + col} className={`grid-v col-${col}`} />
                ))}
                <div className="river-line" />
                <div className="river-text">楚河        漢界</div>
                <div className="palace-top" />
                <div className="palace-bottom" />

                {pieces.map((p, idx) => (
                    <div key={idx} className={`piece-wrap piece-x-${p.x} piece-y-${p.y}`}>
                        <div className={`piece ${p.side === 'red' ? 'piece--red' : 'piece--black'}`}>{glyph(p.type, p.side)}</div>
                    </div>
                ))}

                {/* Click areas */}
                {Array.from({ length: 10 }).map((_, y) =>
                    Array.from({ length: 9 }).map((_, x) => (
                        <button
                            key={`c-${x}-${y}`}
                            className={`click-area cell-x-${x} cell-y-${y}`}
                            onClick={() => onCellClick(x, y)}
                            aria-label={`cell ${x},${y}`}
                            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                        />
                    ))
                )}
            </div>
        )
    }

    return (
        <MobileFrame>
            <div>
                <div className="row align-center mb-12">
                    <button className="btn-ghost" onClick={() => nav('/app/endgame')}>← 返回</button>
                    <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>布置残局</h2>
                    <div style={{ width: 64 }} />
                </div>
                <section className="paper-card card-pad">
                    {!initialLayout ? (
                        <div className="note-muted">提示：可从复盘页“残局导出”带入局面，或在下方直接摆子。</div>
                    ) : (
                        <div className="note-info">已载入局面，可直接保存或微调摆子。</div>
                    )}
                    <div className="mt-12 row-between">
                        <div>
                            <div className="text-14 muted">名称</div>
                            <div className="text-18 fw-600 mt-6">{name || '未命名残局'}</div>
                        </div>
                        <button
                            className={'btn-ghost'}
                            onClick={() => {
                                const next = window.prompt('输入模板名称：', name || '未命名残局')
                                if (next !== null) {
                                    const trimmed = next.trim()
                                    setName(trimmed)
                                }
                            }}
                            title={'改名字'}
                        >改名字</button>
                    </div>

                    <div className="mt-12 row-start gap-12 wrap">
                        <div className="pad-8 w-full">
                            <div className="col gap-8">
                                {/* 先手选择 */}
                                <div className="row-start gap-8 align-center">
                                    <span className="text-14">先手：</span>
                                    <button
                                        className={`btn ${turn === 'red' ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setTurn('red')}
                                        title="红方先手"
                                    >红</button>
                                    <button
                                        className={`btn ${turn === 'black' ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setTurn('black')}
                                        title="黑方先手"
                                    >黑</button>
                                </div>
                                <div>
                                    <div className="grid-7 gap-8 mb-16 card-surface">
                                        {/* 橡皮擦 */}
                                        <button
                                            className={`opt-btn opt-btn--icon ${mode === 'erase' ? 'opt-btn--active' : ''}`}
                                            onClick={() => setMode('erase')}
                                            title="橡皮擦：点击棋盘删除棋子"
                                        >
                                            ❌
                                        </button>

                                        {/* 红黑各子顺序与自定义棋局一致 */}
                                        {([
                                            { type: 'general' as PieceType, side: 'red' as Side },
                                            { type: 'general' as PieceType, side: 'black' as Side },
                                            { type: 'advisor' as PieceType, side: 'red' as Side },
                                            { type: 'advisor' as PieceType, side: 'black' as Side },
                                            { type: 'elephant' as PieceType, side: 'red' as Side },
                                            { type: 'elephant' as PieceType, side: 'black' as Side },
                                            { type: 'horse' as PieceType, side: 'red' as Side },
                                            { type: 'horse' as PieceType, side: 'black' as Side },
                                            { type: 'rook' as PieceType, side: 'red' as Side },
                                            { type: 'rook' as PieceType, side: 'black' as Side },
                                            { type: 'cannon' as PieceType, side: 'red' as Side },
                                            { type: 'cannon' as PieceType, side: 'black' as Side },
                                            { type: 'soldier' as PieceType, side: 'red' as Side },
                                            { type: 'soldier' as PieceType, side: 'black' as Side },
                                        ]).map(({ type, side }) => {
                                            const label = type === 'general' ? (side === 'red' ? '帅' : '将')
                                                : type === 'advisor' ? (side === 'red' ? '仕' : '士')
                                                    : type === 'elephant' ? (side === 'red' ? '相' : '象')
                                                        : type === 'horse' ? '马'
                                                            : type === 'rook' ? '车'
                                                                : type === 'cannon' ? '炮'
                                                                    : (side === 'red' ? '兵' : '卒')
                                            const active = mode === 'place' && brushSide === side && brushType === type
                                            return (
                                                <button
                                                    key={`${side}-${type}`}
                                                    className={`opt-btn ${active ? 'opt-btn--active' : ''} text-18 ${side === 'red' ? 'text-red' : 'text-gray-800'}`}
                                                    onClick={() => { setBrushSide(side); setBrushType(type); setMode('place') }}
                                                    title={`${side === 'red' ? '红' : '黑'}方 ${label}`}
                                                >
                                                    {label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="row-start gap-8">
                                    <button className="btn-ghost" onClick={() => setPieces([])}>清空棋盘</button>
                                </div>
                                <div className="note-muted text-12">提示：点击棋盘格即可{mode === 'erase' ? '删除棋子' : '放置所选棋子'}；上方直接选择任一红/黑棋子即可切换放置对象。</div>
                            </div>
                        </div>
                        <BoardEditor
                            pieces={pieces}
                            onCellClick={(x, y) => {
                                if (mode === 'erase') {
                                    setPieces(prev => prev.filter(p => !(p.x === x && p.y === y)))
                                } else {
                                    setPieces(prev => [...prev.filter(p => !(p.x === x && p.y === y)), { type: brushType, side: brushSide, x, y }])
                                }
                            }}
                        />
                    </div>

                    {/* 保存模板与对战入口 */}
                    <div className="mt-16 col gap-12">
                        <div className="row-start gap-12">
                            <button
                                className="btn-primary"
                                disabled={saving}
                                onClick={async () => {
                                    setSaveMsg('')
                                    setSaving(true)
                                    try {
                                        const req: any = { name: name || '未命名残局', layout: { ...layout, turn }, preview: '', isEndgame: true }
                                        await boardApi.createTemplate(req)
                                        setSaveMsg('已保存到我的残局（模板）')
                                    } catch (e: any) {
                                        console.error('保存残局模板失败: ', e)
                                        const msg = e?.message || '保存失败（需登录后端才能保存）。'
                                        setSaveMsg(msg)
                                    } finally {
                                        setSaving(false)
                                    }
                                }}
                            >保存模板</button>
                        </div>

                        {saveMsg && (
                            <div className="note-info text-13">{saveMsg} <button className="btn-ghost btn-xs" onClick={() => nav('/app/endgame')}>查看我的残局</button></div>
                        )}

                        <div className="row-start gap-12">
                            <button className="btn-primary" onClick={async () => {
                                const initialBoard = buildInitialBoard()
                                nav('/app/play', { state: { initialBoard, turn } })
                            }}>本地对战</button>
                            <button
                                className="btn-ghost"
                                title="保存为模板并创建好友房，邀请在线对战"
                                onClick={async () => {
                                    setSaveMsg('')
                                    setSaving(true)
                                    try {
                                        const payload: any = {
                                            name: name || '未命名残局',
                                            layout: { ...layout, turn },
                                            preview: '',
                                            isEndgame: true,
                                        }
                                        const res = await boardApi.createTemplate(payload)
                                        const boardId = (res as any)?.boardId ?? (res as any)?.id
                                        if (!boardId) throw new Error('未返回模板ID')
                                        // 跳转到在线对战页，使用 initialBoardId 直达创建好友房
                                        nav(`/app/live-battle?action=create&initialBoardId=${boardId}`)
                                    } catch (e: any) {
                                        const msg = e?.message || '创建好友房失败（需登录后端才能创建）。'
                                        setSaveMsg(msg)
                                    } finally {
                                        setSaving(false)
                                    }
                                }}
                            >在线邀请对战</button>
                        </div>
                    </div>
                </section>
            </div>
        </MobileFrame>
    )
}
