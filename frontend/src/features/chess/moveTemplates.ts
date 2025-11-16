/**
 * 移动模板系统
 * 预定义常见的移动模式，可以套用到不同棋子
 */

import type { MovePattern } from './ruleEngine'

export type MoveTemplateType = 
    | 'line-unlimited'      // 直线无限（车）
    | 'line-limited'        // 直线限制（将）
    | 'diagonal-unlimited'  // 斜线无限
    | 'diagonal-limited'    // 斜线限制（士）
    | 'knight-l'            // 马的日字
    | 'elephant-field'      // 象的田字
    | 'king-eight'          // 八方一格
    | 'cannon-move'         // 炮的移动
    | 'pawn-standard'       // 标准兵（未过河前进，过河横移）
    | 'pawn-forward'        // 兵只能前进
    | 'pawn-cross'          // 兵可以前进和左右
    | 'custom'              // 自定义

export interface MoveTemplate {
    id: MoveTemplateType
    name: string
    description: string
    icon: string
    patterns: MovePattern[]
    preview: string  // ASCII 预览图
}

/**
 * 所有移动模板
 */
export const moveTemplates: Record<MoveTemplateType, MoveTemplate> = {
    'line-unlimited': {
        id: 'line-unlimited',
        name: '直线无限',
        description: '可以沿四个直线方向无限移动（如车）',
        icon: '📏',
        patterns: [
            { dx: 0, dy: 1, repeat: true },   // 前
            { dx: 0, dy: -1, repeat: true },  // 后
            { dx: -1, dy: 0, repeat: true },  // 左
            { dx: 1, dy: 0, repeat: true },   // 右
        ],
        preview: `
  ↑
← ◆ →
  ↓
(无限远)`,
    },

    'line-limited': {
        id: 'line-limited',
        name: '直线一格',
        description: '可以沿四个直线方向移动一格（如将）',
        icon: '➕',
        patterns: [
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
        ],
        preview: `
  ↑
← ◆ →
  ↓
(一格)`,
    },

    'diagonal-unlimited': {
        id: 'diagonal-unlimited',
        name: '斜线无限',
        description: '可以沿四个斜线方向无限移动',
        icon: '╳',
        patterns: [
            { dx: 1, dy: 1, repeat: true },
            { dx: 1, dy: -1, repeat: true },
            { dx: -1, dy: 1, repeat: true },
            { dx: -1, dy: -1, repeat: true },
        ],
        preview: `
↖ · ↗
· ◆ ·
↙ · ↘
(无限远)`,
    },

    'diagonal-limited': {
        id: 'diagonal-limited',
        name: '斜线一格',
        description: '可以沿四个斜线方向移动一格（如士）',
        icon: '✕',
        patterns: [
            { dx: 1, dy: 1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: -1 },
        ],
        preview: `
↖ · ↗
· ◆ ·
↙ · ↘
(一格)`,
    },

    'knight-l': {
        id: 'knight-l',
        name: '马的日字',
        description: '走日字，可以选择是否蹩马腿',
        icon: '🐴',
        patterns: [
            { dx: 1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: 1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: -1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: -1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: 2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: 2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: -2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] },
            { dx: -2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] },
        ],
        preview: `
· ↑ · ↑ ·
← · · · →
· · ◆ · ·
← · · · →
· ↓ · ↓ ·`,
    },

    'elephant-field': {
        id: 'elephant-field',
        name: '象的田字',
        description: '走田字，可以选择是否塞象眼',
        icon: '🐘',
        patterns: [
            { dx: 2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] },
            { dx: 2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] },
            { dx: -2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] },
            { dx: -2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] },
        ],
        preview: `
↖ · · · ↗
· · · · ·
· · ◆ · ·
· · · · ·
↙ · · · ↘`,
    },

    'king-eight': {
        id: 'king-eight',
        name: '八方一格',
        description: '可以向八个方向移动一格',
        icon: '👑',
        patterns: [
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: 1, dy: 1 },
            { dx: 1, dy: -1 },
            { dx: -1, dy: 1 },
            { dx: -1, dy: -1 },
        ],
        preview: `
↖ ↑ ↗
← ◆ →
↙ ↓ ↘`,
    },

    'cannon-move': {
        id: 'cannon-move',
        name: '炮移动',
        description: '直线移动，不吃子',
        icon: '🔫',
        patterns: [
            { dx: 0, dy: 1, repeat: true, moveOnly: true },
            { dx: 0, dy: -1, repeat: true, moveOnly: true },
            { dx: -1, dy: 0, repeat: true, moveOnly: true },
            { dx: 1, dy: 0, repeat: true, moveOnly: true },
        ],
        preview: `
  ↑
← ◆ →
  ↓
(移动)`,
    },


    'pawn-standard': {
        id: 'pawn-standard',
        name: '标准兵',
        description: '未过河只能前进，过河后可以前进和左右',
        icon: '🪖',
        patterns: [
            { dx: 0, dy: 1, conditions: [{ type: 'position', notCrossedRiver: true }] },
            { dx: 0, dy: 1, conditions: [{ type: 'position', crossedRiver: true }] },
            { dx: -1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
            { dx: 1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
        ],
        preview: `
未过河:
  ↑
  ◆

过河后:
  ↑
← ◆ →`,
    },

    'pawn-forward': {
        id: 'pawn-forward',
        name: '兵只能前进',
        description: '未过河只能前进一格',
        icon: '⬆',
        patterns: [
            { dx: 0, dy: 1, conditions: [{ type: 'position', notCrossedRiver: true }] },
        ],
        preview: `
  ↑
  ◆`,
    },

    'pawn-cross': {
        id: 'pawn-cross',
        name: '兵过河横移',
        description: '过河后可以前进和左右移动',
        icon: '↕',
        patterns: [
            { dx: 0, dy: 1, conditions: [{ type: 'position', crossedRiver: true }] },
            { dx: -1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
            { dx: 1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
        ],
        preview: `
  ↑
← ◆ →
(过河后)`,
    },

    'custom': {
        id: 'custom',
        name: '自定义',
        description: '完全自定义移动方式',
        icon: '✏️',
        patterns: [],
        preview: '(自定义)',
    },
}

/**
 * 根据棋子类型获取默认模板
 */
export function getDefaultTemplateForPiece(pieceType: string): MoveTemplateType {
    const defaultMap: Record<string, MoveTemplateType> = {
        general: 'line-limited',
        advisor: 'diagonal-limited',
        elephant: 'elephant-field',
        horse: 'knight-l',
        rook: 'line-unlimited',
        cannon: 'cannon-move',
        soldier: 'pawn-standard',
    }
    return defaultMap[pieceType] || 'line-limited'
}

/**
 * 获取所有可选模板列表
 */
export function getAllTemplates(): MoveTemplate[] {
    return Object.values(moveTemplates)
}

/**
 * 根据ID获取模板
 */
export function getTemplateById(id: MoveTemplateType): MoveTemplate {
    return moveTemplates[id]
}

/**
 * 应用模板到规则配置
 */
export function applyTemplate(templateId: MoveTemplateType): MovePattern[] {
    return moveTemplates[templateId].patterns
}
