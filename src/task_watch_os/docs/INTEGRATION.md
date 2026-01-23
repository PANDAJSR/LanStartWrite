# 任务监视与进程管理模块集成指南

本指南说明如何在 LanStartWrite 主进程或其它模块中启动并集成 TaskWatchOS 监控进程。

## 1. 进程启动方式

推荐在 Electron 主进程（`src/main.js`）中通过 `child_process.spawn` 或 `fork` 启动监控模块。

示例代码（伪代码，仅作参考，不会自动生效）：

```js
const path = require('path');
const { spawn } = require('child_process');

function startTaskWatchOS() {
  const entry = path.join(__dirname, 'task_watch_os', 'src', 'index.js');
  const child = spawn(process.execPath, [entry], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  child.stdout.on('data', buf => {
    const lines = buf.toString('utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        handleTaskWatchEvent(child, msg);
      } catch (e) {
      }
    }
  });

  return child;
}
```

## 2. 发送命令

向监控进程发送命令时，需要按行写入 JSON：

```js
function sendRequest(child, command, payload) {
  const msg = {
    type: 'request',
    id: `req_${Date.now()}`,
    command,
    payload: payload || {}
  };
  child.stdin.write(JSON.stringify(msg) + '\n');
}

// 启动监控
sendRequest(child, 'monitor.start');

// 添加监控目标（以当前应用进程为例）
sendRequest(child, 'process.watch', { kind: 'pid', target: process.pid });
```

## 3. 处理事件

从监控进程的 stdout 读取到的消息中，`type === 'event'` 的为事件通知：

```js
function handleTaskWatchEvent(child, msg) {
  if (msg.type === 'event') {
    switch (msg.event) {
      case 'monitor:ready':
        // 可以在此处发送初始配置命令
        break;
      case 'metrics:update':
        // 进程性能快照，可用于写入日志或展示 UI
        break;
      case 'foreground:changed':
        // 前台任务切换事件
        break;
      case 'monitor:resource-warning':
        // 自身资源使用超限预警
        break;
    }
  }
}
```

## 4. 自恢复策略

建议在主进程中实现简单的自恢复逻辑：

```js
let watcherProcess = null;

function ensureWatcherRunning() {
  if (watcherProcess && !watcherProcess.killed) return;
  watcherProcess = startTaskWatchOS();
  watcherProcess.on('exit', (code, signal) => {
    // 延迟重启，避免快速重启风暴
    setTimeout(() => {
      watcherProcess = null;
      ensureWatcherRunning();
    }, 2000);
  });
}

ensureWatcherRunning();
```

## 5. 与现有模块集成建议

- 如果已有日志模块，可以将 `metrics:update` / `foreground:changed` 事件写入统一的日志或指标上报系统
- 可以在设置界面新增开关、采样频率调节，通过 `monitor.configure` 动态传递到 TaskWatchOS
- 如需监控插件进程或外部程序，可在对应模块中调用 `process.watch` 注册 PID 或进程名

## 6. 性能注意事项

- 采样频率过高会导致 PowerShell 调用压力增大，建议根据业务需要合理配置：
  - 前台任务追踪：一般 250–500 ms 足够
  - 进程性能数据：500–1000 ms 通常即可满足实时性
- 可通过 `monitor:resource-warning` 事件监控监控模块自身的内存使用情况，并在必要时提高采样间隔或减少监控目标数量。

