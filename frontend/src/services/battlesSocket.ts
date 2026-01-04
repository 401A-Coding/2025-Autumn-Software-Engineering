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
    drawOffer?: {
        fromUserId: number;
        timestamp: number;
    } | null;
    drawOfferCount?: Record<number, number>;
    undoRequestCount?: Record<number, number>;
};

export function connectBattle() {
    const token = localStorage.getItem('token') || '';
    const socket: Socket = io(`${base}/battle`, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
    });

    // 基础错误与事件日志（便于定位 ack 超时原因）
    socket.on('connect_error', (err: any) => {
        console.error('[WS] connect_error', err);
    });
    socket.on('error', (err: any) => {
        console.error('[WS] error', err);
    });
    socket.on('exception', (err: any) => {
        console.error('[WS] exception', err);
    });
    // 轻量 onAny 调试（忽略高频心跳）
    (socket as any).onAny?.((event: string, ...args: any[]) => {
        if (event !== 'battle.heartbeat') {
            console.debug('[WS] event', event, args?.[0] ?? args);
        }
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
            }, 5000);
            // 附带客户端随机请求ID，便于后端回执关联
            socket.emit('battle.move', { battleId, from, to, clientRequestId }, (ack: any) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (ack && (ack.error || ack.code === 'ERROR')) {
                    reject(new Error(ack.error || 'server rejected move'));
                    return;
                }
                resolve(ack as BattleMove);
            });
        });
    };
    const snapshot = (battleId: number) => socket.emit('battle.snapshot', { battleId });
    const offline = (battleId: number) => new Promise<{ ok: boolean }>((resolve) => {
        console.log('[offline] emitting battle.offline for battleId=', battleId, 'connected=', socket.connected, 'readyState=', socket.io?.engine?.readyState);
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.log('[offline] timeout (2s), no ack, resolving with false');
                resolve({ ok: false });
            }
        }, 2000);
        socket.emit('battle.offline', { battleId }, (ack: { ok?: boolean }) => {
            console.log('[offline] got ack:', ack, 'settled=', settled);
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ ok: !!ack?.ok });
        });
    });
    const heartbeat = (battleId: number, cb?: (ack: { ok: boolean; ts: number }) => void) => {
        socket.emit('battle.heartbeat', { battleId }, cb);
    };

    const onMove = (cb: (m: BattleMove) => void) => socket.on('battle.move', cb);
    const onSnapshot = (cb: (s: BattleSnapshot) => void) => socket.on('battle.snapshot', cb);
    const onReplay = (cb: (r: { battleId: number; fromSeq: number; moves: BattleMove[]; stateHash?: string }) => void) => socket.on('battle.replay', cb);
    const onPlayerJoin = (cb: (p: { userId: number }) => void) => socket.on('battle.player_join', cb);
    const onOfflineNotice = (cb: (p: { userId: number; battleId: number }) => void) => socket.on('battle.offline_notice', cb);
    const onDrawOffer = (cb: (p: { fromUserId: number; toUserId?: number }) => void) => socket.on('battle.draw-offer', cb);
    const onDrawDeclined = (cb: (p: { byUserId: number; toUserId: number }) => void) => socket.on('battle.draw-declined', cb);
    const onUndoOffer = (cb: (p: { fromUserId: number; toUserId?: number }) => void) => socket.on('battle.undo-offer', cb);
    const onUndoAccepted = (cb: () => void) => socket.on('battle.undo-accepted', cb);
    const onUndoDeclined = (cb: (p: { byUserId: number; toUserId: number }) => void) => socket.on('battle.undo-declined', cb);

    return { socket, join, move, snapshot, heartbeat, offline, onMove, onSnapshot, onReplay, onPlayerJoin, onOfflineNotice, onDrawOffer, onDrawDeclined, onUndoOffer, onUndoAccepted, onUndoDeclined };
}
