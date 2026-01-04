#!/usr/bin/env node
/**
 * Socket.IO 压力测试脚本
 * 使用原生 socket.io-client 实现真实的 WebSocket 连接测试
 */

const { io } = require('socket.io-client');
const axios = require('axios');

// ============ 配置参数 ============
const BASE_URL = process.env.BASE_URL || 'http://101.42.118.61';
const PHONE = process.env.PHONE || '13053083296';
const PASSWORD = process.env.PASSWORD || '123456';
const BATTLE_ID = parseInt(process.env.BATTLE_ID || '23165');

// 负载参数
const TOTAL_CLIENTS = parseInt(process.env.CLIENTS || '50');
const RAMP_UP_TIME = parseInt(process.env.RAMP_UP || '10'); // 秒
const TEST_DURATION = parseInt(process.env.DURATION || '60'); // 秒
const MOVES_PER_CLIENT = parseInt(process.env.MOVES || '5');

// ============ 统计数据 ============
const stats = {
    login: { success: 0, failed: 0, totalTime: 0 },
    connect: { success: 0, failed: 0, totalTime: 0 },
    join: { success: 0, failed: 0, totalTime: 0 },
    move: { success: 0, failed: 0, totalTime: 0 },
    errors: [],
};

// ============ HTTP 登录 ============
async function login() {
    const startTime = Date.now();
    try {
        const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
            phone: PHONE,
            password: PASSWORD,
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
            status: error.response?.status,
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
            reconnection: false, // 压测时禁用重连
            timeout: 10000,
        });

        // 连接成功
        socket.on('connect', () => {
            if (!isResolved) {
                isResolved = true;
                const elapsed = Date.now() - startConnect;
                stats.connect.success++;
                stats.connect.totalTime += elapsed;
                resolve(socket);
            }
        });

        // 连接错误
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

        // 其他错误
        socket.on('error', (error) => {
            stats.errors.push({
                type: 'socket_error',
                clientId,
                message: error.message || String(error),
            });
        });

        socket.on('exception', (error) => {
            stats.errors.push({
                type: 'exception',
                clientId,
                message: error.message || String(error),
            });
        });
    });
}

// ============ 加入房间 ============
function joinBattle(socket, battleId) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            stats.join.failed++;
            stats.errors.push({
                type: 'join_timeout',
                battleId,
                message: 'Join battle timeout after 5s',
            });
            reject(new Error('Join battle timeout'));
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
                stats.errors.push({
                    type: 'join_error',
                    battleId,
                    response,
                });
                reject(new Error('Invalid join response'));
            }
        });
    });
}

// ============ 等待房间状态 ============
function waitForBattleStatus(socket, battleId, targetStatus = 'playing', maxWait = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let snapshotReceived = false;

        const timeout = setTimeout(() => {
            if (!snapshotReceived) {
                reject(new Error(`Battle did not reach ${targetStatus} status within ${maxWait}ms`));
            }
        }, maxWait);

        const onSnapshot = (snapshot) => {
            if (snapshot.battleId === battleId && snapshot.status === targetStatus) {
                snapshotReceived = true;
                clearTimeout(timeout);
                socket.off('battle.snapshot', onSnapshot);
                resolve(snapshot);
            } else if (Date.now() - startTime > maxWait) {
                clearTimeout(timeout);
                socket.off('battle.snapshot', onSnapshot);
                reject(new Error(`Timeout waiting for ${targetStatus}, current: ${snapshot.status}`));
            }
        };

        socket.on('battle.snapshot', onSnapshot);

        // 请求当前快照
        socket.emit('battle.snapshot', { battleId });
    });
}

// ============ 发送走棋 ============
function sendMove(socket, battleId, moveIndex) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
            stats.move.failed++;
            stats.errors.push({
                type: 'move_timeout',
                battleId,
                moveIndex,
                message: 'Move timeout after 5s',
            });
            reject(new Error('Move timeout'));
        }, 5000);

        const clientRequestId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        socket.emit(
            'battle.move',
            {
                battleId,
                from: { x: 0, y: 0 },
                to: { x: 0, y: 1 },
                clientRequestId,
            },
            (response) => {
                clearTimeout(timeout);
                const elapsed = Date.now() - startTime;
                if (response && response.battleId) {
                    stats.move.success++;
                    stats.move.totalTime += elapsed;
                    resolve(response);
                } else {
                    stats.move.failed++;
                    stats.errors.push({
                        type: 'move_error',
                        battleId,
                        moveIndex,
                        response,
                    });
                    reject(new Error('Invalid move response'));
                }
            }
        );
    });
}

// ============ 单个客户端测试流程 ============
async function runClient(clientId, delay) {
    // 延迟启动以实现 ramp-up
    await new Promise((resolve) => setTimeout(resolve, delay));

    let socket = null;

    try {
        // 1. 登录
        const token = await login();

        // 2. 连接 Socket.IO
        socket = await createClient(token, clientId);

        // 3. 加入房间
        await joinBattle(socket, BATTLE_ID);

        // 4. 等待房间进入playing状态（最多等10秒）
        try {
            await waitForBattleStatus(socket, BATTLE_ID, 'playing', 10000);
        } catch (err) {
            // 如果房间一直是waiting状态，跳过走棋
            stats.errors.push({
                type: 'waiting_timeout',
                clientId,
                message: err.message,
            });
            return; // 不执行走棋，直接返回
        }

        // 5. 发送多次走棋
        for (let i = 0; i < MOVES_PER_CLIENT; i++) {
            await sendMove(socket, BATTLE_ID, i);
            await new Promise((resolve) => setTimeout(resolve, 100)); // 两次走棋间隔100ms
        }

        // 6. 保持连接直到测试结束
        const remainingTime = RAMP_UP_TIME * 1000 + TEST_DURATION * 1000 - Date.now() + startTime;
        if (remainingTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }
    } catch (error) {
        // 错误已在各个函数中记录
    } finally {
        if (socket) {
            socket.close();
        }
    }
}

// ============ 主测试流程 ============
let startTime;

async function runLoadTest() {
    console.log('========================================');
    console.log('Socket.IO 压力测试');
    console.log('========================================');
    console.log(`目标服务器: ${BASE_URL}`);
    console.log(`测试房间ID: ${BATTLE_ID}`);
    console.log(`并发客户端: ${TOTAL_CLIENTS}`);
    console.log(`启动时间: ${RAMP_UP_TIME}秒`);
    console.log(`测试时长: ${TEST_DURATION}秒`);
    console.log(`每客户端走棋次数: ${MOVES_PER_CLIENT}`);
    console.log('========================================\n');

    startTime = Date.now();

    // 创建客户端，均匀分布启动时间
    const clients = [];
    const delayBetweenClients = (RAMP_UP_TIME * 1000) / TOTAL_CLIENTS;

    for (let i = 0; i < TOTAL_CLIENTS; i++) {
        const delay = i * delayBetweenClients;
        clients.push(runClient(i, delay));
    }

    // 等待所有客户端完成
    await Promise.allSettled(clients);

    // 输出结果
    printResults();
}

// ============ 结果输出 ============
function printResults() {
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

    console.log('\n总体成功率:');
    const totalOps = stats.login.success + stats.login.failed +
        stats.connect.success + stats.connect.failed +
        stats.join.success + stats.join.failed +
        stats.move.success + stats.move.failed;
    const totalSuccess = stats.login.success + stats.connect.success +
        stats.join.success + stats.move.success;
    console.log(`  ${((totalSuccess / totalOps) * 100).toFixed(2)}% (${totalSuccess}/${totalOps})`);

    if (stats.errors.length > 0) {
        console.log('\n错误摘要 (前10条):');
        const errorSummary = {};
        stats.errors.forEach((err) => {
            const key = err.type;
            errorSummary[key] = (errorSummary[key] || 0) + 1;
        });
        Object.entries(errorSummary).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        console.log('\n详细错误 (前10条):');
        stats.errors.slice(0, 10).forEach((err, idx) => {
            console.log(`  ${idx + 1}. [${err.type}] ${err.message || JSON.stringify(err)}`);
        });
    }

    console.log('========================================\n');
}

// ============ 运行测试 ============
runLoadTest().catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
});
