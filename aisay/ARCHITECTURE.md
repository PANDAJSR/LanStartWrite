# LanStartWrite 架构设计文档

## 版本控制信息

- 文档版本：1.0.0
- 适配应用版本：0.2.1（见 package.json）
- 更新时间：2026-01-03
- 维护者：项目维护者

## 1. 目标与范围

本文件描述 LanStartWrite 的整体架构、核心模块职责边界、关键执行链路、关键设计决策与权衡、性能优化与扩展性设计。面向需要维护核心代码、排查线上问题、或开发插件能力的开发者。

## 2. 系统架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│                             Electron 应用                              │
├───────────────────────────────┬──────────────────────────────────────┤
│           主进程 (main)        │           渲染进程 (renderer)          │
│  src/main.js                   │  src/renderer.js（绘制内核）            │
│  - 窗口/Overlay 策略            │  src/ui-tools.js（UI 编排）              │
│  - 插件安装/校验/注册表         │  src/message.js（事件总线）              │
│  - 文件/资源读写                │  src/setting.js（设置持久化）             │
│  - IPC handlers                │  src/mod.js（插件宿主/Worker 管理）        │
│               ▲                │               ▲                          │
│               │ IPC (invoke/   │               │ 模块间事件（Message）     │
│               │ send/reply)    │               │                          │
│        src/preload.js          │        功能模块：pen/erese/page/...       │
│        - electronAPI 桥接       │        子菜单定位：more_decide_windows.js │
├───────────────┴────────────────┴──────────────────────────────────────┤
│                               插件生态                                  │
│  mod/plugins/<id>/...                                                   │
│  - manifest.json（声明）                                                │
│  - entry.kind=worker（Web Worker 模块）                                  │
│  - 通过 Mod API 注册工具/模式/Overlay，并通过总线发布订阅事件               │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. 核心模块与职责

### 3.1 绘制内核

- [renderer.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/renderer.js)：Canvas 2D 绘制、笔画数据结构、撤销重做、工具状态维护、背景/视图变换等核心能力。

### 3.2 UI 编排与交互

- [ui-tools.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/ui-tools.js)：工具栏、设置/插件弹窗、批注模式交互控制（鼠标穿透与交互矩形同步）。
- [more_decide_windows.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/more_decide_windows.js)：子菜单定位、固定、拖拽与随工具栏移动的智能重排。
- [pen.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/pen.js)、[erese.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/erese.js)：具体工具 UI 与行为封装。

### 3.3 状态与配置

- [setting.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/setting.js)：设置读写与规范化，包含画笔颜色的模式隔离字段（annotationPenColor / whiteboardPenColor）。
- [message.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/message.js)：模块间解耦通信总线（事件发布订阅）。

### 3.4 插件系统

- 主进程安装/校验： [main.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/main.js) 中 `mod:*` IPC handlers 与 `.lanmod` 安装流程（解压、manifest 校验、资源哈希、签名验证、registry 写入）。
- 渲染进程宿主： [mod.js](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/mod.js)（Worker 启动、权限裁剪、总线转发、工具/模式/Overlay 注册）。

## 4. 关键流程与执行链路

### 4.1 子菜单打开与智能定位（典型 UI 流程）

```
用户点击工具栏按钮
  ↓
ui-tools.js → showSubmenu(menu, opener)
  ↓
more_decide_windows.js
  - 关闭其它未固定 submenu（互斥）
  - positionMenu：测量 submenu → 判断上下空间 → 计算 top/left 并夹紧
  - pinned=true 时切换 fixed，支持独立拖拽
```

相关实现：[showSubmenu/positionMenu](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/more_decide_windows.js#L182-L203)。

### 4.2 批注模式鼠标穿透与交互矩形同步（典型业务链路）

```
UI 状态变化（打开菜单/弹窗、折叠工具栏、拖拽工具栏）
  ↓
ui-tools.js → scheduleInteractiveRectsUpdate（按帧合并）
  ↓
collectInteractiveRects（收集 toolbar/menu/modal 的 DOMRect）
  ↓
preload.js → electronAPI.sendToMain
  ↓
main.js：overlay:set-interactive-rects / overlay:set-ignore-mouse
  ↓
窗口策略更新：仅 UI 区域接收鼠标，其余区域穿透到底层应用
```

相关实现：[ui-tools.js:交互矩形链路](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/ui-tools.js)。

### 4.3 插件安装与启用（典型插件链路）

```
用户在“插件管理”选择 .lanmod
  ↓
ui-tools.js → invokeMain('message','mod:install', {path})
  ↓
main.js
  - 解压到 temp
  - 读取并校验 manifest.json
  - 校验 resources（size/sha256）
  - 校验 signature.sig（RSA-SHA256 等）
  - 写入 registry.json，落盘到 mod/plugins/<id>
  - 广播 mod:changed
  ↓
mod.js 收到 mod:changed → scheduleReload
  ↓
mod.js → _loadAll → spawn Worker → 插件 ready → init 下发
```

相关实现：[main.js:mod:install handler](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/main.js) ，[mod.js:_loadAll/_spawnWorker](file:///c:/Users/HiteVision%20station/Documents/LanStart/LanStartWrite/src/mod.js#L174-L373)。

## 5. 关键设计决策与 Trade-off

### 5.1 Canvas 2D 作为绘制引擎

- 选择理由：API 成熟、调试成本低、满足手写/标注的主要需求。
- 权衡：复杂特效与超大画面在极端场景可能受限于单线程与重绘成本；需要配合分段绘制、采样与缓存策略控制性能。

### 5.2 事件总线（Message）解耦 UI 与内核

- 选择理由：降低模块间耦合度，便于模式切换、插件接入与测试。
- 权衡：过度事件化会增加链路可观测性成本；需要在关键事件上保持命名规范与追踪手段。

### 5.3 插件以 Worker 运行并做权限裁剪

- 选择理由：隔离插件执行环境，降低阻塞 UI 的风险；可基于 manifest 权限禁用 fetch/WebSocket 等能力。
- 权衡：Worker 与主线程通信需要序列化；复杂 UI 扩展需要通过宿主提供的注册点实现，而不是直接操控宿主内部状态。

## 6. 性能优化方案

- 绘制性能：对超长笔画做下采样；撤销栈上限；必要时采用离屏缓存或分层绘制（由 renderer.js 策略决定）。
- UI 性能：拖拽过程对重排做节流（如 TOOLBAR_MOVE 16ms 节流）；菜单测量使用 visibility=hidden 避免布局抖动。
- IPC 性能：批注模式交互矩形同步按帧合并，避免 UI 高频操作导致 IPC 泛洪。
- 插件性能：渲染进程加载插件设置预算（mod.js budgetMs=480），避免启动期卡顿；增量重载使用定时合并（scheduleReload=80ms）。

## 7. 扩展性设计

- 新工具/新模式：通过 message 事件与 ui-tools 的按钮入口扩展，或通过插件注册 Tool/Mode 实现。
- 新业务面板：推荐复用 Overlay/Modal 模式并纳入交互矩形收集，保证批注模式可用性。
- 插件生态：manifest 声明 + 权限系统 + registry 顺序管理 + Worker 生命周期统一管理。

