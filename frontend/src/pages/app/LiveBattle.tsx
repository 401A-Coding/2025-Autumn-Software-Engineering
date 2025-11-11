import { useEffect, useMemo, useRef, useState } from 'react';
import { connectBattle } from '../../services/battlesSocket';
import type { BattleMove, BattleSnapshot } from '../../services/battlesSocket';
import { battleApi, userApi } from '../../services/api';
import OnlineBoard from '../../features/chess/OnlineBoard';

export default function LiveBattle() {
    const [battleId, setBattleId] = useState<number | ''>('');
    const [connected, setConnected] = useState(false);
    const [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
    const [moves, setMoves] = useState<BattleMove[]>([]);
    const connRef = useRef<ReturnType<typeof connectBattle> | null>(null);
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
        const id = Number(battleId);
        if (!id) return;
        try {
            // 先走 REST 入座，确保服务端把当前用户加入 players
            await battleApi.join(id);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(`加入房间失败：${msg}`);
        }
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

    return (
        <div className="card-pad">
            <h2>Live Battle Demo</h2>
            <div className="row gap">
                <input
                    type="number"
                    placeholder="Battle ID"
                    value={battleId}
                    onChange={(e) => setBattleId(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <button onClick={handleJoin} disabled={!connected || !battleId}>
                    加入房间
                </button>
                <button onClick={handleCreate} disabled={!connected}>
                    创建房间
                </button>
                <button onClick={handleMatch} disabled={!connected}>
                    快速匹配
                </button>
            </div>
            <div className="mt-2">
                <div className="muted">连接状态：{connected ? '已连接' : '未连接'}</div>
                {snapshot && (
                    <div className="mt-2">
                        <div className="muted">对局状态：{snapshot.status}
                            {snapshot.status === 'waiting' && '（等待另一位玩家加入）'}</div>
                        <div className="muted">房间玩家：[{snapshot.players.join(', ')}]，我的ID：{myUserId ?? '-'}</div>
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
                )}
            </div>
        </div>
    );
}
