/**
 * 预设规则库
 * 包含标准中国象棋规则和各种变体规则
 */

import type { CustomRuleSet, PieceRuleConfig } from './ruleEngine'

// ==================== 标准中国象棋规则 ====================

/**
 * 将/帅规则
 */
const standardKingRule: PieceRuleConfig = {
    name: '将/帅',
    description: '只能在九宫内移动，每次走一格',
    movePatterns: [
        { dx: 0, dy: 1 },   // 前
        { dx: 0, dy: -1 },  // 后
        { dx: -1, dy: 0 },  // 左
        { dx: 1, dy: 0 },   // 右
    ],
    restrictions: {
        mustStayInPalace: true,
        canJump: false,
        canCrossRiver: false,
    },
}

/**
 * 士规则
 */
const standardAdvisorRule: PieceRuleConfig = {
    name: '士',
    description: '只能在九宫内沿斜线移动',
    movePatterns: [
        { dx: 1, dy: 1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: -1, dy: -1 },
    ],
    restrictions: {
        mustStayInPalace: true,
        canJump: false,
        canCrossRiver: false,
    },
}

/**
 * 象/相规则
 */
const standardElephantRule: PieceRuleConfig = {
    name: '象/相',
    description: '走田字，不能过河，不能塞象眼',
    movePatterns: [
        { dx: 2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] },
        { dx: 2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] },
        { dx: -2, dy: 2, conditions: [{ type: 'position', hasNoObstacle: true }] },
        { dx: -2, dy: -2, conditions: [{ type: 'position', hasNoObstacle: true }] },
    ],
    restrictions: {
        canCrossRiver: false,
        canJump: false,
    },
}

/**
 * 马规则
 */
const standardHorseRule: PieceRuleConfig = {
    name: '马',
    description: '走日字，不能蹩马腿',
    movePatterns: [
        { dx: 1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: 1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: -1, dy: 2, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: -1, dy: -2, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: 2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: 2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: -2, dy: 1, conditions: [{ type: 'path', hasNoObstacle: true }] },
        { dx: -2, dy: -1, conditions: [{ type: 'path', hasNoObstacle: true }] },
    ],
    restrictions: {
        canJump: true, // 允许跳跃（用于扫描），但 moveOnly 在引擎中遇子仍会阻挡
        canCrossRiver: true,
    },
}

/**
 * 车规则
 */
const standardChariotRule: PieceRuleConfig = {
    name: '车',
    description: '直线移动，无距离限制',
    movePatterns: [
        { dx: 0, dy: 1, repeat: true },   // 前
        { dx: 0, dy: -1, repeat: true },  // 后
        { dx: -1, dy: 0, repeat: true },  // 左
        { dx: 1, dy: 0, repeat: true },   // 右
    ],
    restrictions: {
        canJump: false,
        canCrossRiver: true,
    },
}

/**
 * 炮规则
 */
const standardCannonRule: PieceRuleConfig = {
    name: '炮',
    description: '直线移动不越子；吃子必须隔一个子，只能吃到隔子后的第一个敌子',
    movePatterns: [
        // 移动（不吃子）：直线，不越子
        { dx: 0, dy: 1, repeat: true, moveOnly: true },
        { dx: 0, dy: -1, repeat: true, moveOnly: true },
        { dx: -1, dy: 0, repeat: true, moveOnly: true },
        { dx: 1, dy: 0, repeat: true, moveOnly: true },
    ],
    restrictions: {
        canJump: false,
        canCrossRiver: true,
    },
    captureRules: {
        // 吃子：隔一个子，只能吃到第一个敌子（通过 obstacleCount:1 和 repeat 结合实现）
        capturePattern: [
            { dx: 0, dy: 1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
            { dx: 0, dy: -1, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
            { dx: -1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
            { dx: 1, dy: 0, repeat: true, captureOnly: true, conditions: [{ type: 'path', obstacleCount: 1 }] },
        ],
    },
}

/**
 * 兵/卒规则
 */
const standardPawnRule: PieceRuleConfig = {
    name: '兵/卒',
    description: '未过河只能前进，过河可以左右移动',
    movePatterns: [
        // 未过河：只能前进
        { dx: 0, dy: 1, conditions: [{ type: 'position', notCrossedRiver: true }] },
        // 过河后：可以前进和左右
        { dx: 0, dy: 1, conditions: [{ type: 'position', crossedRiver: true }] },
        { dx: -1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
        { dx: 1, dy: 0, conditions: [{ type: 'position', crossedRiver: true }] },
    ],
    restrictions: {
        canJump: false,
        canCrossRiver: true,
    },
}

/**
 * 标准中国象棋规则集
 */
export const standardChessRules: CustomRuleSet = {
    name: '标准中国象棋',
    description: '遵循传统中国象棋规则',
    version: '1.0.0',
    pieceRules: {
        general: standardKingRule,
        advisor: standardAdvisorRule,
        elephant: standardElephantRule,
        horse: standardHorseRule,
        rook: standardChariotRule,
        cannon: standardCannonRule,
        soldier: standardPawnRule,
    },
    globalRules: {
        allowFlyingGeneral: false,
        checkRequired: true,
        stalemateIsDraw: true,
    },
    winConditions: {
        captureKing: true,
    },
}

// ==================== 变体规则 ====================

/**
 * 超级象棋 - 所有棋子增强
 */
export const superChessRules: CustomRuleSet = {
    name: '超级象棋',
    description: '所有棋子能力增强',
    version: '1.0.0',
    pieceRules: {
        general: {
            ...standardKingRule,
            name: '超级将帅',
            description: '可以在整个棋盘移动',
            restrictions: {
                mustStayInPalace: false,
                canJump: false,
                canCrossRiver: true,
            },
        },
        advisor: {
            ...standardAdvisorRule,
            name: '超级士',
            description: '可以在整个棋盘斜线移动',
            restrictions: {
                mustStayInPalace: false,
                canJump: false,
                canCrossRiver: true,
            },
        },
        elephant: {
            ...standardElephantRule,
            name: '超级象',
            description: '可以过河，可以塞象眼',
            restrictions: {
                canCrossRiver: true,
                canJump: true,
            },
        },
        horse: {
            ...standardHorseRule,
            name: '超级马',
            description: '可以蹩马腿',
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
        },
        rook: standardChariotRule,
        cannon: {
            ...standardCannonRule,
            name: '超级炮',
            description: '移动和吃子都可以跳过棋子',
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
            // 移动：直线不吃子，禁止越子
            movePatterns: [
                { dx: 0, dy: 1, repeat: true, moveOnly: true },
                { dx: 0, dy: -1, repeat: true, moveOnly: true },
                { dx: -1, dy: 0, repeat: true, moveOnly: true },
                { dx: 1, dy: 0, repeat: true, moveOnly: true },
            ],
        },
        soldier: {
            ...standardPawnRule,
            name: '超级兵',
            description: '从开局就可以左右移动',
            movePatterns: [
                { dx: 0, dy: 1 },   // 前
                { dx: -1, dy: 0 },  // 左
                { dx: 1, dy: 0 },   // 右
            ],
        },
    },
    globalRules: {
        allowFlyingGeneral: true,
        checkRequired: false,
        stalemateIsDraw: false,
    },
    winConditions: {
        captureKing: true,
    },
}

/**
 * 现代象棋 - 简化版，适合新手
 */
export const modernChessRules: CustomRuleSet = {
    name: '现代象棋',
    description: '简化规则，适合新手学习',
    version: '1.0.0',
    pieceRules: {
        general: standardKingRule,
        advisor: standardAdvisorRule,
        elephant: {
            ...standardElephantRule,
            name: '现代象',
            description: '走田字，可以过河，不能塞象眼',
            restrictions: {
                canCrossRiver: true,
                canJump: false,
            },
        },
        horse: {
            ...standardHorseRule,
            name: '现代马',
            description: '走日字，可以蹩马腿',
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
        },
        rook: standardChariotRule,
        cannon: standardCannonRule,
        soldier: {
            ...standardPawnRule,
            name: '现代兵',
            description: '从开局就可以前进和左右移动',
            movePatterns: [
                { dx: 0, dy: 1 },   // 前
                { dx: -1, dy: 0 },  // 左
                { dx: 1, dy: 0 },   // 右
            ],
        },
    },
    globalRules: {
        allowFlyingGeneral: false,
        checkRequired: true,
        stalemateIsDraw: true,
    },
    winConditions: {
        captureKing: true,
    },
}

/**
 * 疯狂象棋 - 极限模式
 */
export const crazyChessRules: CustomRuleSet = {
    name: '疯狂象棋',
    description: '所有限制解除，极限对战',
    version: '1.0.0',
    pieceRules: {
        general: {
            name: '疯狂将帅',
            description: '可以随意移动',
            movePatterns: [
                { dx: 0, dy: 1, repeat: true },
                { dx: 0, dy: -1, repeat: true },
                { dx: -1, dy: 0, repeat: true },
                { dx: 1, dy: 0, repeat: true },
                { dx: 1, dy: 1, repeat: true },
                { dx: 1, dy: -1, repeat: true },
                { dx: -1, dy: 1, repeat: true },
                { dx: -1, dy: -1, repeat: true },
            ],
            restrictions: {
                mustStayInPalace: false,
                canJump: true,
                canCrossRiver: true,
            },
        },
        advisor: {
            name: '疯狂士',
            description: '可以跳跃和无限移动',
            movePatterns: [
                { dx: 1, dy: 1, repeat: true },
                { dx: 1, dy: -1, repeat: true },
                { dx: -1, dy: 1, repeat: true },
                { dx: -1, dy: -1, repeat: true },
            ],
            restrictions: {
                mustStayInPalace: false,
                canJump: true,
                canCrossRiver: true,
            },
        },
        elephant: {
            name: '疯狂象',
            description: '可以跳跃，可以过河',
            movePatterns: [
                { dx: 2, dy: 2 },
                { dx: 2, dy: -2 },
                { dx: -2, dy: 2 },
                { dx: -2, dy: -2 },
            ],
            restrictions: {
                canCrossRiver: true,
                canJump: true,
            },
        },
        horse: {
            name: '疯狂马',
            description: '可以跳跃',
            movePatterns: [
                { dx: 1, dy: 2 },
                { dx: 1, dy: -2 },
                { dx: -1, dy: 2 },
                { dx: -1, dy: -2 },
                { dx: 2, dy: 1 },
                { dx: 2, dy: -1 },
                { dx: -2, dy: 1 },
                { dx: -2, dy: -1 },
            ],
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
        },
        rook: {
            name: '疯狂车',
            description: '可以跳跃',
            movePatterns: [
                { dx: 0, dy: 1, repeat: true },
                { dx: 0, dy: -1, repeat: true },
                { dx: -1, dy: 0, repeat: true },
                { dx: 1, dy: 0, repeat: true },
            ],
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
        },
        cannon: {
            name: '疯狂炮',
            description: '无需炮架也能吃子',
            movePatterns: [
                { dx: 0, dy: 1, repeat: true },
                { dx: 0, dy: -1, repeat: true },
                { dx: -1, dy: 0, repeat: true },
                { dx: 1, dy: 0, repeat: true },
            ],
            restrictions: {
                canJump: true,
                canCrossRiver: true,
            },
        },
        soldier: {
            name: '疯狂兵',
            description: '可以八方移动',
            movePatterns: [
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
                { dx: 1, dy: 1 },
                { dx: 1, dy: -1 },
                { dx: -1, dy: 1 },
                { dx: -1, dy: -1 },
            ],
            restrictions: {
                canJump: false,
                canCrossRiver: true,
            },
        },
    },
    globalRules: {
        allowFlyingGeneral: true,
        checkRequired: false,
        stalemateIsDraw: false,
    },
    winConditions: {
        captureKing: true,
    },
}

/**
 * 获取所有预设规则
 */
export const getAllPresets = (): CustomRuleSet[] => {
    return [
        standardChessRules,
        superChessRules,
        modernChessRules,
        crazyChessRules,
    ]
}

/**
 * 根据名称获取预设规则
 */
export const getPresetByName = (name: string): CustomRuleSet | undefined => {
    return getAllPresets().find(preset => preset.name === name)
}
