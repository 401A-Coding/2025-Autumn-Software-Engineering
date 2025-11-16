import { Board, Pos, Side, inBounds, cloneBoard } from './types';

// 查找将帅位置
export function findKing(board: Board, side: Side): Pos | null {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.type === 'general' && p.side === side) return { x, y };
    }
  }
  return null;
}

function pathClear(board: Board, from: Pos, to: Pos): boolean {
  if (from.x === to.x) {
    const step = from.y < to.y ? 1 : -1;
    for (let y = from.y + step; y !== to.y; y += step)
      if (board[y][from.x]) return false;
    return true;
  }
  if (from.y === to.y) {
    const step = from.x < to.x ? 1 : -1;
    for (let x = from.x + step; x !== to.x; x += step)
      if (board[from.y][x]) return false;
    return true;
  }
  return false;
}

// 生成“伪合法”走法（不考虑自家被将军）
export function generatePseudoMoves(board: Board, from: Pos): Pos[] {
  const piece = board[from.y][from.x];
  if (!piece) return [];
  const occ = (x: number, y: number) => board[y][x];
  const res: Pos[] = [];
  const pushIf = (x: number, y: number, cond: boolean) => {
    if (cond && inBounds(x, y)) res.push({ x, y });
  };
  switch (piece.type) {
    case 'soldier': {
      const dir = piece.side === 'red' ? -1 : 1;
      const ny = from.y + dir;
      if (inBounds(from.x, ny)) res.push({ x: from.x, y: ny });
      const crossed = piece.side === 'red' ? from.y <= 4 : from.y >= 5;
      if (crossed) {
        pushIf(from.x + 1, from.y, true);
        pushIf(from.x - 1, from.y, true);
      }
      break;
    }
    case 'rook': {
      const dirs: Pos[] = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      for (const d of dirs) {
        let x = from.x + d.x;
        let y = from.y + d.y;
        while (inBounds(x, y) && !occ(x, y)) {
          res.push({ x, y });
          x += d.x;
          y += d.y;
        }
        if (inBounds(x, y) && occ(x, y)) res.push({ x, y });
      }
      break;
    }
    case 'horse': {
      const legs = [
        {
          leg: { x: from.x + 1, y: from.y },
          moves: [
            { x: from.x + 2, y: from.y + 1 },
            { x: from.x + 2, y: from.y - 1 },
          ],
        },
        {
          leg: { x: from.x - 1, y: from.y },
          moves: [
            { x: from.x - 2, y: from.y + 1 },
            { x: from.x - 2, y: from.y - 1 },
          ],
        },
        {
          leg: { x: from.x, y: from.y + 1 },
          moves: [
            { x: from.x + 1, y: from.y + 2 },
            { x: from.x - 1, y: from.y + 2 },
          ],
        },
        {
          leg: { x: from.x, y: from.y - 1 },
          moves: [
            { x: from.x + 1, y: from.y - 2 },
            { x: from.x - 1, y: from.y - 2 },
          ],
        },
      ];
      for (const l of legs) {
        if (inBounds(l.leg.x, l.leg.y) && !occ(l.leg.x, l.leg.y)) {
          for (const m of l.moves) if (inBounds(m.x, m.y)) res.push(m);
        }
      }
      break;
    }
    case 'cannon': {
      const dirs: Pos[] = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      for (const d of dirs) {
        let x = from.x + d.x;
        let y = from.y + d.y;
        let jumped = false;
        while (inBounds(x, y)) {
          const p = occ(x, y);
          if (!p && !jumped) {
            res.push({ x, y });
          } else if (p && !jumped) {
            jumped = true;
          } else if (p && jumped) {
            res.push({ x, y });
            break;
          }
          x += d.x;
          y += d.y;
        }
      }
      break;
    }
    case 'advisor': {
      const palaceY = piece.side === 'red' ? [7, 8, 9] : [0, 1, 2];
      const palaceX = [3, 4, 5];
      const moves: Pos[] = [
        { x: from.x + 1, y: from.y + 1 },
        { x: from.x + 1, y: from.y - 1 },
        { x: from.x - 1, y: from.y + 1 },
        { x: from.x - 1, y: from.y - 1 },
      ];
      for (const m of moves)
        if (palaceX.includes(m.x) && palaceY.includes(m.y)) res.push(m);
      break;
    }
    case 'elephant': {
      const riverLimit = piece.side === 'red' ? 4 : 5; // 不可过河
      const moves: { eye: Pos; to: Pos }[] = [
        {
          eye: { x: from.x + 1, y: from.y + 1 },
          to: { x: from.x + 2, y: from.y + 2 },
        },
        {
          eye: { x: from.x - 1, y: from.y + 1 },
          to: { x: from.x - 2, y: from.y + 2 },
        },
        {
          eye: { x: from.x + 1, y: from.y - 1 },
          to: { x: from.x + 2, y: from.y - 2 },
        },
        {
          eye: { x: from.x - 1, y: from.y - 1 },
          to: { x: from.x - 2, y: from.y - 2 },
        },
      ];
      for (const m of moves) {
        if (!inBounds(m.to.x, m.to.y)) continue;
        if (piece.side === 'red' && m.to.y < riverLimit) continue;
        if (piece.side === 'black' && m.to.y > riverLimit) continue;
        if (!occ(m.eye.x, m.eye.y)) res.push(m.to);
      }
      break;
    }
    case 'general': {
      const palaceY = piece.side === 'red' ? [7, 8, 9] : [0, 1, 2];
      const palaceX = [3, 4, 5];
      const dirs: Pos[] = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      for (const d of dirs) {
        const nx = from.x + d.x;
        const ny = from.y + d.y;
        if (palaceX.includes(nx) && palaceY.includes(ny))
          res.push({ x: nx, y: ny });
      }
      // 飞将：若中线无阻隔，可对面将帅位置算一条“吃”
      const other =
        piece.side === 'red'
          ? findKing(board, 'black')
          : findKing(board, 'red');
      if (other && other.x === from.x) {
        let blocked = false;
        const minY = Math.min(other.y, from.y);
        const maxY = Math.max(other.y, from.y);
        for (let y = minY + 1; y < maxY; y++)
          if (board[y][from.x]) blocked = true;
        if (!blocked) res.push({ x: other.x, y: other.y });
      }
      break;
    }
    default:
      break;
  }
  return res;
}

export function generateLegalMoves(board: Board, from: Pos, side: Side): Pos[] {
  const pseudo = generatePseudoMoves(board, from);
  const piece = board[from.y][from.x];
  if (!piece || piece.side !== side) return [];
  return pseudo.filter((to) => {
    if (!inBounds(to.x, to.y)) return false;
    const target = board[to.y][to.x];
    if (target && target.side === side) return false; // 不能吃自己
    // 走后不能使己方将帅暴露在将军中
    const nb = movePiece(board, from, to);
    return !isInCheck(nb, side);
  });
}

export function movePiece(board: Board, from: Pos, to: Pos): Board {
  const nb = cloneBoard(board);
  const piece = nb[from.y][from.x];
  nb[from.y][from.x] = null;
  nb[to.y][to.x] = piece;
  return nb;
}

function flyingGeneralsIllegal(board: Board): boolean {
  const rk = findKing(board, 'red');
  const bk = findKing(board, 'black');
  if (!rk || !bk || rk.x !== bk.x) return false;
  const x = rk.x;
  const y1 = Math.min(rk.y, bk.y);
  const y2 = Math.max(rk.y, bk.y);
  for (let y = y1 + 1; y < y2; y++) if (board[y][x]) return false;
  return true;
}

export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return false;
  const opponent: Side = side === 'red' ? 'black' : 'red';
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.side === opponent) {
        const moves = generatePseudoMoves(board, { x, y });
        for (const m of moves) {
          if (m.x === king.x && m.y === king.y) {
            // 炮需验证隔子数 / 车需验证路径清晰 / 马需不被别腿
            if (p.type === 'rook' && pathClear(board, { x, y }, m)) return true;
            else if (p.type === 'cannon') {
              if (x === m.x) {
                const step = y < m.y ? 1 : -1;
                let cnt = 0;
                for (let yy = y + step; yy !== m.y; yy += step)
                  if (board[yy][x]) cnt++;
                if (cnt === 1) return true;
              } else if (y === m.y) {
                const step = x < m.x ? 1 : -1;
                let cnt = 0;
                for (let xx = x + step; xx !== m.x; xx += step)
                  if (board[y][xx]) cnt++;
                if (cnt === 1) return true;
              }
            } else if (p.type === 'horse') {
              // 马：伪合法列表已过滤被别腿
              return true;
            } else {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

export function checkGameOver(
  board: Board,
  currentTurn: Side,
): Side | 'draw' | null {
  const redKing = findKing(board, 'red');
  const blackKing = findKing(board, 'black');
  if (!redKing || !blackKing) {
    if (!redKing && !blackKing) return 'draw';
    return redKing ? 'red' : 'black';
  }
  if (flyingGeneralsIllegal(board)) {
    // 飞将直接判负当前走子的一方（等价于对方取胜）
    return currentTurn === 'red' ? 'black' : 'red';
  }
  // 是否无合法步（被绝杀）
  let hasLegalMove = false;
  for (let y = 0; y < 10 && !hasLegalMove; y++) {
    for (let x = 0; x < 9 && !hasLegalMove; x++) {
      const piece = board[y][x];
      if (piece && piece.side === currentTurn) {
        const moves = generateLegalMoves(board, { x, y }, currentTurn);
        if (moves.length > 0) {
          hasLegalMove = true;
        }
      }
    }
  }
  if (!hasLegalMove) {
    // currentTurn 无步 → 对方胜
    return currentTurn === 'red' ? 'black' : 'red';
  }
  return null;
}
