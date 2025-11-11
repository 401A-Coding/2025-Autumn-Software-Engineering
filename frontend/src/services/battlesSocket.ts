import { io, Socket } from 'socket.io-client';

const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export type BattleMove = {
    battleId: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    piece?: string;
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
    createdAt: number;
    winnerId: number | null;
};

export function connectBattle() {
    const token = localStorage.getItem('token') || '';
    const socket: Socket = io(`${base}/battle`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
    });

    const join = (battleId: number) => socket.emit('battle.join', { battleId });
    const move = (battleId: number, from: { x: number; y: number }, to: { x: number; y: number }, piece?: string) =>
        socket.emit('battle.move', { battleId, from, to, piece });
    const snapshot = (battleId: number) => socket.emit('battle.snapshot', { battleId });

    const onMove = (cb: (m: BattleMove) => void) => socket.on('battle.move', cb);
    const onSnapshot = (cb: (s: BattleSnapshot) => void) => socket.on('battle.snapshot', cb);
    const onPlayerJoin = (cb: (p: { userId: number }) => void) => socket.on('battle.player_join', cb);

    return { socket, join, move, snapshot, onMove, onSnapshot, onPlayerJoin };
}
