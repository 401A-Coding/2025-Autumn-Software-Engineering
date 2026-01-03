/**
 * 棋盘和对局相关的 API 服务
 */

import type { components, operations } from '../types/api'
import http from '../lib/http'
import { getAccessToken } from '../lib/auth'

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
type ReportRequest = components['schemas']['ReportRequest']
type SearchResultItem = components['schemas']['SearchResultItem']

/**
 * 通用请求函数
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // 统一通过 axios 实例 http 发起请求，以复用 401 自动刷新与包裹解封装
  const method = (options.method || 'GET').toString().toUpperCase()
  const headers = { ...(options.headers || {}) } as Record<string, string>
  let data: any = undefined
  if (options.body !== undefined) {
    data = options.body
    // 确保 JSON 请求头
    if (typeof data === 'string' && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  }
  const res = await http.request<T>({ url: `${endpoint}`, method, headers, data })
  // http 拦截器已将 { code, message, data } 解封装为 res.data
  return { code: 0, message: 'OK', data: res.data as T }
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
   * 获取我的残局列表（需登录）
   */
  async getMyEndgames(page = 1, pageSize = 20): Promise<
    NonNullable<operations['boardsEndgames']['responses'][200]['content']['application/json']['data']>
  > {
    type EndgamesData = NonNullable<
      operations['boardsEndgames']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<EndgamesData>(`/api/v1/boards/endgames?page=${page}&pageSize=${pageSize}`)
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
   * 创建残局（与对战无关的独立保存）
   * 自动设置 isEndgame=true、isTemplate=false 与默认 preview 字段
   */
  async createTemplate(request: BoardCreateRequest): Promise<
    NonNullable<operations['boardsCreate']['responses'][200]['content']['application/json']['data']>
  > {
    const payload: BoardCreateRequest = {
      ...request,
      // 强制作为模板保存
      // 由于 BoardCreateRequest 类型不含 isTemplate/preview（来自 OpenAPI 旧版），此处按后端约定附加字段
      ...(request as any),
    }
      ; (payload as any).isEndgame = true
      ; (payload as any).isTemplate = false
    if ((payload as any).preview === undefined) (payload as any).preview = ''
    const res = await apiRequest<
      NonNullable<operations['boardsCreate']['responses'][200]['content']['application/json']['data']>
    >('/api/v1/boards', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  /** 设置临时规则（仅房主可调用） */
  async setRules(battleId: number, rules: any): Promise<{ battleId: number; ok: boolean } | null> {
    const res = await apiRequest<{ battleId: number; ok: boolean }>(`/api/v1/battles/${battleId}/rules`, {
      method: 'POST',
      body: JSON.stringify({ rules }),
    })
    return res.data ?? null
  },

  /** 获取临时规则（加入方调用） */
  async getRules(battleId: number): Promise<any | null> {
    const res = await apiRequest<any>(`/api/v1/battles/${battleId}/rules`)
    return res.data ?? null
  },

  /** 设置临时回放（仅房主可调用） */
  async setReplay(battleId: number, replay: any): Promise<{ battleId: number; ok: boolean } | null> {
    const res = await apiRequest<{ battleId: number; ok: boolean }>(`/api/v1/battles/${battleId}/replay`, {
      method: 'POST',
      body: JSON.stringify({ replay }),
    })
    return res.data ?? null
  },

  /** 获取临时回放（参与者调用） */
  async getReplay(battleId: number): Promise<any | null> {
    const res = await apiRequest<any>(`/api/v1/battles/${battleId}/replay`)
    return res.data ?? null
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

  /** 删除记录 */
  async delete(id: number): Promise<void> {
    await apiRequest<void>(`/api/v1/records/${id}`, { method: 'DELETE' })
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
    const token = getAccessToken()
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
 * 管理相关 API（需要管理员权限）
 */
export const adminApi = {
  async listUsers(q?: string) {
    const url = q ? `/api/v1/admin/users?q=${encodeURIComponent(q)}` : '/api/v1/admin/users'
    const res = await apiRequest<any[]>(url)
    return res.data
  },

  async updateUserRole(id: number, role: 'USER' | 'ADMIN') {
    const res = await apiRequest<any>(`/api/v1/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
    return res.data
  },
  async banUser(id: number, body: { reason?: string; days?: number }) {
    const res = await apiRequest<any>(`/api/v1/admin/users/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return res.data
  },
  async unbanUser(id: number) {
    const res = await apiRequest<any>(`/api/v1/admin/users/${id}/unban`, {
      method: 'PATCH',
    })
    return res.data
  },
  async listPosts(q?: string, status?: string) {
    let url = '/api/v1/admin/posts'
    const parts: string[] = []
    if (q) parts.push(`q=${encodeURIComponent(q)}`)
    if (status) parts.push(`status=${encodeURIComponent(status)}`)
    if (parts.length) url += `?${parts.join('&')}`
    const res = await apiRequest<any[]>(url)
    return res.data
  },
  async removePost(id: number) {
    const res = await apiRequest<any>(`/api/v1/admin/posts/${id}`, { method: 'DELETE' })
    return res.data
  },
  async restorePost(id: number) {
    const res = await apiRequest<any>(`/api/v1/admin/posts/${id}/restore`, { method: 'PATCH' })
    return res.data
  },
  async deleteComment(commentId: number, body?: { reason?: string }) {
    const res = await apiRequest<any>(`/api/v1/admin/comments/${commentId}`, { method: 'DELETE', body: JSON.stringify(body || {}) })
    return res.data
  },
  async listReports(opts?: { targetType?: string; status?: string; page?: number; pageSize?: number }) {
    const params: string[] = []
    if (opts?.targetType) params.push(`targetType=${encodeURIComponent(opts.targetType)}`)
    if (opts?.status) params.push(`status=${encodeURIComponent(opts.status)}`)
    if (opts?.page) params.push(`page=${opts.page}`)
    if (opts?.pageSize) params.push(`pageSize=${opts.pageSize}`)
    const url = `/api/v1/admin/reports${params.length ? '?' + params.join('&') : ''}`
    const res = await apiRequest<any>(url)
    return res.data
  },
  async listLogs(adminId?: number) {
    const url = adminId ? `/api/v1/admin/logs?adminId=${adminId}` : '/api/v1/admin/logs'
    const res = await apiRequest<any[]>(url)
    return res.data
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
    const token = getAccessToken()
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

  /** 按用户ID获取公开信息 */
  async getById(userId: number) {
    type UserData = {
      id: number
      nickname: string
      avatarUrl?: string | null
      role: string
      createdAt: string
    }
    const res = await apiRequest<UserData>(`/api/v1/users/${userId}`)
    return res.data
  },

  /** 搜索用户 */
  async searchUsers(q: string) {
    const url = `/api/v1/users/search?q=${encodeURIComponent(q)}`
    try {
      const res = await apiRequest<any[]>(url)
      return res.data || []
    } catch (e) {
      // 如果搜索端点不存在，返回空数组
      return []
    }
  },

  async getModerationActions() {
    const res = await apiRequest<any[]>('/api/v1/users/me/moderation')
    return res.data
  },
}

/**
 * 社区相关 API
 */
export const communityApi = {
  /** 获取帖子列表 */
  async listPosts(params?: {
    page?: number
    pageSize?: number
    q?: string
    tag?: string
    type?: string
    authorId?: number
    sort?: 'new' | 'hot'
  }) {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.pageSize) query.set('pageSize', String(params.pageSize))
    if (params?.q) query.set('q', params.q)
    if (params?.tag) query.set('tag', params.tag)
    if (params?.type) query.set('type', params.type)
    if (params?.authorId) query.set('authorId', String(params.authorId))
    if (params?.sort) query.set('sort', params.sort)

    type PostsData = NonNullable<
      operations['communityPostsList']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<PostsData>(
      `/api/v1/community/posts${query.toString() ? '?' + query.toString() : ''}`
    )
    return res.data
  },

  /** 创建帖子 */
  async createPost(body: components['schemas']['PostCreateRequest']) {
    type CreateData = NonNullable<
      operations['communityPostsCreate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CreateData>('/api/v1/community/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data
  },

  /** 获取帖子详情 */
  async getPost(postId: number) {
    type PostData = NonNullable<
      operations['communityPostsGet']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<PostData>(`/api/v1/community/posts/${postId}`)
    return res.data
  },

  /** 更新帖子 */
  async updatePost(postId: number, body: components['schemas']['PostPatchRequest']) {
    type UpdateData = NonNullable<
      operations['communityPostsUpdate']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<UpdateData>(`/api/v1/community/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    return res.data
  },

  /** 删除帖子 */
  async deletePost(postId: number) {
    type DeleteData = NonNullable<
      operations['communityPostsDelete']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<DeleteData>(`/api/v1/community/posts/${postId}`, {
      method: 'DELETE',
    })
    return res.data
  },

  /** 获取帖子评论列表 */
  async getComments(postId: number, page = 1, pageSize = 20) {
    type CommentsData = NonNullable<
      operations['communityPostCommentsList']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CommentsData>(
      `/api/v1/community/posts/${postId}/comments?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /** 添加评论 */
  async addComment(postId: number, body: components['schemas']['CommentCreateRequest']) {
    type CommentData = NonNullable<
      operations['communityPostCommentsAdd']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<CommentData>(`/api/v1/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return res.data
  },

  /** 删除评论 */
  async deleteComment(commentId: number) {
    type DeleteData = NonNullable<
      operations['communityCommentDelete']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<DeleteData>(`/api/v1/community/comments/${commentId}`, {
      method: 'DELETE',
    })
    return res.data
  },

  /** 点赞评论 */
  async likeComment(commentId: number) {
    const res = await apiRequest<{ ok: boolean }>(`/api/v1/community/comments/${commentId}/like`, {
      method: 'POST',
    })
    return res.data
  },

  /** 取消点赞评论 */
  async unlikeComment(commentId: number) {
    const res = await apiRequest<{ ok: boolean }>(`/api/v1/community/comments/${commentId}/like`, {
      method: 'DELETE',
    })
    return res.data
  },

  /** 点赞帖子 */
  async likePost(postId: number) {
    type OkData = NonNullable<
      operations['communityPostLike']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/posts/${postId}/like`, {
      method: 'POST',
    })
    return res.data
  },

  /** 取消点赞 */
  async unlikePost(postId: number) {
    type OkData = NonNullable<
      operations['communityPostUnlike']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/posts/${postId}/like`, {
      method: 'DELETE',
    })
    return res.data
  },

  /** 收藏帖子 */
  async bookmarkPost(postId: number) {
    type OkData = NonNullable<
      operations['communityPostBookmark']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/posts/${postId}/bookmark`, {
      method: 'POST',
    })
    return res.data
  },

  /** 取消收藏 */
  async unbookmarkPost(postId: number) {
    type OkData = NonNullable<
      operations['communityPostUnbookmark']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<OkData>(`/api/v1/community/posts/${postId}/bookmark`, {
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

  /** 搜索帖子 */
  async search(params: { q?: string; tag?: string; type?: string; page?: number; pageSize?: number }) {
    const query = new URLSearchParams()
    if (params.q) query.set('q', params.q)
    if (params.tag) query.set('tag', params.tag)
    if (params.type) query.set('type', params.type)
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

  /** 获取我的评论 */
  async getMyComments(page = 1, pageSize = 20) {
    type MyCommentsData = NonNullable<
      operations['communityMyComments']['responses'][200]['content']['application/json']['data']
    >
    const res = await apiRequest<MyCommentsData>(
      `/api/v1/community/my-comments?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /** 记录帖子浏览 */
  async recordPostView(postId: number) {
    await apiRequest(`/api/v1/community/posts/${postId}/view`, {
      method: 'POST',
    })
  },

  /** 获取浏览历史 */
  async getMyViews(page = 1, pageSize = 20) {
    type ViewsData = {
      items: Array<{
        postId: number
        postTitle: string | null
        postStatus: string | null
        viewedAt: string
      }>
      page: number
      pageSize: number
      total: number
    }
    const res = await http.get<ViewsData>(
      `/api/v1/community/my-views?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /** 清空浏览历史 */
  async clearMyViews() {
    await http.delete('/api/v1/community/my-views')
  },

  /** 获取点赞列表 */
  async getMyLikes(type: 'all' | 'post' | 'comment' = 'all', page = 1, pageSize = 20) {
    type LikesData = {
      items: Array<any>
      page: number
      pageSize: number
      total: number
    }
    const res = await http.get<LikesData>(
      `/api/v1/community/my-likes?type=${type}&page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },

  /** 获取收藏列表 */
  async getMyBookmarks(page = 1, pageSize = 20) {
    type BookmarksData = {
      items: Array<{
        postId: number
        title: string
        excerpt: string
        authorNickname?: string
        authorAvatar?: string | null
        likeCount: number
        commentCount: number
        bookmarkedAt: string
        createdAt: string
      }>
      page: number
      pageSize: number
      total: number
    }
    const res = await http.get<BookmarksData>(
      `/api/v1/community/my-bookmarks?page=${page}&pageSize=${pageSize}`
    )
    return res.data
  },
}
