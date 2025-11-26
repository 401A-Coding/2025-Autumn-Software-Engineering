import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectBattle } from '../../services/battlesSocket';
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket';
import { battleApi, userApi } from '../../services/api';
import OnlineBoard from '../../features/chess/OnlineBoard';
import './LiveBattle.css';

export default function LiveBattle() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const action = searchParams.get('action'); // create | join | match | null
    const [battleId, setBattleId] = useState<number | ''>('');
    const [joinIdInput, setJoinIdInput] = useState<string>('');
    const [connected, setConnected] = useState(false);
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
    const [moves, setMoves] = useState<BattleMove[]>([]);
    const movesRef = useRef<BattleMove[]>([]);
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null);
    const battleIdRef = useRef<number | null>(null);
    const [myUserId, setMyUserId] = useState<number | null>(null);
    const latestSnapshotRef = useRef<BattleSnapshot | null>(null);
    const fallbackTimerRef = useRef<number | null>(null);
    const pendingSeqRef = useRef<number | null>(null);
    const createLockRef = useRef(false);
    const matchLockRef = useRef(false);
    const autoActionRef = useRef(false);

    const conn = useMemo(() => {
        const c = connectBattle();
        connRef.current = c;
        c.socket.on('connect', () => {
            setConnected(true);
            // 重连自动 rejoin & snapshot
            const id = battleIdRef.current;
            if (id && id > 0) {
                const lastSeq = movesRef.current.length ? movesRef.current[movesRef.current.length - 1].seq : 0;
                c.join(id, lastSeq);
                c.snapshot(id);
            }
        });
        c.socket.on('disconnect', () => setConnected(false));
        c.onSnapshot((s) => {
            console.log('[WS] snapshot', s);
            latestSnapshotRef.current = s;
            setSnapshot(s);

            // snapshot 主要用于纠偏：仅当服务端 moves 更新得更“新”时才用它覆盖本地
            setMoves((prev) => {
                const snapMoves = s.moves || [];
                const prevLast = prev.length ? prev[prev.length - 1].seq : 0;
                const snapLast = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0;

                if (snapLast > prevLast) {
                    movesRef.current = snapMoves;
                    return snapMoves;
                }

                return prev;
            });

            // 收到任何权威快照后，取消保底计时
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }
            pendingSeqRef.current = null;
        });
        c.onMove((m) => {
            console.log('[WS] move', m);
            // 去重：若已包含该 seq，忽略
            if (movesRef.current.some((mv) => mv.seq === m.seq)) {
                return;
            }
            // 严格顺序：若不是上一个序号的下一步，立即拉取权威快照对齐
            const lastSeq = movesRef.current.length ? movesRef.current[movesRef.current.length - 1].seq : 0;
            if (m.seq !== lastSeq + 1) {
                const id = battleIdRef.current;
                if (id) {
                    c.snapshot(id);
                }
                // 仍然先乐观接入，避免 UI 卡顿；随后 snapshot 会对齐
            }
            setMoves((prev) => {
                const next = [...prev, m];
                movesRef.current = next;
                return next;
            });
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
        // 增量回放：服务端在 join 带 lastSeq 时可能补发最近 moves
        c.onReplay((r) => {
            const currLast = movesRef.current.length ? movesRef.current[movesRef.current.length - 1].seq : 0;
            // 仅当服务端 fromSeq 与本地一致或略小（容忍重复）时接入
            if (r.fromSeq <= currLast) {
                const filtered = r.moves.filter((mv) => mv.seq > currLast);
                if (filtered.length === 0) return;
                setMoves((prev) => {
                    const next = [...prev, ...filtered];
                    movesRef.current = next;
                    return next;
                });
            } else {
                // fromSeq 大于当前，说明本地缺口过大，直接拉权威快照
                const id = battleIdRef.current;
                if (id) c.snapshot(id);
            }
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
        conn.join(id, 0);
        conn.snapshot(id);
    };

    const handleAttemptMove = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
        const id = Number(battleId);
        if (!id) return;
        try {
            await conn.move(id, from, to);
        } catch (e) {
            console.error('[MOVE ERROR]', e);
            conn.snapshot(id);
        }
    };

    const handleCreate = async () => {
        if (createLockRef.current) return;
        createLockRef.current = true;
        try {
            const data = await battleApi.create({ mode: 'pvp' } as { mode: string });
            const id: number = (data as { battleId: number }).battleId;
            setBattleId(id);
            conn.join(id, 0);
            conn.snapshot(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`创建失败: ${msg}`);
        } finally {
            createLockRef.current = false;
        }
    };

    const handleMatch = async () => {
        if (matchLockRef.current) return;
        matchLockRef.current = true;
        try {
            const data = await battleApi.match('pvp');
            const id: number = (data as { battleId: number }).battleId;
            setBattleId(id);
            conn.join(id, 0);
            conn.snapshot(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`匹配失败: ${msg}`);
        } finally {
            matchLockRef.current = false;
        }
    };

    // 若来自模式选择页，则自动执行创建/匹配一次
    useEffect(() => {
        if (!action || autoActionRef.current) return;
        if (!battleId) {
            if (action === 'create') {
                handleCreate();
            } else if (action === 'match') {
                handleMatch();
            }
            autoActionRef.current = true; // 标记已自动执行一次，避免重复
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action, battleId]);

    const inRoom = battleId !== '' && Number(battleId) > 0;

    useEffect(() => {
        battleIdRef.current = typeof battleId === 'number' ? battleId : null;
    }, [battleId]);

    // 心跳：进入房间且连接后启动 interval；离开或断开时清理
    const heartbeatRef = useRef<number | null>(null);
    useEffect(() => {
        if (inRoom && connected && battleIdRef.current) {
            // 先立即发送一次心跳以刷新在线状态
            connRef.current?.heartbeat?.(battleIdRef.current);
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
            }
            heartbeatRef.current = window.setInterval(() => {
                if (battleIdRef.current) {
                    connRef.current?.heartbeat?.(battleIdRef.current);
                }
            }, 20000); // 20s
        } else {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        }
        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [inRoom, connected]);

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

    const handleExit = async () => {
        if (!inRoom) {
            navigate('/app/online-lobby');
            return;
        }
        const ok = window.confirm('确认退出对局？');
        if (!ok) return;
        try {
            // 先调用 REST 兜底离开，幂等返回
            const id = battleIdRef.current;
            if (id) {
                try { await battleApi.leave(id); } catch { /* 忽略错误，继续本地清理 */ }
            }
            // 然后关闭连接并清理本地状态
            connRef.current?.socket?.close();
        } finally {
            setSnapshot(null);
            setMoves([]);
            setBattleId('');
            setJoinIdInput('');
            navigate('/app/online-lobby');
        }
    };

    const handleReconnect = () => {
        try {
            connRef.current?.socket?.connect();
        } catch {
            // 忽略
        }
    };

    useEffect(() => {
        (window as any).battleDebug = { snapshot, moves };
    }, [snapshot, moves]);

    return (
        <div className="card-pad">
            <h2>在线对战</h2>
            <div className="muted livebattle-conn-status">连接状态：{connected ? '已连接' : '未连接'}</div>

            {/* 未进入房间：显示加入/创建/匹配（根据 action 裁剪） */}
            {!inRoom && (
                <div className="livebattle-actions-row">
                    {(!action || action === 'join') && (
                        <>
                            <input className="livebattle-room-input"
                                type="text"
                                inputMode="numeric"
                                pattern="\\d*"
                                placeholder="房间号"
                                value={joinIdInput}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/[^0-9]/g, '');
                                    setJoinIdInput(v);
                                }}
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
                <div className="livebattle-banner">
                    <div className="livebattle-banner-title">
                        {action === 'create' ? '正在创建房间…' : '正在为你匹配…'}
                    </div>
                    <div className="livebattle-banner-sub">请稍候，完成后会显示房间号</div>
                </div>
            )}

            {/* 进入房间：展示房间号；等待阶段不显示棋盘，开始后显示棋盘 */}
            {inRoom && (
                <div className="mt-2">
                    {/* 醒目的房间号徽章 */}
                    <div className="livebattle-room-bar">
                        {snapshot?.source === 'room' && (
                            <>
                                <div className="livebattle-room-badge">房间号：{battleId}</div>
                                <button className="btn-ghost" onClick={copyRoomId}>复制</button>
                            </>
                        )}
                        <button className="btn-ghost livebattle-exit" onClick={handleExit}>退出对局</button>
                        {snapshot?.status === 'waiting' && snapshot.players.length === 1 && snapshot.players[0] === myUserId && (
                            <button className="btn-ghost livebattle-cancel" onClick={async () => {
                                try {
                                    await battleApi.cancel(Number(battleId));
                                    setBattleId('');
                                    setSnapshot(null);
                                    navigate('/app/online-lobby');
                                } catch (e) {
                                    alert('取消失败: ' + (e instanceof Error ? e.message : String(e)));
                                }
                            }}>取消匹配</button>
                        )}
                        {snapshot?.source === 'room' &&
                            snapshot.status === 'waiting' &&
                            snapshot.ownerId === myUserId && (
                                <button className="btn-ghost livebattle-cancel" onClick={async () => {
                                    const ok = window.confirm('确认取消房间？');
                                    if (!ok) return;
                                    try {
                                        await battleApi.cancel(Number(battleId));
                                        setBattleId('');
                                        setSnapshot(null);
                                        navigate('/app/online-lobby');
                                    } catch (e) {
                                        alert('取消失败: ' + (e instanceof Error ? e.message : String(e)));
                                    }
                                }}>
                                    取消房间
                                </button>
                            )}
                    </div>
                    {snapshot && (
                        <>
                            <div className="livebattle-state-line">
                                对局类型：{snapshot.source === 'room' ? '好友房' : '快速匹配'}
                                · 状态：{snapshot.status === 'waiting' ? '等待中' : '对局中'}
                            </div>
                            {inRoom && !connected && (
                                <div className="livebattle-disconnect-banner" role="status" aria-live="polite">
                                    <span className="livebattle-dot-yellow" />
                                    与服务器连接中断，正在尝试重连…
                                    <button className="btn-ghost" onClick={handleReconnect}>重试连接</button>
                                </div>
                            )}
                            <div className="muted livebattle-players-line">玩家（在线高亮） · 我：{myUserId ?? '-'}</div>
                            <div className="livebattle-players-wrap">
                                {snapshot.players.map(pid => {
                                    const online = snapshot.onlineUserIds?.includes(pid);
                                    return (
                                        <div
                                            key={pid}
                                            data-testid={`player-pill-${pid}`}
                                            className={"livebattle-player-pill" + (online ? " online" : "")}
                                        >
                                            <span className="livebattle-player-dot" />
                                            <span>{pid}{pid === myUserId ? ' (我)' : ''}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {(snapshot.status !== 'waiting' || (snapshot.players?.length ?? 0) >= 2) ? (
                                <div className="livebattle-board-wrapper">
                                    <OnlineBoard
                                        moves={moves}
                                        turnIndex={snapshot.turnIndex}
                                        players={snapshot.players}
                                        myUserId={myUserId}
                                        winnerId={snapshot.winnerId}
                                        authoritativeBoard={snapshot.board}
                                        authoritativeTurn={snapshot.turn}
                                        snapshotMoves={snapshot.moves}
                                        onAttemptMove={handleAttemptMove}
                                    />
                                </div>
                            ) : (
                                <div className="empty-center livebattle-board-wrapper">
                                    <div className="livebattle-offline-hint">
                                        房间已创建，正在等待好友加入
                                        <span className="loading-dots"><span></span><span></span><span></span></span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {!snapshot && (
                        <div className="empty-center livebattle-board-wrapper">
                            <div>
                        // 调试：在浏览器控制台可通过 window.battleDebug 查看当前 snapshot 与 moves
                                正在加载房间状态
                                <span className="loading-dots"><span></span><span></span><span></span></span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 返回入口：仅在未入房时提供“返回主页” */}
            {!inRoom && (
                <div className="livebattle-return-bar">
                    <button className="btn-ghost" onClick={() => navigate('/app')}>返回主页</button>
                </div>
            )}
        </div>
    );
}
