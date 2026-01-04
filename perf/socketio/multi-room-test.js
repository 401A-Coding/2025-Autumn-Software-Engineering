#!/usr/bin/env node
/**
 * Socket.IO 多房间压力测试脚本
 * 每对客户端创建独立房间，完整测试对战流程
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// ============ 配置参数 ============
const BASE_URL = process.env.BASE_URL || 'http://101.42.118.61';
const PHONE1 = process.env.PHONE1 || '13053083296';
const PASSWORD1 = process.env.PASSWORD1 || '123456';
const PHONE2 = process.env.PHONE2 || '13035096178';
const PASSWORD2 = process.env.PASSWORD2 || '123456';

// 负载参数
const BATTLE_PAIRS = parseInt(process.env.PAIRS || '5'); // 对战对数
const MOVES_PER_CLIENT = parseInt(process.env.MOVES || '3');

// ============ 统计数据 ============
const stats = {
    login: { success: 0, failed: 0, totalTime: 0 },
    createBattle: { success: 0, failed: 0, totalTime: 0 },
    connect: { success: 0, failed: 0, totalTime: 0 },
    join: { success: 0, failed: 0, totalTime: 0 },
    move: { success: 0, failed: 0, totalTime: 0 },
    errors: [],
};

// ============ HTTP 登录 ============
async function login(phone, password) {
    const startTime = Date.now();
    try {
        const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
            phone,
            password,
        });
        const elapsed = Date.now() - startTime;
        stats.login.success++;
        stats.login.totalTime += elapsed;
        return response.data.data.accessToken;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        stats.login.failed++;
        stats.login.totalTime += elapsed;
        stats.errors.push({
            type: 'login',
            message: error.message,
        });
        throw error;
    }
}

// ============ 创建对战房间 ============
async function createBattle(token) {
    const startTime = Date.now();
    try {
        const response = await axios.post(
            `${BASE_URL}/api/v1/battles`,
            { mode: 'pvp' },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const elapsed = Date.now() - startTime;
        stats.createBattle.success++;
        stats.createBattle.totalTime += elapsed;
        return response.data.data.battleId;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        stats.createBattle.failed++;
        stats.createBattle.totalTime += elapsed;
        stats.errors.push({
            type: 'create_battle',
            message: error.message,
        });
        throw error;
    }
}

// ============ Socket.IO 客户端 ============
function createClient(token, clientId) {
    return new Promise((resolve, reject) => {
        const startConnect = Date.now();
        let isResolved = false;

        const socket = io(`${BASE_URL}/battle`, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: false,
            timeout: 10000,
        });

        socket.on('connect', () => {
            if (!isResolved) {
                isResolved = true;
                const elapsed = Date.now() - startConnect;
                stats.connect.success++;
                stats.connect.totalTime += elapsed;
                resolve(socket);
            }
        });

        socket.on('connect_error', (error) => {
            if (!isResolved) {
                isResolved = true;
                stats.connect.failed++;
                stats.errors.push({
                    type: 'connect',
                    clientId,
                    message: error.message,
                });
                socket.close();
                reject(error);
            }
        });
    });
}

// ============ 加入房间 ============
function joinBattle(socket, battleId) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            stats.join.failed++;
            reject(new Error('Join timeout'));
        }, 5000);

        socket.emit('battle.join', { battleId }, (response) => {
            clearTimeout(timeout);
            const elapsed = Date.now() - startTime;
            if (response && response.battleId) {
                stats.join.success++;
                stats.join.totalTime += elapsed;
                resolve(response);
            } else {
                stats.join.failed++;
                reject(new Error('Invalid join response'));
            }
        });
    });
}

// ============ 发送走棋 ============
function sendMove(socket, battleId, playerName, from = { x: 0, y: 6 }, to = { x: 0, y: 5 }) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            stats.move.failed++;
            stats.errors.push({
                type: 'move_timeout',
                battleId,
                playerName,
                message: 'Move timeout after 5s - no callback received',
            });
            reject(new Error('Move timeout'));
        }, 5000);

        const clientRequestId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // 监听错误事件
        const onException = (err) => {
            clearTimeout(timeout);
            stats.move.failed++;
            const errorDetail = err.message || JSON.stringify(err);
            console.error(`[走棋错误] ${playerName}: ${errorDetail}`);
            stats.errors.push({
                type: 'move_exception',
                battleId,
                playerName,
                message: errorDetail,
            });
            socket.off('exception', onException);
            reject(new Error(`Exception: ${errorDetail}`));
        };

        socket.once('exception', onException);

        socket.emit(
            'battle.move',
            {
                battleId,
                from,
                to,
                clientRequestId,
            },
            (response) => {
                clearTimeout(timeout);
                socket.off('exception', onException);
                const elapsed = Date.now() - startTime;
                if (response && (response.battleId || response.seq)) {
                    stats.move.success++;
                    stats.move.totalTime += elapsed;
                    resolve(response);
                } else {
                    stats.move.failed++;
                    stats.errors.push({
                        type: 'move_invalid_response',
                        battleId,
                        playerName,
                        response: JSON.stringify(response),
                    });
                    reject(new Error(`Invalid move response: ${JSON.stringify(response)}`));
                }
            }
        );
    });
}

// ============ 单对对战流程 ============
async function runBattlePair(pairId) {
    let socket1 = null;
    let socket2 = null;

    try {
        // 1. 两个玩家使用不同账号登录
        const [token1, token2] = await Promise.all([
            login(PHONE1, PASSWORD1),
            login(PHONE2, PASSWORD2)
        ]);

        // 2. 玩家1创建房间
        const battleId = await createBattle(token1);
        console.log(`[对局 ${pairId}] 创建房间 ID=${battleId}`);

        // 3. 两个玩家连接Socket.IO
        [socket1, socket2] = await Promise.all([
            createClient(token1, `${pairId}-p1`),
            createClient(token2, `${pairId}-p2`),
        ]);

        // 4. 两个玩家加入房间（顺序加入，确保都成功）
        await joinBattle(socket1, battleId);
        console.log(`[对局 ${pairId}] 玩家1已加入`);

        await new Promise((resolve) => setTimeout(resolve, 200)); // 短暂延迟

        await joinBattle(socket2, battleId);
        console.log(`[对局 ${pairId}] 玩家2已加入`);

        // 等待房间状态更新为playing
        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log(`[对局 ${pairId}] 两名玩家已加入，开始对战`);

        // 5. 交替走棋 - 使用真实象棋规则
        // 预定义合法走棋序列（只使用兵/卒移动，最安全）
        // 兵/卒位置：x = 0, 2, 4, 6, 8（五个兵/卒）
        const redMoves = [
            { from: { x: 4, y: 6 }, to: { x: 4, y: 5 } }, // 1. 中兵 4路前进
            { from: { x: 2, y: 6 }, to: { x: 2, y: 5 } }, // 2. 2路兵前进
            { from: { x: 6, y: 6 }, to: { x: 6, y: 5 } }, // 3. 6路兵前进
            { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } }, // 4. 0路兵前进
            { from: { x: 8, y: 6 }, to: { x: 8, y: 5 } }, // 5. 8路兵前进（全部兵都前进一步）
            { from: { x: 4, y: 5 }, to: { x: 4, y: 4 } }, // 6. 中兵再进
            { from: { x: 2, y: 5 }, to: { x: 2, y: 4 } }, // 7. 2路兵再进
            { from: { x: 6, y: 5 }, to: { x: 6, y: 4 } }, // 8. 6路兵再进
        ];

        const blackMoves = [
            { from: { x: 4, y: 3 }, to: { x: 4, y: 4 } }, // 1. 中卒 4路前进
            { from: { x: 2, y: 3 }, to: { x: 2, y: 4 } }, // 2. 2路卒前进
            { from: { x: 6, y: 3 }, to: { x: 6, y: 4 } }, // 3. 6路卒前进
            { from: { x: 0, y: 3 }, to: { x: 0, y: 4 } }, // 4. 0路卒前进
            { from: { x: 8, y: 3 }, to: { x: 8, y: 4 } }, // 5. 8路卒前进（全部卒都前进一步）
            { from: { x: 4, y: 4 }, to: { x: 4, y: 5 } }, // 6. 中卒再进
            { from: { x: 2, y: 4 }, to: { x: 2, y: 5 } }, // 7. 2路卒再进
            { from: { x: 6, y: 4 }, to: { x: 6, y: 5 } }, // 8. 6路卒再进
        ];

        for (let i = 0; i < MOVES_PER_CLIENT; i++) {
            // 红方走棋
            const redMove = redMoves[i % redMoves.length];
            try {
                await sendMove(socket1, battleId, `${pairId}-p1`, redMove.from, redMove.to);
                console.log(`[对局 ${pairId}] 红方走棋成功 (${i + 1}/${MOVES_PER_CLIENT}): (${redMove.from.x},${redMove.from.y})→(${redMove.to.x},${redMove.to.y})`);
            } catch (error) {
                console.error(`[对局 ${pairId}] 红方走棋失败 (${i + 1}/${MOVES_PER_CLIENT}):`, error.message);
            }
            await new Promise((resolve) => setTimeout(resolve, 500)); // 增加到500ms避免频率限制

            // 黑方走棋
            const blackMove = blackMoves[i % blackMoves.length];
            try {
                await sendMove(socket2, battleId, `${pairId}-p2`, blackMove.from, blackMove.to);
                console.log(`[对局 ${pairId}] 黑方走棋成功 (${i + 1}/${MOVES_PER_CLIENT}): (${blackMove.from.x},${blackMove.from.y})→(${blackMove.to.x},${blackMove.to.y})`);
            } catch (error) {
                console.error(`[对局 ${pairId}] 黑方走棋失败 (${i + 1}/${MOVES_PER_CLIENT}):`, error.message);
            }
            await new Promise((resolve) => setTimeout(resolve, 500)); // 增加到500ms避免频率限制
        }

        console.log(`[对局 ${pairId}] 完成 ${MOVES_PER_CLIENT * 2} 步走棋`);
    } catch (error) {
        console.error(`[对局 ${pairId}] 错误:`, error.message);
        stats.errors.push({
            type: 'battle_pair',
            pairId,
            message: error.message,
        });
    } finally {
        if (socket1) socket1.close();
        if (socket2) socket2.close();
    }
}

// ============ 主测试流程 ============
async function runLoadTest() {
    console.log('========================================');
    console.log('Socket.IO 多房间压力测试');
    console.log('========================================');
    console.log(`目标服务器: ${BASE_URL}`);
    console.log(`玩家1账号: ${PHONE1}`);
    console.log(`玩家2账号: ${PHONE2}`);
    console.log(`对战对数: ${BATTLE_PAIRS}`);
    console.log(`每对战走棋次数: ${MOVES_PER_CLIENT * 2}`);
    console.log('========================================\n');

    const startTime = Date.now();

    // 串行执行多对对战（避免并发冲突）
    for (let i = 0; i < BATTLE_PAIRS; i++) {
        await runBattlePair(i + 1);
        // 每对战之间等待一下
        if (i < BATTLE_PAIRS - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }

    const totalTime = Date.now() - startTime;

    console.log('\n========================================');
    console.log('测试结果');
    console.log('========================================');
    console.log(`总耗时: ${(totalTime / 1000).toFixed(2)}秒\n`);

    console.log('登录 (Login):');
    console.log(`  成功: ${stats.login.success}`);
    console.log(`  失败: ${stats.login.failed}`);
    if (stats.login.success > 0) {
        console.log(`  平均响应时间: ${(stats.login.totalTime / stats.login.success).toFixed(2)}ms`);
    }

    console.log('\n创建房间 (Create Battle):');
    console.log(`  成功: ${stats.createBattle.success}`);
    console.log(`  失败: ${stats.createBattle.failed}`);
    if (stats.createBattle.success > 0) {
        console.log(`  平均响应时间: ${(stats.createBattle.totalTime / stats.createBattle.success).toFixed(2)}ms`);
    }

    console.log('\nSocket.IO 连接 (Connect):');
    console.log(`  成功: ${stats.connect.success}`);
    console.log(`  失败: ${stats.connect.failed}`);
    if (stats.connect.success > 0) {
        console.log(`  平均连接时间: ${(stats.connect.totalTime / stats.connect.success).toFixed(2)}ms`);
    }

    console.log('\n加入房间 (Join):');
    console.log(`  成功: ${stats.join.success}`);
    console.log(`  失败: ${stats.join.failed}`);
    if (stats.join.success > 0) {
        console.log(`  平均响应时间: ${(stats.join.totalTime / stats.join.success).toFixed(2)}ms`);
    }

    console.log('\n走棋 (Move):');
    console.log(`  成功: ${stats.move.success}`);
    console.log(`  失败: ${stats.move.failed}`);
    if (stats.move.success > 0) {
        console.log(`  平均响应时间: ${(stats.move.totalTime / stats.move.success).toFixed(2)}ms`);
    }

    const expectedMoves = BATTLE_PAIRS * MOVES_PER_CLIENT * 2;
    console.log(`\n走棋完成率: ${((stats.move.success / expectedMoves) * 100).toFixed(2)}% (${stats.move.success}/${expectedMoves})`);

    if (stats.errors.length > 0) {
        console.log('\n错误列表:');
        stats.errors.forEach((err, idx) => {
            console.log(`  ${idx + 1}. [${err.type}] ${err.message}`);
        });
    }

    console.log('========================================\n');
}

// ============ 运行测试 ============
runLoadTest().catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
});
