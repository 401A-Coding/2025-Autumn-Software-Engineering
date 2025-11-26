import { io, Socket } from 'socket.io-client';
import type { Board, Side } from '../features/chess/types';

const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export type BattleMove = {
    battleId: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    by: number;
    seq: number;
    ts: number;
    stateHash?: string;
};

export type BattleSnapshot = {
    battleId: number;
    status: 'waiting' | 'playing' | 'finished';
    mode: string;
    players: number[];
    moves: BattleMove[];
    turnIndex: 0 | 1;
    board: Board;
    turn: Side;
    createdAt: number;
    winnerId: number | null;
    finishReason: string | null;
    lastMove: BattleMove | null;
    stateHash: string;
    onlineUserIds: number[];
    // 新增 ↓
    source: 'match' | 'room';
    visibility: 'match' | 'private' | 'public';
    ownerId: number | null;
};

export function connectBattle() {
    const token = localStorage.getItem('token') || '';
    const socket: Socket = io(`${base}/battle`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
    });

    const join = (battleId: number, lastSeq?: number) => socket.emit('battle.join', { battleId, lastSeq });
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
    const onReplay = (cb: (r: { battleId: number; fromSeq: number; moves: BattleMove[]; stateHash?: string }) => void) => socket.on('battle.replay', cb);
    const onPlayerJoin = (cb: (p: { userId: number }) => void) => socket.on('battle.player_join', cb);

    return { socket, join, move, snapshot, heartbeat, onMove, onSnapshot, onReplay, onPlayerJoin };
}
