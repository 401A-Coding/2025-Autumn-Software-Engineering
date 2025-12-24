import { Injectable } from '@nestjs/common';
import type { Board, Pos, Side } from '../../shared/chess/types';
import { createInitialBoard } from '../../shared/chess/types';
import {
  generateLegalMoves,
  movePiece,
  checkGameOver,
} from '../../shared/chess/rules';

export type ApplyResult =
  | { ok: true; board: Board; nextTurn: Side; winner: Side | 'draw' | null }
  | { ok: false; reason: string };

@Injectable()
export class ChessEngineService {
  createInitialBoard(): Board {
    return createInitialBoard();
  }

  validateAndApply(board: Board, turn: Side, from: Pos, to: Pos): ApplyResult {
    const legal = generateLegalMoves(board, from, turn);
    const isLegal = legal.some((m) => m.x === to.x && m.y === to.y);
    if (!isLegal) return { ok: false, reason: '非法走子' };
    const nb = movePiece(board, from, to);
    const nextTurn: Side = turn === 'red' ? 'black' : 'red';
    const winner = checkGameOver(nb, nextTurn);
    return { ok: true, board: nb, nextTurn, winner };
  }

  /**
   * 自定义模式下的无校验应用：信任客户端已按自定义规则计算合法性。
   * 后端仅做落子与轮次推进，不做标准规则校验与胜负判定。
   */
  applyUncheckedCustom(
    board: Board,
    turn: Side,
    from: Pos,
    to: Pos,
  ): { board: Board; nextTurn: Side } {
    const nb = movePiece(board, from, to);
    const nextTurn: Side = turn === 'red' ? 'black' : 'red';
    return { board: nb, nextTurn };
  }
}
