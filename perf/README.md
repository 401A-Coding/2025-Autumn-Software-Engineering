# 性能测试工具集

本目录包含三种性能测试工具，用于测试象棋对战平台的 HTTP API 和 Socket.IO WebSocket 性能。

## 目录结构

```
perf/
├── socketio/        # Socket.IO WebSocket 实战测试 ✅ 推荐
├── k6/             # k6 HTTP API 压测
└── artillery/      # Artillery HTTP API 压测
```

## 快速开始

### 1. Socket.IO 实战测试（推荐）

**用途**：模拟真实对战，测试 WebSocket 连接、走棋性能

```bash
cd perf/socketio
npm install

# 快速测试
$env:PAIRS='1'; $env:MOVES='2'; node multi-room-test.js

# 压力测试
$env:PAIRS='5'; $env:MOVES='5'; node multi-room-test.js
```

**特点**：

- ✅ 真实 WebSocket 连接
- ✅ 双账号对战（红方 vs 黑方）
- ✅ 真实象棋规则走法
- ✅ 100% 走棋成功率

**性能基准**：

- 登录：230ms 平均
- 连接：30ms 平均
- 加入房间：10ms 平均
- 走棋：10ms 平均

📖 [详细文档](./socketio/README.md)

### 2. k6 HTTP 压测

**用途**：HTTP API 性能基准测试

```bash
cd perf/k6

# Windows
& "D:\Program Files\k6\k6.exe" run http-scenarios.js

# Linux/macOS
k6 run http-scenarios.js
```

**特点**：

- 高性能 Go 实现
- JavaScript DSL 编程
- 50 并发 VUs，3.5 分钟测试
- 内置性能阈值检查

📖 [详细文档](./k6/README.md)

### 3. Artillery HTTP 压测

**用途**：HTTP API 配置化压测

```bash
cd perf/artillery
artillery run http-scenarios.yml
```

**特点**：

- YAML 配置简单
- 3 VU/s 负载，2 分钟测试
- P95 < 250ms

📖 [详细文档](./artillery/README.md)

## 测试场景对比

| 测试工具 | 测试类型 | 并发模型 | 配置方式 | 适用场景 |
|---------|---------|---------|---------|---------|
| **socketio/** | WebSocket | 串行对战 | JS 编程 | Socket.IO 实战测试 |
| **k6/** | HTTP | 50 并发 VUs | JS 编程 | HTTP 高并发压测 |
| **artillery/** | HTTP | 3 VU/s | YAML 配置 | HTTP 轻量压测 |

## 推荐测试流程

### 第一步：HTTP 基准测试

选择 k6 或 Artillery 进行 HTTP API 性能验证：

```bash
# 选项 A: k6（高并发）
cd perf/k6
k6 run http-scenarios.js

# 选项 B: Artillery（轻量级）
cd perf/artillery
artillery run http-scenarios.yml
```

**验证指标**：

- ✅ 成功率 > 99%
- ✅ P95 延迟 < 500ms
- ✅ 错误率 < 1%

### 第二步：Socket.IO 实战测试

使用 socketio 工具进行 WebSocket 性能测试：

```bash
cd perf/socketio
npm install

# 1对对局验证
$env:PAIRS='1'; $env:MOVES='2'; node multi-room-test.js

# 3对对局标准测试
$env:PAIRS='3'; $env:MOVES='3'; node multi-room-test.js

# 5对对局压力测试
$env:PAIRS='5'; $env:MOVES='5'; node multi-room-test.js
```

**验证指标**：

- ✅ 走棋成功率 = 100%
- ✅ 走棋延迟 < 20ms
- ✅ 连接时间 < 50ms

### 第三步：结果分析

对比不同工具的测试结果，验证：

1. HTTP API 性能是否满足要求
2. Socket.IO 连接是否稳定
3. 走棋操作延迟是否可接受
4. 并发负载下系统表现

## 环境变量配置

### 通用配置

```bash
# PowerShell
$env:BASE_URL='http://101.42.118.61'

# Linux/macOS
export BASE_URL=http://101.42.118.61
```

### Socket.IO 专用

```bash
# 红方账号
$env:PHONE1='13053083296'
$env:PASSWORD1='123456'

# 黑方账号
$env:PHONE2='13035096178'
$env:PASSWORD2='123456'
```

### HTTP 测试专用

```bash
$env:PHONE='13053083296'
$env:PASSWORD='123456'
```

## 性能监控建议

测试期间建议同时监控：

### 后端指标

- CPU 使用率
- 内存使用率
- GC（垃圾回收）频率
- Node.js 事件循环延迟

### 数据库指标

- Prisma 连接池使用率
- PostgreSQL 慢查询
- 活跃连接数
- 锁等待时间

### 工具

- Prometheus + Grafana
- PostgreSQL `pg_stat_statements`
- Node.js `clinic`

## 注意事项

### ⚠️ 测试环境

- **不要在生产环境运行高负载测试**
- 使用独立的测试账号
- 测试后清理测试数据

### ⚠️ Socket.IO 限制

- 后端有走棋频率限制（500ms 间隔）
- 需要两个不同的测试账号
- 测试脚本已自动处理这些限制

### ⚠️ 废弃功能

以下功能已废弃，不建议使用：

- ❌ Artillery Socket.IO 测试（不支持认证）
- ❌ k6 Socket.IO 测试（需要特殊构建，功能受限）

## 故障排查

### HTTP 测试失败

**症状**：大量 4xx/5xx 错误

**检查**：

1. 服务器是否正常运行
2. 账号密码是否正确
3. API 路径是否正确（/api/v1/*）
4. JWT token 是否有效

### Socket.IO 连接失败

**症状**：connect_error 错误

**检查**：

1. Socket.IO 服务是否启动
2. 命名空间路径是否正确（/battle）
3. 认证 token 是否有效
4. 防火墙/代理设置

### 走棋失败

**症状**：走棋成功率 < 100%

**检查**：

1. 是否使用了两个不同账号
2. 走棋坐标是否符合象棋规则
3. 走棋间隔是否 ≥ 500ms
4. 后端日志中的详细错误

## 扩展开发

### 添加新测试场景

1. **复制现有脚本**作为模板
2. **修改测试流程**适配新场景
3. **更新 README**添加使用说明
4. **验证测试结果**确保准确性

### 集成 CI/CD

```yaml
# .github/workflows/performance-test.yml
name: Performance Test

on:
  schedule:
    - cron: '0 2 * * *'  # 每天凌晨2点

jobs:
  http-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run k6 HTTP test
        run: |
          cd perf/k6
          k6 run http-scenarios.js
        env:
          BASE_URL: ${{ secrets.TEST_SERVER_URL }}
          PHONE: ${{ secrets.TEST_PHONE }}
          PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## 更多信息

- [Socket.IO 测试文档](./socketio/README.md)
- [k6 测试文档](./k6/README.md)
- [Artillery 测试文档](./artillery/README.md)
- [项目 API 文档](../docs/API_SPEC.md)
