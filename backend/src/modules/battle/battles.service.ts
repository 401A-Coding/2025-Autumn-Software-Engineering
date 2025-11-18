import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Board, Side } from '../../shared/chess/types';
import { ChessEngineService } from './engine.service';

export type BattleStatus = 'waiting' | 'playing' | 'finished';

export interface Move {
  from: { x: number; y: number };
  to: { x: number; y: number };
  by: number; // userId
  seq: number;
  ts: number;
}

export interface BattleState {
  id: number;
  mode: string;
  status: BattleStatus;
  players: number[]; // [red, black]
  moves: Move[];
  turnIndex: 0 | 1; // 0=players[0], 1=players[1]
  createdAt: number;
  winnerId?: number | null;
  // 权威棋盘与轮次
  board: Board;
  turn: Side; // 'red' | 'black'
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

  constructor(
    private readonly jwt: JwtService,
    private readonly engine: ChessEngineService,
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

  createBattle(creatorId: number, mode = 'pvp') {
    // 若该用户在该模式已有单人等待房间，直接复用避免重复创建
    const reuse = this.findUserWaiting(creatorId, mode);
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
      board: this.engine.createInitialBoard(),
      turn: 'red',
    };
    this.battles.set(id, state);
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
    };
  }

  move(userId: number, battleId: number, move: Pick<Move, 'from' | 'to'>) {
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
    // 同步 turnIndex
    b.turnIndex = b.turn === 'red' ? 0 : 1;
    // 胜负判定（如有）
    if (res.winner) {
      if (res.winner === 'draw') {
        this.finish(b.id, { winnerId: null, reason: 'draw' });
      } else {
        const winnerId = res.winner === 'red' ? b.players[0] : b.players[1];
        this.finish(b.id, { winnerId, reason: 'checkmate' });
      }
    }
    return m;
  }

  finish(
    battleId: number,
    result: { winnerId?: number | null; reason?: string },
  ) {
    const b = this.getBattle(battleId);
    b.status = 'finished';
    b.winnerId = typeof result.winnerId === 'number' ? result.winnerId : null;
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
    return { battleId: b.id, ...result };
  }

  quickMatch(userId: number, mode = 'pvp') {
    // 先看自己是否已有等待房间（可能前端重复点击）
    const selfWaiting = this.findUserWaiting(userId, mode);
    if (selfWaiting) {
      return { battleId: selfWaiting };
    }
    // 尝试匹配等待中的房间
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
    // 无可匹配→创建并进入等待
    const { battleId } = this.createBattle(userId, mode);
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
    if (!b) throw new BadRequestException('房间不存在');
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
}
