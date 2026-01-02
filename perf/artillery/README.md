# Artillery HTTP 性能测试

Artillery 是基于 Node.js 的负载测试工具，支持 HTTP、WebSocket 和 Socket.IO。

> **注意**：Socket.IO 测试已废弃，请使用 `perf/socketio/multi-room-test.js` 进行 WebSocket 实战测试。

## 安装

```bash
npm install -g artillery
```

验证安装：

```bash
artillery --version
```

## HTTP 压测

### 快速开始

```bash
cd perf/artillery
artillery run http-scenarios.yml
```

### 自定义参数

编辑 `http-scenarios.yml` 中的 `config.variables` 部分：

```yaml
config:
  target: "http://101.42.118.61"
  variables:
    phone: "13053083296"
    password: "123456"
```

或使用环境变量：

```bash
# PowerShell
$env:BASE_URL='http://101.42.118.61'
$env:PHONE='13053083296'
$env:PASSWORD='123456'
artillery run http-scenarios.yml

# Linux/macOS
BASE_URL=http://101.42.118.61 \
PHONE=13053083296 \
PASSWORD=123456 \
artillery run http-scenarios.yml
```

## 测试场景

- **登录认证**：POST `/api/v1/auth/login`
- **创建对战**：POST `/api/v1/battles`
- **查询棋盘模板**：GET `/api/v1/boards/templates`
- **查询对局记录**：GET `/api/v1/records`
- **查询社区帖子**：GET `/api/v1/community/posts`

## 负载配置

当前配置（`http-scenarios.yml`）：

- **启动阶段**：30秒内从 1 VU/s 增长到 3 VU/s
- **稳定阶段**：60秒保持 3 VU/s
- **结束阶段**：30秒降至 0 VU/s
- **超时设置**：30秒

> **VU/s vs 并发**：`arrivalRate: 3` 表示每秒创建 3 个新虚拟用户，不是 3 个并发连接。60秒内会产生约 180 个总请求。

## 输出与报告

### 实时输出

```bash
artillery run http-scenarios.yml
```

显示实时吞吐、P50/P95/P99 延迟、错误率。

### 生成 JSON 报告

```bash
artillery run http-scenarios.yml --output report.json
```

### 生成 HTML 报告

```bash
artillery run http-scenarios.yml --output report.json
artillery report report.json
```

会生成 `report.json.html` 文件，用浏览器打开查看可视化报告。

## 性能基准

**测试环境**：服务器 101.42.118.61，3 VU/s 负载

**结果**（324 VUs，1620 requests）：

- ✅ 成功率：100%
- ⚡ P50 延迟：18ms
- ⚡ P95 延迟：242ms
- ⚡ P99 延迟：284ms

## 配置说明

`http-scenarios.yml` 主要配置：

- `config.target`：基础 URL
- `config.phases`：负载阶段定义
  - `duration`：持续时间（秒）
  - `arrivalRate`：每秒创建的 VU 数量
  - `rampTo`：目标速率（渐变）
- `config.http.timeout`：请求超时（秒）
- `scenarios[*].flow`：请求流程定义

## 与其他工具对比

| 工具 | 用途 | 优势 |
|------|------|------|
| **Artillery HTTP** | HTTP API 压测 | 配置简单，YAML 格式 |
| **k6 HTTP** | HTTP API 压测 | 编程灵活，二进制执行 |
| **perf/socketio/** | Socket.IO 实战测试 | 真实 WebSocket，双账号对战 |

## 更多信息

官方文档：<https://artillery.io/docs>
