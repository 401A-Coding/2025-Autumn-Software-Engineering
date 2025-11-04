/**
 * 棋盘和对局相关的 API 服务
 */

import type { components, operations } from '../types/api'

const base = import.meta.env.VITE_API_BASE || ''

type ApiResponse<T> = {
  code: number
  message: string
  data: T
}

type BoardTemplate = components['schemas']['BoardTemplate']
type BoardCreateRequest = components['schemas']['BoardCreateRequest']
type BoardUpdateRequest = components['schemas']['BoardUpdateRequest']
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
    type TemplatesData = NonNullable<
      operations['boardsTemplates']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<TemplatesData>('/api/v1/boards/templates')
    return res.data
  },

  /**
   * 创建自定义棋盘
   */
  async create(request: BoardCreateRequest): Promise<
    NonNullable<operations['boardsCreate']['responses'][200]['content']['application/json']['data']>
  > {
    type CreateData = NonNullable<
      operations['boardsCreate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CreateData>('/api/v1/boards', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 获取我的棋盘列表
   */
  async getMine(page = 1, pageSize = 20): Promise<
    NonNullable<operations['boardsMine']['responses'][200]['content']['application/json']['data']>
  > {
    type MineData = NonNullable<
      operations['boardsMine']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<MineData>(
      `/api/v1/boards/mine?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /**
   * 获取棋盘详情
   */
  async get(boardId: number): Promise<
    NonNullable<operations['boardsGet']['responses'][200]['content']['application/json']['data']>
  > {
    type GetData = NonNullable<
      operations['boardsGet']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<GetData>(`/api/v1/boards/${boardId}`)
    return res.data
  },

  /**
   * 更新棋盘
   */
  async update(boardId: number, request: BoardUpdateRequest): Promise<
    NonNullable<operations['boardsUpdate']['responses'][200]['content']['application/json']['data']>
  > {
    type UpdateData = NonNullable<
      operations['boardsUpdate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<UpdateData>(`/api/v1/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 删除棋盘
   */
  async delete(boardId: number): Promise<void> {
    type DeleteData = operations['boardsDelete']['responses'][200]['content']['application/json']['data']
    await apiRequest<DeleteData>(`/api/v1/boards/${boardId}`, {
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
  async create(request: BattleCreateRequest): Promise<
    NonNullable<operations['battlesCreate']['responses'][200]['content']['application/json']['data']>
  > {
    type CreateData = NonNullable<
      operations['battlesCreate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CreateData>('/api/v1/battles', {
      method: 'POST',
      body: JSON.stringify(request),
    })
    return res.data
  },

  /**
   * 加入对局
   */
  async join(battleId: number, password?: string): Promise<
    NonNullable<operations['battlesJoin']['responses'][200]['content']['application/json']['data']>
  > {
    type JoinData = NonNullable<
      operations['battlesJoin']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<JoinData>('/api/v1/battles/join', {
      method: 'POST',
      body: JSON.stringify({ battleId, password }),
    })
    return res.data
  },

  /**
   * 快速匹配
   */
  async match(mode = 'pvp'): Promise<
    NonNullable<operations['battlesMatch']['responses'][200]['content']['application/json']['data']>
  > {
    type MatchData = NonNullable<
      operations['battlesMatch']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<MatchData>('/api/v1/battles/match', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    })
    return res.data
  },

  /**
   * 获取对局详情
   */
  async get(battleId: number): Promise<
    NonNullable<operations['battlesGet']['responses'][200]['content']['application/json']['data']>
  > {
    type GetData = NonNullable<
      operations['battlesGet']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<GetData>(`/api/v1/battles/${battleId}`)
    return res.data
  },

  /**
   * 获取对局历史
   */
  async getHistory(page = 1, pageSize = 20): Promise<
    NonNullable<operations['battlesHistory']['responses'][200]['content']['application/json']['data']>
  > {
    type HistoryData = NonNullable<
      operations['battlesHistory']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<HistoryData>(
      `/api/v1/battles/history?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },
}

/**
 * 记录相关 API
 */
export const recordsApi = {
  /** 列出我的记录（分页） */
  async list(page = 1, pageSize = 20): Promise<
    NonNullable<operations['recordsList']['responses'][200]['content']['application/json']['data']>
  > {
    type ListData = NonNullable<
      operations['recordsList']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<ListData>(
      `/api/v1/records?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /** 获取记录详情 */
  async get(id: number): Promise<
    NonNullable<operations['recordsGet']['responses'][200]['content']['application/json']['data']>
  > {
    type GetData = NonNullable<
      operations['recordsGet']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<GetData>(`/api/v1/records/${id}`)
    return res.data
  },

  /** 分享记录 */
  async share(id: number, body: components['schemas']['ShareRequest']): Promise<
    NonNullable<operations['recordsShare']['responses'][200]['content']['application/json']['data']>
  > {
    type ShareData = NonNullable<
      operations['recordsShare']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<ShareData>(`/api/v1/records/${id}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data
  },

  /** 收藏记录 */
  async favorite(id: number): Promise<
    NonNullable<operations['recordsFavorite']['responses'][200]['content']['application/json']['data']>
  > {
    type FavoriteData = NonNullable<
      operations['recordsFavorite']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<FavoriteData>(`/api/v1/records/${id}/favorite`, {
      method: 'POST',
    })
    return res.data
  },

  /** 取消收藏 */
  async unfavorite(id: number): Promise<
    NonNullable<operations['recordsUnfavorite']['responses'][200]['content']['application/json']['data']>
  > {
    type UnfavoriteData = NonNullable<
      operations['recordsUnfavorite']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<UnfavoriteData>(`/api/v1/records/${id}/favorite`, {
      method: 'DELETE',
    })
    return res.data
  },

  comments: {
    /** 列出评论 */
    async list(id: number): Promise<
      NonNullable<operations['recordsCommentsList']['responses'][200]['content']['application/json']['data']>
    > {
      type CommentsData = NonNullable<
        operations['recordsCommentsList']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<CommentsData>(`/api/v1/records/${id}/comments`)
      return res.data
    },

    /** 新增评论 */
    async add(id: number, body: components['schemas']['CommentCreateRequest']): Promise<
      NonNullable<operations['recordsCommentsAdd']['responses'][200]['content']['application/json']['data']>
    > {
      type AddCommentData = NonNullable<
        operations['recordsCommentsAdd']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<AddCommentData>(`/api/v1/records/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.data
    },
  },

  /** 导出记录（二进制） */
  async export(id: number): Promise<
    operations['recordsExport']['responses'][200]['content']['application/octet-stream']
  > {
    // 使用独立的二进制请求，保留 Authorization 头
    const token = getAuthToken()
    const res = await fetch(`${base}/api/v1/records/${id}/export`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // OpenAPI 类型是 string；如需 Blob 可另行提供导出方法
    return await res.text()
  },
}
/**
 * 用户相关 API
 */
export const userApi = {
  /** 获取当前用户信息 */
  async getMe() {
    type MeData = NonNullable<
      operations['usersMe']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<MeData>('/api/v1/users/me')
    return res.data
  },
  /** 部分更新当前用户信息 */
  async updateMe(patch: components['schemas']['UserUpdateRequest']) {
    type MeUpdateData = NonNullable<
      operations['usersMeUpdate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<MeUpdateData>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    return res.data
  },
}
