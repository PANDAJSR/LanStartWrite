# 部署与运行说明

本模块位于：

- `src/task_watch_os/`

目录结构：

- `src/`：核心源码
- `config/`：默认配置
- `tests/`：自测脚本
- `docs/`：文档
- `data/`：运行时生成的快照日志（首次运行时自动创建）

## 1. 运行环境

- Node.js：与 Electron 运行时保持一致（当前工程使用 Electron 34）
- 操作系统：Windows（前台窗口监控依赖 PowerShell 与 Windows API）

## 2. 独立运行

在项目根目录下：

```bash
node src/task_watch_os/src/index.js
```

此时模块会：

- 从 `config/default.json` 读取默认配置
- 监听 stdin 上的 JSON 行命令
- 通过 stdout 输出事件与响应

如果不发送任何命令，模块仍会启动监控循环，并默认使用配置的采样频率。

## 3. 与 LanStartWrite 一起部署

构建流程：

- 本模块的文件已经位于 `src/` 目录下，electron-builder 会自动打包
- 无需额外配置即可包含在应用安装包中

运行时集成：

- 在 Electron 主进程中按 `INTEGRATION.md` 的说明使用 `child_process` 启动
- 建议在应用启动后尽早启动监控进程，以便捕获完整的生命周期数据

## 4. 配置管理

默认配置文件：

- `src/task_watch_os/config/default.json`

可以通过修改该文件调整：

- `samplingIntervalMs`：进程性能采样间隔
- `foregroundIntervalMs`：前台任务检测间隔
- `maxInMemorySnapshots`：内存中保留的快照数量
- `maxMemoryMbSelf`：监控进程自身内存上限预警
- `dataDir`：快照日志输出目录名

运行时也可以通过 IPC 命令 `monitor.configure` 动态调整部分参数。

## 5. 数据持久化

模块会在 `data/` 目录下创建 `snapshots.log`：

- 每一行是一个 JSON 对象，对应一次 `metrics:update` 快照
- 可以用任意脚本离线分析，例如：

```bash
node -e "require('fs').readFileSync('src/task_watch_os/data/snapshots.log','utf8').trim().split(/\r?\n/).map(JSON.parse).slice(0,5).forEach(x=>console.log(x.kind,x.ts));"
```

## 6. 资源控制与可用性

目标指标：

- 启动时间：< 3 秒
- 采样延迟：< 500 ms（默认配置满足）
- 内存占用：< 100 MB（通过自监控预警）
- 可用性：内部异常通过事件上报，由主进程负责重启

实际部署时建议：

- 在日志系统中收集 `monitor:fatal-error` 与 `monitor:resource-warning` 事件
- 对监控进程实现“退出后自动重启”的逻辑
- 对 PowerShell 调用的错误进行统计，以便调整采样频率与监控范围

