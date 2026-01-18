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
import Message, { EVENTS } from '../message.js';

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

function _applySubmenuStagger(menu){
  if (!menu) return;
  let idx = 0;
  const list = menu.querySelectorAll('.more-title,.submenu-quick-grid > *,.submenu-body > *');
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (!el || !el.dataset) continue;
    el.dataset.lsSubmenuItem = '1';
    try{ el.style.setProperty('--ls-item-index', String(idx)); }catch(e){}
    idx++;
  }
}

function _clearSubmenuAnim(menu){
  if (!menu) return;
  if (menu._lsOpenRaf) {
    try{ cancelAnimationFrame(menu._lsOpenRaf); }catch(e){}
    menu._lsOpenRaf = null;
  }
  if (menu._lsCloseTimer) {
    try{ clearTimeout(menu._lsCloseTimer); }catch(e){}
    menu._lsCloseTimer = null;
  }
  if (menu._lsCloseOnEnd) {
    try{ menu.removeEventListener('transitionend', menu._lsCloseOnEnd); }catch(e){}
    menu._lsCloseOnEnd = null;
  }
}

function _closeSubmenuAnimated(menu, openerEl){
  if (!menu) return;
  _clearSubmenuAnim(menu);
  try{ menu.dataset.anim = 'closing'; }catch(e){}
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden','true');
  if (openerEl) openerEl.classList.remove('active');

  const done = ()=>{
    _clearSubmenuAnim(menu);
    try{ delete menu.dataset.anim; }catch(e){ try{ menu.dataset.anim = ''; }catch(e2){} }
    cleanupMenuStyles(menu);
  };

  const onEnd = (e)=>{
    if (!e || e.target !== menu) return;
    if (e.propertyName && e.propertyName !== 'opacity' && e.propertyName !== 'transform') return;
    done();
  };

  menu._lsCloseOnEnd = onEnd;
  menu.addEventListener('transitionend', onEnd);
  menu._lsCloseTimer = setTimeout(done, 380);
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
  menu.style.transformOrigin = '';
  menu.style.removeProperty('--ls-origin-x');
  menu.style.zIndex = '';
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
  if (colorMenu && colorMenu.classList.contains('open') && colorMenu.dataset.pinned!=='true') { _closeSubmenuAnimated(colorMenu, colorTool); _menuDebug('submenu', 'closeAll', colorMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: colorMenu.id, pinned: false }); }catch(e){} }
  if (eraserMenu && eraserMenu.classList.contains('open') && eraserMenu.dataset.pinned!=='true') { _closeSubmenuAnimated(eraserMenu, eraserTool); _menuDebug('submenu', 'closeAll', eraserMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: eraserMenu.id, pinned: false }); }catch(e){} }
  if (moreMenu && moreMenu.classList.contains('open') && moreMenu.dataset.pinned!=='true') { _closeSubmenuAnimated(moreMenu, moreTool); _menuDebug('submenu', 'closeAll', moreMenu.id); try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: moreMenu.id, pinned: false }); }catch(e){} }
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
  // Disable position transition during initial placement to avoid flying effect
  menu.classList.add('no-pos-transition');

  const canvasRect = getCanvasRect();
  const openerRect = openerEl.getBoundingClientRect();

  /** 临时显示用于测量（避免 display:none 时拿到 0 尺寸） */
  menu.style.visibility = 'hidden';
  const mRect = menu.getBoundingClientRect();
  const menuHeight = mRect.height;
  const GAP = 12;

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
    
    // Horizontal logic - Center on Opener
    const openerCenter = openerRect.left + openerRect.width / 2;
    // Calculate left in Viewport coords
    let leftInViewport = openerCenter - mRect.width / 2;
    
    // Constraint: Keep within viewport (with margin)
    const margin = 12;
    if (leftInViewport < canvasRect.left + margin) leftInViewport = canvasRect.left + margin;
    if (leftInViewport + mRect.width > canvasRect.right - margin) leftInViewport = canvasRect.right - margin - mRect.width;

    // Convert to relative to Panel
    let left = leftInViewport - parentRect.left;
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.zIndex = 2500;
    menu.dataset.placement = isAbove ? 'above' : 'below';

    // Set transform origin to align with opener center
    const originX = openerCenter - leftInViewport;
    const originY = isAbove ? 'bottom' : 'top';
    menu.style.transformOrigin = `${originX}px ${originY}`;

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
    
    const openerCenter = openerRect.left + openerRect.width / 2;
    let left = openerCenter - mRect.width / 2;
    const margin = 12;
    if (left < canvasRect.left + margin) left = canvasRect.left + margin;
    if (left + mRect.width > canvasRect.right - margin) left = Math.max(canvasRect.right - margin - mRect.width, canvasRect.left + margin);
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.dataset.placement = isAbove ? 'above' : 'below';

    // Set transform origin
    const originX = openerCenter - left;
    const originY = isAbove ? 'bottom' : 'top';
    menu.style.transformOrigin = `${originX}px ${originY}`;
  }

  menu.style.visibility = '';
  // Force reflow and restore transition
  menu.offsetHeight;
  menu.classList.remove('no-pos-transition');
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
  if (menu.classList.contains('open') || (menu.dataset && menu.dataset.anim === 'opening')){
    const pinned = menu.dataset && menu.dataset.pinned === 'true';
    _closeSubmenuAnimated(menu, openerEl);
    _menuDebug('submenu', 'toggle-close', menu.id, { pinned: !!pinned });
    try{ Message.emit(EVENTS.SUBMENU_CLOSE, { id: menu.id, pinned: !!pinned }); }catch(e){}
    return;
  }

  /** 打开前关闭其它未固定菜单 */
  closeAllSubmenus();

  const pinned = menu.dataset && menu.dataset.pinned === 'true';
  _applySubmenuStagger(menu);
  _clearSubmenuAnim(menu);
  try{ menu.dataset.anim = 'opening'; }catch(e){}
  menu.classList.add('open');
  menu.setAttribute('aria-hidden','false');
  positionMenu(menu, openerEl, pinned);
  openerEl.classList.add('active');
  menu._lsOpenRaf = requestAnimationFrame(()=>{
    menu._lsOpenRaf = null;
    try{ delete menu.dataset.anim; }catch(e){ try{ menu.dataset.anim = ''; }catch(e2){} }
  });
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
  let _lastTouchTapAt = 0;
  document.querySelectorAll('.submenu-pin').forEach(btn => {
    const doToggle = ()=>{
      const menu = btn.closest('.submenu');
      if (!menu) return;
      const wasPinned = menu.dataset.pinned === 'true';
      const mRect = menu.getBoundingClientRect();
      const opener = _openerForMenu(menu);
      menu.dataset.pinned = wasPinned ? 'false' : 'true';
      btn.classList.toggle('pinned', !wasPinned);
      if (menu.classList.contains('open')){
        menu.classList.add('no-pos-transition'); // Disable transition
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
        menu.offsetHeight; // Force reflow
        menu.classList.remove('no-pos-transition'); // Restore
      }
    };

    btn.addEventListener('click', (e)=>{
      if (Date.now() - _lastTouchTapAt < 400) return;
      e.stopPropagation();
      doToggle();
    });

    let down = null;
    let moved = false;
    const moveThreshold = 8;
    const delayMs = 50;
    const getTouchPoint = (e)=>{
      const list = (e && e.changedTouches) ? e.changedTouches : null;
      if (!list || typeof list.length !== 'number') return null;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t) continue;
        if (!down || t.identifier === down.id) return t;
      }
      return null;
    };

    btn.addEventListener('touchstart', (e)=>{
      const t = (e && e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;
      down = { id: t.identifier, x: t.clientX, y: t.clientY, t: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now() };
      moved = false;
    }, { passive: true });

    btn.addEventListener('touchmove', (e)=>{
      if (!down) return;
      const t = getTouchPoint(e);
      if (!t) return;
      const dx = (t.clientX - down.x);
      const dy = (t.clientY - down.y);
      if ((dx*dx + dy*dy) > (moveThreshold*moveThreshold)) moved = true;
    }, { passive: true });

    btn.addEventListener('touchend', (e)=>{
      if (!down) return;
      const t = getTouchPoint(e);
      if (!t) return;
      const tUp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsed = tUp - down.t;
      const shouldFire = !moved;
      const delay = Math.max(0, delayMs - elapsed);
      down = null;
      moved = false;
      if (!shouldFire) return;
      _lastTouchTapAt = Date.now();
      try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(err){}
      setTimeout(()=>{ try{ doToggle(); }catch(err){} }, delay);
    }, { passive: false });

    btn.addEventListener('touchcancel', ()=>{
      down = null;
      moved = false;
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
        touchThreshold: 5,
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
  const openerRect = openerEl.getBoundingClientRect();
  const panelHeight = panelEl.offsetHeight || 50;
  const mRect = menu.getBoundingClientRect();
  const menuHeight = mRect.height;
  const GAP = 12;
  
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
  
  // Horizontal logic (Center on Opener + Clamp)
  const openerCenter = openerRect.left + openerRect.width / 2;
  let leftInViewport = openerCenter - mRect.width / 2;
  
  const margin = 12;
  if (leftInViewport < canvasRect.left + margin) leftInViewport = canvasRect.left + margin;
  if (leftInViewport + mRect.width > canvasRect.right - margin) leftInViewport = canvasRect.right - margin - mRect.width;

  let newLeft = leftInViewport - parentRect.left;
  
  const currentTop = parseFloat(menu.style.top) || 0;
  const currentLeft = parseFloat(menu.style.left) || 0;

  if (Math.abs(currentTop - newTop) > 0.5 || Math.abs(currentLeft - newLeft) > 0.5) {
    menu.style.top = newTop + 'px';
    menu.style.left = newLeft + 'px';
    menu.dataset.placement = newPlacement;

    // Update transform origin
    const originX = openerCenter - leftInViewport;
    const originY = newPlacement === 'above' ? 'bottom' : 'top';
    menu.style.transformOrigin = `${originX}px ${originY}`;
    menu.style.setProperty('--ls-origin-x', `${originX}px`);
  }
}

/**
 * 监听 TOOLBAR_MOVE：以 16ms 节流重排，降低 reflow 压力并保持跟手。
 */
Message.on(EVENTS.TOOLBAR_MOVE, ()=>{
  if (smartRepositionOpenSubmenus._raf) return;
  smartRepositionOpenSubmenus._raf = requestAnimationFrame(()=>{
    smartRepositionOpenSubmenus._raf = null;
    smartRepositionOpenSubmenus();
  });
});
