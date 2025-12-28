import type { CustomRuleSet, PieceRuleConfig } from './ruleEngine'

function cleanRule(rule: PieceRuleConfig | undefined): any {
    if (!rule) return null
    const { name, description, ...rest } = rule as any
    return rest
}

function deepEqual(a: any, b: any): boolean {
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        return false
    }
}

export function getModifiedPieceKeys(ruleSet: CustomRuleSet | null | undefined, baseline: CustomRuleSet): string[] {
    if (!ruleSet || !ruleSet.pieceRules) return []
    const rsMap = ruleSet.pieceRules as Record<string, PieceRuleConfig | undefined>
    const baseMap = baseline.pieceRules as Record<string, PieceRuleConfig | undefined>
    const modified: string[] = []
    // 仅遍历当前规则集定义过的棋子；缺失的视为“未修改”，避免显示未改的
    for (const k of Object.keys(rsMap)) {
        const a = cleanRule(rsMap[k])
        const b = cleanRule(baseMap[k])
        if (!deepEqual(a, b)) modified.push(k)
    }
    return modified
}

export const pieceDisplayNames: Record<string, string> = {
    general: '将/帅',
    advisor: '士/仕',
    elephant: '象/相',
    horse: '马/马',
    rook: '车/车',
    cannon: '炮/炮',
    soldier: '兵/卒',
}
