/**
 * 棋盘数据格式转换器
 * 用于在前端内部格式（二维数组）和 API 格式（扁平数组+坐标）之间转换
 */

import type { Board, Piece } from './types'
import type { components } from '../../types/api'

type ApiBoard = components['schemas']['Board']
type ApiPiece = NonNullable<NonNullable<ApiBoard['layout']>['pieces']>[number]

/**
 * 将前端二维数组格式转换为 API 格式
 */
export function boardToApiFormat(board: Board, name?: string, description?: string): ApiBoard {
  const pieces: ApiPiece[] = []

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      const piece = board[y][x]
      if (piece) {
        pieces.push({
          // 后端字段命名使用 chariot 代指车，这里做一次映射
          type: (piece.type === 'rook' ? 'chariot' : piece.type) as any,
          x,
          y,
          side: piece.side,
        })
      }
    }
  }

  return {
    name: name || '自定义棋局',
    // DTO 要求 string，这里用空串而不是 null 以通过验证
    description: description || '',
    layout: { pieces },
  }
}

/**
 * 将 API 格式转换为前端二维数组格式
 */
export function apiBoardToLocalFormat(apiBoard: ApiBoard): Board {
  // 初始化空棋盘
  const board: Board = Array.from({ length: 10 }, () =>
    Array.from({ length: 9 }, () => null)
  )

  const pieces = apiBoard.layout?.pieces || []
  let idCounter = 0

  pieces.forEach((apiPiece) => {
    const { type, x, y, side } = apiPiece
    if (
      type &&
      typeof x === 'number' &&
      typeof y === 'number' &&
      side &&
      x >= 0 && x < 9 &&
      y >= 0 && y < 10
    ) {
      const piece: Piece = {
        id: `${side}-${type}-${idCounter++}`,
        // 与上行相反映射：后端的 chariot 在前端使用 rook
        type: (type === 'chariot' ? 'rook' : (type as any)) as Piece['type'],
        side: side as 'red' | 'black',
      }
      board[y][x] = piece
    }
  })

  return board
}

/**
 * 从 API BoardTemplate 创建初始棋盘
 */
export function templateToBoard(_template: components['schemas']['BoardTemplate']): Board {
  void _template; // 占位：将来可根据模板加载布局
  // 模板只有 id/name/preview，实际布局需要从 GET /api/v1/boards/{id} 获取
  // 这里返回标准初始棋盘作为占位
  return createStandardBoard()
}

/**
 * 创建标准象棋初始棋盘（与 types.ts 中的 createInitialBoard 相同）
 */
function createStandardBoard(): Board {
  const b: Board = Array.from({ length: 10 }, () =>
    Array.from({ length: 9 }, () => null)
  )
  let id = 0
  const add = (x: number, y: number, type: Piece['type'], side: 'red' | 'black') => {
    b[y][x] = { id: `${side}-${type}-${id++}`, type, side }
  }
  // 黑方（上）
  add(0, 0, 'rook', 'black'); add(8, 0, 'rook', 'black')
  add(1, 0, 'horse', 'black'); add(7, 0, 'horse', 'black')
  add(2, 0, 'elephant', 'black'); add(6, 0, 'elephant', 'black')
  add(3, 0, 'advisor', 'black'); add(5, 0, 'advisor', 'black')
  add(4, 0, 'general', 'black')
  add(1, 2, 'cannon', 'black'); add(7, 2, 'cannon', 'black')
  for (let x = 0; x < 9; x += 2) add(x, 3, 'soldier', 'black')
  // 红方（下）
  add(0, 9, 'rook', 'red'); add(8, 9, 'rook', 'red')
  add(1, 9, 'horse', 'red'); add(7, 9, 'horse', 'red')
  add(2, 9, 'elephant', 'red'); add(6, 9, 'elephant', 'red')
  add(3, 9, 'advisor', 'red'); add(5, 9, 'advisor', 'red')
  add(4, 9, 'general', 'red')
  add(1, 7, 'cannon', 'red'); add(7, 7, 'cannon', 'red')
  for (let x = 0; x < 9; x += 2) add(x, 6, 'soldier', 'red')
  return b
}
