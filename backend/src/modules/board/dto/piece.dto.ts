import { IsIn, IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

function normalizePieceType(input: unknown): string {
  const s = String(input ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    // 将/帅
    general: 'general',
    king: 'general',
    k: 'general',
    jiang: 'general',
    shuai: 'general',
    将: 'general',
    帥: 'general',
    帅: 'general',
    將: 'general',
    // 士/仕
    advisor: 'advisor',
    guard: 'advisor',
    a: 'advisor',
    shi: 'advisor',
    士: 'advisor',
    仕: 'advisor',
    // 象/相
    elephant: 'elephant',
    bishop: 'elephant',
    e: 'elephant',
    xiang: 'elephant',
    象: 'elephant',
    相: 'elephant',
    // 马
    horse: 'horse',
    knight: 'horse',
    n: 'horse',
    ma: 'horse',
    马: 'horse',
    馬: 'horse',
    // 车
    rook: 'rook',
    chariot: 'rook',
    car: 'rook',
    r: 'rook',
    ju: 'rook',
    车: 'rook',
    車: 'rook',
    俥: 'rook',
    // 炮
    cannon: 'cannon',
    c: 'cannon',
    pao: 'cannon',
    炮: 'cannon',
    砲: 'cannon',
    // 兵/卒
    soldier: 'soldier',
    pawn: 'soldier',
    p: 'soldier',
    bing: 'soldier',
    zu: 'soldier',
    兵: 'soldier',
    卒: 'soldier',
  };
  const mapped = map[s] ?? s;
  const allowed = new Set([
    'general',
    'advisor',
    'elephant',
    'horse',
    'rook',
    'cannon',
    'soldier',
    'chariot',
  ]);
  // 将 chariot 统一视作 rook，但也允许直接校验通过
  if (mapped === 'chariot') return 'rook';
  return allowed.has(mapped) ? mapped : 'soldier';
}

function normalizeSide(input: unknown): string {
  const s = String(input ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, 'red' | 'black'> = {
    red: 'red',
    r: 'red',
    红: 'red',
    紅: 'red',
    black: 'black',
    b: 'black',
    黑: 'black',
  };
  return map[s] ?? (s === '0' ? 'red' : s === '1' ? 'black' : 'red');
}

export class PieceDto {
  @IsString()
  @Transform(({ value }) => normalizePieceType(value))
  @IsIn(
    [
      'general', // 将/帅
      'advisor', // 士/仕
      'elephant', // 象/相
      'horse', // 马
      'chariot', // 车
      'rook', // 兼容前端历史命名
      'cannon', // 炮
      'soldier', // 卒/兵
    ],
    { message: 'Invalid piece type' },
  )
  type!: string;

  @IsString()
  @Transform(({ value }) => normalizeSide(value))
  @IsIn(['red', 'black'], { message: "side must be either 'red' or 'black'" })
  side!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}
