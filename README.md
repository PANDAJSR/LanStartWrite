# LanStartWrite buggy edition

新一代书写体验

注意！该版本为激进式快照版本，允许所有人提交代码，拥有更多的功能，更快的更新，以及更不稳定的体验。

LanStartWrite 基于 Electron 的书写应用 采用vibe coding

## ✨ 核心特性

### 🎨 流畅书写体验
- **高性能画布**：基于 Canvas 2D 的平滑绘制，支持压感和速度优化
- **智能墨迹识别**：自动识别直线、圆形、矩形、三角形等几何图形
- **多种笔刷工具**：可调节大小和颜色的画笔，满足不同书写需求
- **智能橡皮擦**：支持像素擦除、笔画擦除、矩形区域擦除三种模式
- **多点触控支持**：支持同时多笔绘制，提升交互效率

### 🌓 个性化定制
- **主题系统**：支持浅色/深色主题切换
- **画布颜色**：白色、黑色、黑板绿三种背景选择
- **智能笔色**：根据背景自动切换笔色，确保最佳对比度
- **视觉风格**：实心、模糊、透明三种面板样式
- **可拖拽工具栏**：自由调整工具栏位置，适应不同使用场景

### 📚 多页管理
- **无限页面**：支持创建多个页面，自由切换
- **快照保存**：自动保存每页内容，切换页面无缝衔接
- **快速导航**：上一页/下一页/新建页面，操作便捷

### 🔧 强大插件系统
- **插件架构**：支持 `.lanmod` 格式插件
- **安全验证**：数字签名验证，确保插件安全
- **依赖管理**：自动处理插件依赖关系
- **UI 扩展**：支持工具栏、模式、覆盖层等界面扩展
- **热加载**：插件安装/卸载无需重启应用

### 🎯 双模式支持
- **白板模式**：自由创作，支持多页管理
- **批注模式**：覆盖在其他应用上进行标注
- **透明窗口**：批注模式下可设置穿透，不影响底层应用操作

### 💾 完整历史记录
- **撤销/重做**：支持多达 30 步历史记录
- **智能快照**：自动保存关键状态，防止意外丢失
- **内存优化**：对超长笔画进行下采样，节省内存占用

## 🚀 快速开始

### 环境要求
- Node.js 16+ 
- npm 或 yarn
- Windows / macOS / Linux

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/yourusername/LanStartWrite.git
cd LanStartWrite

# 安装依赖
npm install

# 启动应用
npm start
```

### 开发模式

```bash
# 开发模式启动（自动打开开发者工具）
npm run dev
```

## 📖 使用指南

### 基础操作

#### 书写与绘制
1. 选择画笔工具
2. 调整笔刷大小和颜色
3. 在画布上自由绘制
4. 智能墨迹识别会自动优化您的笔迹

#### 橡皮擦使用
- **像素擦除**：精确擦除单个像素
- **笔画擦除**：点击或拖动擦除整条笔画
- **矩形擦除**：框选区域批量擦除

#### 页面管理
- 点击底部工具栏的 `‹` 和 `›` 按钮切换页面
- 点击 `+ 新建` 创建新页面
- 页码显示当前页码和总页数

### 高级功能

#### 智能墨迹识别
启用后，您的手绘图形会自动识别为标准几何图形：
- 直线：自动拉直
- 圆形：自动优化为标准圆
- 矩形：自动修正为标准矩形
- 三角形：自动识别并优化

#### 笔色自动切换
切换画布背景时，笔色会自动调整：
- 白色背景 → 黑色笔
- 黑色背景 → 白色笔
- 黑板绿 → 白色笔

历史笔迹也会自动重新映射，确保在新背景下清晰可见。

#### 批注模式
1. 切换到批注模式
2. 应用变为透明覆盖层
3. 在其他应用上进行标注
4. 可设置鼠标穿透，不影响底层操作

#### 插件安装
1. 打开设置面板
2. 进入插件管理
3. 拖拽 `.lanmod` 文件到安装区域
4. 等待安装完成
5. 启用插件即可使用

## 🛠️ 技术架构

### 核心技术
- **Electron 26.0.0**：跨平台桌面应用框架
- **Canvas 2D**：高性能绘图引擎
- **ES Modules**：模块化 JavaScript
- **IPC 通信**：主进程与渲染进程通信
- **事件总线**：模块间解耦通信

### 项目结构
```
LanStartWrite/
├── src/                    # 源代码
│   ├── main.js            # 主进程入口
│   ├── renderer.js        # 渲染进程核心逻辑
│   ├── pen.js             # 笔刷工具
│   ├── erese.js           # 橡皮擦工具
│   ├── page.js            # 页面管理
│   ├── setting.js         # 设置管理
│   ├── ui-bootstrap.js    # UI 启动
│   ├── ui-tools.js        # UI 工具
│   └── message.js         # 事件总线
├── mod/                    # 插件系统
│   ├── plugins/           # 插件目录
│   ├── config/            # 配置文件
│   └── temp/              # 临时文件
├── aisay/                 # 文档
└── package.json           # 项目配置
```

### 插件开发

#### 插件清单 (manifest.json)
```json
{
  "schemaVersion": 1,
  "id": "my-plugin",
  "version": "1.0.0",
  "type": "feature",
  "name": "我的插件",
  "description": "插件描述",
  "author": "作者名",
  "permissions": ["ui:toolbar", "bus:cross"],
  "entry": {
    "kind": "worker",
    "path": "main.js"
  },
  "resources": [
    {
      "path": "icon.svg",
      "sha256": "...",
      "size": 1024
    }
  ]
}
```

#### 插件类型
- **control-replace**：替换现有控件
- **mode**：添加新模式
- **feature**：添加新功能

#### 权限系统
- `ui:toolbar` - 工具栏访问
- `ui:mode` - 模式切换
- `ui:overlay` - 覆盖层访问
- `ui:override` - UI 覆盖
- `bus:cross` - 事件总线访问
- `net:fetch` - 网络请求

## 🎨 界面预览

### 主界面
- 全屏画布，最大化书写空间
- 右侧浮动工具栏，可拖拽可折叠
- 底部页面导航，快速切换页面
- 智能墨迹识别提示，实时反馈

### 工具栏
- 笔刷工具（颜色选择、大小调节）
- 橡皮擦工具（三种模式切换）
- 撤销/重做按钮
- 清空画布
- 设置入口

### 设置面板
- 主题切换（浅色/深色）
- 画布颜色选择
- 视觉风格调整
- 插件管理
- 快捷键设置

## 🧭 UI 交互规范（触摸/鼠标混合）

### 输入来源判定
- 支持 mouse/touch/pen 三类指针来源
- 触摸/触控笔输入优先维持交互窗口响应，避免穿透
- 鼠标输入维持原有 hover/点击逻辑，不改变按钮行为

### 触摸点击逻辑
- 触摸点击使用独立 tap 识别流程，避免 300ms 延迟与误触
- 通过位移阈值区分点击/拖动，默认阈值 8px
- 触摸触发 tap 后 400ms 内阻断浏览器合成 click，避免重复触发

### 混合输入切换策略
- 近期触摸/触控笔输入触发窗口可交互区域强制开启
- 触摸设备且近期未检测到鼠标移动时，保持 UI 区域可交互
- 最近 1.2s 内鼠标移动判定为鼠标活跃，恢复穿透策略

### 窗口重叠响应
- 批注模式下同步交互矩形到主进程
- 主进程依据交互矩形决定是否转发鼠标事件
- 鼠标落在工具栏/子菜单/弹窗区域时允许交互，其余区域穿透至下层应用

### 关键时序参数
- 触摸 tap 延迟补齐：0ms（可通过 bindTouchTap 参数覆盖）
- 触摸 tap 判定位移阈值：8px
- 触摸触发 click 屏蔽窗口：400ms
- 交互矩形同步节流：按帧合并
- 鼠标穿透判定轮询：40ms
- 触摸 UI block 释放延迟：120ms

## 🧩 穿透模块（Operar_Penetration）

### API
- 构造：new OperarPenetration({ appModes, getAppMode, isPointerActive, sendToMain, selectors, extendInteractiveRects, debug })
- 输入状态：recordPointerInput(type), getActiveInputType(), markTouchAction(), getLastTouchActionAt(), shouldSuppressClick()
- 触摸拦截：beginTouchUiBlock(e), endTouchUiBlock(e), forceReleaseTouchUiBlock()
- IPC 同步：sendIgnoreMouse(ignore, forward), sendInteractiveRects(rects)
- 交互矩形：collectInteractiveRects(force), scheduleInteractiveRectsUpdate(), flushInteractiveRects()
- 穿透策略：applyWindowInteractivity(forceIgnore), applyWindowInteractivityNow(forceIgnore)
- 事件绑定：bindGlobalListeners()

### 使用说明
- 渲染进程引入 Operar_Penetration.js 并创建单例
- 初始化后调用 bindGlobalListeners 绑定全局输入监听
- 菜单/弹窗/工具栏状态变化时调用 applyWindowInteractivity 与 scheduleInteractiveRectsUpdate
- 触摸 tap 触发后调用 markTouchAction，并在 click 捕获阶段用 shouldSuppressClick 抑制合成 click
- 通过 selectors 和 extendInteractiveRects 扩展可交互区域

### 迁移指南
- 将分散的 sendIgnoreMouse、collectInteractiveRects、applyWindowInteractivity 调用收敛到模块
- 用 markTouchAction 替代对 _lastTouchActionAt 的直接写入
- 维持 IPC 通道名 overlay:set-ignore-mouse 与 overlay:set-interactive-rects 不变
- 将输入类型识别统一交由 recordPointerInput 与 bindGlobalListeners

## 🧪 测试报告与性能指标（浮动工具栏输入）

### 自动化测试结果
- 测试命令：npm test
- 结果：运行结束后记录（见下方“执行结果”）

### 手动场景覆盖
- 纯触摸：未在当前环境执行（需具备触摸屏设备）
- 纯鼠标：已覆盖（点击、拖拽、菜单打开/关闭）
- 混合输入：未在当前环境执行（需同时连接触摸屏与鼠标）
- 窗口重叠：已覆盖（工具栏上层交互可用，下层窗口可穿透）

### 性能指标数据
- UI 交互矩形同步：按帧合并（最大 1 次/帧）
- 鼠标穿透轮询间隔：40ms
- 触摸事件到交互恢复：120ms
- 指针输入判定窗口：1.2s（鼠标活跃判定）

### 执行结果
- npm test：通过（2026-01-20）

## 📘 用户操作手册更新内容

### 触摸操作
- 轻触按钮触发点击，避免大幅拖动以防误判为拖拽
- 触摸后 400ms 内若误触鼠标点击，会被系统忽略以防重复触发

### 鼠标操作
- 鼠标点击维持原有交互逻辑
- 拖动工具栏请使用拖拽手柄区域

### 混合输入建议
- 触摸后若立即使用鼠标，请稍等 0.4s 再点击以确保事件不被抑制
- 在触摸屏设备上，建议先完成触摸操作，再切换鼠标精细调整

### 窗口重叠场景
- 工具栏、子菜单、设置弹窗区域始终可交互
- 其余区域将穿透至下层应用，避免遮挡正常操作

## 🔧 配置说明

### 默认设置
```javascript
{
  toolbarCollapsed: false,
  enableAutoResize: true,
  toolbarPosition: { right: 20, top: 80 },
  theme: 'light',
  showTooltips: true,
  multiTouchPen: false,
  smartInkRecognition: false,
  annotationPenColor: '#FF0000',
  whiteboardPenColor: '#000000',
  visualStyle: 'blur',
  canvasColor: 'white',
  shortcuts: { undo: 'Ctrl+Z', redo: 'Ctrl+Y' }
}
```

### 环境变量
- `LANSTART_MOD_ROOT` - 插件根目录
- `LANSTART_MOD_PUBKEY_PEM` - 插件公钥
- `LANSTART_ALLOW_UNSIGNED` - 允许未签名插件（仅开发）

## 📝 开发文档

项目包含完整的开发文档，位于 `aisay/` 目录：

- [快速开始指南](aisay/QUICK_START.md) - 5 分钟快速入门
- [通信指南](aisay/COMMUNICATION.md) - 完整通信系统文档
- [API 参考](aisay/COMMUNICATION_QUICK_REF.md) - API 速查表
- [集成指南](aisay/INTEGRATION_GUIDE.md) - 项目集成说明
- [代码示例](communication-examples.js) - 8 个完整示例
- [实现总结](aisay/IMPLEMENTATION_SUMMARY.md) - 技术实现细节

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 贡献流程
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 ES6+ 语法
- 遵循现有代码风格
- 添加必要的注释
- 编写测试用例

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

**LanStartWrite** - 新一代书写体验
