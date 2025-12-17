import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import type { Board, Side } from '../../shared/chess/types';
import { createHash } from 'node:crypto';
import { ChessEngineService } from './engine.service';
import { MetricsService } from '../metrics/metrics.service';
import { RecordService } from '../record/record.service';

export type BattleStatus = 'waiting' | 'playing' | 'finished';

export interface Move {
  from: { x: number; y: number };
  to: { x: number; y: number };
  by: number; // userId
  seq: number;
  ts: number;
  stateHash?: string;
}

export interface BattleState {
  id: number;
  mode: string;
  status: BattleStatus;
  players: number[];
  moves: Move[];
  turnIndex: 0 | 1;
  createdAt: number;
  winnerId?: number | null;
  finishReason?: string | null;
  board: Board;
  turn: Side;
  onlineUserIds: number[];
  // 新增 ↓
  source: 'match' | 'room';
  visibility: 'match' | 'private' | 'public';
  ownerId?: number;
}

@Injectable()
export class BattlesService {
  private nextId = 1;
  private battles = new Map<number, BattleState>();
  private waitingByMode = new Map<string, number[]>(); // mode -> battleId list
  private histories = new Map<
    number,
    { battleId: number; result: 'win' | 'lose' | 'draw' }[]
  >();
  // 已处理的客户端请求（用于走子幂等）
  private processedRequests = new Map<string, { result: Move; ts: number }>();
  // TTL 定时器
  private waitingTtls = new Map<number, NodeJS.Timeout>();
  private disconnectTtls = new Map<number, NodeJS.Timeout>();
  // 每局互斥锁，串行化对同一对局的修改
  private readonly battleMutexes = new Map<number, SimpleMutex>();
  // 基础指标
  private readonly metricsData = {
    movesTotal: 0,
    waitingTtlCleaned: 0,
    disconnectTtlTriggered: 0,
  };

  // TTL 配置（开发默认）
  private static readonly WAITING_TTL_MS = 10 * 60 * 1000; // 10min
  private static readonly DISCONNECT_TTL_MS = 15 * 60 * 1000; // 15min，无人在线时触发
  private static readonly PROCESSED_REQ_TTL_MS = 5 * 60 * 1000; // 5min 去重记录 TTL

  constructor(
    private readonly jwt: JwtService,
    private readonly engine: ChessEngineService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly records?: RecordService,
  ) { }

  verifyBearer(authorization?: string) {
    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('未登录');
    }
    const token = authorization.slice(7).trim();
    try {
      const payload = this.jwt.verify<{ sub: number }>(token);
      return payload.sub;
    } catch {
      throw new UnauthorizedException('无效的凭证');
    }
  }

  createBattle(
    creatorId: number,
    mode = 'pvp',
    opts?: {
      source?: 'match' | 'room';
      visibility?: 'match' | 'private' | 'public';
    },
    seed?: { board: Board; turn: Side },
  ) {
    const source = opts?.source ?? 'room';
    const visibility =
      opts?.visibility ?? (source === 'match' ? 'match' : 'private');

    // 只有自建房才复用自己的等待房
    const reuse =
      source === 'room' ? this.findUserWaiting(creatorId, mode) : undefined;
    if (reuse) {
      const b = this.battles.get(reuse)!;
      return { battleId: b.id, status: b.status };
    }

    const id = this.nextId++;
    const state: BattleState = {
      id,
      mode,
      status: 'waiting',
      players: [creatorId],
      moves: [],
      turnIndex: 0,
      createdAt: Date.now(),
      board: seed?.board ?? this.engine.createInitialBoard(),
      turn: seed?.turn ?? 'red',
      onlineUserIds: [],
      source,
      visibility,
      ownerId: creatorId,
    };
    // 同步 turnIndex 与初始先手
    state.turnIndex = state.turn === 'red' ? 0 : 1;
    this.battles.set(id, state);
    this.scheduleWaitingTtl(id);
    return { battleId: id, status: state.status };
  }

  joinBattle(userId: number, battleId: number, _password?: string | null) {
    void _password;
    const b = this.battles.get(battleId);
    if (!b) throw new BadRequestException('房间不存在');
    if (b.status === 'finished') throw new BadRequestException('对局已结束');
    if (b.players.includes(userId)) {
      // 已在房间，返回当前状态
      return { battleId: b.id, status: b.status };
    }
    if (b.players.length >= 2) throw new BadRequestException('房间已满');
    b.players.push(userId);
    if (b.players.length === 2) b.status = 'playing';
    // 进入对战后，清理等待 TTL
    if (b.status === 'playing') this.clearWaitingTtl(b.id);
    return { battleId: b.id, status: b.status };
  }

  getBattle(battleId: number) {
    const b = this.battles.get(battleId);
    if (!b) throw new BadRequestException('房间不存在');
    return b;
  }

  snapshot(battleId: number) {
    const b = this.getBattle(battleId);
    return {
      battleId: b.id,
      status: b.status,
      mode: b.mode,
      players: b.players,
      moves: b.moves,
      turnIndex: b.turnIndex,
      board: b.board,
      turn: b.turn,
      createdAt: b.createdAt,
      winnerId: b.winnerId ?? null,
      finishReason: b.finishReason ?? null,
      lastMove: b.moves.length ? b.moves[b.moves.length - 1] : null,
      stateHash: this.computeStateHash(b),
      onlineUserIds: b.onlineUserIds,
      // 新增 ↓
      source: b.source,
      visibility: b.visibility,
      ownerId: b.ownerId ?? null,
    };
  }

  move(
    userId: number,
    battleId: number,
    move: Pick<Move, 'from' | 'to'>,
    clientRequestId?: string,
  ) {
    // 去重键包含 battleId，避免跨房间冲突
    const dedupeKey = clientRequestId
      ? `${battleId}:${clientRequestId}`
      : undefined;
    if (dedupeKey) {
      const hit = this.processedRequests.get(dedupeKey);
      if (hit) return hit.result;
    }

    // 同一对局的并发互斥
    const mutex = this.getBattleMutex(battleId);
    return mutex.runExclusive(() => {
      const b = this.getBattle(battleId);
      if (b.status !== 'playing') throw new BadRequestException('当前不可走子');
      const idx = b.players.indexOf(userId);
      if (idx === -1) throw new UnauthorizedException('不在房间内');
      if (idx !== b.turnIndex) throw new BadRequestException('未到你的回合');
      // 权威校验与应用
      const res = this.engine.validateAndApply(
        b.board,
        b.turn,
        move.from,
        move.to,
      );
      if (!('ok' in res) || !res.ok) {
        throw new BadRequestException(res.reason || '非法走子');
      }
      b.board = res.board;
      b.turn = res.nextTurn;
      const m: Move = {
        ...move,
        by: userId,
        seq: b.moves.length + 1,
        ts: Date.now(),
      };
      b.moves.push(m);
      this.metricsData.movesTotal += 1;
      this.metrics?.incMoves();
      // 同步 turnIndex
      b.turnIndex = b.turn === 'red' ? 0 : 1;
      // 附加最新 stateHash（给 ACK 与广播使用）
      m.stateHash = this.computeStateHash(b);
      // 胜负判定（如有）
      if (res.winner) {
        console.log(
          '[battle.move] winner detected',
          res.winner,
          'battleId',
          b.id,
        );
        if (res.winner === 'draw') {
          this.finish(b.id, { winnerId: null, reason: 'draw' });
        } else {
          const winnerId = res.winner === 'red' ? b.players[0] : b.players[1];
          this.finish(b.id, { winnerId, reason: 'checkmate' });
        }
      }
      if (dedupeKey) {
        this.processedRequests.set(dedupeKey, {
          result: m,
          ts: Date.now(),
        });
        this.cleanupProcessedRequests();
      }
      return m;
    });
  }

  finish(
    battleId: number,
    result: { winnerId?: number | null; reason?: string },
  ) {
    console.log('[battle.finish] ENTER', battleId, result);
    const b = this.getBattle(battleId);
    b.status = 'finished';
    b.winnerId = typeof result.winnerId === 'number' ? result.winnerId : null;
    b.finishReason = result.reason ?? null;
    // 结束时统一清理相关 TTL
    this.clearWaitingTtl(battleId);
    this.clearDisconnectTtl(battleId);
    // 记录历史
    for (const pid of b.players) {
      const list = this.histories.get(pid) || [];
      let r: 'win' | 'lose' | 'draw' = 'draw';
      if (b.winnerId && b.players.includes(b.winnerId)) {
        r = pid === b.winnerId ? 'win' : 'lose';
      }
      list.unshift({ battleId: b.id, result: r });
      this.histories.set(pid, list.slice(0, 200));
    }
    // 广播对局结束事件，方便 Gateway 推送最新 snapshot 与记录创建
    console.log('[battle.finish] before emit', !!this.events);
    this.events?.emit('battle.finished', { battleId: b.id });
    console.log('[battle.finish] after emit');
    return { battleId: b.id, ...result };
  }

  // 监听对局结束事件，自动创建云端记录（record）
  @OnEvent('battle.finished')
  async handleBattleFinished(payload: { battleId: number }) {
    console.log(
      '[battle.finished] creating records for battle',
      payload.battleId,
      'records exists =',
      !!this.records,
    );
    if (!this.records) return;
    const b = this.battles.get(payload.battleId);
    if (!b) return;

    // 调试信息
    console.log(
      '[battle.finished] battle moves count:',
      b.moves.length,
      'moves:',
      b.moves,
    );

    // 确定游戏结果（相对于红方）
    // b.players[0] 是红方，b.players[1] 是黑方
    let gameResult: 'red' | 'black' | 'draw' = 'draw';
    if (b.winnerId !== null && typeof b.winnerId !== 'undefined') {
      if (b.players[0] === b.winnerId)
        gameResult = 'red'; // 红方赢
      else if (b.players[1] === b.winnerId) gameResult = 'black'; // 黑方赢
    }

    // 将对局内存中的 moves 映射为 Record 模块可接受的结构
    const movesPayload = b.moves.map((mv, idx) => ({
      moveIndex: idx,
      from: { x: mv.from.x, y: mv.from.y },
      to: { x: mv.to.x, y: mv.to.y },
      piece: {
        side: mv.by === b.players[0] ? 'red' : 'black',
      },
    }));

    // 调试信息：输出 movesPayload
    console.log(
      '[battle.finished] movesPayload count:',
      movesPayload.length,
      'gameResult:',
      gameResult,
    );

    // 对每个玩家各写一条记录（都用同一个 gameResult）
    for (const pid of b.players) {
      const opponentId = b.players.find((id) => id !== pid) ?? null;
      try {
        const sourceLabel = b.source === 'match' ? '在线匹配' : '好友对战';
        console.log(
          '[battle.finished] creating record for player',
          pid,
          'result:',
          gameResult,
          'movesCount:',
          movesPayload.length,
        );
        await this.records.create(pid, {
          opponent: opponentId ? String(opponentId) : '对手',
          startedAt: new Date(b.createdAt).toISOString(),
          endedAt: new Date().toISOString(),
          result: gameResult,
          endReason: b.finishReason ?? 'other',
          keyTags: [sourceLabel],
          moves: movesPayload,
          bookmarks: [],
        } as any);
      } catch (e) {
        console.error(
          '[battle.finished] record create failed for user',
          pid,
          e,
        );
      }
    }
  }

  // 主动认输：当前对局中玩家请求直接判负
  resign(userId: number, battleId: number) {
    const b = this.getBattle(battleId);
    if (b.status !== 'playing') {
      throw new BadRequestException('当前不可认输');
    }
    if (!b.players.includes(userId)) {
      throw new UnauthorizedException('不在房间内');
    }
    const opponent = b.players.find((id) => id !== userId) ?? null;
    return this.finish(battleId, {
      winnerId: opponent,
      reason: 'resign',
    });
  }

  quickMatch(userId: number, mode = 'pvp') {
    const selfWaiting = this.findUserWaiting(userId, mode);
    if (selfWaiting) {
      return { battleId: selfWaiting };
    }

    const pool = this.waitingByMode.get(mode) || [];
    while (pool.length) {
      const bid = pool.shift()!;
      const b = this.battles.get(bid);
      if (b && b.status === 'waiting' && !b.players.includes(userId)) {
        this.joinBattle(userId, bid);
        this.waitingByMode.set(mode, pool);
        return { battleId: bid };
      }
    }

    // 仅为匹配创建 match 对局并加入匹配池
    const { battleId } = this.createBattle(userId, mode, {
      source: 'match',
      visibility: 'match',
    });
    const list = this.waitingByMode.get(mode) || [];
    list.push(battleId);
    this.waitingByMode.set(mode, list);
    return { battleId };
  }

  history(userId: number, page: number, pageSize: number) {
    const list = this.histories.get(userId) || [];
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);
    return { items, page, pageSize, total: list.length };
  }

  cancelWaiting(userId: number, battleId: number) {
    const b = this.battles.get(battleId);
    // 幂等：房间已不存在视为已取消
    if (!b) return { battleId, cancelled: true };
    if (b.status !== 'waiting')
      throw new BadRequestException('当前状态不可取消');
    if (b.players.length !== 1 || b.players[0] !== userId) {
      throw new BadRequestException('仅创建者可取消等待');
    }
    // 从等待池移除
    const list = this.waitingByMode.get(b.mode) || [];
    const filtered = list.filter((id) => id !== battleId);
    this.waitingByMode.set(b.mode, filtered);
    // 删除房间
    this.battles.delete(battleId);
    return { battleId, cancelled: true };
  }

  // 离开房间（幂等）：不在房间或房间不存在返回 left=false 与原因
  leaveBattle(userId: number, battleId: number) {
    const b = this.battles.get(battleId);
    if (!b) return { battleId, left: false, reason: 'not_found' as const };
    if (!b.players.includes(userId)) {
      return { battleId, left: false, reason: 'not_in_room' as const };
    }
    // 从房间移除
    b.players = b.players.filter((id) => id !== userId);
    if (b.players.length === 0) {
      // 若在等待池内则移除
      const list = this.waitingByMode.get(b.mode) || [];
      const filtered = list.filter((id) => id !== battleId);
      this.waitingByMode.set(b.mode, filtered);
      this.clearWaitingTtl(battleId);
      this.clearDisconnectTtl(battleId);
      this.battles.delete(battleId);
      return { battleId, left: true };
    }
    if (b.players.length === 1) {
      // 只剩一人：转为等待，并放回等待池（去重）
      b.status = 'waiting';
      const list = this.waitingByMode.get(b.mode) || [];
      if (!list.includes(battleId)) {
        list.push(battleId);
        this.waitingByMode.set(b.mode, list);
      }
      // 重新挂等待 TTL
      this.scheduleWaitingTtl(battleId);
      // 无人在线则考虑断线 TTL（通常剩下一人仍可能在线）
      this.evaluateDisconnectTtl(battleId);
    }
    return { battleId, left: true };
  }

  // 查找用户在指定模式下的单人等待房间
  private findUserWaiting(userId: number, mode: string): number | undefined {
    const pool = this.waitingByMode.get(mode) || [];
    for (const bid of pool) {
      const b = this.battles.get(bid);
      if (
        b &&
        b.status === 'waiting' &&
        b.players.length === 1 &&
        b.players[0] === userId
      ) {
        return bid;
      }
    }
    return undefined;
  }

  // 在线状态维护
  setOnline(battleId: number, userId: number, online: boolean): boolean {
    const b = this.battles.get(battleId);
    if (!b) return false;
    const set = new Set(b.onlineUserIds);
    const had = set.has(userId);
    if (online) set.add(userId);
    else set.delete(userId);
    const changed = had !== online;
    if (changed) {
      b.onlineUserIds = Array.from(set);
    }
    this.evaluateDisconnectTtl(battleId);
    return changed;
  }

  private evaluateDisconnectTtl(battleId: number) {
    const b = this.battles.get(battleId);
    if (!b) return;
    if (b.status === 'finished') {
      this.clearDisconnectTtl(battleId);
      return;
    }
    if ((b.onlineUserIds?.length || 0) === 0) {
      // 无人在线，启动断线 TTL
      this.scheduleDisconnectTtl(battleId);
    } else {
      // 有人在线，清理断线 TTL
      this.clearDisconnectTtl(battleId);
    }
  }

  private scheduleWaitingTtl(battleId: number) {
    this.clearWaitingTtl(battleId);
    const h = setTimeout(() => {
      const b = this.battles.get(battleId);
      if (!b) return;
      if (b.status === 'waiting') {
        // 从等待池清理并删除
        const list = this.waitingByMode.get(b.mode) || [];
        const filtered = list.filter((id) => id !== battleId);
        this.waitingByMode.set(b.mode, filtered);
        this.battles.delete(battleId);
        this.metricsData.waitingTtlCleaned += 1;
        this.metrics?.incWaitingTtlCleaned();
      }
      this.clearWaitingTtl(battleId);
    }, BattlesService.WAITING_TTL_MS);
    // 避免阻止进程退出
    h.unref?.();
    this.waitingTtls.set(battleId, h);
  }

  private clearWaitingTtl(battleId: number) {
    const h = this.waitingTtls.get(battleId);
    if (h) clearTimeout(h);
    this.waitingTtls.delete(battleId);
  }

  private scheduleDisconnectTtl(battleId: number) {
    this.clearDisconnectTtl(battleId);
    const h = setTimeout(() => {
      const b = this.battles.get(battleId);
      if (!b) return;
      if (b.status !== 'finished') {
        const online = b.onlineUserIds ?? [];
        let winnerId: number | null | undefined;
        if (online.length === 1) {
          // 只剩一人在线：判该玩家胜
          winnerId = online[0];
        } else if (online.length === 0) {
          // 双方都不在线：维持原有行为，判和
          winnerId = null;
        }
        if (winnerId !== undefined) {
          this.finish(battleId, {
            winnerId,
            reason: 'disconnect_ttl',
          });
          this.metricsData.disconnectTtlTriggered += 1;
          this.metrics?.incDisconnectTtlTriggered();
        }
      }
      this.clearDisconnectTtl(battleId);
    }, BattlesService.DISCONNECT_TTL_MS);
    // 避免阻止进程退出
    h.unref?.();
    this.disconnectTtls.set(battleId, h);
  }

  // 可选对外查询指标（目前仅内部使用）
  getMetrics() {
    return { ...this.metricsData };
  }

  private clearDisconnectTtl(battleId: number) {
    const h = this.disconnectTtls.get(battleId);
    if (h) clearTimeout(h);
    this.disconnectTtls.delete(battleId);
  }

  // 获取/创建指定对局的互斥锁
  private getBattleMutex(battleId: number): SimpleMutex {
    let m = this.battleMutexes.get(battleId);
    if (!m) {
      m = new SimpleMutex();
      this.battleMutexes.set(battleId, m);
    }
    return m;
  }

  // 清理由于 TTL 过期或数量过多的去重记录
  private cleanupProcessedRequests() {
    const now = Date.now();
    const ttl = BattlesService.PROCESSED_REQ_TTL_MS;
    for (const [k, v] of this.processedRequests) {
      if (now - v.ts > ttl) this.processedRequests.delete(k);
    }
    if (this.processedRequests.size > 500) {
      const keys = Array.from(this.processedRequests.keys()).slice(0, 100);
      keys.forEach((k) => this.processedRequests.delete(k));
    }
  }

  // 计算当前局面哈希，用于客户端快速一致性校验
  private computeStateHash(b: BattleState): string {
    const payload = {
      board: b.board,
      turn: b.turn,
      moves: b.moves.length,
      status: b.status,
      winnerId: b.winnerId ?? null,
    };
    const json = JSON.stringify(payload);
    return createHash('sha1').update(json).digest('hex');
  }
}

// 轻量互斥锁，串行化执行同一对局的临界区
class SimpleMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const release = () => {
        const next = this.queue.shift();
        if (next) next();
        else this.locked = false;
      };
      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}
