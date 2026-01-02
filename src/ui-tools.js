// ui-tools.js (ESM)
import { clearAll, undo, redo, setBrushColor, setErasing, canUndo, canRedo, replaceStrokeColors, getToolState, setInputEnabled, setMultiTouchPenEnabled, setInkRecognitionEnabled, setViewTransform, setCanvasMode } from './renderer.js';
import Curous from './curous.js';
import Settings from './setting.js';
import { showSubmenu, cleanupMenuStyles, initPinHandlers, closeAllSubmenus } from './more_decide_windows.js';
import Message, { EVENTS } from './message.js';
import { updateAppSettings } from './write_a_change.js';
import { initPenUI, updatePenModeLabel } from './pen.js';
import { initEraserUI, updateEraserModeLabel } from './erese.js';
import { applyModeCanvasBackground } from './mode_background.js';

const colorTool = document.getElementById('colorTool');
const pointerTool = document.getElementById('pointerTool');
const colorMenu = document.getElementById('colorMenu');
const eraserTool = document.getElementById('eraserTool');
const eraserMenu = document.getElementById('eraserMenu');
const moreTool = document.getElementById('moreTool');
const moreMenu = document.getElementById('moreMenu');
const clearBtn = document.getElementById('clear');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const collapseTool = document.getElementById('collapseTool');
const exitTool = document.getElementById('exitTool');

// initialize pen and eraser UI modules
initPenUI();
initEraserUI();

function storeDefaultIcon(el){
  if (!el) return;
  if (!el.dataset.defaultIcon) el.dataset.defaultIcon = el.innerHTML || '';
}

function restoreDefaultIcon(el){
  if (!el) return;
  if (typeof el.dataset.defaultIcon === 'string') el.innerHTML = el.dataset.defaultIcon;
}

function escapeAttr(v){
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getColorSwatchIconSvg(color){
  const fill = escapeAttr(color || '#000000');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="${fill}" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5"/></svg>`;
}

function getEraserModeIconSvg(mode){
  const m = mode || 'pixel';
  const btn = document.querySelector(`.erase-mode-btn[data-mode="${m}"]`);
  const svg = btn ? btn.querySelector('svg') : null;
  return svg ? svg.outerHTML : '';
}

function syncToolbarIcons(){
  const s = getToolState();
  const pointerActive = !!(pointerTool && pointerTool.classList.contains('active'));

  if (eraserTool) {
    if (s && s.erasing) {
      const svg = getEraserModeIconSvg(s.eraserMode || 'pixel');
      if (svg) eraserTool.innerHTML = svg;
      else restoreDefaultIcon(eraserTool);
    } else {
      restoreDefaultIcon(eraserTool);
    }
  }

  if (colorTool) {
    if (!pointerActive && !(s && s.erasing)) colorTool.innerHTML = getColorSwatchIconSvg((s && s.brushColor) || '#000000');
    else restoreDefaultIcon(colorTool);
  }
}

storeDefaultIcon(colorTool);
storeDefaultIcon(eraserTool);
storeDefaultIcon(exitTool);

const APP_MODES = { WHITEBOARD: 'whiteboard', ANNOTATION: 'annotation' };
const ENTER_WHITEBOARD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><path d="M2 6.75A2.75 2.75 0 0 1 4.75 4h14.5A2.75 2.75 0 0 1 22 6.75v5.786l-.8-.801a2.5 2.5 0 0 0-.7-.493V6.75c0-.69-.56-1.25-1.25-1.25H4.75c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h7.265a2.5 2.5 0 0 0 .561 1.5H4.75A2.75 2.75 0 0 1 2 17.25z"/><path d="M20.492 12.442a1.5 1.5 0 0 0-2.121 0l-3.111 3.11l4.207 4.208l3.11-3.111a1.5 1.5 0 0 0 0-2.122zm-7.039 4.918l1.1-1.1l4.207 4.207l-1.1 1.1a1.5 1.5 0 0 1-2.121 0l-2.086-2.086a1.5 1.5 0 0 1 0-2.122"/></g></svg>`;

let _appMode = APP_MODES.WHITEBOARD;
let _interactiveRectsRaf = 0;
let _lastTouchActionAt = 0;

function readPersistedAppMode(){
  try{
    const v = localStorage.getItem('appMode');
    if (v === APP_MODES.ANNOTATION) return APP_MODES.ANNOTATION;
  }catch(e){}
  return APP_MODES.WHITEBOARD;
}

function persistAppMode(mode){
  try{ localStorage.setItem('appMode', mode); }catch(e){}
}

function bindTouchTap(el, onTap, opts){
  if (!el || typeof onTap !== 'function') return;
  const delayMs = (opts && typeof opts.delayMs === 'number') ? Math.max(0, opts.delayMs) : 20;
  const moveThreshold = (opts && typeof opts.moveThreshold === 'number') ? Math.max(0, opts.moveThreshold) : 8;
  let down = null;
  let moved = false;

  function clear(){
    down = null;
    moved = false;
  }

  el.addEventListener('pointerdown', (e)=>{
    if (!e || e.pointerType !== 'touch') return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now() };
    moved = false;
    try{ if (el.setPointerCapture) el.setPointerCapture(e.pointerId); }catch(err){}
  }, { passive: true });

  el.addEventListener('pointermove', (e)=>{
    if (!down || !e || e.pointerId !== down.id) return;
    const dx = (e.clientX - down.x);
    const dy = (e.clientY - down.y);
    if ((dx*dx + dy*dy) > (moveThreshold*moveThreshold)) moved = true;
  }, { passive: true });

  el.addEventListener('pointerup', (e)=>{
    if (!down || !e || e.pointerId !== down.id) return;
    const tUp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = tUp - down.t;
    const shouldFire = !moved;
    const delay = Math.max(0, delayMs - elapsed);
    const ev = e;
    clear();
    try{ if (el.releasePointerCapture) el.releasePointerCapture(ev.pointerId); }catch(err){}
    if (!shouldFire) return;
    _lastTouchActionAt = Date.now();
    try{ ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); }catch(err){}
    setTimeout(()=>{ try{ onTap(ev); }catch(err){} }, delay);
  });

  el.addEventListener('pointercancel', (e)=>{
    if (!down || !e || e.pointerId !== down.id) return;
    clear();
    try{ if (el.releasePointerCapture) el.releasePointerCapture(e.pointerId); }catch(err){}
  });

  el.addEventListener('click', (e)=>{
    if (Date.now() - _lastTouchActionAt < 400) {
      try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(err){}
    }
  }, true);
}

function sendIgnoreMouse(ignore, forward){
  try{
    if (!window.electronAPI || typeof window.electronAPI.sendToMain !== 'function') return;
    window.electronAPI.sendToMain('overlay:set-ignore-mouse', { ignore: !!ignore, forward: !!forward });
  }catch(e){}
}

function sendInteractiveRects(rects){
  try{
    if (!window.electronAPI || typeof window.electronAPI.sendToMain !== 'function') return;
    window.electronAPI.sendToMain('overlay:set-interactive-rects', { rects: Array.isArray(rects) ? rects : [] });
  }catch(e){}
}

function collectInteractiveRects(){
  const rects = [];
  const pushEl = (el)=>{
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(0, r.width || 0);
    const h = Math.max(0, r.height || 0);
    if (w <= 0 || h <= 0) return;
    rects.push({ left: r.left, top: r.top, width: w, height: h });
  };

  pushEl(document.querySelector('.floating-panel'));
  document.querySelectorAll('.submenu.open').forEach(pushEl);
  document.querySelectorAll('.recognition-ui.open').forEach(pushEl);
  document.querySelectorAll('.settings-modal.open').forEach(pushEl);
  pushEl(document.getElementById('pageToolbar'));
  return rects;
}

function scheduleInteractiveRectsUpdate(){
  if (_appMode !== APP_MODES.ANNOTATION) return;
  if (_interactiveRectsRaf) return;
  _interactiveRectsRaf = requestAnimationFrame(()=>{
    _interactiveRectsRaf = 0;
    sendInteractiveRects(collectInteractiveRects());
  });
}

function flushInteractiveRects(){
  if (_appMode !== APP_MODES.ANNOTATION) return;
  try{ sendInteractiveRects(collectInteractiveRects()); }catch(e){}
}

function updateExitToolUI(){
  if (!exitTool) return;
  if (_appMode === APP_MODES.ANNOTATION) {
    exitTool.title = '进入白板模式';
    exitTool.innerHTML = ENTER_WHITEBOARD_ICON_SVG;
  } else {
    exitTool.title = '进入智能批注模式';
    restoreDefaultIcon(exitTool);
  }
}

function applyWindowInteractivity(){
  const hasOpenModal = !!document.querySelector('.settings-modal.open, .recognition-ui.open');
  if (hasOpenModal) {
    sendIgnoreMouse(false, false);
    try{ sendInteractiveRects(collectInteractiveRects()); }catch(e){}
    return;
  }
  if (_appMode === APP_MODES.WHITEBOARD) {
    sendIgnoreMouse(false, false);
    return;
  }
  const pointerActive = !!(pointerTool && pointerTool.classList.contains('active'));
  if (!pointerActive) {
    sendIgnoreMouse(false, false);
    return;
  }
  try{ sendInteractiveRects(collectInteractiveRects()); }catch(e){}
  sendIgnoreMouse(true, true);
  scheduleInteractiveRectsUpdate();
}

function setAppMode(nextMode, opts){
  const m = nextMode === APP_MODES.ANNOTATION ? APP_MODES.ANNOTATION : APP_MODES.WHITEBOARD;
  _appMode = m;
  if (!opts || opts.persist !== false) persistAppMode(_appMode);
  try{ document.body.dataset.appMode = _appMode; }catch(e){}
  try{
    const s = Settings.loadSettings();
    applyModeCanvasBackground(_appMode, s && s.canvasColor, { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel });
  }catch(e){}
  updateExitToolUI();
  applyWindowInteractivity();
  scheduleInteractiveRectsUpdate();
  try{ Message.emit(EVENTS.APP_MODE_CHANGED, { mode: _appMode }); }catch(e){}
}

class SmartAnnotationController {
  activate(){
    closeAllSubmenus();
    try{ setCanvasMode('annotation'); }catch(e){}
    setErasing(false);
    if (eraserTool) eraserTool.classList.remove('active');
    if (colorTool) colorTool.classList.remove('active');
    if (pointerTool) pointerTool.classList.add('active');
    try{ setViewTransform(1, 0, 0); }catch(e){}
    try{ setInputEnabled(false); }catch(e){}
    try{ Curous.setTransformEnabled(false); }catch(e){}
    try{ Curous.enableSelectionMode(true); }catch(e){}
    try{
      const s = Settings.loadSettings();
      const c = String((s && s.annotationPenColor) ? s.annotationPenColor : '#FF0000').toUpperCase();
      setBrushColor(c);
    }catch(e){}
    updateEraserModeLabel();
    updatePenModeLabel();
    syncToolbarIcons();
    applyWindowInteractivity();
    try{ sendInteractiveRects(collectInteractiveRects()); }catch(e){}
    scheduleInteractiveRectsUpdate();
  }

  deactivate(){
    closeAllSubmenus();
    setErasing(false);
    if (eraserTool) eraserTool.classList.remove('active');
    if (colorTool) colorTool.classList.remove('active');
  }
}

class WhiteboardController {
  activate(){
    closeAllSubmenus();
    try{ setCanvasMode('whiteboard'); }catch(e){}
    if (pointerTool) pointerTool.classList.remove('active');
    try{ Curous.setTransformEnabled(true); }catch(e){}
    try{ Curous.enableSelectionMode(false); setInputEnabled(true); }catch(e){}
    updateEraserModeLabel();
    updatePenModeLabel();
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
  }

  deactivate(){
    closeAllSubmenus();
  }
}

const _whiteboardController = new WhiteboardController();
const _annotationController = new SmartAnnotationController();
let _activeController = _whiteboardController;

function switchAppMode(nextMode, opts){
  const m = nextMode === APP_MODES.ANNOTATION ? APP_MODES.ANNOTATION : APP_MODES.WHITEBOARD;
  try{ if (_activeController && _activeController.deactivate) _activeController.deactivate(); }catch(e){}
  setAppMode(m, opts);
  _activeController = (m === APP_MODES.ANNOTATION) ? _annotationController : _whiteboardController;
  try{ if (_activeController && _activeController.activate) _activeController.activate(); }catch(e){}
}

function enterAnnotationMode(opts){
  switchAppMode(APP_MODES.ANNOTATION, opts);
}

function enterWhiteboardMode(opts){
  switchAppMode(APP_MODES.WHITEBOARD, opts);
}
try{
  const mo = new MutationObserver(()=>{ scheduleInteractiveRectsUpdate(); });
  mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
}catch(e){}
try{ window.addEventListener('resize', ()=>{ scheduleInteractiveRectsUpdate(); }, { passive: true }); }catch(e){}

try{ window.addEventListener('toolbar:sync', syncToolbarIcons); }catch(e){}

try{
  Message.on(EVENTS.SUBMENU_OPEN, ()=>{ applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); });
  Message.on(EVENTS.SUBMENU_CLOSE, ()=>{ applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); });
  Message.on(EVENTS.SUBMENU_PIN, ()=>{ applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); });
  Message.on(EVENTS.SUBMENU_MOVE, ()=>{ applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); });
  Message.on(EVENTS.TOOLBAR_MOVE, ()=>{ scheduleInteractiveRectsUpdate(); });
}catch(e){}

if (colorTool) {
  const openPen = ()=>{
    if (!colorMenu) return;
    try{
      const s = getToolState();
      setBrushColor((s && s.brushColor) || '#000000');
    }catch(e){
      setBrushColor('#000000');
    }
    setErasing(false);
    // when using pen, disable selection mode and enable canvas input
    try{ Curous.enableSelectionMode(false); setInputEnabled(true); }catch(e){}
    if (pointerTool) pointerTool.classList.remove('active');
    if (eraserTool) eraserTool.classList.remove('active');
    showSubmenu(colorMenu, colorTool);
    updatePenModeLabel();
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
  };
  colorTool.addEventListener('click', openPen);
  bindTouchTap(colorTool, openPen, { delayMs: 20 });
}

if (eraserTool) {
  const openEraser = ()=>{
    if (!eraserMenu) return;
    const closing = eraserMenu.classList.contains('open');
    if (closing) {
      showSubmenu(eraserMenu, eraserTool);
      setErasing(false);
      updateEraserModeLabel();
      syncToolbarIcons();
      applyWindowInteractivity();
      scheduleInteractiveRectsUpdate();
      return;
    }
    setErasing(true);
    try{ Curous.enableSelectionMode(false); setInputEnabled(true); }catch(e){}
    if (pointerTool) pointerTool.classList.remove('active');
    if (colorTool) colorTool.classList.remove('active');
    showSubmenu(eraserMenu, eraserTool);
    updateEraserModeLabel();
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
  };
  eraserTool.addEventListener('click', openEraser);
  bindTouchTap(eraserTool, openEraser, { delayMs: 20 });
}

if (pointerTool) {
  const togglePointer = ()=>{
    const next = !pointerTool.classList.contains('active');
    if (next) {
      // enable selection mode
      pointerTool.classList.add('active');
      // disable drawing/erasing
      setErasing(false);
      try{ setInputEnabled(false); }catch(e){}
      Curous.enableSelectionMode(true);
    } else {
      pointerTool.classList.remove('active');
      Curous.enableSelectionMode(false);
      try{ setInputEnabled(true); }catch(e){}
    }
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
  };
  pointerTool.addEventListener('click', togglePointer);
  bindTouchTap(pointerTool, togglePointer, { delayMs: 20 });
}

if (moreTool) {
  const openMore = ()=>{
    if (!moreMenu) return;
    // 更多菜单不改变画笔/橡皮状态，仅切换子菜单显示
    if (colorTool) colorTool.classList.remove('active');
    if (eraserTool) eraserTool.classList.remove('active');
    showSubmenu(moreMenu, moreTool);
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
  };
  moreTool.addEventListener('click', openMore);
  bindTouchTap(moreTool, openMore, { delayMs: 20 });
  // simple action hooks
  const exportBtn = document.getElementById('exportBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const aboutBtn = document.getElementById('aboutBtn');
  const closeWhiteboardBtn = document.getElementById('closeWhiteboardBtn');
  const onExport = ()=>{ closeAllSubmenus(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); Message.emit(EVENTS.REQUEST_EXPORT, {}); };
  const onSettings = ()=>{ closeAllSubmenus(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); Message.emit(EVENTS.OPEN_SETTINGS, {}); };
  const onAbout = ()=>{ closeAllSubmenus(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); Message.emit(EVENTS.OPEN_ABOUT, {}); };
  if (exportBtn) { exportBtn.addEventListener('click', onExport); bindTouchTap(exportBtn, onExport, { delayMs: 20 }); }
  if (settingsBtn) { settingsBtn.addEventListener('click', onSettings); bindTouchTap(settingsBtn, onSettings, { delayMs: 20 }); }
  if (aboutBtn) { aboutBtn.addEventListener('click', onAbout); bindTouchTap(aboutBtn, onAbout, { delayMs: 20 }); }
  if (closeWhiteboardBtn) closeWhiteboardBtn.addEventListener('click', ()=>{
    closeAllSubmenus();
    syncToolbarIcons();
    applyWindowInteractivity();
    scheduleInteractiveRectsUpdate();
    try{
      if (window.electronAPI && typeof window.electronAPI.sendToMain === 'function') {
        window.electronAPI.sendToMain('app:close', {});
        return;
      }
    }catch(e){}
    try{ window.close(); }catch(e){}
  });
}

if (exitTool) {
  const toggleMode = ()=>{
    if (_appMode === APP_MODES.WHITEBOARD) enterAnnotationMode();
    else enterWhiteboardMode();
  };
  exitTool.addEventListener('click', toggleMode);
  bindTouchTap(exitTool, toggleMode, { delayMs: 20 });
}

// submenu logic moved to more_decide_windows.js

document.addEventListener('click', (e)=>{ if (e.target.closest && (e.target.closest('.tool') || e.target.closest('.drag-handle'))) return; closeAllSubmenus(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); });
document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') { closeAllSubmenus(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); } });

// pin button handlers: toggle data-pinned on submenu
// initialize pin handlers from more_decide_windows
initPinHandlers();

// Drag handle: allow floating panel to be moved with shared helper (mouse vs touch/pen)
import { attachDragHelper } from './drag_helper.js';
const panel = document.querySelector('.floating-panel');
const dragHandle = document.getElementById('dragHandle');
if (dragHandle && panel) {
  dragHandle.style.touchAction = 'none';
  const detachPanelDrag = attachDragHelper(dragHandle, panel, {
    threshold: 2,
    clampRect: ()=>({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }),
    onMove: ({ left, top }) => { try{ Message.emit(EVENTS.TOOLBAR_MOVE, { left, top }); }catch(e){} scheduleInteractiveRectsUpdate(); },
    onEnd: (ev, rect) => { try{ Message.emit(EVENTS.TOOLBAR_MOVE, { left: rect.left, top: rect.top }); }catch(e){} scheduleInteractiveRectsUpdate(); }
  });
}

if (clearBtn) {
  const onClear = ()=>{ clearAll(); setErasing(false); if (eraserTool) eraserTool.classList.remove('active'); updatePenModeLabel(); updateEraserModeLabel(); syncToolbarIcons(); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); };
  clearBtn.addEventListener('click', onClear);
  bindTouchTap(clearBtn, onClear, { delayMs: 20 });
}

if (undoBtn) {
  const onUndo = ()=>{ undo(); };
  undoBtn.addEventListener('click', onUndo);
  bindTouchTap(undoBtn, onUndo, { delayMs: 20 });
}
if (redoBtn) {
  const onRedo = ()=>{ redo(); };
  redoBtn.addEventListener('click', onRedo);
  bindTouchTap(redoBtn, onRedo, { delayMs: 20 });
}
document.addEventListener('keydown', (e)=>{
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase()==='y' || (e.shiftKey && e.key.toLowerCase()==='z'))) { e.preventDefault(); redo(); }
});

// ensure labels reflect initial state
updateEraserModeLabel();
updatePenModeLabel();
syncToolbarIcons();
try{
  const bootMode = readPersistedAppMode();
  if (bootMode === APP_MODES.ANNOTATION) enterAnnotationMode({ persist: false });
  else enterWhiteboardMode({ persist: false });
}catch(e){
  enterWhiteboardMode({ persist: false });
}

// Collapse/expand behavior for horizontal fold
const settings = Settings.loadSettings();

if (collapseTool && panel) {
  function applyCollapsed(collapsed){
    try{ if (collapsed) panel.classList.add('collapsed'); else panel.classList.remove('collapsed'); }catch(e){}
    try{ localStorage.setItem('toolbarCollapsed', collapsed ? '1' : '0'); }catch(e){}
    // trigger layout recalculation used by ResizeObserver logic
    window.dispatchEvent(new Event('resize'));
    scheduleInteractiveRectsUpdate();
  }

  const toggleCollapse = ()=>{
    const next = !panel.classList.contains('collapsed');
    applyCollapsed(next);
  };
  collapseTool.addEventListener('click', toggleCollapse);
  bindTouchTap(collapseTool, toggleCollapse, { delayMs: 20 });

  // restore persisted state
  try{
    if (settings && settings.toolbarCollapsed) applyCollapsed(true);
  }catch(e){}
}

// Settings modal wiring
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const resetSettingsBtn = document.getElementById('resetSettings');
const optAutoResize = document.getElementById('optAutoResize');
const optCollapsed = document.getElementById('optCollapsed');
const optTheme = document.getElementById('optTheme');
const optTooltips = document.getElementById('optTooltips');
const optMultiTouchPen = document.getElementById('optMultiTouchPen');
const optAnnotationPenColor = document.getElementById('optAnnotationPenColor');
const optSmartInk = document.getElementById('optSmartInk');
const optVisualStyle = document.getElementById('optVisualStyle');
const optCanvasColor = document.getElementById('optCanvasColor');
const keyUndo = document.getElementById('keyUndo');
const keyRedo = document.getElementById('keyRedo');
const previewSettingsBtn = document.getElementById('previewSettings');
const revertPreviewBtn = document.getElementById('revertPreview');
const historyStateDisplay = document.getElementById('historyStateDisplay');

const aboutModal = document.getElementById('aboutModal');
const closeAbout = document.getElementById('closeAbout');

let _previewBackup = null;

function openSettings(){
  if (!settingsModal) return;
  // populate from store
  const s = Settings.loadSettings();
  if (optAutoResize) optAutoResize.checked = !!s.enableAutoResize;
  if (optCollapsed) optCollapsed.checked = !!s.toolbarCollapsed;
  if (optTheme) optTheme.value = s.theme || 'light';
  if (optVisualStyle) optVisualStyle.value = s.visualStyle || 'blur';
  if (optCanvasColor) optCanvasColor.value = s.canvasColor || 'white';
  if (optTooltips) optTooltips.checked = !!s.showTooltips;
  if (optMultiTouchPen) optMultiTouchPen.checked = !!s.multiTouchPen;
  if (optAnnotationPenColor) optAnnotationPenColor.value = String(s.annotationPenColor || '#FF0000');
  if (optSmartInk) optSmartInk.checked = !!s.smartInkRecognition;
  if (keyUndo) keyUndo.value = (s.shortcuts && s.shortcuts.undo) || '';
  if (keyRedo) keyRedo.value = (s.shortcuts && s.shortcuts.redo) || '';
  settingsModal.classList.add('open');
  applyWindowInteractivity();
  scheduleInteractiveRectsUpdate();
}

function closeSettingsModal(){ if (settingsModal) settingsModal.classList.remove('open'); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); }

function openAbout(){
  if (!aboutModal) return;
  aboutModal.classList.add('open');
  applyWindowInteractivity();
  scheduleInteractiveRectsUpdate();
}

function closeAboutModal(){ if (aboutModal) aboutModal.classList.remove('open'); applyWindowInteractivity(); scheduleInteractiveRectsUpdate(); }

// open when message requested
Message.on(EVENTS.OPEN_SETTINGS, ()=>{ openSettings(); });
Message.on(EVENTS.OPEN_ABOUT, ()=>{ openAbout(); });

if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
if (settingsModal) settingsModal.addEventListener('click', (e)=>{ if (e.target.classList && e.target.classList.contains('settings-backdrop')) closeSettingsModal(); });
if (closeAbout) closeAbout.addEventListener('click', closeAboutModal);
if (aboutModal) aboutModal.addEventListener('click', (e)=>{ if (e.target.classList && e.target.classList.contains('settings-backdrop')) closeAboutModal(); });

if (saveSettings) saveSettings.addEventListener('click', ()=>{
  const newS = {
    enableAutoResize: !!(optAutoResize && optAutoResize.checked),
    toolbarCollapsed: !!(optCollapsed && optCollapsed.checked),
    theme: (optTheme && optTheme.value) || 'light',
    visualStyle: (optVisualStyle && optVisualStyle.value) || 'blur',
    canvasColor: (optCanvasColor && optCanvasColor.value) || 'white',
    showTooltips: !!(optTooltips && optTooltips.checked),
    multiTouchPen: !!(optMultiTouchPen && optMultiTouchPen.checked),
    annotationPenColor: String((optAnnotationPenColor && optAnnotationPenColor.value) || '#FF0000').toUpperCase(),
    smartInkRecognition: !!(optSmartInk && optSmartInk.checked),
    shortcuts: { undo: (keyUndo && keyUndo.value) || '', redo: (keyRedo && keyRedo.value) || '' }
  };
  // persist via cross-module helper which emits SETTINGS_CHANGED
  updateAppSettings(newS);
  // apply immediate effects
  if (!newS.enableAutoResize) {
    try{ const p = document.querySelector('.floating-panel'); if (p) p.style.width = ''; }catch(e){}
  } else { window.dispatchEvent(new Event('resize')); }
  applyCollapsed(newS.toolbarCollapsed);
  // apply theme and tooltips immediately
  applyTheme(newS.theme);
  try{ applyVisualStyle(newS.visualStyle); }catch(e){}
  try{ applyModeCanvasBackground(_appMode, newS.canvasColor, { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel }); }catch(e){}
  applyTooltips(newS.showTooltips);
  try{ setMultiTouchPenEnabled(!!newS.multiTouchPen); }catch(e){}
  try{ setInkRecognitionEnabled(!!newS.smartInkRecognition); }catch(e){}
  try{
    if (_appMode === APP_MODES.ANNOTATION) {
      setBrushColor(newS.annotationPenColor);
      updatePenModeLabel();
      syncToolbarIcons();
    }
  }catch(e){}
  closeSettingsModal();
});

if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', ()=>{ Settings.resetSettings(); const s = Settings.loadSettings(); if (optAutoResize) optAutoResize.checked = !!s.enableAutoResize; if (optCollapsed) optCollapsed.checked = !!s.toolbarCollapsed; if (optTheme) optTheme.value = s.theme || 'light'; if (optVisualStyle) optVisualStyle.value = s.visualStyle || 'blur'; if (optCanvasColor) optCanvasColor.value = s.canvasColor || 'white'; if (optTooltips) optTooltips.checked = !!s.showTooltips; if (optMultiTouchPen) optMultiTouchPen.checked = !!s.multiTouchPen; if (optAnnotationPenColor) optAnnotationPenColor.value = String(s.annotationPenColor || '#FF0000'); if (optSmartInk) optSmartInk.checked = !!s.smartInkRecognition; if (keyUndo) keyUndo.value = (s.shortcuts && s.shortcuts.undo) || ''; if (keyRedo) keyRedo.value = (s.shortcuts && s.shortcuts.redo) || ''; try{ setMultiTouchPenEnabled(!!s.multiTouchPen); }catch(e){} try{ setInkRecognitionEnabled(!!s.smartInkRecognition); }catch(e){} try{ if (_appMode === APP_MODES.ANNOTATION) { setBrushColor(String(s.annotationPenColor || '#FF0000').toUpperCase()); updatePenModeLabel(); syncToolbarIcons(); } }catch(e){} });

// apply theme to document body
function applyTheme(name){ try{ document.body.dataset.theme = name; if (name==='dark') document.documentElement.classList.add('theme-dark'); else document.documentElement.classList.remove('theme-dark'); }catch(e){} }

// apply tooltips: preserve original title in data-orig-title
function applyTooltips(show){ try{
  document.querySelectorAll('.tool-btn, .mode-btn, .submenu-drag-handle, .submenu-pin, button').forEach(el=>{
    if (!el.dataset.origTitle) el.dataset.origTitle = el.getAttribute('title') || '';
    if (show) el.setAttribute('title', el.dataset.origTitle || ''); else el.setAttribute('title','');
  });
}catch(e){} }

// apply visual style variants: 'solid' | 'blur' | 'transparent'
function applyVisualStyle(style){
  try{
    const root = document.documentElement;
    ['visual-solid','visual-blur','visual-transparent'].forEach(c=>root.classList.remove(c));
    if (!style || style === 'blur') root.classList.add('visual-blur');
    else if (style === 'solid') root.classList.add('visual-solid');
    else if (style === 'transparent') root.classList.add('visual-transparent');
  }catch(e){}
}

// preview settings (temporary)
if (previewSettingsBtn) previewSettingsBtn.addEventListener('click', ()=>{
  if (!settingsModal) return;
  const s = Settings.loadSettings();
  // backup only once
  if (!_previewBackup) _previewBackup = Object.assign({}, s);
  const preview = {
    theme: (optTheme && optTheme.value) || s.theme,
    showTooltips: !!(optTooltips && optTooltips.checked),
    visualStyle: (optVisualStyle && optVisualStyle.value) || s.visualStyle,
    canvasColor: (optCanvasColor && optCanvasColor.value) || s.canvasColor
  };
  applyTheme(preview.theme);
  applyTooltips(preview.showTooltips);
  // preview visual style
  try{ if (preview.visualStyle) applyVisualStyle(preview.visualStyle); }catch(e){}
  // preview canvas color
  try{ if (preview.canvasColor) applyModeCanvasBackground(_appMode, preview.canvasColor, { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel }); }catch(e){}
});

if (revertPreviewBtn) revertPreviewBtn.addEventListener('click', ()=>{
  if (_previewBackup) {
    applyTheme(_previewBackup.theme);
    applyTooltips(_previewBackup.showTooltips);
    try{ applyVisualStyle(_previewBackup.visualStyle || 'blur'); }catch(e){}
    try{ applyModeCanvasBackground(_appMode, _previewBackup.canvasColor || 'white', { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel }); }catch(e){}
    _previewBackup = null;
  }
});

// listen for history changes to update UI
Message.on(EVENTS.HISTORY_CHANGED, (st)=>{
  try{
    const canU = st && st.canUndo; const canR = st && st.canRedo;
    if (undoBtn) undoBtn.disabled = !canU;
    if (redoBtn) redoBtn.disabled = !canR;
    if (historyStateDisplay) historyStateDisplay.textContent = `撤销: ${canU? '可' : '—'}  重做: ${canR? '可' : '—'}`;
  }catch(e){}
});

// toast notification helper
function _ensureToast(){
  let t = document.querySelector('.app-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'app-toast';
    document.body.appendChild(t);
  }
  return t;
}

function showToast(msg, type='success', ms=2500){
  const t = _ensureToast();
  t.textContent = msg;
  t.classList.remove('success','error');
  t.classList.add(type);
  // force reflow then show
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._hideT);
  t._hideT = setTimeout(()=>{ t.classList.remove('show'); }, ms);
}

// Show file write results forwarded from main via ipc_bridge
Message.on('io:request-file-write:result', (res)=>{
  try{
    if (!res) { showToast('写入失败 (未知错误)', 'error'); return; }
    if (res.success) showToast(`写入成功： ${res.path || ''}`, 'success');
    else showToast(`写入失败： ${res.error || res.message || '未知'}`, 'error');
  }catch(e){ showToast('写入结果处理错误', 'error'); }
});

// Shortcut binding: parse simple shortcut like 'Ctrl+Z' or 'Ctrl+Shift+Z'
let _shortcutHandler = null;
function parseShortcut(str){
  if (!str || typeof str !== 'string') return null;
  // support multiple alternatives with '|' e.g. 'Ctrl+Z|Cmd+Z'
  const altStrs = str.split('|').map(s=>s.trim()).filter(Boolean);
  const parseOne = (s)=>{
    const parts = s.split('+').map(s=>s.trim().toLowerCase());
    const obj = { ctrl:false, shift:false, alt:false, meta:false, key: null };
    parts.forEach(p=>{
      if (p==='ctrl' || p==='control') obj.ctrl = true;
      else if (p==='cmd' || p==='meta') obj.meta = true;
      else if (p==='shift') obj.shift = true;
      else if (p==='alt' || p==='option') obj.alt = true;
      else obj.key = p;
    });
    return obj.key ? obj : null;
  };
  const specs = altStrs.map(parseOne).filter(Boolean);
  if (specs.length === 0) return null;
  return specs.length === 1 ? specs[0] : specs;
}

function matchShortcut(ev, spec){
  if (!spec) return false;
  const key = (ev.key || '').toLowerCase();
  const checkSpec = (s)=>{
    if (!s) return false;
    if (s.key) {
      // normalize common names
      const k = s.key.toLowerCase();
      if (k.length === 1) { if (key !== k) return false; }
      else {
        // named key like enter, escape, arrowup
        if (key !== k) return false;
      }
    }
    if (!!ev.ctrlKey !== !!s.ctrl) return false;
    if (!!ev.metaKey !== !!s.meta) return false;
    if (!!ev.shiftKey !== !!s.shift) return false;
    if (!!ev.altKey !== !!s.alt) return false;
    return true;
  };
  if (Array.isArray(spec)) {
    return spec.some(s => checkSpec(s));
  }
  return checkSpec(spec);
}

function bindShortcutsFromSettings(){
  try{
    const s = Settings.loadSettings();
    const specUndo = parseShortcut((s.shortcuts && s.shortcuts.undo) || 'ctrl+z');
    const specRedo = parseShortcut((s.shortcuts && s.shortcuts.redo) || 'ctrl+y');
    if (_shortcutHandler) document.removeEventListener('keydown', _shortcutHandler);
    _shortcutHandler = (e)=>{
      if (matchShortcut(e, specUndo)) { e.preventDefault(); undo(); }
      else if (matchShortcut(e, specRedo)) { e.preventDefault(); redo(); }
    };
    document.addEventListener('keydown', _shortcutHandler);
  }catch(e){ console.warn('bindShortcuts failed', e); }
}

// initial bind
bindShortcutsFromSettings();
// rebind on settings change and apply visual style
Message.on(EVENTS.SETTINGS_CHANGED, (s)=>{ try{ bindShortcutsFromSettings(); if (s && s.visualStyle) applyVisualStyle(s.visualStyle); if (s && s.canvasColor) applyModeCanvasBackground(_appMode, s.canvasColor, { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel }); if (s && typeof s.multiTouchPen !== 'undefined') setMultiTouchPenEnabled(!!s.multiTouchPen); if (s && typeof s.smartInkRecognition !== 'undefined') setInkRecognitionEnabled(!!s.smartInkRecognition); }catch(e){} });

// initialize undo/redo button states now (renderer may have emitted before listener attached)
try{ if (undoBtn) undoBtn.disabled = !canUndo(); if (redoBtn) redoBtn.disabled = !canRedo(); if (historyStateDisplay) historyStateDisplay.textContent = `撤销: ${canUndo()? '可' : '—'}  重做: ${canRedo()? '可' : '—'}`; }catch(e){}

// apply persisted theme/tooltips on startup
try{
  if (settings) { if (settings.theme) applyTheme(settings.theme); if (typeof settings.showTooltips !== 'undefined') applyTooltips(!!settings.showTooltips); }
}catch(e){}
try{ if (settings) { if (settings.visualStyle) applyVisualStyle(settings.visualStyle); else applyVisualStyle('blur'); } }catch(e){}
try{ if (settings) { applyModeCanvasBackground(_appMode, settings.canvasColor || 'white', { getToolState, replaceStrokeColors, setBrushColor, updatePenModeLabel }); } }catch(e){}
try{ if (settings && typeof settings.multiTouchPen !== 'undefined') setMultiTouchPenEnabled(!!settings.multiTouchPen); }catch(e){}
try{ if (settings && typeof settings.smartInkRecognition !== 'undefined') setInkRecognitionEnabled(!!settings.smartInkRecognition); }catch(e){}

// Auto-adjust floating panel width based on tools content
(() => {
  const panel = document.querySelector('.floating-panel');
  if (!panel) return;
  const toolsSection = panel.querySelector('.panel-section.tools');
  const H_PADDING = 24; // panel horizontal padding (12px left + 12px right)
  const MIN_W = 64;
  const MAX_W = Math.max(220, window.innerWidth - 40);

  function applyWidth(w){
    const width = Math.max(MIN_W, Math.min(MAX_W, Math.round(w + H_PADDING)));
    panel.style.width = width + 'px';
  }

  function recalc(){
    try{
      if (!toolsSection) { applyWidth(MIN_W); return; }
      // measure natural content width
      const rect = toolsSection.getBoundingClientRect();
      applyWidth(rect.width);
    }catch(e){}
  }

  // Observe size changes of the tools container
  try{
    const ro = new ResizeObserver(recalc);
    if (toolsSection) ro.observe(toolsSection);
    // also observe panel (in case of style changes)
    ro.observe(panel);
    // respond to DOM mutations (buttons added/removed)
    const mo = new MutationObserver(recalc);
    if (toolsSection) mo.observe(toolsSection, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', recalc);
    // initial calculation
    setTimeout(recalc, 16);
  }catch(e){/* fail silently if ResizeObserver not available */}
})();

