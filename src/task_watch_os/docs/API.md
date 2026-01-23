# 任务监视与进程管理模块 API 文档（TaskWatchOS）

本模块作为独立进程运行，通过标准输入 / 输出的 JSON 行与主应用或其它模块通信。  
下面说明对外可见的命令、事件以及数据结构。

## 进程模型

- 可执行入口：`src/task_watch_os/src/index.js`
- 通信方式：stdin/stdout，每一行是一个 JSON 对象
- 字符集：UTF-8

所有消息使用统一结构：

```json
{
  "type": "request | response | event | error",
  "id": "字符串，用于关联请求/响应",
  "command": "仅 request 使用",
  "event": "仅 event 使用",
  "payload": { "任意字段": "…" },
  "error": { "code": "错误码", "message": "错误信息" },
  "timestamp": 1700000000000
}
```

## 请求命令（command）

### 1. `ping`

健康检查。

请求：

```json
{ "type": "request", "id": "1", "command": "ping" }
```

响应：

```json
{
  "type": "response",
  "id": "1",
  "payload": { "ok": true, "ts": 1700000000000 }
}
```

### 2. `monitor.start`

启动监控主循环。

请求：

```json
{ "type": "request", "id": "2", "command": "monitor.start" }
```

响应：

```json
{ "type": "response", "id": "2", "payload": { "ok": true } }
```

### 3. `monitor.stop`

停止监控主循环。

### 4. `monitor.configure`

动态更新配置。

请求：

```json
{
  "type": "request",
  "id": "3",
  "command": "monitor.configure",
  "payload": {
    "patch": {
      "samplingIntervalMs": 250,
      "foregroundIntervalMs": 250
    }
  }
}
```

响应：

```json
{
  "type": "response",
  "id": "3",
  "payload": {
    "ok": true,
    "config": {
      "samplingIntervalMs": 250,
      "foregroundIntervalMs": 250,
      "maxInMemorySnapshots": 600,
      "maxMemoryMbSelf": 100,
      "dataDir": "data",
      "reportIntervalMs": 60000,
      "baseDir": "...",
      "dataPath": "..."
    }
  }
}
```

### 5. `process.watch`

注册需要监控的进程。

请求：

```json
{
  "type": "request",
  "id": "4",
  "command": "process.watch",
  "payload": {
    "kind": "pid",
    "target": 1234
  }
}
```

- `kind`: `"pid"` 或 `"name"`  
- `target`: 对应的 pid 数字或进程名字符串

响应：

```json
{
  "type": "response",
  "id": "4",
  "payload": { "ok": true, "id": "pid:1234" }
}
```

### 6. `process.unwatch`

取消监控目标。

请求：

```json
{
  "type": "request",
  "id": "5",
  "command": "process.unwatch",
  "payload": { "id": "pid:1234" }
}
```

### 7. `snapshot.get`

获取当前内存中的所有快照。

响应 payload：

```json
{
  "ok": true,
  "snapshots": [
    {
      "kind": "process",
      "ts": 1700000000000,
      "durationMs": 12.3,
      "processes": [
        { "pid": 1234, "processName": "lanstartwrite", "cpu": 0.1, "memoryMb": 55.2, "status": "running" }
      ],
      "self": {
        "rss": 12345678,
        "heapTotal": 1234,
        "heapUsed": 567,
        "external": 0
      }
    }
  ]
}
```

## 事件（event）

### `monitor:ready`

模块启动完成。

```json
{
  "type": "event",
  "event": "monitor:ready",
  "payload": {
    "pid": 4321,
    "config": { "samplingIntervalMs": 500, "foregroundIntervalMs": 500, "…" : "…" }
  }
}
```

### `monitor:started` / `monitor:stopped`

监控主循环启动 / 停止。

### `monitor:config-updated`

配置更新。

payload：

```json
{
  "before": { "samplingIntervalMs": 500, "…" : "…" },
  "after": { "samplingIntervalMs": 250, "…" : "…" }
}
```

### `metrics:update`

周期性推送的进程性能快照。

payload 与 `snapshot.get` 中单条快照结构一致。

### `foreground:changed`

前台任务切换事件。

```json
{
  "type": "event",
  "event": "foreground:changed",
  "payload": {
    "previous": {
      "pid": 100,
      "processName": "explorer",
      "windowTitle": "Desktop",
      "enteredAt": 1700000000000
    },
    "next": {
      "pid": 1234,
      "processName": "lanstartwrite",
      "windowTitle": "LanStartWrite",
      "enteredAt": 1700000000500
    },
    "durationMs": 500
  }
}
```

### `monitor:resource-warning`

监控模块自身资源使用预警。

当前实现报告内存：

```json
{
  "type": "event",
  "event": "monitor:resource-warning",
  "payload": {
    "type": "memory",
    "rssMb": 120.5,
    "limitMb": 100
  }
}
```

### `monitor:error` / `monitor:fatal-error`

内部异常与致命错误报告。

```json
{
  "type": "event",
  "event": "monitor:error",
  "payload": {
    "scope": "processLoop",
    "message": "..."
  }
}
```

