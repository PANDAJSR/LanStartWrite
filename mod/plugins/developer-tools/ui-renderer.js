class UIRenderer {
  constructor() {
    this.window = null;
    this.isAlwaysOnTop = true;
    this.currentView = 'main';
  }

  // 创建Fluent风格的窗口
  createFluentWindow(options = {}) {
    const defaultOptions = {
      width: 800,
      height: 600,
      title: '开发者工具',
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    };

    const windowOptions = { ...defaultOptions, ...options };
    
    // 创建窗口
    this.window = Mod.createWindow(windowOptions);
    
    // 设置窗口样式
    this.setupFluentStyling();
    
    return this.window;
  }

  // 设置Fluent风格样式
  setupFluentStyling() {
    const fluentCSS = `
      /* Fluent Design System Styles */
      :root {
        --fluent-accent: #0078d4;
        --fluent-accent-light: #106ebe;
        --fluent-accent-dark: #005a9e;
        --fluent-background: rgba(32, 32, 32, 0.8);
        --fluent-surface: rgba(45, 45, 45, 0.9);
        --fluent-card: rgba(55, 55, 55, 0.95);
        --fluent-text: #ffffff;
        --fluent-text-secondary: #b3b3b3;
        --fluent-border: rgba(255, 255, 255, 0.1);
        --fluent-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        --fluent-blur: blur(20px);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: var(--fluent-background);
        backdrop-filter: var(--fluent-blur);
        color: var(--fluent-text);
        overflow: hidden;
        user-select: none;
      }

      .fluent-window {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--fluent-border);
        box-shadow: var(--fluent-shadow);
      }

      .fluent-titlebar {
        height: 32px;
        background: var(--fluent-surface);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        border-bottom: 1px solid var(--fluent-border);
        -webkit-app-region: drag;
      }

      .fluent-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--fluent-text);
      }

      .fluent-controls {
        display: flex;
        gap: 4px;
        -webkit-app-region: no-drag;
      }

      .fluent-control {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--fluent-text-secondary);
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .fluent-control:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--fluent-text);
      }

      .fluent-control:active {
        background: rgba(255, 255, 255, 0.05);
      }

      .fluent-content {
        flex: 1;
        background: var(--fluent-background);
        backdrop-filter: var(--fluent-blur);
        padding: 16px;
        overflow: auto;
      }

      .fluent-card {
        background: var(--fluent-card);
        border: 1px solid var(--fluent-border);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        backdrop-filter: var(--fluent-blur);
      }

      .fluent-button {
        background: var(--fluent-accent);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .fluent-button:hover {
        background: var(--fluent-accent-light);
      }

      .fluent-button:active {
        background: var(--fluent-accent-dark);
      }

      .fluent-button.secondary {
        background: var(--fluent-surface);
        border: 1px solid var(--fluent-border);
      }

      .fluent-button.secondary:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .fluent-input {
        background: var(--fluent-surface);
        border: 1px solid var(--fluent-border);
        color: var(--fluent-text);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        outline: none;
        transition: all 0.2s ease;
      }

      .fluent-input:focus {
        border-color: var(--fluent-accent);
        box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.3);
      }

      .fluent-tree {
        list-style: none;
        padding: 0;
      }

      .fluent-tree-item {
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .fluent-tree-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .fluent-tree-item.selected {
        background: rgba(0, 120, 212, 0.2);
        color: var(--fluent-accent);
      }

      .fluent-tabs {
        display: flex;
        border-bottom: 1px solid var(--fluent-border);
        margin-bottom: 16px;
      }

      .fluent-tab {
        padding: 8px 16px;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        color: var(--fluent-text-secondary);
      }

      .fluent-tab:hover {
        color: var(--fluent-text);
      }

      .fluent-tab.active {
        color: var(--fluent-accent);
        border-bottom-color: var(--fluent-accent);
      }

      .fluent-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .fluent-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }

      .fluent-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }

      .fluent-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;

    // 注入样式
    this.window.webContents.insertCSS(fluentCSS);
  }

  // 渲染主界面
  renderMainView() {
    const html = `
      <div class="fluent-window">
        <div class="fluent-titlebar">
          <div class="fluent-title">开发者工具</div>
          <div class="fluent-controls">
            <button class="fluent-control" onclick="minimizeWindow()">−</button>
            <button class="fluent-control" onclick="closeWindow()">✕</button>
          </div>
        </div>
        <div class="fluent-content fluent-scrollbar">
          <div class="fluent-tabs">
            <div class="fluent-tab active" onclick="switchTab('controls')">控件</div>
            <div class="fluent-tab" onclick="switchTab('windows')">窗口</div>
            <div class="fluent-tab" onclick="switchTab('scripts')">脚本</div>
            <div class="fluent-tab" onclick="switchTab('state')">状态</div>
          </div>
          
          <div id="controls-tab" class="tab-content">
            <div class="fluent-card">
              <h3>应用控件</h3>
              <div id="controls-tree" class="fluent-tree"></div>
              <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button class="fluent-button" onclick="refreshControls()">刷新</button>
                <button class="fluent-button secondary" onclick="simulateClick()">模拟点击</button>
              </div>
            </div>
          </div>

          <div id="windows-tab" class="tab-content" style="display: none;">
            <div class="fluent-card">
              <h3>窗口管理</h3>
              <div id="windows-list" class="fluent-tree"></div>
              <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button class="fluent-button" onclick="refreshWindows()">刷新</button>
                <button class="fluent-button secondary" onclick="focusWindow()">聚焦</button>
                <button class="fluent-button secondary" onclick="closeWindow()">关闭</button>
              </div>
            </div>
          </div>

          <div id="scripts-tab" class="tab-content" style="display: none;">
            <div class="fluent-card">
              <h3>脚本执行</h3>
              <textarea id="script-input" class="fluent-input" placeholder="输入JavaScript代码..." 
                style="width: 100%; height: 200px; margin-bottom: 16px; font-family: monospace;"></textarea>
              <div style="display: flex; gap: 8px;">
                <button class="fluent-button" onclick="executeScript()">执行</button>
                <button class="fluent-button secondary" onclick="clearScript()">清除</button>
              </div>
              <div id="script-output" style="margin-top: 16px; background: var(--fluent-surface); padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto;"></div>
            </div>
          </div>

          <div id="state-tab" class="tab-content" style="display: none;">
            <div class="fluent-card">
              <h3>应用状态</h3>
              <div id="app-state" style="font-family: monospace; font-size: 12px; white-space: pre-wrap;"></div>
              <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button class="fluent-button" onclick="refreshState()">刷新</button>
                <button class="fluent-button secondary" onclick="exportState()">导出</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
  }

  // 获取当前窗口
  getWindow() {
    return this.window;
  }

  // 设置置顶状态
  setAlwaysOnTop(alwaysOnTop) {
    this.isAlwaysOnTop = alwaysOnTop;
    if (this.window) {
      this.window.setAlwaysOnTop(alwaysOnTop);
    }
  }

  // 销毁窗口
  destroy() {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }
}

module.exports = UIRenderer;