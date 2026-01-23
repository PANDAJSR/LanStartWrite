# 任务监视与进程管理模块通信协议规范

本文档补充说明 TaskWatchOS 模块的通信协议细节、并发处理策略以及错误处理约定。

## 1. 传输层

- 通道：标准输入（stdin）与标准输出（stdout）
- 格式：以行为边界的 JSON 文本（JSON Lines）
- 每一行是一个完整的 JSON 对象，不包含换行
- 字符集：UTF-8

## 2. 消息结构

```json
{
  "type": "request | response | event | error",
  "id": "string",
  "command": "string (for request)",
  "event": "string (for event)",
  "payload": { "..." : "..." },
  "error": { "code": "string", "message": "string" },
  "timestamp": 1700000000000
}
```

字段说明：

- `type`: 消息类型
  - `request`: 调用方发送的命令请求
  - `response`: 监控模块对请求的正常响应
  - `event`: 监控模块主动推送的状态或数据
  - `error`: 对请求的错误响应，或解析失败的错误消息
- `id`: 请求/响应的相关标识。  
  对于 `request`，由调用方生成；对于 `response` 和 `error`，复用请求的 id；对于 `event`，由监控模块自行生成。
- `command`: 请求命令名称，仅在 `type=request` 时使用
- `event`: 事件名称，仅在 `type=event` 时使用
- `payload`: 命令参数、响应数据或事件数据
- `error`: 错误对象，包含错误码和文本信息
- `timestamp`: 服务器端发送消息的时间戳（毫秒）

## 3. 命令列表

参考 `API.md` 中的详细说明，这里只列出集合：

- `ping`
- `monitor.start`
- `monitor.stop`
- `monitor.configure`
- `process.watch`
- `process.unwatch`
- `snapshot.get`

协议约定：

- 监控模块对每一个合法的 `request` 至少返回一条 `response` 或 `error`
- 对于解析失败的 JSON 数据，模块返回一条 `error`，`id` 由模块自行生成

## 4. 并发与队列

### 4.1 输入队列

- 所有从 stdin 接收的行会按到达顺序依次解析
- 对于 `type=request` 的消息，会立即调度到核心处理逻辑
- 目前实现为单线程顺序执行，避免复杂的并发语义

### 4.2 输出队列

- 输出通过 stdout 顺序写入，模块不会在单次写入中拆分 JSON 行
- 调用方应以行分割读取 stdout，将每一行解码为 JSON

### 4.3 高并发场景

- 在高频请求的情况下，调用方应自行实现限流与重试机制：
  - 降低请求频率（例如配置类命令）
  - 检测 `error.code === 'internal_error'` 或 `monitor:resource-warning` 事件，并根据需要退避
- 监控模块内部通过配置参数控制采样频率与内存缓冲大小，避免资源耗尽

## 5. 错误处理

### 5.1 请求级错误

当请求格式或参数不合法时，模块返回：

```json
{
  "type": "error",
  "id": "原请求 id",
  "error": {
    "code": "bad_request | unknown_command | internal_error",
    "message": "错误详情"
  },
  "timestamp": 1700000000000
}
```

常见错误码：

- `bad_request`: 缺少必须字段或字段类型不正确
- `unknown_command`: 未识别的 command 名称
- `internal_error`: 核心逻辑抛出未捕获异常

### 5.2 解析失败

当输入行无法解析为 JSON 时，模块会发送：

```json
{
  "type": "error",
  "id": "自动生成",
  "error": {
    "code": "bad_json",
    "message": "解析错误信息"
  }
}
```

### 5.3 模块级错误

当内部出现异常但模块仍可继续运行时，会发送事件：

- `monitor:error`
- `monitor:fatal-error`

调用方可根据事件内容决定是否重启监控进程。

## 6. 消息顺序与幂等性

- 协议不保证严格的时间顺序，仅保证同一进程内“发送顺序即输出顺序”
- 调用方在设计时应假定事件可能延迟或乱序到达
- `process.watch` / `process.unwatch` 应视为幂等操作：
  - 重复 watch 同一目标不会导致错误
  - unwatch 不存在的 id 不会抛出异常

## 7. 安全与隔离

- 模块不主动执行任意外部命令，只调用固定的 PowerShell 脚本获取系统信息
- 不接受任何会直接传入 shell 的原始字符串，避免注入风险
- 所有持久化内容写入模块自身目录下的 `data/` 子目录，避免污染其他路径

