# Ink Enhancer 插件安装说明

## 概述

Ink Enhancer 插件为 LanStartWrite 提供书写体验增强功能：
1. 基于书写速度的动态笔锋效果 - 线条粗细根据书写速度智能调整
2. 低延迟渲染优化 - 减少笔触输入到屏幕显示之间的延迟

## 安装步骤

### 方法一：通过开发者工具加载（推荐）

1. 启动 LanStartWrite 应用程序
2. 按 `Ctrl+Shift+I`（或 `F12`）打开开发者工具
3. 切换到 "Console"（控制台）标签页
4. 复制以下代码并粘贴到控制台中：

```javascript
fetch('mod/plugins/ink-enhancer/enhancer-api.js')
  .then(response => response.text())
  .then(code => {
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
    console.log('Ink Enhancer API 加载成功');
  })
  .catch(error => console.error('加载失败:', error));
```

5. 按回车键执行代码
6. 在控制台中应该看到 "Ink Enhancer API 加载成功" 的消息

### 方法二：修改主应用代码（高级用户）

如果您希望每次启动时自动加载增强功能，可以修改主应用代码：

1. 打开 `src/index.html` 文件
2. 在 `</head>` 标签之前添加以下代码：

```html
<script src="mod/plugins/ink-enhancer/enhancer-api.js"></script>
```

3. 保存文件并重新构建应用程序

## 使用方法

### 启用增强功能

加载 API 后，您可以通过以下方式控制增强功能：

```javascript
// 启用增强功能
window._inkEnhancerApi.setEnabled(true);

// 启用增强渲染（动态笔锋效果）
window._inkEnhancerApi.setUseEnhancedRendering(true);

// 禁用增强功能
window._inkEnhancerApi.setEnabled(false);

// 禁用增强渲染
window._inkEnhancerApi.setUseEnhancedRendering(false);
```

### 检查状态

```javascript
// 检查增强功能是否启用
window._inkEnhancerApi.isEnabled();

// 检查增强渲染是否启用
window._inkEnhancerApi.isEnhancedRenderingEnabled();
```

## 功能说明

### 动态笔锋效果

- 当书写速度较慢时，线条会变粗，模拟真实笔触的压感效果
- 当书写速度较快时，线条会变细，保持书写的流畅性
- 线条粗细变化范围：基础粗细的 40% - 160%
- 使用平滑算法确保线条过渡自然

### 低延迟渲染优化

- 使用 requestAnimationFrame 优化渲染时机
- 批量处理绘制指令，减少渲染开销
- 自适应渲染频率，平衡性能和流畅度

## 技术细节

### 插件架构

- **main.js**: 运行在 Worker 环境中，提供增强算法
- **enhancer-api.js**: 运行在渲染进程中，集成到主应用
- **inject.js**: 已弃用（插件系统不支持自动注入）

### 事件通信

插件通过 Mod 事件总线与主应用通信：
- `ink-enhancer/start-stroke`: 笔画开始
- `ink-enhancer/move-stroke`: 笔画移动
- `ink-enhancer/end-stroke`: 笔画结束
- `ink-enhancer/enhance-stroke`: 增强笔画数据
- `ink-enhancer/stroke-segments`: 增强的笔画段
- `ink-enhancer/stroke-finalized`: 笔画完成
- `ink-enhancer/stroke-enhanced`: 增强后的笔画数据

## 故障排除

### 增强功能未生效

1. 检查控制台是否有错误消息
2. 确认 `window._inkEnhancerApi` 对象是否存在
3. 确认增强功能已启用：`window._inkEnhancerApi.setEnabled(true)`
4. 确认增强渲染已启用：`window._inkEnhancerApi.setUseEnhancedRendering(true)`

### 加载失败

1. 确认文件路径正确：`mod/plugins/ink-enhancer/enhancer-api.js`
2. 检查文件是否存在
3. 查看控制台错误消息

## 性能建议

- 对于高分辨率屏幕，建议适当降低设备像素比以提升性能
- 如果遇到卡顿，可以禁用增强渲染功能
- 增强功能会增加少量计算开销，但在现代设备上影响很小

## 版本信息

- 版本：1.0.0
- 作者：LanStart
- 兼容性：LanStartWrite v26.0.0+

## 反馈与支持

如有问题或建议，请联系开发团队。
