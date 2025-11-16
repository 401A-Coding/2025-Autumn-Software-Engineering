/**
 * 规则格式转换适配器
 * 在旧的 CustomRules 和新的 CustomRuleSet 之间转换
 */

import type { CustomRules } from './types'
import type { CustomRuleSet } from './ruleEngine'

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
            if (ruleConfig.movePatterns && ruleConfig.movePatterns.length) {
                moves.push(...ruleConfig.movePatterns.map(pattern => ({
                    dx: pattern.dx,
                    dy: pattern.dy,
                    repeat: pattern.repeat,
                    condition: mapCondition(pattern.conditions),
                    conditions: pattern.conditions ? [...pattern.conditions] : undefined,
                    moveOnly: (pattern as any).moveOnly,
                    captureOnly: (pattern as any).captureOnly,
                })))
            }
            if (ruleConfig.captureRules && Array.isArray((ruleConfig as any).captureRules.capturePattern)) {
                moves.push(...((ruleConfig as any).captureRules.capturePattern.map((pattern: any) => ({
                    dx: pattern.dx,
                    dy: pattern.dy,
                    repeat: pattern.repeat,
                    condition: mapCondition(pattern.conditions),
                    conditions: pattern.conditions ? [...pattern.conditions] : undefined,
                    moveOnly: pattern.moveOnly,
                    captureOnly: pattern.captureOnly,
                }))))
            }

            customRules[pieceType] = {
                moves,
                canJump: ruleConfig.restrictions.canJump,
                canCrossBorder: ruleConfig.restrictions.canCrossRiver,
                palaceOnly: ruleConfig.restrictions.mustStayInPalace,
                maxRange: ruleConfig.restrictions.maxMoveDistance,
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
