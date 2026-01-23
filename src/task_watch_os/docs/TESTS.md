# 测试与性能基准说明

本模块提供了一组自包含的测试脚本，用于验证核心功能与通信层逻辑。  
由于工程整体使用自定义测试框架，TaskWatchOS 的测试默认不会被 `npm test` 自动执行。

## 1. 单元测试

### 1.1 monitor_core.test.js

路径：

- `src/task_watch_os/tests/monitor_core.test.js`

测试内容：

- 使用 FakeProbe 与 FakeIpc 验证：
  - 监控启动 / 停止事件是否发送
  - 是否能够收集至少一条进程快照
  - 前台任务切换时是否发送 `foreground:changed` 事件

运行方式：

```bash
node src/task_watch_os/tests/monitor_core.test.js
```

### 1.2 ipc_channel.test.js

路径：

- `src/task_watch_os/tests/ipc_channel.test.js`

测试内容：

- 使用内存流模拟 stdin/stdout
- 验证：
  - JSON 行能被正确解析并回调
  - `sendResponse` 会写入合法的响应 JSON 行

运行方式：

```bash
node src/task_watch_os/tests/ipc_channel.test.js
```

## 2. 集成测试建议

目前未内置完整的端到端集成测试脚本，建议在主应用中编写以下场景：

1. 启动监控进程，发送 `ping` 与 `monitor.start`：
   - 应收到 `monitor:ready` 与 `monitor:started` 事件
2. 调用 `process.watch` 监控当前应用 PID：
   - 定期收到包含该 PID 的 `metrics:update` 事件
3. 切换前台窗口：
   - 在 0.5 秒内收到 `foreground:changed` 事件
4. 主动停止监控：
   - 发送 `monitor.stop`，收到 `monitor:stopped` 事件

## 3. 性能基准采集建议

可以通过以下方式粗略评估模块性能：

1. 在配置中设置：
   - `samplingIntervalMs = 500`
   - `foregroundIntervalMs = 500`
2. 运行 10 分钟，并统计：
   - 监控进程的 RSS 内存最大值
   - `metrics:update` 事件的平均间隔
   - PowerShell 调用失败次数（如有）
3. 结果记录建议：
   - 总运行时间
   - 采样次数
   - 最大/平均内存占用
   - 事件延迟是否保持在 500 ms 以内

这些数据可以手工整理为一份简单的性能报告存档在项目文档中。

