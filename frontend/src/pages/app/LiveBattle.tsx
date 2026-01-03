import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { connectBattle } from '../../services/battlesSocket';
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket';
import { battleApi, userApi } from '../../services/api';
import OnlineBoard from '../../features/chess/OnlineBoard';
import './LiveBattle.css';
import UserAvatar from '../../components/UserAvatar';
import DropdownMenu from '../../components/DropdownMenu';

export default function LiveBattle() {
    const DISCONNECT_TTL_MINUTES = 15;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const action = searchParams.get('action'); // create | join | match | null
    const joinRoomParam = searchParams.get('room');
    const initialBoardIdParam = searchParams.get('initialBoardId');
    const initialBoardId = initialBoardIdParam && /^\d+$/.test(initialBoardIdParam)
        ? Number(initialBoardIdParam)
        : undefined;
    const [battleId, setBattleId] = useState<number | ''>('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinIdInput, setJoinIdInput] = useState<string>('');
    const [connected, setConnected] = useState(false);
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
    const [endMessage, setEndMessage] = useState<string | null>(null);
    const [endKind, setEndKind] = useState<'win' | 'lose' | 'draw' | 'info' | null>(null);
    const [endCountdown, setEndCountdown] = useState<number | null>(null);
    const [moves, setMoves] = useState<BattleMove[]>([]);
    const movesRef = useRef<BattleMove[]>([]);
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null);
    const battleIdRef = useRef<number | null>(null);
    const [myUserId, setMyUserId] = useState<number | null>(null);
    const myUserIdRef = useRef<number | null>(null);
    const latestSnapshotRef = useRef<BattleSnapshot | null>(null);
    const fallbackTimerRef = useRef<number | null>(null);
    const pendingSeqRef = useRef<number | null>(null);
    const createLockRef = useRef(false);
    const matchLockRef = useRef(false);
    const autoActionRef = useRef(false);
    const popGuardActiveRef = useRef(false);
    const allowPopRef = useRef(false);
    const graceResignTimerRef = useRef<number | null>(null);
    const isUnmountingRef = useRef(false);
    const offlineAlreadySentRef = useRef(false);  // 标记已发送 offline

    const scheduleGraceResign = (id: number) => {
        if (graceResignTimerRef.current) {
            clearTimeout(graceResignTimerRef.current);
        }
        graceResignTimerRef.current = window.setTimeout(() => {
            battleApi.resign(id).catch(() => { /* ignore */ });
            clearPersistBattleId();
            graceResignTimerRef.current = null;
        }, 2 * 60 * 1000); // 2 min grace
    };

    const clearGraceResign = () => {
        if (graceResignTimerRef.current) {
            clearTimeout(graceResignTimerRef.current);
            graceResignTimerRef.current = null;
        }
    };

    // Profiles for overlay and modal
    const [myProfile, setMyProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null);
    const [opponentProfile, setOpponentProfile] = useState<{ id: number; nickname?: string; avatarUrl?: string } | null>(null);
    const [showProfileModal, setShowProfileModal] = useState<{ userId: number } | null>(null);
    const [profileDetail, setProfileDetail] = useState<{ loading: boolean; data: any | null; error?: string }>({ loading: false, data: null });
    const [showDrawOfferDialog, setShowDrawOfferDialog] = useState(false);
    const [drawOfferFromUserId, setDrawOfferFromUserId] = useState<number | null>(null);
    const [showUndoOfferDialog, setShowUndoOfferDialog] = useState(false);
    const [undoOfferFromUserId, setUndoOfferFromUserId] = useState<number | null>(null);
    const PERSIST_KEY = 'livebattle.activeBattleId';
    const persistBattleId = (id: number) => {
        try { localStorage.setItem(PERSIST_KEY, String(id)); } catch { /* ignore */ }
    };
    const clearPersistBattleId = () => {
        try { localStorage.removeItem(PERSIST_KEY); } catch { /* ignore */ }
    };

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
            console.log('[WS] snapshot', s, 'myUserId=', myUserId);
            latestSnapshotRef.current = s;
            setSnapshot(s);
            // derive opponent profile when possible（使用 ref 避免闭包问题）
            const currentUserId = myUserIdRef.current;
            if (currentUserId && Array.isArray(s.players)) {
                const oppId = s.players.find((uid) => uid !== currentUserId);
                if (typeof oppId === 'number') {
                    (async () => {
                        try {
                            const info = await userApi.getById(oppId);
                            setOpponentProfile({ id: info.id, nickname: info.nickname, avatarUrl: info.avatarUrl || undefined });
                        } catch { }
                    })();
                }
            }

            // 若对局结束，给出一次性的结束提示（尽量使用 myUserId 判别阵营；缺失时也给基础提示）
            if (s.status === 'finished') {
                clearPersistBattleId();
                console.log('[WS] finished snapshot', {
                    myUserId,
                    players: s.players,
                    winnerId: s.winnerId,
                    finishReason: s.finishReason,
                });

                const iAmRed = myUserId != null && s.players[0] === myUserId;
                const iAmBlack = myUserId != null && s.players[1] === myUserId;
                const iAmPlayer = iAmRed || iAmBlack;

                if (!iAmPlayer) {
                    // 观战或尚未获取到当前用户信息：给出基础结束提示，避免完全无反馈
                    setEndMessage('对局已结束，可在「历史对局」中查看记录。');
                    setEndKind('info');
                    if (battleIdRef.current) {
                        setEndCountdown(3);
                    }
                    // 后续仍会通过 snapshot/moves 驱动棋盘状态
                } else if (myUserId) {
                    console.log('[WS] finished as player, computing end message');
                    let msg = '对局已结束。';
                    let kind: 'win' | 'lose' | 'draw' | 'info' = 'info';

                    const baseByWinner = () => {
                        if (s.winnerId == null) {
                            kind = 'draw';
                            msg = '对局已结束，双方打成平局。';
                            return;
                        }
                        if (s.winnerId === myUserId) {
                            kind = 'win';
                            msg = '对局已结束，您已获胜。';
                        } else {
                            kind = 'lose';
                            msg = '对局已结束，您已落败。';
                        }
                    };

                    switch (s.finishReason) {
                        case 'resign': {
                            if (s.winnerId === myUserId) {
                                kind = 'win';
                                msg = '对局已结束，对手已认输，您获得胜利。';
                            } else if (s.winnerId != null) {
                                kind = 'lose';
                                msg = '您已认输，对局结束，本局记为落败。';
                            } else {
                                baseByWinner();
                            }
                            break;
                        }
                        case 'checkmate': {
                            baseByWinner();
                            if (s.winnerId === myUserId) msg = '将死对手！恭喜您获胜。';
                            if (s.winnerId != null && s.winnerId !== myUserId) msg = '您已被将死，本局落败。';
                            break;
                        }
                        case 'timeout': {
                            if (s.winnerId === myUserId) {
                                kind = 'win';
                                msg = '对手超时未操作，本局判您获胜。';
                            } else if (s.winnerId != null) {
                                kind = 'lose';
                                msg = '您因超时未操作，本局记为落败。';
                            } else {
                                kind = 'draw';
                                msg = '双方超时，本局以平局结束。';
                            }
                            break;
                        }
                        case 'disconnect_ttl': {
                            if (s.winnerId === myUserId) {
                                kind = 'win';
                                msg = '对手长时间离线，本局判您获胜。';
                            } else if (s.winnerId != null) {
                                kind = 'lose';
                                msg = '您长时间离线，本局记为落败。';
                            } else {
                                kind = 'draw';
                                msg = '玩家长时间离线，本局以平局结束。';
                            }
                            break;
                        }
                        case 'draw_agreed': {
                            kind = 'draw';
                            msg = '双方同意和棋，本局以平局结束。';
                            break;
                        }
                        default: {
                            baseByWinner();
                        }
                    }

                    // 结束时提示用户可在历史对局中查看并复盘
                    setEndMessage(msg + ' 本局已自动保存到历史记录，可在「历史对局」中复盘。');
                    setEndKind(kind);
                    // 若当前仍在房间内，则启动 3 秒倒计时自动返回大厅
                    if (battleIdRef.current) {
                        setEndCountdown(3);
                    }
                }
            }

            // snapshot 主要用于纠偏：仅当服务端 moves 更新得更“新”时才用它覆盖本地
            setMoves((prev) => {
                const snapMoves = s.moves || [];
                const prevLast = prev.length ? prev[prev.length - 1].seq : 0;
                const snapLast = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0;

                // 更新条件：快照有新增步数(snapLast > prevLast) 或 减少步数（悔棋：snapLast < prevLast）
                if (snapLast !== prevLast) {
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
        c.onOfflineNotice((p) => {
            const id = battleIdRef.current;
            if (!id || p.battleId !== id) return;
            // 拉一次 snapshot，确保 onlineUserIds 更新并触发 UI 提示
            c.snapshot(id);
        });
        // 监听提和请求
        c.onDrawOffer((p) => {
            const currentUserId = myUserIdRef.current;
            console.log('[DRAW] Received draw offer:', p, 'myUserId=', currentUserId);
            if (p.fromUserId !== currentUserId) {
                console.log('[DRAW] Showing dialog because fromUserId !== myUserId');
                setDrawOfferFromUserId(p.fromUserId);
                setShowDrawOfferDialog(true);
            } else {
                console.log('[DRAW] Ignoring because I am the sender');
            }
        });
        // 监听提和被拒绝
        c.onDrawDeclined((p) => {
            const currentUserId = myUserIdRef.current;
            console.log('[DRAW] Received draw declined:', p, 'myUserId=', currentUserId);
            if (p.toUserId === currentUserId) {
                alert('对方拒绝了您的提和请求');
            }
        });
        // 监听悔棋请求
        c.onUndoOffer((p) => {
            const currentUserId = myUserIdRef.current;
            console.log('[UNDO] Received undo offer:', p, 'myUserId=', currentUserId);
            if (p.fromUserId !== currentUserId) {
                console.log('[UNDO] Showing dialog because fromUserId !== myUserId');
                setUndoOfferFromUserId(p.fromUserId);
                setShowUndoOfferDialog(true);
            } else {
                console.log('[UNDO] Ignoring because I am the sender');
            }
        });
        // 监听悔棋接受
        c.onUndoAccepted(() => {
            console.log('[UNDO] Undo accepted, board will be updated via snapshot');
        });
        // 监听悔棋被拒绝
        c.onUndoDeclined((p) => {
            const currentUserId = myUserIdRef.current;
            console.log('[UNDO] Received undo declined:', p, 'myUserId=', currentUserId);
            if (p.toUserId === currentUserId) {
                alert('对方拒绝了您的悔棋请求');
            }
        });
        return c;
    }, []);

    useEffect(() => {
        return () => {
            isUnmountingRef.current = true;
            const id = battleIdRef.current;
            const status = latestSnapshotRef.current?.status;
            const alreadySent = offlineAlreadySentRef.current;
            console.log('[unmount] cleanup: id=', id, 'status=', status, 'offlineAlreadySent=', alreadySent);

            // 如果有 battleId，就必须确保 offline 被发出去
            if (id) {
                console.log('[unmount] cleanup: starting for battleId=', id, 'socket.connected=', connRef.current?.socket?.connected);

                // 立即发送 offline 信号（同步 fire-and-forget）
                // 即使 popstate 已标记发送过，也要再发一次（后端幂等），因为 popstate 时可能 socket 已断
                (async () => {
                    // 先等 50ms，让 history.back() 的路由导航初始化，但 socket 还没完全关闭
                    await new Promise(r => setTimeout(r, 50));

                    let offlineSent = false;
                    console.log('[unmount] firing offline signal for id=', id, 'connected=', connRef.current?.socket?.connected);
                    try {
                        // 使用 fire-and-forget 模式，尝试 WebSocket
                        const offlinePromise = connRef.current?.offline?.(id);
                        if (offlinePromise) {
                            offlinePromise.then((result) => {
                                console.log('[unmount] offline ack received:', result);
                                if (result?.ok) offlineSent = true;
                            }).catch(e => {
                                console.error('[unmount] offline error:', e?.message);
                            });
                        }
                    } catch (e) {
                        console.error('[unmount] offline send error:', e);
                    }

                    // 等待一点时间看 offline 是否成功
                    await new Promise(r => setTimeout(r, 300));

                    // 如果 WebSocket 未成功，则用 REST 作为 fallback
                    if (!offlineSent) {
                        console.log('[unmount] WebSocket offline failed, using REST fallback for id=', id);
                        try {
                            const userId = myUserIdRef.current;
                            const baseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
                            const url = `${baseUrl}/api/v1/battles/${id}/offline`;
                            // 使用 fetch with keepalive，确保页面卸载时也能发送请求
                            // 在 body 中传递 userId（无需认证）
                            await fetch(url, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ userId }),
                                keepalive: true,
                            }).catch(e => {
                                console.error('[unmount] REST offline error:', e);
                            });
                            console.log('[unmount] REST offline sent via fetch with keepalive');
                        } catch (e) {
                            console.error('[unmount] REST offline fetch error:', e);
                        }
                    }

                    // 只有进行中的对局才需要 2 分钟宽限认输
                    if (status === 'playing') {
                        console.log('[unmount] scheduling grace resign for playing battle');
                        scheduleGraceResign(id);
                    }

                    // 300ms 后关闭 socket（给 offline 消息在出站队列中沉淀）
                    await new Promise(r => setTimeout(r, 300));
                    console.log('[unmount] closing socket');
                    connRef.current?.socket?.close();
                })();
            } else {
                // 没有 battleId，直接断开
                connRef.current?.socket?.close();
            }
        };
    }, []);

    // 拉取弹窗内的完整用户信息，避免跳出对局
    useEffect(() => {
        if (!showProfileModal) {
            setProfileDetail({ loading: false, data: null, error: undefined });
            return;
        }
        const uid = showProfileModal.userId;
        let alive = true;
        (async () => {
            setProfileDetail({ loading: true, data: null, error: undefined });
            try {
                const data = await userApi.getById(uid);
                if (!alive) return;
                setProfileDetail({ loading: false, data: data as any, error: undefined });
            } catch (e: any) {
                if (!alive) return;
                setProfileDetail({ loading: false, data: null, error: e?.message || '加载用户信息失败' });
            }
        })();
        return () => { alive = false; };
    }, [showProfileModal]);

    useEffect(() => {
        // 拉取当前用户信息，用于判定阵营
        (async () => {
            try {
                const me = await userApi.getMe();
                console.log('[ME] got user', me);
                setMyUserId(me.id as number);
                myUserIdRef.current = me.id as number;
                setMyProfile({ id: me.id as number, nickname: (me as any).nickname, avatarUrl: (me as any).avatarUrl });
            } catch (e) {
                console.error('[ME] getMe failed', e);
                setMyUserId(null);
                myUserIdRef.current = null;
            }
        })();
    }, []);

    // 若已在房间但未拿到对手头像（可能因为恢复时先拿到 snapshot，再拿到 myUserId），补拉对手资料
    useEffect(() => {
        if (!snapshot || !myUserId) return;
        if (opponentProfile) return;
        const oppId = snapshot.players?.find((uid) => uid !== myUserId);
        if (!oppId) return;
        let alive = true;
        (async () => {
            try {
                const info = await userApi.getById(oppId);
                if (!alive) return;
                setOpponentProfile({ id: info.id, nickname: info.nickname, avatarUrl: info.avatarUrl || undefined });
            } catch {
                /* ignore */
            }
        })();
        return () => { alive = false; };
    }, [snapshot, myUserId, opponentProfile]);

    const handleJoin = async () => {
        const raw = joinIdInput.trim();
        if (!/^\d+$/.test(raw)) return;
        const id = Number(raw);
        try {
            // 先走 REST 入座，确保服务端把当前用户加入 players
            await battleApi.join(id);
            setJoinError(null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setJoinError(msg || '加入房间失败');
            return;
        }
        setBattleId(id);
        conn.join(id, 0);
        conn.snapshot(id);
    };

    // 通过 query 参数自动加入指定房间（用于“加入好友房”直达）
    const handleAutoJoin = async (id: number) => {
        try {
            await battleApi.join(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`加入房间失败：${msg}`);
        }
        setBattleId(id);
        conn.join(id, 0);
        conn.snapshot(id);
    };

    // 刷新/重开页面后，若存在未结束对局，则尝试恢复并直接 rejoin
    useEffect(() => {
        const saved = (() => {
            try { return localStorage.getItem(PERSIST_KEY); } catch { return null; }
        })();
        if (!saved) return;
        const id = Number(saved);
        if (!id) {
            clearPersistBattleId();
            return;
        }
        autoActionRef.current = true; // 避免再次自动匹配/创建
        (async () => {
            try {
                const snap = await battleApi.snapshot(id);
                // 若对局已结束则清理
                if (snap.status === 'finished') {
                    clearPersistBattleId();
                    return;
                }
                setBattleId(id);
                setSnapshot(snap as BattleSnapshot);
                const snapMoves = (snap as BattleSnapshot).moves || [];
                setMoves(snapMoves);
                movesRef.current = snapMoves;
                battleIdRef.current = id;
                const lastSeq = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0;
                conn.join(id, lastSeq);
                conn.snapshot(id);
            } catch {
                clearPersistBattleId();
            }
        })();
    }, []);

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
            const req: any = { mode: 'pvp' };
            if (typeof initialBoardId === 'number') {
                req.initialBoardId = initialBoardId;
            }
            const data = await battleApi.create(req as { mode: string });
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

    // 若来自模式选择页或直达参数，则自动执行创建/匹配/加入一次
    useEffect(() => {
        if (autoActionRef.current) return;
        if (!battleId) {
            if (action === 'create') {
                handleCreate();
                autoActionRef.current = true;
            } else if (action === 'match') {
                handleMatch();
                autoActionRef.current = true;
            } else if (action === 'join' && joinRoomParam && /^\d+$/.test(joinRoomParam)) {
                const id = Number(joinRoomParam);
                handleAutoJoin(id);
                autoActionRef.current = true;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action, battleId, joinRoomParam]);

    const inRoom = battleId !== '' && Number(battleId) > 0;

    useEffect(() => {
        battleIdRef.current = typeof battleId === 'number' ? battleId : null;
        if (typeof battleId === 'number' && battleId > 0) {
            persistBattleId(battleId);
        } else {
            clearPersistBattleId();
        }
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

    // 防止进行中对局时意外关闭/刷新页面
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (battleIdRef.current && snapshot?.status === 'playing') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [snapshot?.status]);

    // 浏览器回退时的确认：通过 pushState 创建“哨兵”历史记录，先拦截，再决定是否真正回退
    useEffect(() => {
        if (snapshot?.status === 'playing') {
            // 标记进入 guard 状态，并创建一个当前页的历史记录，下一次 back 先触发 popstate 而不是直接离开
            popGuardActiveRef.current = true;
            allowPopRef.current = false;
            window.history.pushState({ livebattleGuard: true }, '', window.location.href);
        } else {
            popGuardActiveRef.current = false;
            allowPopRef.current = false;
        }
    }, [snapshot?.status]);

    useEffect(() => {
        const handler = (e: PopStateEvent) => {
            if (!popGuardActiveRef.current) return;
            if (!(battleIdRef.current && snapshot?.status === 'playing')) return;

            if (allowPopRef.current) {
                // 已允许真正离开，交给浏览器默认行为
                return;
            }

            const ok = window.confirm('离开将视为退出对局（可能判负），是否继续？');
            if (!ok) {
                // 用户取消：把哨兵再推回去，维持当前页面
                window.history.pushState({ livebattleGuard: true }, '', window.location.href);
                return;
            }

            // 用户确认离开：立即发离线信号（无条件），然后导航离开
            allowPopRef.current = true;
            offlineAlreadySentRef.current = true;  // 标记已发送 offline
            const id = battleIdRef.current;
            const myId = myUserIdRef.current;

            // 无论 unmount 是否正在执行，都立即尝试发 offline
            if (id) {
                console.log('[popstate] firing offline signal for id=', id, 'connected=', connRef.current?.socket?.connected);
                try {
                    // 同时尝试 WebSocket 和 REST（不等结果，立即back）
                    // WebSocket: fire-and-forget
                    connRef.current?.offline?.(id).then(() => {
                        console.log('[popstate] offline ack received');
                    }).catch(e => {
                        console.error('[popstate] offline error:', e?.message);
                    });

                    // REST: 立即发送（带 keepalive），不等回复
                    if (myId && id) {
                        const baseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
                        const url = `${baseUrl}/api/v1/battles/${id}/offline`;
                        fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: myId }),
                            keepalive: true,
                        }).catch(e => {
                            console.error('[popstate] REST offline error:', e?.message);
                        });
                    }
                } catch (e) {
                    console.error('[popstate] offline send error:', e);
                }

                // 在 popstate 中也启动 grace resign（不要依赖 unmount，因为页面卸载时定时器可能不运行）
                console.log('[popstate] scheduling grace resign for id=', id);
                scheduleGraceResign(id);
            }

            // 立即执行 back
            console.log('[popstate] executing back immediately');
            window.history.back();
        };
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, [snapshot?.status]);

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

        const id = battleIdRef.current;
        if (!id) {
            navigate('/app/online-lobby');
            return;
        }

        // 若对局尚未开始（waiting 且玩家不足 2 个），使用 leave/cancel 语义上的“取消房间”
        const isNotStarted = snapshot?.status === 'waiting' && (snapshot.players?.length ?? 0) < 2;
        if (isNotStarted) {
            const okCancel = window.confirm('当前对局尚未开始，确认取消房间？');
            if (!okCancel) return;
            try {
                try { await battleApi.leave(id); } catch { /* 忽略错误，继续本地清理 */ }
                connRef.current?.socket?.close();
            } finally {
                setSnapshot(null);
                setMoves([]);
                setBattleId('');
                setJoinIdInput('');
                clearPersistBattleId();
                navigate('/app/online-lobby');
            }
            return;
        }

        // 已经开始的对局：退出 = 认输
        const ok = window.confirm('确认退出对局？退出将视为本方认输，并判负。');
        if (!ok) return;
        try {
            try {
                await battleApi.resign(id);
            } catch {
                // 若认输接口异常，避免卡住用户，仍然允许本地退出
            }
            connRef.current?.socket?.close();
        } finally {
            // 退出方本地也给出认输提示，并启动倒计时返回大厅
            setEndMessage('您已认输，对局结束，本局记为落败。');
            setEndKind('lose');
            setEndCountdown(3);
            clearPersistBattleId();
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
        // 只要重新回到对局页面，就清理延迟认输的定时器
        if (snapshot?.status === 'playing') {
            clearGraceResign();
        }
    }, [snapshot, moves]);

    // 结束后的 3 秒倒计时自动返回大厅
    useEffect(() => {
        if (endCountdown === null) return;
        if (endCountdown <= 0) {
            setSnapshot(null);
            setMoves([]);
            setBattleId('');
            setJoinIdInput('');
            navigate('/app/online-lobby');
            return;
        }
        const t = window.setTimeout(() => {
            setEndCountdown((prev) => (prev === null ? null : prev - 1));
        }, 1000);
        return () => window.clearTimeout(t);
    }, [endCountdown, navigate]);

    // 兜底：在对局未结束时，每 10 秒通过 REST 拉一次 snapshot，防止偶发漏掉 WS 广播
    useEffect(() => {
        if (!inRoom || !battleIdRef.current) return;
        if (snapshot?.status === 'finished') return;
        const id = battleIdRef.current;
        const timer = window.setInterval(async () => {
            if (!id) return;
            try {
                const data = await battleApi.snapshot(id);
                if (!data) return;
                // 仅当服务端状态“更新”时才覆盖本地
                const next = data as unknown as BattleSnapshot;
                const currentLast = snapshot?.moves?.length
                    ? snapshot.moves[snapshot.moves.length - 1].seq
                    : 0;
                const nextLast = next.moves?.length
                    ? next.moves[next.moves.length - 1].seq
                    : 0;
                if (nextLast >= currentLast && next.stateHash !== snapshot?.stateHash) {
                    latestSnapshotRef.current = next;
                    setSnapshot(next);
                    setMoves((prev) => {
                        const snapMoves = next.moves || [];
                        const prevLast = prev.length ? prev[prev.length - 1].seq : 0;
                        const snapLast = snapMoves.length ? snapMoves[snapMoves.length - 1].seq : 0;
                        // 更新条件：快照有新增步数(snapLast > prevLast) 或 减少步数（悔棋：snapLast < prevLast）
                        if (snapLast !== prevLast) {
                            movesRef.current = snapMoves;
                            return snapMoves;
                        }
                        return prev;
                    });
                }
            } catch {
                // 忽略兜底轮询错误
            }
        }, 10000);
        return () => window.clearInterval(timer);
    }, [inRoom, snapshot]);

    return (
        <div className="card-pad pos-rel">
            <div className="row align-center" style={{ marginBottom: 0 }}>
                <div style={{ width: 360, maxWidth: '100%', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
                    {(!inRoom && (!action || action === 'join')) ? (
                        <button className="btn-ghost" onClick={() => navigate(-1)}>← 返回</button>
                    ) : (
                        <div style={{ width: 64 }} />
                    )}
                    <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>在线对战</h2>
                    <div style={{ width: 64 }} />
                </div>
            </div>
            {endMessage && (
                <div
                    className={
                        'livebattle-end-banner' +
                        (endKind ? ` livebattle-end-${endKind}` : '')
                    }
                    role="status"
                    aria-live="polite"
                >
                    <div>{endMessage}</div>
                    <div className="livebattle-end-sub">
                        {endCountdown !== null && endCountdown > 0
                            ? `${endCountdown} 秒后自动返回，对局记录可在「历史对局」中查看。`
                            : '对局记录可在「历史对局」中查看。'}
                        <button
                            className="btn-link livebattle-end-link"
                            type="button"
                            onClick={() => {
                                setSnapshot(null);
                                setMoves([]);
                                setBattleId('');
                                setJoinIdInput('');
                                navigate('/app/online-lobby');
                            }}
                        >
                            立即返回大厅
                        </button>
                    </div>
                </div>
            )}
            <div className="muted livebattle-conn-status">连接状态：{connected ? '已连接' : '未连接'}</div>

            {/* 未进入房间：显示加入/创建/匹配（根据 action 裁剪） */}
            {!inRoom && (
                <div className="livebattle-actions-row">
                    {(!action || action === 'join') && (
                        <div className="livebattle-join-card">
                            <div className="livebattle-join-title">好友房对战</div>
                            <div className="livebattle-join-sub">输入房间号加入，直达好友的房间</div>
                            {joinError ? (
                                <>
                                    <div className="livebattle-join-hint invalid" style={{ marginTop: 12 }}>{joinError}</div>
                                    <button className="btn-ghost mt-8" onClick={() => setJoinError(null)}>返回</button>
                                </>
                            ) : (
                                <>
                                    <div className="livebattle-join-row">
                                        <input
                                            className="livebattle-room-input"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\\d*"
                                            placeholder="房间号（例如 123456）"
                                            value={joinIdInput}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^0-9]/g, '');
                                                setJoinIdInput(v);
                                            }}
                                        />
                                        <button
                                            className="btn-ghost"
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    const text = await navigator.clipboard.readText();
                                                    const v = (text || '').replace(/[^0-9]/g, '');
                                                    if (v) setJoinIdInput(v);
                                                } catch (e) {
                                                    // 忽略剪贴板错误
                                                }
                                            }}
                                        >
                                            粘贴
                                        </button>
                                        <button
                                            className="btn-primary"
                                            onClick={handleJoin}
                                            disabled={!connected || !/^\d+$/.test(joinIdInput)}
                                        >
                                            加入房间
                                        </button>
                                    </div>
                                    {myProfile && (
                                        <div className="livebattle-join-self">
                                            <UserAvatar
                                                userId={myProfile.id}
                                                nickname={myProfile.nickname}
                                                avatarUrl={myProfile.avatarUrl}
                                                size="small"
                                                showTime={false}
                                                nicknameWrap={true}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
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
                        {/* 按业务场景精简按钮 */}
                        {(() => {
                            // 创建房间等待：仅房主显示“取消房间”
                            if (snapshot?.source === 'room' && snapshot.status === 'waiting' && snapshot.ownerId === myUserId) {
                                return (
                                    <button className="btn-ghost livebattle-cancel" onClick={async () => {
                                        try {
                                            await battleApi.cancel(Number(battleId));
                                            setBattleId('');
                                            setSnapshot(null);
                                            navigate('/app/online-lobby');
                                        } catch (e) {
                                            alert('取消失败: ' + (e instanceof Error ? e.message : String(e)));
                                        }
                                    }}>取消房间</button>
                                );
                            }
                            // 匹配等待：仅本人显示“取消匹配”
                            if (snapshot?.source === 'match' && snapshot.status === 'waiting' && (myUserId !== null && snapshot.players?.includes(myUserId))) {
                                return (
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
                                );
                            }
                            // 加入房间等待：仅显示“返回”按钮，返回到在线对战大厅
                            if (snapshot?.source === 'room' && snapshot.status === 'waiting' && snapshot.ownerId !== myUserId) {
                                return (
                                    <button className="btn-ghost" onClick={() => navigate(-1)}>返回</button>
                                );
                            }
                            // 其他情况（如对局中/结束/观战等）可按需补充
                            // 对局中/观战时显示“退出对局”按钮
                            if (snapshot && snapshot.status !== 'waiting') {
                                return (
                                    <button className="btn-ghost livebattle-cancel" onClick={handleExit}>退出对局</button>
                                );
                            }
                            return null;
                        })()}
                    </div>
                    {snapshot && (
                        <>
                            <div className="livebattle-state-line">
                                对局类型：{snapshot.source === 'room' ? '好友房' : '快速匹配'}
                                · 状态：
                                {snapshot.status === 'waiting'
                                    ? '等待中'
                                    : snapshot.status === 'finished'
                                        ? '已结束'
                                        : '对局中'}
                            </div>
                            {inRoom && !connected && (
                                <div className="livebattle-disconnect-banner" role="status" aria-live="polite">
                                    <span className="livebattle-dot-yellow" />
                                    与服务器连接中断，正在尝试重连…
                                    <button className="btn-ghost" onClick={handleReconnect}>重试连接</button>
                                </div>
                            )}
                            {(() => {
                                const meId = myUserId;
                                const oppId = meId && Array.isArray(snapshot.players)
                                    ? snapshot.players.find((uid) => uid !== meId)
                                    : undefined;
                                const online = snapshot.onlineUserIds || [];
                                const meOnline = typeof meId === 'number' ? online.includes(meId) : false;
                                const oppOnline = typeof oppId === 'number' ? online.includes(oppId) : false;
                                const allOffline = online.length === 0;
                                const justMeOnline = meOnline && online.length === 1;
                                if (snapshot.status !== 'playing') return null;
                                if (oppOnline && !allOffline) return null;
                                const ttl = DISCONNECT_TTL_MINUTES;
                                let text = '对手掉线，等待重连…';
                                if (justMeOnline) {
                                    text = `对手掉线，等待重连…超过 ${ttl} 分钟未返回将自动判您获胜。`;
                                } else if (allOffline) {
                                    text = `玩家均已离线，超过 ${ttl} 分钟未恢复将按规则自动裁定（通常判和）。`;
                                } else if (!oppOnline) {
                                    text = `对手掉线，等待重连…若 ${ttl} 分钟内未恢复，系统将自动裁定结果。`;
                                }
                                return (
                                    <div className="livebattle-disconnect-banner" role="status" aria-live="polite">
                                        <span className="livebattle-dot-yellow" />
                                        {text}
                                    </div>
                                );
                            })()}
                            {/* 玩家在线状态与对局状态信息在同一行，宽度与棋盘一致 */}
                            <div className="livebattle-board-wrapper" style={{ marginTop: 8, marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexDirection: 'column' }}>
                                    {/* 丰富等待区内容：展示当前用户头像和昵称 */}
                                    {snapshot.status === 'waiting' && myProfile && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
                                            <UserAvatar
                                                userId={myProfile.id}
                                                nickname={myProfile.nickname}
                                                avatarUrl={myProfile.avatarUrl}
                                                size="large"
                                                showTime={false}
                                                nicknameWrap={true}
                                            />
                                            <div className="muted" style={{ marginTop: 8, fontSize: 15, textAlign: 'center', maxWidth: 320 }}>
                                                {snapshot.source === 'room'
                                                    ? '房间已创建，等待好友输入房间号加入对局。你将执红方先手，对方加入后自动开始。'
                                                    : <>
                                                        正在为你智能匹配实力相近的对手，匹配成功后自动进入对局。<br />
                                                        <span style={{ fontSize: 13, color: '#888' }}>
                                                            匹配规则：优先匹配活跃玩家，综合考虑历史胜率、活跃度等因素，确保公平对局。
                                                        </span>
                                                    </>
                                                }
                                            </div>
                                        </div>
                                    )}
                                    {/* 其他玩家信息可后续补充 */}
                                </div>
                            </div>
                            {(snapshot.status !== 'waiting' || (snapshot.players?.length ?? 0) >= 2) ? (
                                <>
                                    {(() => {
                                        const turn = snapshot.turn ?? (snapshot.turnIndex === 0 ? 'red' : 'black');
                                        const redUser = snapshot.players?.[0];
                                        const blackUser = snapshot.players?.[1];
                                        const mySide = myUserId === redUser ? 'red' : myUserId === blackUser ? 'black' : 'spectator';
                                        const opponentSide = mySide === 'red' ? 'black' : mySide === 'black' ? 'red' : null;
                                        const isMyTurn = mySide !== 'spectator' && turn === mySide;
                                        const isOpponentTurn = opponentSide !== null && turn === opponentSide;

                                        // 计算头像尺寸
                                        const avatarSize = 40; // medium size

                                        return (
                                            <>
                                                {/* 对手头像：左对齐，头像在左侧 */}
                                                {opponentProfile && opponentSide && (
                                                    <div className="livebattle-board-wrapper" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div
                                                            className="cursor-pointer"
                                                            onClick={() => setShowProfileModal({ userId: opponentProfile.id })}
                                                            style={{
                                                                width: avatarSize,
                                                                height: avatarSize,
                                                                borderRadius: '50%',
                                                                border: `3px solid ${opponentSide === 'red' ? '#c8102e' : '#333'}`,
                                                                overflow: 'hidden',
                                                                flexShrink: 0,
                                                                animation: isOpponentTurn ? 'pulse-border 1s infinite' : 'none',
                                                                backgroundColor: opponentProfile.avatarUrl ? 'transparent' : '#e0e0e0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            {opponentProfile.avatarUrl ? (
                                                                <img
                                                                    src={opponentProfile.avatarUrl}
                                                                    alt={opponentProfile.nickname || '对手'}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                                                                    {(opponentProfile.nickname || '?').slice(0, 2).toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div
                                                            className="cursor-pointer"
                                                            onClick={() => setShowProfileModal({ userId: opponentProfile.id })}
                                                            style={{ fontWeight: 600, fontSize: 14, color: '#333' }}
                                                        >
                                                            {opponentProfile.nickname || '匿名用户'}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="livebattle-board-wrapper" style={{ position: 'relative' }}>
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

                                                {/* 我的头像在棋盘下方：头像右对齐，昵称在左 */}
                                                {myProfile && mySide !== 'spectator' && (() => {
                                                    // 判断是否可以悔棋：
                                                    // 1. 有棋步存在（至少有一步）
                                                    // 2. 最后一步是自己下的
                                                    // 3. 当前轮到对方（即自己刚下完，对方还没下）
                                                    const canUndo = (() => {
                                                        // 优先检查：必须有棋步且基础条件满足
                                                        if (!snapshot || !moves || moves.length === 0 || !myUserId || !snapshot.players || !isOpponentTurn) {
                                                            return false;
                                                        }
                                                        // 检查最后一步是否是自己下的
                                                        const lastMoveIndex = moves.length - 1;
                                                        // 第0步(index=0)是红方(players[0])，第1步(index=1)是黑方(players[1])，以此类推
                                                        const lastMovePlayer = lastMoveIndex % 2 === 0 ? snapshot.players[0] : snapshot.players[1];
                                                        return lastMovePlayer === myUserId;
                                                    })();

                                                    // 计算剩余次数
                                                    const myDrawCount = snapshot?.drawOfferCount?.[myUserId as number] || 0;
                                                    const myUndoCount = snapshot?.undoRequestCount?.[myUserId as number] || 0;
                                                    const drawRemaining = 3 - myDrawCount;
                                                    const undoRemaining = 3 - myUndoCount;
                                                    const canDraw = drawRemaining > 0;
                                                    const canRequestUndo = canUndo && undoRemaining > 0;

                                                    return (
                                                        <div className="livebattle-board-wrapper" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                            {/* 左侧菜单按钮 */}
                                                            <div>
                                                                <DropdownMenu position="top" actions={[
                                                                    {
                                                                        label: '🏳️ 认输',
                                                                        danger: true,
                                                                        onClick: async () => {
                                                                            if (!battleId || typeof battleId !== 'number') return;
                                                                            if (!window.confirm('确定要认输吗？')) return;
                                                                            try {
                                                                                await battleApi.resign(battleId);
                                                                                // 认输后重新获取快照
                                                                                conn.snapshot(battleId);
                                                                            } catch (e: any) {
                                                                                alert(e?.message || '认输失败');
                                                                            }
                                                                        }
                                                                    },
                                                                    {
                                                                        label: `🤝 提和 (${drawRemaining}/3)`,
                                                                        disabled: !canDraw,
                                                                        onClick: async () => {
                                                                            if (!canDraw) {
                                                                                alert('您的提和次数已用完（每局最多3次）');
                                                                                return;
                                                                            }
                                                                            try {
                                                                                await battleApi.offerDraw(battleId);
                                                                                alert('已向对方发起提和请求');
                                                                            } catch (e: any) {
                                                                                alert(e?.message || '提和请求失败');
                                                                            }
                                                                        }
                                                                    },
                                                                    {
                                                                        label: `↩️ 悔棋 (${undoRemaining}/3)`,
                                                                        disabled: !canRequestUndo,
                                                                        onClick: async () => {
                                                                            // 前端校验：只有在满足悔棋条件时才发送请求
                                                                            if (!canUndo) {
                                                                                if (!moves || moves.length === 0) {
                                                                                    alert('还没有走棋，无法悔棋');
                                                                                } else if (isMyTurn) {
                                                                                    alert('当前是您的回合，无法悔棋。只能在您走完一步且对方还未落子时悔棋');
                                                                                } else {
                                                                                    alert('无法悔棋：只能在您走完一步且对方还未落子时悔棋');
                                                                                }
                                                                                return;
                                                                            }
                                                                            if (undoRemaining <= 0) {
                                                                                alert('您的悔棋次数已用完（每局最多3次）');
                                                                                return;
                                                                            }
                                                                            try {
                                                                                await battleApi.offerUndo(battleId);
                                                                                alert('已向对方发起悔棋请求');
                                                                            } catch (e: any) {
                                                                                alert(e?.message || '悔棋请求失败');
                                                                            }
                                                                        }
                                                                    }
                                                                ]} />
                                                            </div>
                                                            {/* 右侧昵称和头像 */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div
                                                                    className="cursor-pointer"
                                                                    onClick={() => setShowProfileModal({ userId: myProfile.id })}
                                                                    style={{ fontWeight: 600, fontSize: 14, color: '#333' }}
                                                                >
                                                                    {myProfile.nickname || '匿名用户'}
                                                                </div>
                                                                <div
                                                                    className="cursor-pointer"
                                                                    onClick={() => setShowProfileModal({ userId: myProfile.id })}
                                                                    style={{
                                                                        width: avatarSize,
                                                                        height: avatarSize,
                                                                        borderRadius: '50%',
                                                                        border: `3px solid ${mySide === 'red' ? '#c8102e' : '#333'}`,
                                                                        overflow: 'hidden',
                                                                        flexShrink: 0,
                                                                        animation: isMyTurn ? 'pulse-border 1s infinite' : 'none',
                                                                        backgroundColor: myProfile.avatarUrl ? 'transparent' : '#e0e0e0',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    {myProfile.avatarUrl ? (
                                                                        <img
                                                                            src={myProfile.avatarUrl}
                                                                            alt={myProfile.nickname || '我'}
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        />
                                                                    ) : (
                                                                        <span style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
                                                                            {(myProfile.nickname || '?').slice(0, 2).toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        );
                                    })()}
                                </>
                            ) : null}
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

            {/* 返回入口：仅在未入房时提供“返回” */}
            {/* 返回入口：已移至页面头部 */}

            {/* Profile modal */}
            {showProfileModal && (
                <div role="dialog" aria-modal="true" className="modal-mask" onClick={() => setShowProfileModal(null)}>
                    <div className="paper-card modal-card" style={{ maxWidth: 720, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <div className="row-between align-center">
                            <h4 className="mt-0 mb-0">玩家信息</h4>
                            <button className="btn-ghost" aria-label="关闭" onClick={() => setShowProfileModal(null)}>×</button>
                        </div>
                        <div className="mt-12">
                            {(() => {
                                const uid = showProfileModal.userId;
                                const p = myProfile && myProfile.id === uid ? myProfile : opponentProfile && opponentProfile.id === uid ? opponentProfile : null;
                                const detail = profileDetail.data as any;
                                const redUser = snapshot?.players?.[0];
                                const blackUser = snapshot?.players?.[1];
                                const sideLabel = (() => {
                                    if (!snapshot) return '未知';
                                    if (uid === redUser) return '红方';
                                    if (uid === blackUser) return '黑方';
                                    return '观战';
                                })();
                                const isOnline = snapshot?.onlineUserIds?.includes(uid);
                                const roleLabel = uid === myUserId ? '你' : uid === redUser || uid === blackUser ? '对手' : '其他玩家';

                                if (profileDetail.loading) {
                                    return <div className="muted">加载中...</div>;
                                }
                                if (profileDetail.error) {
                                    return <div className="muted">{profileDetail.error}</div>;
                                }

                                const user = detail || p;
                                if (!user) return <div className="muted">加载中或不可用</div>;

                                const stats = user.stats || {};
                                const posts = user.posts || [];
                                const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知';

                                return (
                                    <div className="col-start gap-12">
                                        <div className="row-start gap-12 align-center">
                                            <div
                                                style={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    backgroundColor: user.avatarUrl ? 'transparent' : '#e0e0e0',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt={user.nickname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: 28, fontWeight: 600, color: '#666' }}>
                                                        {(user.nickname || '?').slice(0, 2).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                                                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{user.nickname || '匿名用户'}</h2>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#8a7f73' }}>
                                                    <span>UID：{user.id}</span>
                                                    <button className="btn-compact btn-ghost" onClick={() => navigator.clipboard?.writeText(String(user.id)).catch(() => { })} style={{ padding: '2px 6px', fontSize: 12 }}>复制</button>
                                                </div>
                                                <div style={{ fontSize: 14, color: '#8a7f73' }}>📅 加入于 {joinDate}</div>
                                                <div className="muted">身份：{roleLabel} · 阵营：{sideLabel} · 状态：{isOnline ? '在线' : '离线'}</div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: 14, color: '#555', lineHeight: '1.5' }}>
                                            {user.bio && user.bio.trim().length > 0 ? user.bio : '该用户还没有填写签名...'}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 12, borderTop: '1px solid #e7d8b1' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{stats.posts ?? 0}</div>
                                                <div style={{ fontSize: 13, color: '#8a7f73' }}>帖子</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{stats.comments ?? 0}</div>
                                                <div style={{ fontSize: 13, color: '#8a7f73' }}>评论</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{stats.likes ?? 0}</div>
                                                <div style={{ fontSize: 13, color: '#8a7f73' }}>获赞</div>
                                            </div>
                                        </div>

                                        <div className="col gap-8" style={{ marginTop: 12 }}>
                                            <h4 className="mt-0 mb-0">Ta 的帖子</h4>
                                            {posts.length > 0 ? (
                                                <div className="col gap-8">
                                                    {posts.map((pp: any) => (
                                                        <div
                                                            key={pp.id}
                                                            className="paper-card pad-12"
                                                        >
                                                            <div className="fw-600 mb-4" style={{ textAlign: 'left' }}>{pp.title}</div>
                                                            <div className="muted text-13 line-clamp-2 mb-6" style={{ textAlign: 'left' }}>{pp.excerpt || '(无内容)'}</div>
                                                            <div className="text-12 muted row-start gap-10">
                                                                <span>{new Date(pp.createdAt).toLocaleDateString()}</span>
                                                                <span>👍 {pp.likeCount}</span>
                                                                <span>💬 {pp.commentCount}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-box">暂无帖子</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* 提和请求对话框 */}
            {showDrawOfferDialog && drawOfferFromUserId !== null && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <h3 style={{ marginBottom: 16 }}>提和请求</h3>
                        <p style={{ marginBottom: 24 }}>
                            对方请求和棋，是否接受？
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                className="btn-secondary"
                                onClick={async () => {
                                    try {
                                        await battleApi.declineDraw(battleId);
                                        setShowDrawOfferDialog(false);
                                        setDrawOfferFromUserId(null);
                                    } catch (e: any) {
                                        alert(e?.message || '拒绝提和失败');
                                    }
                                }}
                            >
                                拒绝
                            </button>
                            <button
                                className="btn-primary"
                                onClick={async () => {
                                    try {
                                        await battleApi.acceptDraw(battleId);
                                        setShowDrawOfferDialog(false);
                                        setDrawOfferFromUserId(null);
                                    } catch (e: any) {
                                        alert(e?.message || '接受提和失败');
                                    }
                                }}
                            >
                                接受
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 悔棋请求对话框 */}
            {showUndoOfferDialog && undoOfferFromUserId !== null && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <h3 style={{ marginBottom: 16 }}>悔棋请求</h3>
                        <p style={{ marginBottom: 24 }}>
                            对方请求悔棋，是否同意？
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                className="btn-secondary"
                                onClick={async () => {
                                    try {
                                        await battleApi.declineUndo(battleId);
                                        setShowUndoOfferDialog(false);
                                        setUndoOfferFromUserId(null);
                                    } catch (e: any) {
                                        alert(e?.message || '拒绝悔棋失败');
                                    }
                                }}
                            >
                                拒绝
                            </button>
                            <button
                                className="btn-primary"
                                onClick={async () => {
                                    try {
                                        await battleApi.acceptUndo(battleId);
                                        setShowUndoOfferDialog(false);
                                        setUndoOfferFromUserId(null);
                                    } catch (e: any) {
                                        alert(e?.message || '同意悔棋失败');
                                    }
                                }}
                            >
                                同意
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
