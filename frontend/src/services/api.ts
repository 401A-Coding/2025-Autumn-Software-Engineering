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
type CommunityShare = components['schemas']['CommunityShareItem']
type ReportRequest = components['schemas']['ReportRequest']
type SearchResultItem = components['schemas']['SearchResultItem']

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
    // API may return either an array or a paginated object { items: [] }
    const data: unknown = res.data
    if (Array.isArray(data)) {
      return data as BoardTemplate[]
    }
    if (data && typeof data === 'object' && 'items' in (data as Record<string, unknown>)) {
      const items = (data as Record<string, unknown>)['items']
      if (Array.isArray(items)) return items as BoardTemplate[]
    }
    // fallback to empty array to satisfy the declared return type
    return []
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

  /** 取消等待匹配（仅单人等待房间创建者） */
  async cancel(battleId: number): Promise<{ battleId: number; cancelled: boolean }> {
    const res = await apiRequest<{ battleId: number; cancelled: boolean }>(
      '/api/v1/battles/cancel',
      {
        method: 'POST',
        body: JSON.stringify({ battleId }),
      }
    );
    return res.data;
  },

  /** 离开房间（幂等） */
  async leave(battleId: number): Promise<{ battleId: number; left: boolean; reason?: string }> {
    const res = await apiRequest<{ battleId: number; left: boolean; reason?: string }>(
      '/api/v1/battles/leave',
      {
        method: 'POST',
        body: JSON.stringify({ battleId }),
      }
    );
    return res.data;
  },

  /** 认输当前对局 */
  async resign(battleId: number): Promise<
    NonNullable<operations['battlesResign']['responses'][200]['content']['application/json']['data']>
  > {
    type ResignData = NonNullable<
      operations['battlesResign']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<ResignData>('/api/v1/battles/resign', {
      method: 'POST',
      body: JSON.stringify({ battleId }),
    })
    return res.data
  },

  /** 获取当前对局最新快照（用于兜底轮询） */
  async snapshot(battleId: number): Promise<
    NonNullable<operations['battlesGet']['responses'][200]['content']['application/json']['data']>
  > {
    type GetData = NonNullable<
      operations['battlesGet']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<GetData>(`/api/v1/battles/${battleId}`)
    return res.data
  },
}

/**
 * 记录相关 API
 */
export const recordsApi = {
  /** 创建记录 */
  async create(
    body: components['schemas']['RecordCreateRequest']
  ): Promise<
    NonNullable<operations['recordsCreate']['responses'][200]['content']['application/json']['data']>
  > {
    type CreateData = NonNullable<
      operations['recordsCreate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CreateData>('/api/v1/records', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data
  },
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

  /** 更新记录（结果、标签等） */
  async update(
    id: number,
    body: components['schemas']['RecordUpdateRequest']
  ): Promise<
    NonNullable<operations['recordsUpdate']['responses'][200]['content']['application/json']['data']>
  > {
    type UpdateData = NonNullable<
      operations['recordsUpdate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<UpdateData>(`/api/v1/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
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

  bookmarks: {
    /** 为记录添加书签 */
    async add(id: number, body: components['schemas']['BookmarkCreateRequest']) {
      type AddBmData = NonNullable<
        operations['recordsBookmarkAdd']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<AddBmData>(`/api/v1/records/${id}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.data
    },

    /** 更新书签 */
    async update(
      id: number,
      bookmarkId: number,
      body: components['schemas']['BookmarkUpdateRequest']
    ) {
      type UpdateBmData = NonNullable<
        operations['recordsBookmarkUpdate']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<UpdateBmData>(
        `/api/v1/records/${id}/bookmarks/${bookmarkId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      )
      return res.data
    },

    /** 删除书签 */
    async remove(id: number, bookmarkId: number): Promise<void> {
      type RemoveBmData =
        operations['recordsBookmarkDelete']['responses'][200]['content']['application/json']['data']
      await apiRequest<RemoveBmData>(`/api/v1/records/${id}/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
      })
    },
  },

  prefs: {
    async get(): Promise<
      NonNullable<operations['recordsPrefsGet']['responses'][200]['content']['application/json']['data']>
    > {
      type PrefsData = NonNullable<
        operations['recordsPrefsGet']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<PrefsData>('/api/v1/records/prefs')
      return res.data
    },

    async update(body: components['schemas']['RecordPrefsPatch']) {
      type UpdatePrefsData = NonNullable<
        operations['recordsPrefsUpdate']['responses'][200]['content']['application/json']['data']
      >
      const res = await apiRequest<UpdatePrefsData>('/api/v1/records/prefs', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      return res.data
    },
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
  /** 上传头像（multipart/form-data） */
  async uploadAvatar(file: File) {
    type AvatarData = NonNullable<
      operations['usersMeAvatar']['responses'][200]['content']['application/json']['data']
    >
    const token = getAuthToken()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${base}/api/v1/users/me/avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => 'Unknown error')}`)
    }
    const json: ApiResponse<AvatarData> = await res.json()
    return json.data
  },
}

/**
 * 社区相关 API
 */
export const communityApi = {
  /** 获取分享广场 */
  async list(page = 1, pageSize = 20): Promise<
    NonNullable<operations['communityShares']['responses'][200]['content']['application/json']['data']>
  > {
    type PageData = NonNullable<
      operations['communityShares']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<PageData>(`/api/v1/community/shares?page=${page}&pageSize=${pageSize}`)
    // 兼容 data 为空或 items 缺失的情况
    const data: any = res.data ?? {}
    return {
      items: Array.isArray(data.items) ? (data.items as CommunityShare[]) : [],
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
      total: data.total ?? 0,
    }
  },

  /** 点赞分享 */
  async like(id: number) {
    type OkData = NonNullable<
      operations['communityLike']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/shares/${id}/like`, {
      method: 'POST',
    })
    return res.data
  },

  /** 取消点赞分享 */
  async unlike(id: number) {
    type OkData = NonNullable<
      operations['communityUnlike']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/shares/${id}/like`, {
      method: 'DELETE',
    })
    return res.data
  },

  /** 举报内容 */
  async report(body: ReportRequest) {
    type ReportData = NonNullable<
      operations['communityReport']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<ReportData>('/api/v1/community/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data
  },

  /** 搜索对局 */
  async search(params: { q?: string; tag?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.tag) query.set('tag', params.tag)
    if (params.page) query.set('page', String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))

    type SearchData = NonNullable<
      operations['communitySearch']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<SearchData>(`/api/v1/community/search?${query.toString()}`)
    const data: any = res.data ?? {}
    return {
      items: Array.isArray(data.items) ? (data.items as SearchResultItem[]) : [],
      page: data.page ?? params.page ?? 1,
      pageSize: data.pageSize ?? params.pageSize ?? 10,
      total: data.total ?? 0,
    }
  },
}
