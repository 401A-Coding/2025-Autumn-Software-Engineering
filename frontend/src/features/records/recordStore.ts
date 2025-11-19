import type { ChessRecord, Bookmark, Note } from './types'

const LS_KEY = 'records.list.v1'
const KEEP_LIMIT_KEY = 'record.keepLimit'

function uid() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function loadAll(): ChessRecord[] {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return []
        const list = JSON.parse(raw) as ChessRecord[]
        if (!Array.isArray(list)) return []
        return list
    } catch {
        return []
    }
}

function saveAll(list: ChessRecord[]) {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
}

function getKeepLimit(): number {
    const saved = localStorage.getItem(KEEP_LIMIT_KEY)
    const n = saved ? parseInt(saved, 10) : 30
    if (Number.isNaN(n)) return 30
    return Math.min(500, Math.max(1, Math.floor(n)))
}

export const recordStore = {
    list(): ChessRecord[] {
        const list = loadAll()
        return list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    },

    get(id: string): ChessRecord | undefined {
        return loadAll().find(r => r.id === id)
    },

    saveNew(partial: Omit<ChessRecord, 'id'>): ChessRecord {
        const list = loadAll()
        const rec: ChessRecord = { id: uid(), ...partial }
        list.push(rec)
        // 应用保留策略
        const keep = getKeepLimit()
        const nonFav = list
            .filter(r => !r.favorite)
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        const toRemove = nonFav.slice(keep) // 超出的
        if (toRemove.length) {
            const toRemoveIds = new Set(toRemove.map(r => r.id))
            const after = list.filter(r => !(toRemoveIds.has(r.id) && !r.favorite))
            saveAll(after)
            return rec
        }
        saveAll(list)
        return rec
    },

    toggleFavorite(id: string, fav: boolean) {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx >= 0) {
            list[idx].favorite = fav
            saveAll(list)
        }
    },

    addBookmark(id: string, step: number, label?: string): Bookmark | undefined {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx < 0) return
        const bm: Bookmark = { id: uid(), step, label }
        list[idx].bookmarks = [...(list[idx].bookmarks || []), bm]
        saveAll(list)
        return bm
    },

    updateBookmark(id: string, bookmarkId: string, label?: string) {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx < 0) return
        const rec = list[idx]
        if (!rec.bookmarks) return
        const bIdx = rec.bookmarks.findIndex(b => b.id === bookmarkId)
        if (bIdx < 0) return
        rec.bookmarks[bIdx] = { ...rec.bookmarks[bIdx], label }
        saveAll(list)
    },

    removeBookmark(id: string, bookmarkId: string) {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx < 0) return
        list[idx].bookmarks = (list[idx].bookmarks || []).filter(b => b.id !== bookmarkId)
        saveAll(list)
    },

    addNote(id: string, step: number, text: string): Note | undefined {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx < 0) return
        const note: Note = { id: uid(), step, text, ts: Date.now() }
        list[idx].notes = [...(list[idx].notes || []), note]
        saveAll(list)
        return note
    },

    removeNote(id: string, noteId: string) {
        const list = loadAll()
        const idx = list.findIndex(r => r.id === id)
        if (idx < 0) return
        list[idx].notes = (list[idx].notes || []).filter(n => n.id !== noteId)
        saveAll(list)
    },
}
