import { Logger } from '@nestjs/common';
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

@WebSocketGateway({
  namespace: '/battle',
  cors: { origin: [/http:\/\/localhost:(5173|5174)$/] },
})
export class BattlesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(BattlesGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly battles: BattlesService) {}

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
    @MessageBody() body: { battleId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.users.get(client) as number;
    const { battleId } = body || ({} as any);
    const res = this.battles.joinBattle(userId, battleId);
    await client.join(`battle:${battleId}`);
    this.joinedBattle.set(client, battleId);
    this.battles.setOnline(battleId, userId, true);
    const snapshot = this.battles.snapshot(battleId);
    // 回发给加入者 snapshot
    client.emit('battle.snapshot', snapshot);
    // 广播有人加入（给房间其他人）
    client.to(`battle:${battleId}`).emit('battle.player_join', { userId });
    // 同步在线状态
    this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
    return res;
  }

  @SubscribeMessage('battle.move')
  onMove(
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
    const m = this.battles.move(
      userId,
      body.battleId,
      {
        from: body.from,
        to: body.to,
      },
      body.clientRequestId,
    );
    // 广播给房间
    this.server.to(`battle:${body.battleId}`).emit('battle.move', m);
    // 同步最新快照（包含权威棋盘与可能的胜负状态）
    const snapshot = this.battles.snapshot(body.battleId);
    this.server.to(`battle:${body.battleId}`).emit('battle.snapshot', snapshot);
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
      const changed = this.battles.setOnline(battleId, userId, true);
      // 条件推送：仅当在线状态发生变化时广播最新快照
      if (changed) {
        const snapshot = this.battles.snapshot(battleId);
        this.server.to(`battle:${battleId}`).emit('battle.snapshot', snapshot);
      }
    }
    return { ok: true, ts: Date.now() };
  }
}
