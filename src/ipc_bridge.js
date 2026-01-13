/**
 * ipc_bridge.js
 *
 * 渲染进程内的 IPC 桥：将 Message 总线上的特定事件转发到主进程处理。
 *
 * 背景：
 * - 渲染进程应避免直接访问 Node.js 文件系统能力（安全/权限边界）
 * - 通过 electronAPI.invokeMain('message', ...) 走主进程白名单通道
 */
import Message, { EVENTS } from './message.js';

/**
 * 转发文件写入请求到主进程，并将结果回灌到 Message 总线。
 * 事件链路：
 * - 渲染进程：Message.emit(EVENTS.REQUEST_FILE_WRITE, { path, content })
 * - 本桥接：invokeMain('message','io:request-file-write', payload)
 * - 主进程：ipcMain.handle('message', ...) 执行写入并返回结果
 * - 本桥接：Message.emit('io:request-file-write:result', res)
 */
Message.on(EVENTS.REQUEST_FILE_WRITE, async (payload)=>{
  try{
    if (window && window.electronAPI && typeof window.electronAPI.invokeMain === 'function'){
      const res = await window.electronAPI.invokeMain('message', 'io:request-file-write', payload);
      try{ Message.emit('io:request-file-write:result', res); }catch(e){}
    } else {
      console.warn('ipc_bridge: electronAPI.invokeMain not available');
    }
  }catch(e){ console.warn('ipc_bridge forward failed', e); }
});

/**
 * 转发 PPT 相关操作到主进程
 */
Message.on(EVENTS.PPT_GOTO_PAGE, (payload) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'ppt:goto-page', payload);
  }
});

Message.on(EVENTS.PPT_EXIT, () => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'ppt:exit');
  }
});

/**
 * 转发 PPT 相关状态同步到主进程
 */
Message.on(EVENTS.PPT_SYNC_STATE, (payload) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'ppt:sync-state', payload);
  }
});

/**
 * 监听主进程发送的 PPT 状态同步
 */
if (window.electronAPI && window.electronAPI.onReplyFromMain) {
  window.electronAPI.onReplyFromMain('ppt:sync-state', (data) => {
    try { Message.emit(EVENTS.PPT_SYNC_STATE, data); } catch(e) {}
  });
}

/**
 * 转发 VSTO 相关操作到主进程
 */
Message.on(EVENTS.VSTO_TOGGLE_SERVICE, (enabled) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'vsto:toggle-service', enabled);
  }
});

Message.on(EVENTS.VSTO_GOTO_PAGE, (payload) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'vsto:goto-page', payload);
  }
});

/**
 * 监听主进程发送的 VSTO 状态与同步
 */
if (window.electronAPI && window.electronAPI.onReplyFromMain) {
  window.electronAPI.onReplyFromMain('vsto:status-changed', (data) => {
    try { Message.emit(EVENTS.VSTO_STATUS_CHANGED, data); } catch(e) {}
  });
  window.electronAPI.onReplyFromMain('vsto:sync-state', (data) => {
    try { Message.emit(EVENTS.VSTO_SYNC_STATE, data); } catch(e) {}
  });
  window.electronAPI.onReplyFromMain('com:status-changed', (data) => {
    try { Message.emit(EVENTS.COM_STATUS_CHANGED, data); } catch(e) {}
  });
  window.electronAPI.onReplyFromMain('com:sync-state', (data) => {
    try { Message.emit(EVENTS.COM_SYNC_STATE, data); } catch(e) {}
  });
}

/**
 * 转发 COM 相关操作到主进程
 */
Message.on(EVENTS.COM_TOGGLE_SERVICE, (enabled) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'com:toggle-service', enabled);
  }
});

Message.on(EVENTS.COM_GOTO_PAGE, (payload) => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    window.electronAPI.invokeMain('message', 'com:goto-page', payload);
  }
});

/**
 * COM 状态获取请求
 */
Message.on('com:request-status', async () => {
  if (window.electronAPI && window.electronAPI.invokeMain) {
    const res = await window.electronAPI.invokeMain('message', 'com:get-status');
    Message.emit('com:get-status:result', res);
  }
});

/**
 * 说明：
 * - SETTINGS_CHANGED 事件不在此处转发，渲染进程内模块已直接订阅处理
 */
export default {};
