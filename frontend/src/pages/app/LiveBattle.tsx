import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectBattle } from '../../services/battlesSocket';
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket';
import { battleApi, userApi } from '../../services/api';
import OnlineBoard from '../../features/chess/OnlineBoard';

export default function LiveBattle() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const action = searchParams.get('action'); // create | join | match | null
    const [battleId, setBattleId] = useState<number | ''>('');
    const [joinIdInput, setJoinIdInput] = useState<string>('');
    const [connected, setConnected] = useState(false);
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
    const [moves, setMoves] = useState<BattleMove[]>([]);
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null);
    const battleIdRef = useRef<number | null>(null);
    const [myUserId, setMyUserId] = useState<number | null>(null);
    const latestSnapshotRef = useRef<BattleSnapshot | null>(null);
    const fallbackTimerRef = useRef<number | null>(null);
    const pendingSeqRef = useRef<number | null>(null);

    const conn = useMemo(() => {
        const c = connectBattle();
        connRef.current = c;
        c.socket.on('connect', () => setConnected(true));
        c.socket.on('disconnect', () => setConnected(false));
        c.onSnapshot((s) => {
            latestSnapshotRef.current = s;
            setSnapshot(s);
            setMoves(s.moves || []);
            // 收到任何权威快照后，取消保底计时
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            pendingSeqRef.current = null;
        });
        c.onMove((m) => {
            setMoves((prev) => [...prev, m]);
            // 启动保底计时：若短时间内未收到包含该步的 snapshot，则主动拉取一次
            pendingSeqRef.current = m.seq;
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
            }
            fallbackTimerRef.current = window.setTimeout(() => {
                const snap = latestSnapshotRef.current;
                const hasThisMove = !!snap?.moves?.some((mv) => mv.seq === m.seq);
                if (!hasThisMove) {
                    c.snapshot(m.battleId);
                }
                fallbackTimerRef.current = null;
            }, 600);
        });
        // 有玩家加入事件时，主动刷新当前房间的快照
        c.onPlayerJoin(() => {
            const id = battleIdRef.current;
            if (id && id > 0) {
                c.snapshot(id);
            }
        });
        return c;
    }, []);

    useEffect(() => {
        return () => {
            connRef.current?.socket?.close();
        };
    }, []);

    useEffect(() => {
        // 拉取当前用户信息，用于判定阵营
        (async () => {
            try {
                const me = await userApi.getMe();
                setMyUserId(me.id as number);
            } catch {
                setMyUserId(null);
            }
        })();
    }, []);

    const handleJoin = async () => {
        const raw = joinIdInput.trim();
        if (!/^\d+$/.test(raw)) return;
        const id = Number(raw);
        try {
            // 先走 REST 入座，确保服务端把当前用户加入 players
            await battleApi.join(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`加入房间失败：${msg}`);
        }
        setBattleId(id);
        conn.join(id);
        conn.snapshot(id);
    };

    const handleAttemptMove = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        const id = Number(battleId);
        if (!id) return;
        conn.move(id, from, to);
    };

    const handleCreate = async () => {
        try {
            const data = await battleApi.create({ mode: 'pvp' } as { mode: string });
            const id: number = (data as { battleId: number }).battleId;
            setBattleId(id);
            conn.join(id);
            conn.snapshot(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`创建失败: ${msg}`);
        }
    };

    const handleMatch = async () => {
        try {
            const data = await battleApi.match('pvp');
            const id: number = (data as { battleId: number }).battleId;
            setBattleId(id);
            conn.join(id);
            conn.snapshot(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`匹配失败: ${msg}`);
        }
    };

    // 若来自模式选择页，则自动执行创建/匹配一次
    useEffect(() => {
        if (!action) return;
        if (action === 'create' && !battleId) {
            handleCreate();
        }
        if (action === 'match' && !battleId) {
            handleMatch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action]);

    const inRoom = battleId !== '' && Number(battleId) > 0;

    useEffect(() => {
        battleIdRef.current = typeof battleId === 'number' ? battleId : null;
    }, [battleId]);

    const copyRoomId = async () => {
        const id = battleIdRef.current;
        if (!id) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(String(id));
                alert('房间号已复制');
            } else {
                // 兼容处理
                const ok = window.prompt('复制房间号', String(id));
                if (ok) {
                    // no-op
                }
            }
        } catch {
            // 忽略
        }
    };

    const handleExit = () => {
        if (!inRoom) {
            navigate('/app/online-lobby');
            return;
        }
        const ok = window.confirm('确认退出对局？');
        if (!ok) return;
        try {
            // 若后端已有离开事件，可在此 emit('battle.leave', { battleId })
            // 目前仅做前端级别退出：关闭连接并清理本地状态
            connRef.current?.socket?.close();
        } finally {
            setSnapshot(null);
            setMoves([]);
            setBattleId('');
            setJoinIdInput('');
            navigate('/app/online-lobby');
        }
    };

    return (
        <div className="card-pad">
            <h2>在线对战</h2>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>连接状态：{connected ? '已连接' : '未连接'}</div>

            {/* 未进入房间：显示加入/创建/匹配（根据 action 裁剪） */}
            {!inRoom && (
                <div className="row gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {(!action || action === 'join') && (
                        <>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\\d*"
                                placeholder="房间号"
                                value={joinIdInput}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/[^0-9]/g, '');
                                    setJoinIdInput(v);
                                }}
                                style={{ width: 140 }}
                            />
                            <button
                                className="btn-ghost"
                                onClick={handleJoin}
                                disabled={!connected || !/^\d+$/.test(joinIdInput)}
                            >
                                加入房间
                            </button>
                        </>
                    )}
                    {!action && (
                        <>
                            <button className="btn-primary" onClick={handleCreate} disabled={!connected}>创建房间</button>
                            <button className="btn-ghost" onClick={handleMatch} disabled={!connected}>快速匹配</button>
                        </>
                    )}
                    {action === 'create' && !battleId && <span className="muted">正在创建房间...</span>}
                    {action === 'match' && !battleId && <span className="muted">正在匹配...</span>}
                </div>
            )}

            {/* 高亮创建/匹配中的状态横幅 */}
            {!inRoom && (action === 'create' || action === 'match') && !battleId && (
                <div style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--muted-bg)',
                    color: 'var(--control-text)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
                        {action === 'create' ? '正在创建房间…' : '正在为你匹配…'}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>请稍候，完成后会显示房间号</div>
                </div>
            )}

            {/* 进入房间：展示房间号；等待阶段不显示棋盘，开始后显示棋盘 */}
            {inRoom && (
                <div className="mt-2">
                    {/* 醒目的房间号徽章 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'var(--control-bg)',
                            color: 'var(--accent)',
                            border: '1px solid var(--control-border)',
                            fontWeight: 700,
                            fontSize: 18,
                        }}>
                            房间号：{battleId}
                        </div>
                        <button className="btn-ghost" onClick={copyRoomId}>复制</button>
                        <button className="btn-ghost" onClick={handleExit} style={{ color: 'var(--accent-dark)' }}>退出对局</button>
                    </div>
                    {snapshot && (
                        <>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                                对局状态：{snapshot.status}{snapshot.status === 'waiting' && '（等待好友加入）'}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>玩家：[{snapshot.players.join(', ')}] · 我：{myUserId ?? '-'}</div>
                            {(snapshot.status !== 'waiting' || (snapshot.players?.length ?? 0) >= 2) ? (
                                <div style={{ marginTop: 12 }}>
                                    <OnlineBoard
                                        moves={moves}
                                        turnIndex={snapshot.turnIndex}
                                        players={snapshot.players}
                                        myUserId={myUserId}
                                        winnerId={snapshot.winnerId}
                                        authoritativeBoard={snapshot.board}
                                        authoritativeTurn={snapshot.turn}
                                        onAttemptMove={handleAttemptMove}
                                    />
                                </div>
                            ) : (
                                <div className="empty-center" style={{ marginTop: 12 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        房间已创建，正在等待好友加入
                                        <span className="loading-dots"><span></span><span></span><span></span></span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {!snapshot && (
                        <div className="empty-center" style={{ marginTop: 12 }}>
                            <div>
                                正在加载房间状态
                                <span className="loading-dots"><span></span><span></span><span></span></span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 返回入口：仅在未入房时提供“返回主页” */}
            {!inRoom && (
                <div style={{ marginTop: 12 }}>
                    <button className="btn-ghost" onClick={() => navigate('/app')}>返回主页</button>
                </div>
            )}
        </div>
    );
}
