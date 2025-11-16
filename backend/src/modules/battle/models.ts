import type { Board, Pos, Side, PieceType } from '../../shared/chess/types';

// 唯一标识一个对局
export type BattleId = number;

// 对局状态
export type BattleStatus = 'waiting' | 'playing' | 'finished';

// 玩家在对局中的席位（红/黑）
export type PlayerSlot = 'red' | 'black';

// 玩家信息（未来可扩展昵称、网络延迟等）
export interface BattlePlayer {
  userId: number;
  slot: PlayerSlot;
  joinedAt: number; // epoch ms
}

// 一步走子（带可选的棋子类型信息，便于回放/统计）
export interface BattleMove {
  seq: number; // 从 1 开始递增
  byUserId: number;
  slot: PlayerSlot; // 该步属于红/黑
  from: Pos;
  to: Pos;
  pieceType?: PieceType; // 走子方棋子类型（可由服务端填充）
  capturedType?: PieceType; // 被吃子的类型（若有）
  ts: number; // epoch ms
}

// 棋盘状态（权威状态）
export interface BattleBoardState {
  board: Board; // 10x9
  turn: Side; // 轮到哪一方（red/black）
}

// 对局快照：用于 Socket 广播/REST 获取
export interface BattleSnapshot {
  battleId: BattleId;
  status: BattleStatus;
  mode: string; // pvp / ai 等

  // 兼容字段：现有实现使用 players:number[] 表示参与者，players[0]=红，players[1]=黑
  players: number[];

  // 新字段（推荐）：明确的席位映射，易读性更高；迁移期间可与 players 并存
  playerSlots: Record<PlayerSlot, number | null>;

  // 棋盘与轮次（权威校验启用后始终返回；迁移期可为可选）
  board?: Board;
  turn?: Side;

  // 历史走子（可选包含类型信息）
  moves: BattleMove[];

  createdAt: number; // epoch ms

  // 终局信息（未结束为 null/undefined）
  winnerUserId?: number | null;
  winnerSlot?: PlayerSlot | null;
  // 采用枚举字符串或自定义扩展：保留内置枚举并允许其他值
  endReason?:
    | 'resign'
    | 'checkmate'
    | 'timeout'
    | 'draw'
    | 'manual'
    | (string & {});
}

// 对局简要信息（用于历史/列表）
export interface BattleSummary {
  battleId: BattleId;
  mode: string;
  status: BattleStatus;
  createdAt: number;
  players: number[]; // 或者可切换为 playerSlots
  winnerUserId?: number | null;
  endReason?:
    | 'resign'
    | 'checkmate'
    | 'timeout'
    | 'draw'
    | 'manual'
    | (string & {})
    | null;
}
