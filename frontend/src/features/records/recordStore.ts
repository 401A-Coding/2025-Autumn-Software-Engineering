import type { ChessRecord, Bookmark, Note, MoveRecord } from './types'
import { recordsApi } from '../../services/api'
import http from '../../lib/http'
import type { components } from '../../types/api'

const LOCAL_KEY = 'saved.records.v1'

function readLocal(): ChessRecord[] {
    try {
        const raw = localStorage.getItem(LOCAL_KEY)
        if (!raw) return []
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) return []
        return arr as ChessRecord[]
    } catch (e) {
        console.warn('[recordStore] failed to read local records', e)
        return []
    }
}

function writeLocal(list: ChessRecord[]) {
    try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
        try { window.dispatchEvent(new CustomEvent('saved-records-changed')) } catch { }
    } catch (e) {
        console.warn('[recordStore] failed to write local records', e)
    }
}

function uid() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getCurrentUserId(): string | null {
    try {
        const token = localStorage.getItem('token')
        if (!token) return null
        const seg = token.split('.')[1]
        if (!seg) return null
        const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
        const pad = b64.length % 4
        const padded = pad ? b64 + '='.repeat(4 - pad) : b64
        const json = atob(padded)
        const payload = JSON.parse(json)
        const uid = payload.sub || payload.userId || payload.id
        return uid != null ? String(uid) : null
    } catch {
        return null
    }
}

export const recordStore = {
    async list(): Promise<ChessRecord[]> {
        // Pure server source; no local cache
        const page = await recordsApi.list(1, 500)
        let items: any[] = []
        const data = page as any
        if (Array.isArray(data)) items = data
        else if (data && Array.isArray(data.items)) items = data.items
        else items = []
        const me = getCurrentUserId()
        const mapped: ChessRecord[] = (items as any[]).map(it => ({
            id: String(it.id),
            startedAt: it.startedAt || new Date().toISOString(),
            endedAt: it.endedAt || undefined,
            opponent: it.opponent || undefined,
            result: it.result as any,
            keyTags: it.keyTags || [],
            favorite: Array.isArray((it as any).favorites) ? (me != null ? (it as any).favorites.some((f: any) => String(f.userId) === me) : ((it as any).favorites.length > 0)) : !!(it as any).favorite,
            moves: (it.moves || []).map((m: any) => ({
                from: { x: m.from?.x ?? m.fromX ?? 0, y: m.from?.y ?? m.fromY ?? 0 },
                to: { x: m.to?.x ?? m.toX ?? 0, y: m.to?.y ?? m.toY ?? 0 },
                turn: (m.piece?.side as any) ?? (m.pieceSide as any) ?? (m.piece_side as any) ?? 'red',
                ts: Date.now(),
            })),
            bookmarks: (it.bookmarks || []).map((b: any) => ({ id: String(b.id), step: b.step || 0, label: b.label || undefined, note: b.note || undefined })),
            notes: [],
            initialLayout: (it as any).initialLayout ?? undefined,
            customLayout: (it as any).customLayout ?? undefined,
            customRules: (it as any).customRules ?? undefined,
            mode: (it as any).mode ?? undefined,
        }))
        return mapped.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    },

    async get(id: string): Promise<ChessRecord | undefined> {
        try {
            const data = await recordsApi.get(Number(id))
            if (!data) return undefined
            const it = data as any
            const me = getCurrentUserId()
            const rec: ChessRecord = {
                id: String(it.id),
                startedAt: it.startedAt || new Date().toISOString(),
                endedAt: it.endedAt || undefined,
                opponent: it.opponent || undefined,
                result: it.result as any,
                keyTags: it.keyTags || [],
                favorite: Array.isArray((it as any).favorites) ? (me != null ? (it as any).favorites.some((f: any) => String(f.userId) === me) : ((it as any).favorites.length > 0)) : !!(it as any).favorite,
                moves: (it.moves || []).map((m: any) => ({
                    from: { x: m.from?.x ?? m.fromX ?? 0, y: m.from?.y ?? m.fromY ?? 0 },
                    to: { x: m.to?.x ?? m.toX ?? 0, y: m.to?.y ?? m.toY ?? 0 },
                    turn: (m.piece?.side as any) ?? (m.pieceSide as any) ?? (m.piece_side as any) ?? 'red',
                    ts: Date.now(),
                })),
                bookmarks: (it.bookmarks || []).map((b: any) => ({ id: String(b.id), step: b.step || 0, label: b.label || undefined, note: b.note || undefined })),
                notes: [],
                initialLayout: (it as any).initialLayout ?? undefined,
                customLayout: (it as any).customLayout ?? undefined,
                customRules: (it as any).customRules ?? undefined,
                mode: (it as any).mode ?? undefined,
            }
            return rec
        } catch (e) {
            return undefined
        }
    },

    async saveNew(partial: Omit<ChessRecord, 'id'>): Promise<{ record: ChessRecord; savedToServer: boolean }> {
        // prepare server payload
        const body: components['schemas']['RecordCreateRequest'] & { initialLayout?: any; customLayout?: any; customRules?: any; mode?: any } = {
            opponent: partial.opponent,
            startedAt: partial.startedAt,
            endedAt: partial.endedAt,
            result: partial.result as any,
            keyTags: partial.keyTags,
            moves: (partial.moves || []).map((m: MoveRecord, idx) => ({
                moveIndex: idx,
                from: { x: m.from.x, y: m.from.y },
                to: { x: m.to.x, y: m.to.y },
                piece: { side: m.turn },
            })),
            bookmarks: (partial.bookmarks || []).map(b => ({ step: b.step, label: b.label, note: (b as any).note })),
            ...(partial as any).initialLayout ? { initialLayout: (partial as any).initialLayout } : {},
            ...(partial as any).customLayout ? { customLayout: (partial as any).customLayout } : {},
            ...(partial as any).customRules ? { customRules: (partial as any).customRules } : {},
            ...(partial as any).mode ? { mode: (partial as any).mode } : {},
        }

        let created: any = null
        let savedToServer = false
        // 尝试向服务器保存（若未登录或网络/授权失败则回退到本地保存）
        try {
            // 使用 axios 实例以触发 refresh token 流程（若需要）并正确处理拦截器
            const res = await http.post('/api/v1/records', body)
            created = res.data
            savedToServer = !!created
        } catch (e) {
            // 后端保存失败（可能未登录或网络问题），将降级为仅本地保存
            console.warn('[recordStore] server save failed, falling back to local', e)
            created = null
            savedToServer = false
        }

        const rec: ChessRecord = {
            id: String(created?.id ?? uid()),
            startedAt: created?.startedAt ?? partial.startedAt,
            endedAt: created?.endedAt ?? partial.endedAt,
            opponent: created?.opponent ?? partial.opponent,
            result: created?.result ?? partial.result,
            keyTags: created?.keyTags ?? partial.keyTags ?? [],
            favorite: !!created?.favorite,
            moves: (created?.moves || partial.moves || []).map((mv: any, idx: number) => ({
                from: { x: mv.from?.x ?? partial.moves?.[idx]?.from.x ?? 0, y: mv.from?.y ?? partial.moves?.[idx]?.from.y ?? 0 },
                to: { x: mv.to?.x ?? partial.moves?.[idx]?.to.x ?? 0, y: mv.to?.y ?? partial.moves?.[idx]?.to.y ?? 0 },
                turn: (mv.piece?.side as any) ?? (mv.pieceSide as any) ?? partial.moves?.[idx]?.turn ?? 'red',
                ts: partial.moves?.[idx]?.ts ?? Date.now(),
            })),
            bookmarks: (created?.bookmarks || partial.bookmarks || []).map((b: any) => ({
                id: String(b.id ?? uid()),
                step: b.step ?? 0,
                label: b.label ?? undefined,
                note: b.note || undefined,
            })),
            notes: partial.notes || [],
            initialLayout: created?.initialLayout ?? (partial as any).initialLayout ?? undefined,
            customLayout: created?.customLayout ?? (partial as any).customLayout ?? undefined,
            customRules: created?.customRules ?? (partial as any).customRules ?? undefined,
            mode: created?.mode ?? (partial as any).mode ?? undefined,
        }

        // 如果未能保存到服务器，落盘到 localStorage
        if (!savedToServer) {
            try {
                const list = readLocal()
                // 确保不重复 id
                const next = [rec, ...list.filter(r => r.id !== rec.id)]
                writeLocal(next)
            } catch (e) {
                console.warn('[recordStore] failed to persist record locally', e)
            }
        }

        return { record: rec, savedToServer }
    },

    async toggleFavorite(id: string, fav: boolean) {
        try {
            const nid = Number(id)
            if (fav) {
                await recordsApi.favorite(nid)
            } else {
                await recordsApi.unfavorite(nid)
            }
        } catch (e) {
            // ignore server error
        }
        // no local mutation; rely on next list() pull
    },

    async addBookmark(id: string, step: number, label?: string, note?: string): Promise<Bookmark | undefined> {
        try {
            const nid = Number(id)
            const res = await recordsApi.bookmarks.add(nid, { step, label, note })
            const bid = res?.id ?? undefined
            const bm: Bookmark = { id: String(bid ?? uid()), step, label }
            return bm
        } catch (e) {
            return undefined
        }
    },

    async updateBookmark(id: string, bookmarkId: string, label?: string, note?: string) {
        try {
            const nid = Number(id)
            const bid = Number(bookmarkId)
            await recordsApi.bookmarks.update(nid, bid, { label, note })
        } catch (e) {
            // ignore
        }
        // no local mutation
    },

    async removeBookmark(id: string, bookmarkId: string) {
        try {
            const nid = Number(id)
            const bid = Number(bookmarkId)
            await recordsApi.bookmarks.remove(nid, bid)
        } catch (e) {
            // ignore
        }
        // no local mutation
    },

    async addNote(id: string, step: number, text: string): Promise<Note | undefined> {
        try {
            // use bookmarks endpoint with note field to add a note
            const nid = Number(id)
            const res = await recordsApi.bookmarks.add(nid, { step, note: text })
            const bid = res?.id ?? undefined
            const note: Note = { id: String(bid ?? uid()), step, text, ts: Date.now() }
            return note
        } catch (e) {
            return undefined
        }
    },

    async removeNote(id: string, noteId: string) {
        try {
            const nid = Number(id)
            const bid = Number(noteId)
            await recordsApi.bookmarks.remove(nid, bid)
        } catch (e) {
            // ignore
        }
        // no local mutation
    },

    async remove(id: string) {
        try {
            const nid = Number(id)
            await recordsApi.delete(nid)
        } catch (e) {
            // ignore server error
        }
        // no local mutation; caller should refresh list
    },
}
