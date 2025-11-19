import { io, Socket } from 'socket.io-client';

const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export type BattleMove = {
    battleId: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    by: number;
    seq: number;
    ts: number;
};

export type BattleSnapshot = {
    battleId: number;
    status: 'waiting' | 'playing' | 'finished';
    mode: string;
    players: number[];
    moves: BattleMove[];
    turnIndex: 0 | 1;
    // 后端权威棋盘与轮次（接入后端引擎后返回）
    board?: import('../features/chess/types').Board;
    turn?: import('../features/chess/types').Side;
    createdAt: number;
    winnerId: number | null;
    onlineUserIds?: number[];
};

export function connectBattle() {
    const token = localStorage.getItem('token') || '';
    const socket: Socket = io(`${base}/battle`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
    });

    const join = (battleId: number) => socket.emit('battle.join', { battleId });
    const move = (
        battleId: number,
        from: { x: number; y: number },
        to: { x: number; y: number }
    ) => {
        const clientRequestId = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
        return new Promise<BattleMove>((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('move ack timeout'));
                }
            }, 3000);
            socket.emit('battle.move', { battleId, from, to, clientRequestId }, (ack: BattleMove) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(ack);
            });
        });
    };
    const snapshot = (battleId: number) => socket.emit('battle.snapshot', { battleId });
    const heartbeat = (battleId: number, cb?: (ack: { ok: boolean; ts: number }) => void) => {
        socket.emit('battle.heartbeat', { battleId }, cb);
    };

    const onMove = (cb: (m: BattleMove) => void) => socket.on('battle.move', cb);
    const onSnapshot = (cb: (s: BattleSnapshot) => void) => socket.on('battle.snapshot', cb);
    const onPlayerJoin = (cb: (p: { userId: number }) => void) => socket.on('battle.player_join', cb);

    return { socket, join, move, snapshot, heartbeat, onMove, onSnapshot, onPlayerJoin };
}
