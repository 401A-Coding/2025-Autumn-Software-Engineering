import { BadRequestException } from '@nestjs/common';

type Side = 'red' | 'black';
type PieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'rook'
  | 'cannon'
  | 'soldier';
type Piece = {
  type: PieceType | string;
  side: Side | string;
  x: number;
  y: number;
};

const MAX_COUNTS: Record<string, number> = {
  general: 1,
  advisor: 2,
  elephant: 2,
  horse: 2,
  rook: 2,
  cannon: 2,
  soldier: 5,
};

function inRange(x: number, y: number) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

function kingFacing(pieces: Piece[]) {
  const generals = pieces.filter((p) => p.type === 'general');
  if (generals.length !== 2) return null;
  const [g1, g2] = generals;
  if (g1.x !== g2.x) return null;
  const x = g1.x;
  const minY = Math.min(g1.y, g2.y);
  const maxY = Math.max(g1.y, g2.y);
  const between = pieces.some((p) => p.x === x && p.y > minY && p.y < maxY);
  return between ? null : { x };
}

function isElephantSquare(side: Side | string, x: number, y: number) {
  if (x % 2 !== 0) return false;
  if (String(side) === 'red') return y % 2 === 1 && y >= 5;
  return y % 2 === 0 && y <= 4;
}

function isSoldierPositionLegal(side: Side | string, y: number) {
  return String(side) === 'red' ? y <= 6 : y >= 3;
}

export type ValidationItem = {
  code: string;
  message: string;
  x?: number;
  y?: number;
};
export type ValidationResult = { valid: boolean; errors: ValidationItem[] };

export function validateEndgamePieces(
  pieces: Piece[] | undefined,
): ValidationResult {
  const errors: ValidationItem[] = [];
  if (!Array.isArray(pieces)) return { valid: true, errors };

  const seen = new Set<string>();
  for (const p of pieces) {
    if (!inRange(p.x, p.y)) {
      errors.push({
        code: 'out_of_bounds',
        message: `越界：格 (${p.x},${p.y}) 不在 9x10 棋盘范围内`,
        x: p.x,
        y: p.y,
      });
      continue;
    }
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) {
      errors.push({
        code: 'overlap',
        message: `重叠：多个棋子占据格 (${p.x},${p.y})`,
        x: p.x,
        y: p.y,
      });
    } else {
      seen.add(key);
    }
  }

  const bySideType: Record<string, number> = {};
  for (const p of pieces) {
    const k = `${p.side}:${p.type}`;
    bySideType[k] = (bySideType[k] || 0) + 1;
    const max = MAX_COUNTS[String(p.type)] ?? 99;
    if (bySideType[k] > max) {
      errors.push({
        code: 'exceed_count',
        message: `超出数量限制：${p.side} 方 ${p.type} 超过 ${max} 个`,
      });
    }
  }

  for (const p of pieces) {
    if (p.type === 'elephant') {
      if (!isElephantSquare(p.side, p.x, p.y)) {
        errors.push({
          code: 'elephant_square',
          message: `象放置位置不合法：(${p.x},${p.y})`,
          x: p.x,
          y: p.y,
        });
      }
    }
    if (p.type === 'soldier') {
      if (!isSoldierPositionLegal(p.side, p.y)) {
        errors.push({
          code: 'soldier_position',
          message: `兵放置位置不合法：${p.side} 方 兵 不应置于后方行 (${p.x},${p.y})`,
          x: p.x,
          y: p.y,
        });
      }
    }
  }

  const redGenerals = pieces.filter(
    (p) => p.side === 'red' && p.type === 'general',
  ).length;
  const blackGenerals = pieces.filter(
    (p) => p.side === 'black' && p.type === 'general',
  ).length;
  if (redGenerals !== 1)
    errors.push({
      code: 'general_count_red',
      message: `红方应有且仅有 1 个帅，当前：${redGenerals}`,
    });
  if (blackGenerals !== 1)
    errors.push({
      code: 'general_count_black',
      message: `黑方应有且仅有 1 个将，当前：${blackGenerals}`,
    });

  const facing = kingFacing(pieces);
  if (facing) {
    errors.push({
      code: 'king_facing',
      message: '将帅相对直视（同一列且中间无子），这是不合法的局面',
    });
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidEndgameOrThrow(pieces: Piece[] | undefined) {
  const r = validateEndgamePieces(pieces);
  if (!r.valid) {
    throw new BadRequestException({
      message: 'Invalid endgame layout',
      errors: r.errors,
    });
  }
}
