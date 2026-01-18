// 开发者工具主程序
const DeveloperToolsAPI = require('./control-api.js');
const UIRenderer = require('./ui-renderer.js');

let api = null;
let renderer = null;
let devWindow = null;

Mod.on('init', (ctx) => {
  const pluginId = (ctx && ctx.pluginId) || 'developer-tools';
  
  // 初始化API和渲染器
  api = new DeveloperToolsAPI();
  renderer = new UIRenderer();
  
  // 注册工具按钮到功能库
  Mod.registerTool({ 
    id: 'developer-tools', 
    title: '开发者工具',
    icon: '🔧',
    description: '应用界面与控件调用工具'
  });
  
  // 注册开发者模式
  Mod.registerMode({
    id: 'developerMode',
    title: '开发者模式',
    ui: {
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600">开发者模式已激活</div>
        <div style="font-size:12px;opacity:0.85">可以调用应用所有界面与控件</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button data-mod-plugin="${pluginId}" data-mod-action="open-dev-tools" class="mode-btn">打开开发者工具</button>
          <button data-mod-plugin="${pluginId}" data-mod-action="inspect-controls" class="mode-btn">检查控件</button>
          <button data-mod-plugin="${pluginId}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    }
  });
  
  // 订阅相关事件
  Mod.subscribe('app:window:created');
  Mod.subscribe('app:window:closed');
  Mod.subscribe('app:control:event');
  Mod.subscribe('app:state:changed');
  
  console.log('[Developer Tools] 插件初始化完成');
});

Mod.on('tool', (e) => {
  const toolId = e && e.toolId;
  if (toolId !== 'developer-tools') return;
  
  // 显示开发者工具覆盖层
  Mod.showOverlay({
    kind: 'html',
    html: `<div style="display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:600">开发者工具</div>
      <div style="font-size:12px;opacity:0.85">Fluent风格的开发者工具界面</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button data-mod-plugin="developer-tools" data-mod-action="open-window" class="mode-btn">打开工具窗口</button>
        <button data-mod-plugin="developer-tools" data-mod-action="inspect-mode" class="mode-btn">检查模式</button>
        <button data-mod-plugin="developer-tools" data-mod-action="close" class="mode-btn">关闭</button>
      </div>
    </div>`
  });
});

Mod.on('ui', (e) => {
  const action = e && e.action;
  const pluginId = e && e.pluginId;
  
  if (pluginId !== 'developer-tools') return;
  
  switch (action) {
    case 'close':
      Mod.closeOverlay();
      break;
      
    case 'open-window':
      openDeveloperWindow();
      Mod.closeOverlay();
      break;
      
    case 'inspect-mode':
      startInspectMode();
      Mod.closeOverlay();
      break;
      
    case 'open-dev-tools':
      openDeveloperWindow();
      break;
      
    case 'inspect-controls':
      startInspectMode();
      break;
  }
});

Mod.on('bus', (e) => {
  const topic = e && e.topic;
  const payload = e && e.payload;
  
  switch (topic) {
    case 'app:window:created':
      console.log('[Developer Tools] 窗口创建:', payload);
      updateWindowList();
      break;
      
    case 'app:window:closed':
      console.log('[Developer Tools] 窗口关闭:', payload);
      updateWindowList();
      break;
      
    case 'app:control:event':
      console.log('[Developer Tools] 控件事件:', payload);
      handleControlEvent(payload);
      break;
      
    case 'app:state:changed':
      console.log('[Developer Tools] 应用状态改变:', payload);
      updateAppState();
      break;
  }
});

// 打开开发者工具窗口
function openDeveloperWindow() {
  if (devWindow && !devWindow.isDestroyed()) {
    devWindow.focus();
    return;
  }
  
  try {
    // 创建Fluent风格的窗口
    devWindow = renderer.createFluentWindow({
      width: 900,
      height: 700,
      title: '开发者工具 - LanStart',
      alwaysOnTop: true
    });
    
    // 加载HTML内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>开发者工具</title>
        <style>
          ${getFluentStyles()}
        </style>
      </head>
      <body>
        ${renderer.renderMainView()}
        <script>
          ${getWindowFunctions()}
        </script>
      </body>
      </html>
    `;
    
    devWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    
    devWindow.on('closed', () => {
      devWindow = null;
    });
    
    console.log('[Developer Tools] 开发者工具窗口已打开');
    
  } catch (error) {
    console.error('[Developer Tools] 创建窗口失败:', error);
    Mod.showNotification({
      title: '开发者工具',
      body: '创建工具窗口失败: ' + error.message
    });
  }
}

// 开始检查模式
function startInspectMode() {
  Mod.publish('app:inspect:start', {
    mode: 'control',
    timestamp: Date.now()
  });
  
  Mod.showNotification({
    title: '开发者工具',
    body: '检查模式已启动，点击任意控件查看详情'
  });
}

// 更新窗口列表
function updateWindowList() {
  if (!devWindow || devWindow.isDestroyed()) return;
  
  const windows = api.getAllWindows();
  devWindow.webContents.send('window-list-updated', windows);
}

// 处理控件事件
function handleControlEvent(event) {
  if (!devWindow || devWindow.isDestroyed()) return;
  
  devWindow.webContents.send('control-event', event);
}

// 更新应用状态
function updateAppState() {
  if (!devWindow || devWindow.isDestroyed()) return;
  
  const state = api.getAppState();
  devWindow.webContents.send('app-state-updated', state);
}

// 获取Fluent样式
function getFluentStyles() {
  return `
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
      margin-right: 8px;
      margin-bottom: 8px;
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
      width: 100%;
      margin-bottom: 8px;
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

    .tab-content {
      animation: fluent-fade-in 0.3s ease-out;
    }

    @keyframes fluent-fade-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

// 获取窗口函数
function getWindowFunctions() {
  return `
    let selectedControl = null;
    let selectedWindow = null;

    function closeWindow() {
      window.close();
    }

    function minimizeWindow() {
      require('electron').remote.getCurrentWindow().minimize();
    }

    function switchTab(tabName) {
      // 隐藏所有标签内容
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
      });
      
      // 移除所有标签的激活状态
      document.querySelectorAll('.fluent-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // 显示选中的标签内容
      document.getElementById(tabName + '-tab').style.display = 'block';
      
      // 激活选中的标签
      event.target.classList.add('active');
      
      // 根据标签加载相应数据
      switch(tabName) {
        case 'controls':
          loadControls();
          break;
        case 'windows':
          loadWindows();
          break;
        case 'state':
          loadAppState();
          break;
      }
    }

    function loadControls() {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('get-controls');
    }

    function loadWindows() {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('get-windows');
    }

    function loadAppState() {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('get-app-state');
    }

    function refreshControls() {
      loadControls();
    }

    function refreshWindows() {
      loadWindows();
    }

    function refreshState() {
      loadAppState();
    }

    function simulateClick() {
      if (!selectedControl) {
        alert('请先选择一个控件');
        return;
      }
      
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('simulate-control-click', {
        controlId: selectedControl,
        windowId: selectedWindow
      });
    }

    function focusWindow() {
      if (!selectedWindow) {
        alert('请先选择一个窗口');
        return;
      }
      
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('focus-window', selectedWindow);
    }

    function executeScript() {
      const script = document.getElementById('script-input').value;
      if (!script.trim()) {
        alert('请输入脚本代码');
        return;
      }
      
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('execute-script', script);
    }

    function clearScript() {
      document.getElementById('script-input').value = '';
      document.getElementById('script-output').innerHTML = '';
    }

    function exportState() {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('export-state');
    }

    // 监听IPC消息
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('controls-data', (event, controls) => {
      const tree = document.getElementById('controls-tree');
      tree.innerHTML = renderControlsTree(controls);
    });
    
    ipcRenderer.on('windows-data', (event, windows) => {
      const list = document.getElementById('windows-list');
      list.innerHTML = renderWindowsList(windows);
    });
    
    ipcRenderer.on('app-state-data', (event, state) => {
      const stateDiv = document.getElementById('app-state');
      stateDiv.textContent = JSON.stringify(state, null, 2);
    });
    
    ipcRenderer.on('script-result', (event, result) => {
      const output = document.getElementById('script-output');
      output.innerHTML += '<div style="margin-bottom: 8px;">' + result + '</div>';
      output.scrollTop = output.scrollHeight;
    });

    function renderControlsTree(controls) {
      if (!controls || controls.length === 0) {
        return '<div style="color: var(--fluent-text-secondary);">暂无控件数据</div>';
      }
      
      let html = '';
      controls.forEach(control => {
        html += '<div class="fluent-tree-item" onclick="selectControl(\\'' + control.id + '\\', event)">';
        html += '<span>🎛️</span>';
        html += '<span>' + (control.name || control.id) + '</span>';
        html += '</div>';
      });
      return html;
    }

    function renderWindowsList(windows) {
      if (!windows || windows.length === 0) {
        return '<div style="color: var(--fluent-text-secondary);">暂无窗口数据</div>';
      }
      
      let html = '';
      windows.forEach(window => {
        html += '<div class="fluent-tree-item" onclick="selectWindow(\\'' + window.id + '\\', event)">';
        html += '<span>🪟</span>';
        html += '<span>' + (window.title || window.id) + '</span>';
        html += '</div>';
      });
      return html;
    }

    function selectControl(controlId, event) {
      selectedControl = controlId;
      
      // 更新选中状态
      document.querySelectorAll('.fluent-tree-item').forEach(item => {
        item.classList.remove('selected');
      });
      event.target.classList.add('selected');
    }

    function selectWindow(windowId, event) {
      selectedWindow = windowId;
      
      // 更新选中状态
      document.querySelectorAll('.fluent-tree-item').forEach(item => {
        item.classList.remove('selected');
      });
      event.target.classList.add('selected');
    }

    // 初始化加载
    document.addEventListener('DOMContentLoaded', function() {
      loadControls();
    });
  `;
}

// 插件卸载时清理资源
Mod.on('unload', () => {
  if (devWindow && !devWindow.isDestroyed()) {
    devWindow.close();
  }
  
  if (api) {
    api = null;
  }
  
  if (renderer) {
    renderer.destroy();
  }
  
  console.log('[Developer Tools] 插件已卸载');
});

console.log('[Developer Tools] 开发者工具插件已加载');