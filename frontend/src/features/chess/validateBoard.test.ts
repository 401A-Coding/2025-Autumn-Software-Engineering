import { describe, it, expect } from 'vitest'
import validateBoard, { validatePlacement } from './validateBoard'

describe('validateBoard', () => {
    it('valid minimal board with two generals (different files) passes', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 3, y: 0 },
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(true)
        expect(res.errors.length).toBe(0)
    })

    it('detects overlap', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 4, y: 9 },
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(false)
        expect(res.errors.some(e => e.includes('重叠'))).toBe(true)
    })

    it('detects missing general', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(false)
        expect(res.errors.some(e => /黑方应有.*1 个将/.test(e))).toBe(true)
    })

    it('detects king facing (same file without blocker)', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 4, y: 0 },
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(false)
        expect(res.errors.some(e => e.includes('将帅相对直视'))).toBe(true)
    })

    it('detects illegal elephant square (parity/position)', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 3, y: 0 },
            { type: 'elephant', side: 'red', x: 2, y: 8 }, // illegal by parity
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(false)
        expect(res.errors.some(e => e.includes('象放置位置不合法'))).toBe(true)
    })

    it('detects illegal soldier static position', () => {
        const pieces = [
            { type: 'general', side: 'red', x: 4, y: 9 },
            { type: 'general', side: 'black', x: 3, y: 0 },
            { type: 'soldier', side: 'red', x: 0, y: 9 }, // behind initial row
        ] as any
        const res = validateBoard(pieces)
        expect(res.valid).toBe(false)
        expect(res.errors.some(e => e.includes('兵放置位置不合法'))).toBe(true)
    })
})

describe('validatePlacement', () => {
    it('returns message when placing elephant on illegal square', () => {
        const pool: any[] = [
            { type: 'general', side: 'red', x: 4, y: 9 },
        ]
        const msg = validatePlacement({ type: 'elephant', side: 'red', x: 2, y: 8 }, pool as any)
        expect(msg).toBeTruthy()
        expect(msg).toContain('象')
    })
})
