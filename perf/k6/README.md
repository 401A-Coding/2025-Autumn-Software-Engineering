# k6 HTTP 性能测试

k6 是基于 Go 的现代负载测试工具，提供优秀的性能和灵活的 JavaScript DSL。

> **注意**：Socket.IO 测试已废弃（xk6-socketio 不支持认证），请使用 `perf/socketio/multi-room-test.js` 进行 WebSocket 实战测试。

## 安装

### Windows

1. 从 [k6 Releases](https://github.com/grafana/k6/releases) 下载最新版本
2. 解压到目录（如 `D:\Program Files\k6\`）
3. 添加到系统 PATH 或使用完整路径

### Linux/macOS

```bash
# macOS (Homebrew)
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

验证安装：

```bash
k6 version
```

## HTTP 压测

### 快速开始

```bash
cd perf/k6

# Windows
& "D:\Program Files\k6\k6.exe" run http-scenarios.js

# Linux/macOS
k6 run http-scenarios.js
```

### 自定义参数

使用环境变量：

```bash
# PowerShell
$env:BASE_URL='http://101.42.118.61'
$env:PHONE='13053083296'
$env:PASSWORD='123456'
& "D:\Program Files\k6\k6.exe" run http-scenarios.js

# Linux/macOS
BASE_URL=http://101.42.118.61 \
PHONE=13053083296 \
PASSWORD=123456 \
k6 run http-scenarios.js
```

## 测试场景

`http-scenarios.js` 包含以下测试流程：

1. **Setup 阶段**：单次登录获取 JWT token
2. **VU 测试**：每个虚拟用户执行：
   - 创建对战（POST `/api/v1/battles`）
   - 查询对战列表（GET `/api/v1/battles`）
   - 查询棋盘模板（GET `/api/v1/boards/templates`）
   - 查询对局记录（GET `/api/v1/records`）
   - 查询社区帖子（GET `/api/v1/community/posts`）

## 负载配置

当前配置（`http-scenarios.js`）：

**Ramping VUs 模式**：

- **阶段 1**：30秒内从 0 增长到 20 VUs
- **阶段 2**：60秒内从 20 增长到 50 VUs
- **阶段 3**：60秒保持 50 VUs
- **阶段 4**：60秒从 50 降至 0 VUs

总测试时间：3.5 分钟，最大并发 50 VUs。

## 阈值配置

脚本包含性能阈值检查：

```javascript
thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 请求 < 500ms
    http_req_failed: ['rate<0.1'],    // 失败率 < 10%
}
```

测试失败时 k6 会返回非零退出码。

## 输出与报告

### 控制台输出

默认显示实时指标和最终汇总。

### JSON 输出

```bash
k6 run --out json=results.json http-scenarios.js
```

### CSV 输出

```bash
k6 run --out csv=results.csv http-scenarios.js
```

### InfluxDB/Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 http-scenarios.js
```

配合 Grafana 可视化仪表盘。

## 性能基准

**测试环境**：服务器 101.42.118.61，50 并发 VUs

**结果**：

- ✅ 成功率：100%
- ⚡ P95 延迟：< 500ms（符合阈值）
- ⚡ HTTP 请求失败率：< 1%

## 配置说明

`http-scenarios.js` 主要配置：

### 环境变量

```javascript
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PHONE = __ENV.PHONE || '13053083296';
const PASSWORD = __ENV.PASSWORD || '123456';
```

### Executor 配置

```javascript
scenarios: {
    ramping_load: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '30s', target: 20 },
            { duration: '1m', target: 50 },
            { duration: '1m', target: 50 },
            { duration: '1m', target: 0 },
        ],
    },
}
```

### Options

- `thresholds`：性能阈值
- `summaryTrendStats`：统计指标
- `noConnectionReuse`：禁用连接复用（可选）

## 与其他工具对比

| 工具 | 用途 | 优势 |
|------|------|------|
| **k6 HTTP** | HTTP API 压测 | 高性能，编程灵活，CI/CD 友好 |
| **Artillery HTTP** | HTTP API 压测 | 配置简单，YAML 格式 |
| **perf/socketio/** | Socket.IO 实战测试 | 真实 WebSocket，双账号对战 |

## 更多信息

- 官方文档：<https://k6.io/docs/>
- JavaScript API：<https://k6.io/docs/javascript-api/>
- Executors：<https://k6.io/docs/using-k6/scenarios/executors/>
