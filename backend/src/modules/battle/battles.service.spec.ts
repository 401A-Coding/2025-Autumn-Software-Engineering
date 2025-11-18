import { Test, TestingModule } from '@nestjs/testing';
import { BattlesService } from './battles.service';
import { JwtService } from '@nestjs/jwt';
import { ChessEngineService } from './engine.service';
import { BadRequestException } from '@nestjs/common';

// Stub engine service: only initial board, no real move validation needed for these tests.
class EngineStub {
  createInitialBoard() {
    return { cells: [] } as any; // minimal placeholder
  }
  validateAndApply(board: any, turn: any, from: any, to: any) {
    return {
      ok: true,
      board,
      nextTurn: turn === 'red' ? 'black' : 'red',
      winner: null,
    };
  }
}

describe('BattlesService', () => {
  let service: BattlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BattlesService,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        { provide: ChessEngineService, useClass: EngineStub },
      ],
    }).compile();

    service = module.get<BattlesService>(BattlesService);
  });

  it('quickMatch should create waiting room first time and reuse on duplicate', () => {
    const userId = 101;
    const first = service.quickMatch(userId, 'pvp');
    const second = service.quickMatch(userId, 'pvp');
    expect(first.battleId).toBeDefined();
    expect(second.battleId).toBe(first.battleId); // reuse
    const snap = service.snapshot(first.battleId);
    expect(snap.status).toBe('waiting');
    expect(snap.players).toEqual([userId]);
  });

  it('quickMatch with two distinct users should pair them into same battle', () => {
    const u1 = 201;
    const u2 = 202;
    const m1 = service.quickMatch(u1, 'pvp');
    const m2 = service.quickMatch(u2, 'pvp');
    expect(m1.battleId).toBe(m2.battleId);
    const snap = service.snapshot(m1.battleId);
    expect(snap.status).toBe('playing');
    expect(snap.players.sort()).toEqual([u1, u2].sort());
  });

  it('cancelWaiting should delete waiting battle by creator', () => {
    const uid = 301;
    const { battleId } = service.quickMatch(uid, 'pvp');
    const snapBefore = service.snapshot(battleId);
    expect(snapBefore.status).toBe('waiting');
    const res = service.cancelWaiting(uid, battleId);
    expect(res).toEqual({ battleId, cancelled: true });
    expect(() => service.snapshot(battleId)).toThrow(BadRequestException);
  });

  it('cancelWaiting should fail after second player joins', () => {
    const a = 401;
    const b = 402;
    const matchA = service.quickMatch(a, 'pvp');
    service.quickMatch(b, 'pvp'); // joins A's battle
    const snap = service.snapshot(matchA.battleId);
    expect(snap.status).toBe('playing');
    expect(() => service.cancelWaiting(a, matchA.battleId)).toThrow(
      BadRequestException,
    );
  });

  it('cancelWaiting should fail if non-creator tries to cancel waiting battle', () => {
    const creator = 501;
    const other = 502;
    const { battleId } = service.quickMatch(creator, 'pvp');
    // other user has not joined yet
    expect(() => service.cancelWaiting(other, battleId)).toThrow(
      BadRequestException,
    );
  });
});
