/**
 * 棋盘和对局相关的 API 服务
 */

import type { components } from '../types/api'

const base = import.meta.env.VITE_API_BASE || ''

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

type Board = components['schemas']['Board']
type BoardTemplate = components['schemas']['BoardTemplate']
type BoardCreateRequest = components['schemas']['BoardCreateRequest']
type BoardUpdateRequest = components['schemas']['BoardUpdateRequest']
type Battle = components['schemas']['Battle']
type BattleCreateRequest = components['schemas']['BattleCreateRequest']

/**
 * 获取认证 token
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token')
}

/**
 * 通用请求函数
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => 'Unknown error')}`)
  }

  return response.json()
}

/**
 * 棋盘相关 API
 */
export const boardApi = {
  /**
   * 获取棋盘模板列表
   */
  async getTemplates(): Promise<BoardTemplate[]> {
    const res = await apiRequest<BoardTemplate[]>('/api/v1/boards/templates')
    return res.data
  },

  /**
   * 创建自定义棋盘
   */
  async create(request: BoardCreateRequest): Promise<{ boardId: number; name: string }> {
    const res = await apiRequest<{ boardId: number; name: string }>('/api/v1/boards', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 获取我的棋盘列表
   */
  async getMine(page = 1, pageSize = 20): Promise<{ items: Board[]; page: number; pageSize: number; total: number }> {
    const res = await apiRequest<{ items: Board[]; page: number; pageSize: number; total: number }>(
      `/api/v1/boards/mine?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /**
   * 获取棋盘详情
   */
  async get(boardId: number): Promise<Board> {
    const res = await apiRequest<Board>(`/api/v1/boards/${boardId}`)
    return res.data
  },

  /**
   * 更新棋盘
   */
  async update(boardId: number, request: BoardUpdateRequest): Promise<Board> {
    const res = await apiRequest<Board>(`/api/v1/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 删除棋盘
   */
  async delete(boardId: number): Promise<void> {
    await apiRequest<Record<string, never>>(`/api/v1/boards/${boardId}`, {
      method: 'DELETE',
    })
  },
}

/**
 * 对局相关 API
 */
export const battleApi = {
  /**
   * 创建对局房间
   */
  async create(request: BattleCreateRequest): Promise<{ battleId: number; status: string }> {
    const res = await apiRequest<{ battleId: number; status: string }>('/api/v1/battles', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 加入对局
   */
  async join(battleId: number, password?: string): Promise<Battle> {
    const res = await apiRequest<Battle>('/api/v1/battles/join', {
      method: 'POST',
      body: JSON.stringify({ battleId, password }),
    })
    return res.data
  },

  /**
   * 快速匹配
   */
  async match(mode = 'pvp'): Promise<{ battleId: number }> {
    const res = await apiRequest<{ battleId: number }>('/api/v1/battles/match', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    })
    return res.data
  },

  /**
   * 获取对局详情
   */
  async get(battleId: number): Promise<Battle> {
    const res = await apiRequest<Battle>(`/api/v1/battles/${battleId}`)
    return res.data
  },

  /**
   * 获取对局历史
   */
  async getHistory(page = 1, pageSize = 20) {
    const res = await apiRequest<{ items: any[]; page: number; pageSize: number; total: number }>(
      `/api/v1/battles/history?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },
}
