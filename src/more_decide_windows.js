/**
 * more_decide_windows.js
 *
 * 子菜单（画笔/橡皮/更多）定位、打开/关闭、固定（Pinned）与拖拽移动逻辑。
 *
 * 核心算法：
 * - 未固定：submenu 使用 absolute 定位在 .floating-panel 内部，随工具栏移动
 * - 已固定：submenu 使用 fixed 定位在视口/画布坐标中，允许独立拖拽
 * - 智能上下摆放：根据画布可用空间，在工具栏上方/下方自动选择
 *
 * 事件：
 * - 通过 Message 总线广播 SUBMENU_OPEN / SUBMENU_CLOSE / SUBMENU_PIN / SUBMENU_MOVE
 * - 监听 TOOLBAR_MOVE 以在拖拽工具栏时实时重排未固定的 submenu
 */
import Message, { EVENTS } from './message.js';

function _menuDebug(){
  try{
    if (!localStorage || localStorage.getItem('debugMenus') !== '1') return;
  }catch(e){ return; }
  try{ console.debug('[menu]', ...arguments); }catch(e){}
}

function _openerForMenu(menu){
  if (!menu) return null;
  const id = String(menu.id || '');
  if (id === 'colorMenu') return document.getElementById('colorTool');
  if (id === 'eraserMenu') return document.getElementById('eraserTool');
  if (id === 'moreMenu') return document.getElementById('moreTool');
  return null;
}

/**
 * 获取画布的可交互矩形区域（用于菜单定位与拖拽边界）。
 * @returns {{top:number,left:number,right:number,bottom:number,width:number,height:number}}
 */
export function getCanvasRect(){
  const canvasEl = document.getElementById('board');
  if (canvasEl) return canvasEl.getBoundingClientRect();
  return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight };
}

/**
 * 清理菜单的行内样式（用于关闭/切换定位模式时恢复默认）。
 * @param {HTMLElement} menu - submenu 元素
 * @returns {void}
 */
export function cleanupMenuStyles(menu){
  if (!menu) return;
  menu.style.position = '';
  menu.style.left = '';
  menu.style.top = '';
  menu.style.right = '';
  menu.style.bottom = '';
  menu.style.display = '';
  menu.style.flexDirection = '';
  menu.style.flexWrap = '';
  menu.style.maxWidth = '';
}

/**
 * 关闭所有未固定（pinned !== 'true'）的 submenu，并清理按钮 active 状态。
 * @returns {void}
 */
export function closeAllSubmenus(){
  const colorMenu = document.getElementById('colorMenu');
  const eraserMenu = document.getElementById('eraserMenu');
  const moreMenu = document.getElementById('moreMenu');
  const colorTool = document.getElementById('colorTool');
  const eraserTool = document.getElementById('eraserTool');
  const moreTool = document.getElementById('moreTool');
  /**
   * 流程图（关闭所有未固定菜单）：
   * 1. 获取三个 submenu 与三个按钮
   * 2. 对每个 submenu：
   *    - 若处于 open 且 pinned !== 'true'：清理样式 → 移除 open → aria-hidden=true → 广播 SUBMENU_CLOSE
   *    - 若 pinned === 'true'：保持打开（固定菜单应持久存在）
   * 3. 清理三个按钮的 active 状态
   */
  if (colorMenu && colorMenu.classList.contains('open') && colorMenu.dataset.pinned!=='true') { cleanupMenuStyles(colorMenu); colorMenu.classList.remove('open'); colorMenu.setAttribute('aria-hidden','true'); _menuDebug('submenu', 'closeAll', colorMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: colorMenu.id, pinned: false }); }catch(e){} }
  if (eraserMenu && eraserMenu.classList.contains('open') && eraserMenu.dataset.pinned!=='true') { cleanupMenuStyles(eraserMenu); eraserMenu.classList.remove('open'); eraserMenu.setAttribute('aria-hidden','true'); _menuDebug('submenu', 'closeAll', eraserMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: eraserMenu.id, pinned: false }); }catch(e){} }
  if (moreMenu && moreMenu.classList.contains('open') && moreMenu.dataset.pinned!=='true') { cleanupMenuStyles(moreMenu); moreMenu.classList.remove('open'); moreMenu.setAttribute('aria-hidden','true'); _menuDebug('submenu', 'closeAll', moreMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: moreMenu.id, pinned: false }); }catch(e){} }
  if (colorTool) colorTool.classList.remove('active');
  if (eraserTool) eraserTool.classList.remove('active');
  if (moreTool) moreTool.classList.remove('active');
}

/**
 * 将 submenu 定位到合适位置。
 * @param {HTMLElement} menu - submenu 元素
 * @param {HTMLElement} openerEl - 触发 submenu 的按钮元素
 * @param {boolean} pinned - 是否固定（fixed）
 * @returns {void}
 *
 * 算法要点：
 * - 先将 submenu 暂时显示（visibility=hidden）以测量真实尺寸，再计算定位
 * - 未固定：absolute 相对 .floating-panel，随工具栏移动；固定：fixed 相对视口/画布
 * - 垂直方向：优先放上方；若空间不足则放下方；都不足则选择更宽裕的一侧
 * - 水平方向：居中并做边界夹紧，避免溢出画布/父容器
 *
 * 流程图（定位 submenu）：
 * 1. 读取 canvasRect、openerRect
 * 2. 临时显示 submenu 用于测量（open/aria-hidden/visibility=hidden）
 * 3. 分支：
 *    - pinned=false：以 panelRect 为参考，计算上下空间 → 决定 top 与 placement → 计算 left 并夹紧
 *    - pinned=true ：以 openerRect/canvasRect 为参考，计算上下空间 → 决定 top 与 placement → 计算 left 并夹紧
 * 4. 写入 style.left/style.top/style.position，并落 placement 标记
 * 5. 恢复 visibility
 */
export function positionMenu(menu, openerEl, pinned){
  if (!menu || !openerEl) return;
  const canvasRect = getCanvasRect();
  const openerRect = openerEl.getBoundingClientRect();

  /** 临时显示用于测量（避免 display:none 时拿到 0 尺寸） */
  menu.style.visibility = 'hidden';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden','false');
  const mRect = menu.getBoundingClientRect();
  const menuHeight = mRect.height;
  const GAP = 8;

  /** 未固定：absolute 相对 panel；固定：fixed 相对视口/画布 */
  if (!pinned) {
    menu.style.position = 'absolute';
    const panelEl = openerEl.closest && openerEl.closest('.floating-panel') ? openerEl.closest('.floating-panel') : (document.querySelector('.floating-panel') || menu.parentElement);
    const parentRect = panelEl.getBoundingClientRect();
    const panelHeight = panelEl.offsetHeight || 50;
    
    const panelTopInCanvas = parentRect.top - canvasRect.top;
    const panelBottomInCanvas = canvasRect.bottom - parentRect.bottom;
    
    let top;
    let isAbove = true;
    
    const fitsAbove = panelTopInCanvas >= menuHeight + GAP;
    const fitsBelow = panelBottomInCanvas >= menuHeight + GAP;
    
    if (fitsAbove) {
      top = -GAP - menuHeight;
      isAbove = true;
    } else if (fitsBelow) {
      top = panelHeight + GAP;
      isAbove = false;
    } else {
      if (panelTopInCanvas >= panelBottomInCanvas) {
        top = -GAP - menuHeight;
        isAbove = true;
      } else {
        top = panelHeight + GAP;
        isAbove = false;
      }
    }
    
    let left = (parentRect.width - mRect.width) / 2;
    if (left < 6) left = 6;
    
    try{
      const maxLeft = Math.max(6, parentRect.width - mRect.width - 6);
      left = Math.min(Math.max(left, 6), maxLeft);
    }catch(e){}
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.zIndex = 2500;
    menu.dataset.placement = isAbove ? 'above' : 'below';
  } else {
    menu.style.position = 'fixed';
    
    const spaceAbove = openerRect.top - canvasRect.top;
    const spaceBelow = canvasRect.bottom - openerRect.bottom;
    const fitsAbove = spaceAbove >= menuHeight + GAP;
    const fitsBelow = spaceBelow >= menuHeight + GAP;
    
    let top;
    let isAbove = true;
    
    if (fitsAbove) {
      top = openerRect.top - GAP - menuHeight;
      isAbove = true;
    } else if (fitsBelow) {
      top = openerRect.bottom + GAP;
      isAbove = false;
    } else {
      if (spaceAbove >= spaceBelow) {
        top = Math.max(canvasRect.top + 4, openerRect.top - GAP - menuHeight);
        isAbove = true;
      } else {
        top = Math.min(canvasRect.bottom - menuHeight - 4, openerRect.bottom + GAP);
        isAbove = false;
      }
    }
    
    let left = openerRect.left + (openerRect.width - mRect.width) / 2;
    if (left < canvasRect.left + 6) left = canvasRect.left + 6;
    if (left + mRect.width > canvasRect.right - 6) left = Math.max(canvasRect.right - mRect.width - 6, canvasRect.left + 6);
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.dataset.placement = isAbove ? 'above' : 'below';
  }

  menu.style.visibility = '';
}

/**
 * 打开/关闭 submenu（带互斥：打开一个前会关闭其它未固定菜单）。
 * @param {HTMLElement} menu - submenu 元素
 * @param {HTMLElement} openerEl - 触发按钮
 * @returns {void}
 */
export function showSubmenu(menu, openerEl){
  if (!menu || !openerEl) return;
  /** toggle：如果已打开则直接关闭 */
  if (menu.classList.contains('open')){
    const pinned = menu.dataset && menu.dataset.pinned === 'true';
    cleanupMenuStyles(menu);
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    openerEl.classList.remove('active');
    _menuDebug('submenu', 'toggle-close', menu.id, { pinned: !!pinned });
    try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: menu.id, pinned: !!pinned }); }catch(e){}
    return;
  }

  /** 打开前关闭其它未固定菜单 */
  closeAllSubmenus();

  const pinned = menu.dataset && menu.dataset.pinned === 'true';
  menu.classList.add('open');
  menu.setAttribute('aria-hidden','false');
  positionMenu(menu, openerEl, pinned);
  openerEl.classList.add('active');
  _menuDebug('submenu', 'open', menu.id, { pinned: !!pinned });
  /** 通知外部：子菜单已打开 */
  try{ Message.emit(EVENTS.SUBMENU_OPEN, { id: menu.id, pinned: !!pinned }); }catch(e){}
}

/**
 * 初始化“固定/取消固定”按钮逻辑。
 * 行为：
 * - 固定：submenu 从 absolute → fixed，保持视觉位置不跳动，并附加拖拽能力
 * - 取消固定：submenu 从 fixed → absolute，重定位到工具栏附近
 * @returns {void}
 *
 * 流程图（固定/取消固定）：
 * 1. 监听 .submenu-pin 点击（阻止冒泡，避免触发外层关闭逻辑）
 * 2. 读取 menu、wasPinned、menuRect、opener
 * 3. 切换 menu.dataset.pinned 与按钮样式
 * 4. 若 submenu 未打开：仅更新状态并返回
 * 5. 若 submenu 已打开：
 *    - wasPinned=false：切到 fixed 并保持原屏幕坐标 → 绑定拖拽 → 广播 SUBMENU_PIN(pinned=true)
 *    - wasPinned=true ：切到 absolute（相对父容器）→ 解绑拖拽 → 重新走 positionMenu → 广播 SUBMENU_PIN(pinned=false)
 */
export function initPinHandlers(){
  document.querySelectorAll('.submenu-pin').forEach(btn => {
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const menu = btn.closest('.submenu');
      if (!menu) return;
      const wasPinned = menu.dataset.pinned === 'true';
      const mRect = menu.getBoundingClientRect();
      const opener = _openerForMenu(menu);
      menu.dataset.pinned = wasPinned ? 'false' : 'true';
      btn.classList.toggle('pinned', !wasPinned);
      if (menu.classList.contains('open')){
        if (!wasPinned) {
          menu.style.position = 'fixed';
          menu.style.left = mRect.left + 'px';
          menu.style.top = mRect.top + 'px';
          attachDragToPinned(menu);
          try{ Message.emit(EVENTS.SUBMENU_PIN, { id: menu.id, pinned: true }); }catch(e){}
        } else {
          const parentRect = menu.parentElement.getBoundingClientRect();
          const left = mRect.left - parentRect.left;
          const top = mRect.top - parentRect.top;
          menu.style.position = 'absolute';
          menu.style.left = left + 'px';
          menu.style.top = top + 'px';
          detachDragFromPinned(menu);
          if (opener) positionMenu(menu, opener, false);
          try{ Message.emit(EVENTS.SUBMENU_PIN, { id: menu.id, pinned: false }); }catch(e){}
        }
      }
    });
  });
}

/**
 * 为已固定（fixed）的 submenu 绑定拖拽能力，使其可独立移动。
 * @param {HTMLElement} menu - submenu 元素
 * @returns {void}
 *
 * 流程图（绑定固定菜单拖拽）：
 * 1. 防重复绑定（menu._pinDragAttached）
 * 2. 选择拖拽句柄（.submenu-drag-handle 或 menu 本身）
 * 3. 设置 touchAction=none，确保 pointer 事件稳定
 * 4. 动态 import drag_helper，调用 attachDragHelper
 * 5. onEnd 回调广播 SUBMENU_MOVE
 */
function attachDragToPinned(menu){
  if (!menu) return;
  if (menu._pinDragAttached) return;
  const handle = menu.querySelector('.submenu-drag-handle') || menu;
  try{ if (handle && handle.style) handle.style.touchAction = 'none'; }catch(e){}
  import('./drag_helper.js').then(mod => {
    try{
      const detach = mod.attachDragHelper(handle, menu, {
        threshold: 2,
        clampRect: ()=>{
          const r = getCanvasRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        },
        onEnd: (ev, rect)=>{ try{ Message.emit(EVENTS.SUBMENU_MOVE, { id: menu.id, left: rect.left, top: rect.top }); }catch(e){} }
      });
      menu._pinDragAttached = true;
      menu._pinDragDetach = detach;
    }catch(e){ _menuDebug('attachDragToPinned', 'attach-failed', String(e && e.message || e)); }
  }).catch(e=>{ _menuDebug('attachDragToPinned', 'import-failed', String(e && e.message || e)); });
}

/**
 * 解绑固定 submenu 的拖拽能力（如果已绑定）。
 * @param {HTMLElement} menu - submenu 元素
 * @returns {void}
 */
function detachDragFromPinned(menu){
  if (!menu || !menu._pinDragAttached) return;
  if (menu._pinDragDetach && typeof menu._pinDragDetach === 'function'){
    try{ menu._pinDragDetach(); }catch(e){}
  }
  menu._pinDragAttached = false;
  menu._pinDragDetach = null;
}

/**
 * 窗口尺寸变化时，重新计算已固定 submenu 的定位（避免溢出画布可视区域）。
 */
window.addEventListener('resize', ()=>{
  ['colorMenu','eraserMenu','moreMenu'].forEach(id=>{
    const menu = document.getElementById(id);
    if (menu && menu.classList.contains('open') && menu.dataset.pinned==='true'){
      const opener = _openerForMenu(menu);
      if (opener) positionMenu(menu, opener, true);
    }
  });
});

/**
 * 工具栏拖拽中，自动重排“未固定且已打开”的 submenu（必要时切换上/下摆放）。
 * @returns {void}
 *
 * 流程图（批量重排）：
 * 1. 读取三个 submenu 与三个按钮
 * 2. 对每个 submenu：open 且未固定 → 调用 smartRepositionMenu
 */
function smartRepositionOpenSubmenus(){
  const colorMenu = document.getElementById('colorMenu');
  const eraserMenu = document.getElementById('eraserMenu');
  const moreMenu = document.getElementById('moreMenu');
  const colorTool = document.getElementById('colorTool');
  const eraserTool = document.getElementById('eraserTool');
  const moreTool = document.getElementById('moreTool');
  
  if (colorMenu && colorMenu.classList.contains('open') && colorMenu.dataset.pinned !== 'true' && colorTool) {
    smartRepositionMenu(colorMenu, colorTool);
  }
  
  if (eraserMenu && eraserMenu.classList.contains('open') && eraserMenu.dataset.pinned !== 'true' && eraserTool) {
    smartRepositionMenu(eraserMenu, eraserTool);
  }

  if (moreMenu && moreMenu.classList.contains('open') && moreMenu.dataset.pinned !== 'true' && moreTool) {
    smartRepositionMenu(moreMenu, moreTool);
  }
}

/**
 * 按可用空间智能重排单个 submenu（仅处理未固定 absolute 的菜单）。
 * @param {HTMLElement} menu - submenu 元素
 * @param {HTMLElement} openerEl - 触发按钮
 * @returns {void}
 *
 * 算法要点：
 * - 若上下都能放下：优先保持原 placement，避免拖拽过程中闪烁
 * - 若只有一侧能放下：直接切换到可放的一侧
 * - 若两侧都放不下：选择空间更大的一侧
 *
 * 流程图（智能重排）：
 * 1. 读取 canvasRect、panelRect、menuRect
 * 2. 计算 panel 上/下可用空间与 fitsAbove/fitsBelow
 * 3. 根据 fits 组合确定 newTop/newPlacement
 * 4. 若 top 变化超过阈值：写入 style.top 与 placement
 */
function smartRepositionMenu(menu, openerEl){
  if (!menu || !openerEl) return;
  
  const canvasRect = getCanvasRect();
  const panelEl = openerEl.closest && openerEl.closest('.floating-panel') ? openerEl.closest('.floating-panel') : document.querySelector('.floating-panel');
  if (!panelEl) return;
  
  const parentRect = panelEl.getBoundingClientRect();
  const panelHeight = panelEl.offsetHeight || 50;
  const mRect = menu.getBoundingClientRect();
  const menuHeight = mRect.height;
  const GAP = 8;
  
  const panelTopInCanvas = parentRect.top - canvasRect.top;
  const panelBottomInCanvas = canvasRect.bottom - parentRect.bottom;
  
  const fitsAbove = panelTopInCanvas >= menuHeight + GAP;
  const fitsBelow = panelBottomInCanvas >= menuHeight + GAP;
  
  let newTop;
  let newPlacement;
  
  if (fitsAbove && fitsBelow) {
    newPlacement = menu.dataset.placement || 'above';
    newTop = (newPlacement === 'above') ? (-GAP - menuHeight) : (panelHeight + GAP);
  } else if (fitsAbove) {
    newTop = -GAP - menuHeight;
    newPlacement = 'above';
  } else if (fitsBelow) {
    newTop = panelHeight + GAP;
    newPlacement = 'below';
  } else {
    if (panelTopInCanvas >= panelBottomInCanvas) {
      newTop = -GAP - menuHeight;
      newPlacement = 'above';
    } else {
      newTop = panelHeight + GAP;
      newPlacement = 'below';
    }
  }
  
  const currentTop = parseFloat(menu.style.top) || 0;
  if (Math.abs(currentTop - newTop) > 0.5) {
    menu.style.top = newTop + 'px';
    menu.dataset.placement = newPlacement;
  }
}

/**
 * 监听 TOOLBAR_MOVE：以 16ms 节流重排，降低 reflow 压力并保持跟手。
 */
Message.on(EVENTS.TOOLBAR_MOVE, ()=>{
  if (!smartRepositionOpenSubmenus._timeout) {
    smartRepositionOpenSubmenus._timeout = setTimeout(()=>{
      smartRepositionOpenSubmenus._timeout = null;
      smartRepositionOpenSubmenus();
    }, 16);
  }
});
