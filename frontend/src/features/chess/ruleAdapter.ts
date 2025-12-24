/**
 * 规则格式转换适配器
 * 在旧的 CustomRules 和新的 CustomRuleSet 之间转换
 */

import type { CustomRules, PieceType } from './types'
import type { CustomRuleSet, MovePattern } from './ruleEngine'

/**
 * 判断是否为新的 CustomRuleSet 格式
 */
export function isCustomRuleSet(rules: CustomRules | CustomRuleSet): rules is CustomRuleSet {
    return 'pieceRules' in rules && 'name' in rules
}

/**
 * 将 CustomRuleSet 转换为 CustomRules（简化版，用于兼容旧代码）
 */
export function ruleSetToCustomRules(ruleSet: CustomRuleSet): CustomRules {
    const customRules: CustomRules = {}
    
    // 将每个棋子的规则转换为简化格式
    Object.entries(ruleSet.pieceRules).forEach(([pieceType, ruleConfig]) => {
        if (!ruleConfig) return
        
        // 将新格式的条件映射到旧格式
        const mapCondition = (conditions?: any[]): 'forward' | 'crossed' | 'notCrossed' | undefined => {
            if (!conditions || conditions.length === 0) return undefined
            const cond = conditions[0]
            if (cond.crossedRiver) return 'crossed'
            if (cond.notCrossedRiver) return 'notCrossed'
            return undefined
        }
        
            // 合并 movePatterns 与 captureRules.capturePattern（若存在）
            const moves: any[] = []
            const mps = Array.isArray(ruleConfig.movePatterns) ? ruleConfig.movePatterns : []
            if (mps.length) {
                moves.push(...mps.map(pattern => ({
                    dx: pattern.dx,
                    dy: pattern.dy,
                    repeat: !!pattern.repeat,
                    condition: mapCondition(pattern.conditions),
                    conditions: pattern.conditions ? [...pattern.conditions] : undefined,
                    moveOnly: (pattern as any).moveOnly === true,
                    captureOnly: (pattern as any).captureOnly === true,
                    maxSteps: (pattern as any).maxSteps || 0,
                })))
            }
            const capPat = (ruleConfig as any).captureRules?.capturePattern
            if (Array.isArray(capPat)) {
                moves.push(...(capPat.map((pattern: any) => ({
                    dx: pattern.dx,
                    dy: pattern.dy,
                    repeat: !!pattern.repeat,
                    condition: mapCondition(pattern.conditions),
                    conditions: pattern.conditions ? [...pattern.conditions] : undefined,
                    moveOnly: pattern.moveOnly === true,
                    captureOnly: pattern.captureOnly === true,
                    maxSteps: pattern.maxSteps || 0,
                }))))
            }

            // 兼容缺省的限制字段，提供安全默认值
            const r = (ruleConfig as any).restrictions || {}
            customRules[pieceType] = {
                moves,
                canJump: !!r.canJump,
                canCrossBorder: r.canCrossRiver !== false,
                palaceOnly: !!r.mustStayInPalace,
                maxRange: r.maxMoveDistance || 0,
            }
    })
    
    return customRules
}

/**
 * 将 CustomRules 转换为 CustomRuleSet（用于升级旧规则）
 */
export function customRulesToRuleSet(customRules: CustomRules, name: string = '自定义规则'): CustomRuleSet {
    const pieceRules: CustomRuleSet['pieceRules'] = {}
    
    Object.entries(customRules).forEach(([pieceType, rule]) => {
        if (!rule) return
        
        pieceRules[pieceType as keyof typeof pieceRules] = {
            name: pieceType,
            movePatterns: rule.moves.map(move => ({
                dx: move.dx,
                dy: move.dy,
                repeat: move.repeat,
                conditions: move.condition ? [{ type: move.condition as any }] : undefined,
            })),
            restrictions: {
                canJump: rule.canJump,
                canCrossRiver: rule.canCrossBorder,
                mustStayInPalace: rule.palaceOnly,
                maxMoveDistance: rule.maxRange,
            },
        }
    })
    
    return {
        name,
        pieceRules,
    }
}

/**
 * 将后端 Rules DTO（movement.gridMask/constraints）转换回 CustomRuleSet
 * 仅恢复基础的 movePatterns（不含复杂 repeat/captureOnly 等信息）
 */
export function serverRulesToRuleSet(rulesDto: any, name = '服务器规则'): CustomRuleSet {
    const pieceRules: CustomRuleSet['pieceRules'] = {}
    if (!rulesDto || !rulesDto.pieceRules) {
        return { name, pieceRules }
    }

    const normalizePieceKey = (k: string): PieceType => {
        const key = String(k).trim()
        const map: Record<string, PieceType> = {
            // 中文同义映射（红/黑）
            '兵': 'soldier', '卒': 'soldier',
            '炮': 'cannon', '砲': 'cannon',
            '车': 'rook', '俥': 'rook', '車': 'rook',
            '马': 'horse', '傌': 'horse',
            '相': 'elephant', '象': 'elephant',
            '仕': 'advisor', '士': 'advisor',
            '帅': 'general', '將': 'general', '将': 'general', '帥': 'general',
            // 英文容错
            'soldier': 'soldier',
            'cannon': 'cannon',
            'rook': 'rook',
            'horse': 'horse',
            'elephant': 'elephant',
            'advisor': 'advisor',
            'general': 'general',
        }
        return (map[key] || key) as PieceType
    }

    const mapConstraints = (c: any) => {
        const restrictions: any = {}
        if (!c) return restrictions
        if (c.palace === 'insideOnly') restrictions.mustStayInPalace = true
        if (c.river === 'cannotCross') restrictions.canCrossRiver = false
        return restrictions
    }

    const pr: any = pieceRules as any
    for (const [pieceTypeRaw, cfg] of Object.entries<any>(rulesDto.pieceRules)) {
        const pieceType = normalizePieceKey(pieceTypeRaw)
        // 若同义键（如 兵/卒、帅/将）已映射过，则忽略后续重复，确保红黑共用同一规则
        if (pr[pieceType]) {
            continue
        }
        const patterns: MovePattern[] = []

        const mv = cfg?.movement || {}
        const capMode = cfg?.captureMode || 'sameAsMove'
        const cap = cfg?.capture || {}

        // movement.gridMask -> 单步模式集合
        if (Array.isArray(mv.gridMask)) {
            for (const [dx, dy] of mv.gridMask as Array<[number, number]>) {
                patterns.push({ dx, dy })
            }
        }
        // movement.steps -> 非重复步进；allowCapture=false 时当作 moveOnly
        if (Array.isArray(mv.steps)) {
            for (const s of mv.steps as any[]) {
                const off = s.offset as [number, number]
                if (!off) continue
                patterns.push({
                    dx: off[0],
                    dy: off[1],
                    repeat: false,
                    ...(s.allowCapture === false ? { moveOnly: true } : {}),
                })
            }
        }
        // movement.rays -> 可重复直线/斜线；vectors: [[dx,dy]]
        if (Array.isArray(mv.rays)) {
            for (const r of mv.rays as any[]) {
                const vecs: Array<[number, number]> = r.vectors || []
                const maxSteps = r.maxSteps || 0
                for (const [dx, dy] of vecs) {
                    patterns.push({ dx, dy, repeat: true, ...(maxSteps ? { maxSteps } : {}) })
                }
            }
        }

        // capture 独立定义 -> 生成 captureOnly 的模式
        if (capMode === 'separate') {
            if (Array.isArray(cap.gridMask)) {
                for (const [dx, dy] of cap.gridMask as Array<[number, number]>) {
                    patterns.push({ dx, dy, captureOnly: true })
                }
            }
            if (Array.isArray(cap.steps)) {
                for (const s of cap.steps as any[]) {
                    const off = s.offset as [number, number]
                    if (!off) continue
                    patterns.push({ dx: off[0], dy: off[1], repeat: false, captureOnly: true })
                }
            }
            if (Array.isArray(cap.rays)) {
                for (const r of cap.rays as any[]) {
                    const vecs: Array<[number, number]> = r.vectors || []
                    const maxSteps = r.maxSteps || 0
                    const screens = r.requireScreensForCapture
                    for (const [dx, dy] of vecs) {
                        const conds = typeof screens === 'number' && screens > 0 ? [{ type: 'path', obstacleCount: screens }] : undefined
                        patterns.push({ dx, dy, repeat: true, captureOnly: true, ...(maxSteps ? { maxSteps } : {}), ...(conds ? { conditions: conds as any } : {}) })
                    }
                }
            }
        }

        pr[pieceType] = {
            name: String(pieceType),
            movePatterns: patterns,
            restrictions: {
                canJump: false,
                canCrossRiver: true,
                mustStayInPalace: false,
                maxMoveDistance: 0,
                minMoveDistance: 0,
                ...mapConstraints(cfg?.constraints),
            },
        }
    }

    return { name: rulesDto?.name || name, pieceRules }
}

/**
 * 将 CustomRuleSet 转为后端 Rules DTO（尽量保真）
 */
export function ruleSetToServerRules(ruleSet: CustomRuleSet): any {
    const pieceRules: Record<string, any> = {}

    const toRay = (p: MovePattern) => ({
        vectors: [[p.dx, p.dy]],
        ...(p.maxSteps ? { maxSteps: p.maxSteps } : {}),
        stopAtFirstBlocker: true,
    })
    const toStep = (p: MovePattern, allowCapture: boolean | undefined) => ({
        offset: [p.dx, p.dy],
        ...(allowCapture === false ? { allowCapture: false } : {}),
    })

    const toConstraints = (r: any) => {
        const c: any = {}
        if (r?.mustStayInPalace) c.palace = 'insideOnly'
        if (r?.canCrossRiver === false) c.river = 'cannotCross'
        return c
    }

    for (const [k, cfg] of Object.entries(ruleSet.pieceRules)) {
        if (!cfg) continue

        const movement: any = {}
        const capture: any = {}
        let captureMode: 'sameAsMove' | 'separate' = 'sameAsMove'

        for (const p of cfg.movePatterns || []) {
            // 炮类：repeat + captureOnly + obstacleCount => capture.rays
            const obstacleCond = p.conditions?.find((c: any) => c.type === 'path' && typeof (c as any).obstacleCount === 'number') as any
            const isCannonLike = !!(p.repeat && p.captureOnly && obstacleCond)

            if (isCannonLike) {
                captureMode = 'separate'
                capture.rays = capture.rays || []
                const ray: any = toRay(p)
                if (obstacleCond) (ray as any).requireScreensForCapture = obstacleCond.obstacleCount
                capture.rays.push(ray)
                continue
            }

            if (p.captureOnly) {
                captureMode = 'separate'
                // 非直线的吃子，按 steps 处理
                capture.steps = capture.steps || []
                capture.steps.push(toStep(p, true))
                continue
            }

            if (p.repeat) {
                movement.rays = movement.rays || []
                movement.rays.push(toRay(p))
            } else {
                movement.steps = movement.steps || []
                // moveOnly -> allowCapture=false
                movement.steps.push(toStep(p, p.moveOnly === true ? false : undefined))
            }
        }

        pieceRules[k] = {
            ruleType: 'custom',
            movement: Object.keys(movement).length ? movement : undefined,
            captureMode,
            capture: captureMode === 'separate' && Object.keys(capture).length ? capture : undefined,
            constraints: toConstraints(cfg.restrictions),
        }
    }

    return {
        ruleVersion: 1,
        layoutSource: 'template',
        coordinateSystem: 'relativeToSide',
        mode: 'analysis',
        pieceRules,
    }
}
