# 浮动工具栏

该模块实现主窗口“浮动工具栏”的 UI、交互与状态管理。

## 核心功能

- 快速操作按钮：新建窗口、设置、退出、置顶切换、折叠/展开
- 上下文信息：展示后端事件流（用于调试与状态观察）
- 交互：可拖动（Drag 区域）、可折叠/展开、支持 Mica/Backdrop（由主进程配置）

## 目录结构

- `index.ts`：模块入口导出
- `FloatingToolbar.tsx`：主组件与状态 Provider
- `components/`：工具栏内部组件
- `hooks/`：与后端通信、事件轮询、持久化状态等 hooks
- `styles/`：工具栏样式

## 状态管理

状态采用 React Context + 持久化：

- Key：`toolbar-state`（存储在 LevelDB，由 Elysia `/kv/:key` 提供）
- 字段：
  - `collapsed`：是否折叠
  - `alwaysOnTop`：是否置顶（由主进程执行）

## 与后端通信

- `POST /commands`：发送指令（如 `create-window`, `set-toolbar-always-on-top`, `quit`）
- `GET /events`：轮询事件列表用于显示与调试
- `GET/PUT /kv/:key`：状态持久化

## 使用方式（渲染进程）

```tsx
import { FloatingToolbarApp } from '../../toolbar'

export default function App() {
  return <FloatingToolbarApp />
}
```

