import { Logger, Optional } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BattlesService } from './battles.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@WebSocketGateway({
  namespace: '/battle',
  // 允许来自本机开发端口与生产站点的 WebSocket 连接
  cors: {
    origin: (origin, callback) => {
      try {
        if (!origin) return callback(null, true);
        const allowed =
          /^(http:\/\/localhost:(5173|5174)|http:\/\/101\.42\.118\.61)$/.test(
            origin,
          );
        callback(null, allowed);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  },
})
export class BattlesGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(BattlesGateway.name);
  // 简易限流：每用户每房间每秒最多 3 次 move；heartbeat 最少 10s 一次
  private static readonly MOVE_MAX_PER_SEC = 3;
  private static readonly HEARTBEAT_MIN_MS = 10_000;
  private readonly moveRate = new Map<
    string,
    { windowStart: number; count: number }
  >();
  private readonly heartbeatLastAt = new Map<string, number>();
  // 周期性快照：每 N 步或每 T 秒（默认关闭）
  private readonly snapshotEveryN = Number(
    process.env.BATTLE_SNAPSHOT_EVERY_N || 0,
  );
  private readonly snapshotEveryMs =
    Number(process.env.BATTLE_SNAPSHOT_EVERY_SECS || 0) * 1000;
  private readonly lastSnapshotAt = new Map<number, number>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly battles: BattlesService,
    @Optional() private readonly events?: EventEmitter2,
  ) {
    // 监听对局结束事件，向房间广播最新 snapshot
    this.events?.on('battle.finished', (payload: { battleId: number }) => {
      const { battleId } = payload;
      try {
        const snapshot = this.battles.snapshot(battleId);
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
      } catch {
        // 房间可能已被删除，忽略错误
      }
    });
    // 监听提和请求事件
    this.events?.on('battle.draw-offer', (payload: { battleId: number; fromUserId: number; toUserId?: number }) => {
      const { battleId, fromUserId, toUserId } = payload;
      try {
        const snapshot = this.battles.snapshot(battleId);
        // 向整个房间广播快照更新和提和通知
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
        this.server.to(`battle:${battleId}`).emit('battle.draw-offer', { fromUserId, toUserId });
      } catch (err) {
        this.logger.error(`[draw-offer] Error: ${err}`);
      }
    });
    // 监听提和被拒绝事件
    this.events?.on('battle.draw-declined', (payload: { battleId: number; byUserId: number; toUserId: number }) => {
      const { battleId, byUserId, toUserId } = payload;
      try {
        const snapshot = this.battles.snapshot(battleId);
        // 向整个房间广播快照更新和拒绝通知
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
        this.server.to(`battle:${battleId}`).emit('battle.draw-declined', { byUserId, toUserId });
      } catch (err) {
        this.logger.error(`[draw-declined] Error: ${err}`);
      }
    });
  }

  private readonly users = new WeakMap<Socket, number>();
  private readonly joinedBattle = new WeakMap<Socket, number>();
  handleConnection(client: Socket) {
    // augment socket data type
    try {
      const authHeader =
        (client.handshake.headers['authorization'] as string) || '';
      const tokenFromQuery = (client.handshake.auth?.token as string) || '';
      const authorization: string | undefined = authHeader
        ? authHeader
        : tokenFromQuery
          ? `Bearer ${String(tokenFromQuery)}`
          : undefined;
      const userId = this.battles.verifyBearer(authorization);
      this.users.set(client, userId);
    } catch (err) {
      let reason: string;
      if (err instanceof Error) reason = err.message;
      else reason = String(err);
      this.logger.warn(`Socket auth failed: ${reason}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const userId = this.users.get(client);
      const battleId = this.joinedBattle.get(client);
      if (userId && battleId) {
        this.battles.setOnline(battleId, userId, false);
        // 广播最新快照（在线状态变化）
        const snapshot = this.battles.snapshot(battleId);
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
      }
    } catch {
      // 忽略断开时的异常
    }
  }

  @SubscribeMessage('battle.join')
  async onJoin(
    @MessageBody() body: { battleId: number; lastSeq?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.users.get(client) as number;
    const { battleId, lastSeq } = body || ({} as any);
    const res = this.battles.joinBattle(userId, battleId);
    await client.join(`battle:${battleId}`);
    this.joinedBattle.set(client, battleId);
    this.battles.setOnline(battleId, userId, true);
    const snapshot = this.battles.snapshot(battleId);
    // 回发给加入者 snapshot（基础权威状态）
    client.emit('battle.snapshot', snapshot);
    // 如果提供 lastSeq，补发增量 moves（上限 30 步）
    if (typeof lastSeq === 'number') {
      try {
        const b = this.battles.getBattle(battleId);
        if (lastSeq >= 0 && lastSeq < b.moves.length) {
          const MAX_REPLAY = 30;
          const delta = b.moves.filter((m) => m.seq > lastSeq);
          if (delta.length > 0 && delta.length <= MAX_REPLAY) {
            client.emit('battle.replay', {
              battleId,
              fromSeq: lastSeq,
              moves: delta,
              stateHash: this.battles.snapshot(battleId).stateHash,
            });
          }
        }
      } catch {
        // ignore
      }
    }
    // 广播有人加入（给房间其他人）
    client.to(`battle:${battleId}`).emit('battle.player_join', { userId });
    // 同步在线状态
    this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
    return res;
  }

  @SubscribeMessage('battle.move')
  async onMove(
    @MessageBody()
    body: {
      battleId: number;
      from: { x: number; y: number };
      to: { x: number; y: number };
      clientRequestId?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.users.get(client) as number;
    // 限流：同一用户在同一对局的每秒 move 次数
    const rateKey = `${userId}:${body.battleId}`;
    const now = Date.now();
    const bucket = this.moveRate.get(rateKey);
    if (bucket && now - bucket.windowStart < 1000) {
      if (bucket.count >= BattlesGateway.MOVE_MAX_PER_SEC) {
        throw new WsException('move rate limit exceeded');
      }
      bucket.count += 1;
    } else {
      this.moveRate.set(rateKey, { windowStart: now, count: 1 });
    }
    const m = await this.battles.move(
      userId,
      body.battleId,
      {
        from: body.from,
        to: body.to,
      },
      body.clientRequestId,
    );
    // 广播给房间：发送 move + 每步最新快照
    const room = `battle:${body.battleId}`;
    this.server.to(room).emit('battle.move', m);

    const snapshot = this.battles.snapshot(body.battleId);
    this.server.to(room).emit('battle.snapshot', snapshot);
    this.lastSnapshotAt.set(body.battleId, Date.now());

    // 若对局已结束，清理快照时间记录
    if (snapshot.status === 'finished') {
      this.lastSnapshotAt.delete(body.battleId);
    }

    return m;
  }

  @SubscribeMessage('battle.snapshot')
  onSnapshot(
    @MessageBody() body: { battleId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const snapshot = this.battles.snapshot(body.battleId);
    client.emit('battle.snapshot', snapshot);
    return snapshot;
  }

  @SubscribeMessage('battle.heartbeat')
  onHeartbeat(
    @MessageBody() body: { battleId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.users.get(client);
    const battleId = body?.battleId;
    if (userId && battleId) {
      // 限流：同一用户同一对局心跳至少间隔 HEARTBEAT_MIN_MS
      const key = `${userId}:${battleId}`;
      const now = Date.now();
      const last = this.heartbeatLastAt.get(key) || 0;
      if (now - last < BattlesGateway.HEARTBEAT_MIN_MS) {
        return { ok: true, ts: now, limited: true };
      }
      this.heartbeatLastAt.set(key, now);
      const changed = this.battles.setOnline(battleId, userId, true);
      if (changed) {
        const snapshot = this.battles.snapshot(battleId);
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
      }
    }
    return { ok: true, ts: Date.now() };
  }
}
