import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type BattleStatus = 'waiting' | 'playing' | 'finished';

export interface Move {
  from: { x: number; y: number };
  to: { x: number; y: number };
  piece?: string;
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
}

@Injectable()
export class BattlesService {
  private nextId = 1;
  private battles = new Map<number, BattleState>();

  constructor(private readonly jwt: JwtService) {}

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
    const id = this.nextId++;
    const state: BattleState = {
      id,
      mode,
      status: 'waiting',
      players: [creatorId],
      moves: [],
      turnIndex: 0,
      createdAt: Date.now(),
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
      createdAt: b.createdAt,
    };
  }

  move(
    userId: number,
    battleId: number,
    move: Pick<Move, 'from' | 'to' | 'piece'>,
  ) {
    const b = this.getBattle(battleId);
    if (b.status !== 'playing') throw new BadRequestException('当前不可走子');
    const idx = b.players.indexOf(userId);
    if (idx === -1) throw new UnauthorizedException('不在房间内');
    if (idx !== b.turnIndex) throw new BadRequestException('未到你的回合');
    const m: Move = {
      ...move,
      by: userId,
      seq: b.moves.length + 1,
      ts: Date.now(),
    };
    b.moves.push(m);
    b.turnIndex = b.turnIndex === 0 ? 1 : 0;
    return m;
  }

  finish(
    battleId: number,
    result: { winnerId?: number | null; reason?: string },
  ) {
    const b = this.getBattle(battleId);
    b.status = 'finished';
    return { battleId: b.id, ...result };
  }
}
