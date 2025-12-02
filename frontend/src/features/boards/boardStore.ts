export type SavedBoard = {
    id: string
    name: string
    description?: string
    createdAt: string
    board: any
    ruleSet?: any
}

const KEY = 'saved.boards.v1'

function readAll(): SavedBoard[] {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw) as SavedBoard[]
    } catch (e) {
        console.error('failed to parse saved boards', e)
        return []
    }
}

function writeAll(list: SavedBoard[]) {
    localStorage.setItem(KEY, JSON.stringify(list))
}

export const boardStore = {
    list(): SavedBoard[] {
        return readAll()
    },
    get(id: string): SavedBoard | undefined {
        return readAll().find(b => b.id === id)
    },
    saveNew(payload: { name: string; board: any; ruleSet?: any; description?: string }) {
        const list = readAll()
        const id = `tpl-${Date.now()}`
        const item: SavedBoard = {
            id,
            name: payload.name,
            description: payload.description,
            createdAt: new Date().toISOString(),
            board: payload.board,
            ruleSet: payload.ruleSet,
        }
        list.unshift(item)
        writeAll(list)
        try { window.dispatchEvent(new CustomEvent('saved-boards-changed')) } catch { }
        return item
    },
    update(id: string, patch: Partial<SavedBoard>) {
        const list = readAll()
        const idx = list.findIndex(b => b.id === id)
        if (idx === -1) return undefined
        list[idx] = { ...list[idx], ...patch }
        writeAll(list)
        try { window.dispatchEvent(new CustomEvent('saved-boards-changed')) } catch { }
        return list[idx]
    },
    remove(id: string) {
        const list = readAll()
        const next = list.filter(b => b.id !== id)
        writeAll(next)
        try { window.dispatchEvent(new CustomEvent('saved-boards-changed')) } catch { }
    },
}

export default boardStore

