import { applyCubenoteState, setInputEnabled, setCanvasMode, getViewTransform, getCubenoteState, setViewRotation, setViewTransform } from '../renderer.js';

let currentState = null;
let historyItems = [];
let currentRequestId = '';
let tooltipTimer = 0;
let lastChoicePref = 'overwrite';
let rafPending = false;
let viewScaleCache = 1;
let viewOffsetXCache = 0;
let viewOffsetYCache = 0;
let panActive = false;
let panStartX = 0;
let panStartY = 0;
let panStartOffsetX = 0;
let panStartOffsetY = 0;
let pinchActive = false;
let p1 = null, p2 = null;
let pinchStartDist = 0;
let pinchStartScale = 1;
let previewPages = [];
let previewPageIndex = 0;
let previewDocKey = 'whiteboard';
let inertiaActive = false;
let inertiaVX = 0;
let inertiaVY = 0;
let inertiaFrame = 0;
let lastMoveTs = 0;
let lastMoveX = 0;
let lastMoveY = 0;

function el(id){ return document.getElementById(id); }

function showToast(text, kind){
  const t = el('toast');
  if (!t) return;
  t.textContent = String(text || '');
  t.style.background = kind === 'error' ? 'rgba(255,69,58,0.9)' : 'rgba(0,0,0,0.8)';
  t.classList.add('show');
  setTimeout(()=>{ try{ t.classList.remove('show'); }catch(e){} }, 2000);
}

function showProgress(stage, percent){
  const p = el('progress'); const s = el('progressStage'); const b = el('progressBar');
  if (!p || !s || !b) return;
  s.textContent = String(stage || '');
  b.style.width = `${Math.max(0, Math.min(100, Number(percent || 0)))}%`;
  p.classList.add('show');
  if (percent >= 100) setTimeout(()=>{ try{ p.classList.remove('show'); }catch(e){} }, 250);
}

function renderList(){
  const list = el('noteList');
  if (!list) return;
  list.innerHTML = '';
  for (const it of historyItems) {
    const div = document.createElement('div');
    div.className = 'list-item';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    icon.setAttribute('width', '20');
    icon.setAttribute('height', '20');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.innerHTML = '<path fill="currentColor" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.414a2 2 0 0 0-.586-1.414l-3.414-3.414A2 2 0 0 0 12.586 2H4zm0 2h8.586L16 8.414V15H4zm5 2a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1H7a1 1 0 1 1 0-2h1V8a1 1 0 0 1 1-1"/>';
    const name = document.createElement('div');
    name.textContent = String(it.title || it.path || '未命名');
    const time = document.createElement('div');
    time.style.fontSize = '12px';
    time.style.color = 'rgba(0,0,0,0.5)';
    time.textContent = new Date(Number(it.modifiedAt || Date.now())).toLocaleString();
    div.appendChild(icon);
    div.appendChild(name);
    div.appendChild(time);
    div.addEventListener('click', ()=>{ loadNoteFromPath(it.path, it); });
    list.appendChild(div);
  }
}

function setPreviewTitle(title, meta){
  const t = el('previewTitle'); const m = el('previewMeta');
  if (t) t.textContent = title || '未选择笔记';
  if (m) {
    const created = meta && meta.createdAt ? new Date(Number(meta.createdAt)).toLocaleString() : '';
    const modified = meta && meta.modifiedAt ? new Date(Number(meta.modifiedAt)).toLocaleString() : '';
    m.textContent = meta ? `创建: ${created}  更新: ${modified}` : '';
  }
}

function setTextRender(state){
  const v = el('textRender');
  if (!v) return;
  if (!state || typeof state !== 'object') { v.textContent = '暂无文本内容'; return; }
  try{
    const d = state.documents || {};
    const wb = d.whiteboard || {};
    const an = d.annotation || {};
    const count = (arr)=>Array.isArray(arr) ? arr.length : 0;
    v.innerHTML = `白板笔画: ${count(wb.ops)}；批注笔画: ${count(an.ops)}；历史快照: ${count(wb.history) + count(an.history)}`;
  }catch(e){
    v.textContent = '内容解析失败';
  }
}

async function loadHistory(){
  try{
    const r = await window.electronAPI.invokeMain('message', 'note-manager:get-history', {});
    historyItems = Array.isArray(r && r.items) ? r.items : [];
    renderList();
  }catch(e){}
}

async function saveHistory(){
  try{
    const r = await window.electronAPI.invokeMain('message', 'note-manager:save-history', { items: historyItems });
    historyItems = Array.isArray(r && r.items) ? r.items : historyItems;
    renderList();
  }catch(e){}
}

async function loadNoteFromPath(pathStr, hint){
  try{
    currentRequestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const res = await window.electronAPI.invokeMain('message', 'note:import-cubenote', { path: String(pathStr || ''), requestId: currentRequestId });
    currentRequestId = '';
    if (!res || !res.success || !res.state) { showToast(`预览失败：${res && (res.error || res.reason) ? String(res.error || res.reason) : '未知错误'}`, 'error'); return; }
    currentState = res.state;
    buildPreviewPagesFromState(currentState);
    applyPreviewPage(0);
    setInputEnabled(false);
    window.dispatchEvent(new Event('resize'));
    setPreviewTitle(hint && hint.title ? hint.title : String(pathStr || '笔记'), currentState.meta || null);
    setTextRender(previewPages[previewPageIndex] || currentState);
    updatePreviewPageToolbar();
    const tt = document.getElementById('nmTitle');
    if (tt) tt.textContent = String(pathStr || '笔记管理');
  }catch(e){ showToast('预览失败', 'error'); }
}

async function doImport(){
  try{
    const r = await window.electronAPI.invokeMain('message', 'note:open-import-dialog', {});
    if (!r || !r.success || !r.path) { showToast('已取消导入', 'success'); return; }
    currentRequestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const res = await window.electronAPI.invokeMain('message', 'note:import-cubenote', { path: String(r.path), requestId: currentRequestId });
    currentRequestId = '';
    if (!res || !res.success || !res.state) { showToast(`导入失败：${res && (res.error || res.reason) ? String(res.error || res.reason) : '未知错误'}`, 'error'); return; }
    currentState = res.state;
    buildPreviewPagesFromState(currentState);
    applyPreviewPage(0);
    setInputEnabled(false);
    window.dispatchEvent(new Event('resize'));
    const title = String(r.path).split(/[\\/]/).pop();
    setPreviewTitle(title, currentState.meta || null);
    setTextRender(previewPages[previewPageIndex] || currentState);
    updatePreviewPageToolbar();
    const now = Date.now();
    const item = { id: `${now}`, path: String(r.path), title, modifiedAt: now };
    historyItems = [item, ...historyItems].slice(0, 100);
    await saveHistory();
    showToast('导入完成', 'success');
  }catch(e){ showToast('导入失败', 'error'); }
}

async function doExport(){
  try{
    const r = await window.electronAPI.invokeMain('message', 'note-manager:request-export', {});
    if (r && r.success) {
      showToast('已在主白板窗口导出当前页面', 'success');
    } else {
      showToast('导出失败', 'error');
    }
  }catch(e){ showToast('导出失败', 'error'); }
}

document.addEventListener('DOMContentLoaded', ()=>{
  const closeBtn = el('closeBtn');
  const importBtn = el('importBtn');
  const exportBtn = el('exportBtn');
  const applyBtn = el('applyBtn');
  const modeWb = el('modeWb');
  const modeAn = el('modeAn');
  const rotInput = el('rotationInput');
  const rotLabel = el('rotationLabel');
  if (closeBtn) closeBtn.addEventListener('click', ()=>window.close());
  if (importBtn) importBtn.addEventListener('click', doImport);
  if (exportBtn) exportBtn.addEventListener('click', doExport);
  if (applyBtn) applyBtn.addEventListener('click', ()=>{
    openApplyChoiceModalIfNeeded();
  });
  if (modeWb) {
    const tip = el('wbTip');
    const showTip = (x, y) => {
      if (!tip) return;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.setAttribute('aria-hidden', 'false');
      tip.classList.add('show');
    };
    const hideTip = () => {
      if (!tip) return;
      tip.setAttribute('aria-hidden', 'true');
      tip.classList.remove('show');
    };
    modeWb.addEventListener('mouseenter', (ev)=>{
      if (tooltipTimer) { try{ clearTimeout(tooltipTimer); }catch(e){} tooltipTimer = 0; }
      tooltipTimer = setTimeout(()=>{
        const r = modeWb.getBoundingClientRect();
        showTip(Math.round(r.left + r.width/2), Math.round(r.top - 8));
      }, 300);
    });
    modeWb.addEventListener('mouseleave', ()=>{
      if (tooltipTimer) { try{ clearTimeout(tooltipTimer); }catch(e){} tooltipTimer = 0; }
      hideTip();
    });
    modeWb.addEventListener('click', ()=>{
      try{ setCanvasMode('whiteboard'); }catch(e){}
      openApplyChoiceModalIfNeeded();
    });
  }
  if (modeAn) modeAn.addEventListener('click', ()=>{ try{ setCanvasMode('annotation'); }catch(e){} });
  const zoomInput = el('zoomInput');
  const zoomLabel = el('zoomLabel');
  const board = el('board');
  const wrap = board ? board.parentElement : null;
  const prevBtn = el('previewPrev');
  const nextBtn = el('previewNext');
  if (prevBtn) prevBtn.addEventListener('click', ()=>{ applyPreviewPage(previewPageIndex - 1); });
  if (nextBtn) nextBtn.addEventListener('click', ()=>{ applyPreviewPage(previewPageIndex + 1); });
  if (zoomInput) zoomInput.addEventListener('input', ()=>{
    const percent = Math.max(10, Math.min(1000, Number(zoomInput.value || 100)));
    if (zoomLabel) zoomLabel.textContent = `缩放: ${percent}%`;
    const vt = getViewTransform();
    viewScaleCache = Number(vt.scale) || 1;
    viewOffsetXCache = Number(vt.offsetX) || 0;
    viewOffsetYCache = Number(vt.offsetY) || 0;
    const targetScale = percent / 100;
    const rect = wrap ? wrap.getBoundingClientRect() : (board ? board.getBoundingClientRect() : { left:0, top:0, width:0, height:0 });
    const cx = Math.round(rect.left + rect.width/2);
    const cy = Math.round(rect.top + rect.height/2);
    const anchored = anchorZoom(cx, cy, targetScale);
    applyTransform(anchored.scale, anchored.offsetX, anchored.offsetY);
    showZoomHint(`${percent}%`);
  });
  if (board && wrap) {
    initPointerInteractions(board, wrap);
    initWheelZoom(board, wrap);
  }
  loadHistory();
});

try{
  if (window && window.electronAPI && typeof window.electronAPI.onReplyFromMain === 'function') {
    window.electronAPI.onReplyFromMain('note:io-progress', (payload)=>{
      try{
        const p = payload && typeof payload === 'object' ? payload : {};
        const rid = String(p.requestId || '');
        if (!currentRequestId || rid !== currentRequestId) return;
        const stage = p.stage ? String(p.stage) : '';
        const percent = Number(p.percent || 0);
        showProgress(stage, percent);
      }catch(e){}
    });
  }
}catch(e){}

function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(()=>{ try{ o.stop(); ctx.close(); }catch(e){} }, 120);
  }catch(e){}
}

function openApplyChoiceModalIfNeeded(){
  try{ lastChoicePref = localStorage.getItem('noteManagerApplyPref') || 'overwrite'; }catch(e){}
  const skip = (()=>{ try{ return localStorage.getItem('noteManagerApplySkip') === '1'; }catch(e){ return false; } })();
  if (skip) { applyPreviewWithChoice(lastChoicePref === 'merge' ? 'merge' : 'overwrite'); return; }
  openApplyChoiceModal();
}

function openApplyChoiceModal(){
  const backdrop = el('applyChoiceBackdrop');
  const panel = el('applyChoicePanel');
  const btnClose = el('applyChoiceClose');
  const btnOverwrite = el('btnOverwrite');
  const btnMerge = el('btnMerge');
  const btnCancel = el('btnCancel');
  const chkDontAsk = el('chkDontAsk');
  if (!backdrop || !panel || !btnClose || !btnOverwrite || !btnMerge || !btnCancel || !chkDontAsk) return;
  try{ lastChoicePref = localStorage.getItem('noteManagerApplyPref') || 'overwrite'; }catch(e){}
  try{ chkDontAsk.checked = localStorage.getItem('noteManagerApplySkip') === '1'; }catch(e){}
  const selectChoice = async (choice)=>{
    try{ localStorage.setItem('noteManagerApplyPref', choice); }catch(e){}
    lastChoicePref = choice;
    if (choice === 'overwrite') {
      const ok = window.confirm('确定要覆盖当前画布吗？此操作不可撤销');
      if (!ok) return;
    }
    try{ localStorage.setItem('noteManagerApplySkip', chkDontAsk.checked ? '1' : '0'); }catch(e){}
    beep();
    closeApplyChoiceModal();
    await applyPreviewWithChoice(choice);
  };
  const closeApplyChoiceModal = ()=>{
    backdrop.classList.remove('show'); backdrop.setAttribute('aria-hidden','true');
    panel.classList.remove('show'); panel.setAttribute('aria-hidden','true');
    try{ document.removeEventListener('keydown', onKeyDown, true); }catch(e){}
  };
  const onKeyDown = (ev)=>{
    const k = (ev.key || '').toLowerCase();
    if (k === 'escape') { ev.preventDefault(); closeApplyChoiceModal(); return; }
    if (k === 'enter') { ev.preventDefault(); selectChoice(lastChoicePref || 'overwrite'); return; }
    if (k === 'arrowleft' || k === 'arrowright') {
      ev.preventDefault();
      lastChoicePref = (lastChoicePref === 'merge') ? 'overwrite' : 'merge';
      return;
    }
  };
  btnOverwrite.addEventListener('click', ()=>selectChoice('overwrite'), { once: true });
  btnMerge.addEventListener('click', ()=>selectChoice('merge'), { once: true });
  btnCancel.addEventListener('click', ()=>{ beep(); closeApplyChoiceModal(); }, { once: true });
  btnClose.addEventListener('click', ()=>{ beep(); closeApplyChoiceModal(); }, { once: true });
  backdrop.addEventListener('click', ()=>{ beep(); closeApplyChoiceModal(); }, { once: true });
  backdrop.classList.add('show'); backdrop.setAttribute('aria-hidden','false');
  panel.classList.add('show'); panel.setAttribute('aria-hidden','false');
  document.addEventListener('keydown', onKeyDown, true);
}

async function applyPreviewWithChoice(choice){
  try{
    ensureZoomReset();
    const vt = getViewTransform();
    const s = getCubenoteState();
    const size = (()=>{ try{ return JSON.stringify(s).length; }catch(e){ return 0; } })();
    if (size > 2_000_000) showToast('预览数据较大，应用可能需要时间', 'success');
    const payload = {
      success: true,
      activeDocKey: 'whiteboard',
      pageIndex: 0,
      viewScale: 1,
      rotationDeg: Number(vt.rotation) || 0,
      state: s,
      conflict: choice === 'merge' ? 'merge' : 'overwrite'
    };
    let r = await window.electronAPI.invokeMain('message', 'note-manager:apply-to-whiteboard', payload);
    if (!r || !r.success) {
      r = await window.electronAPI.invokeMain('message', 'note-manager:apply-to-whiteboard', payload);
    }
    if (!r || !r.success) { showToast('应用失败', 'error'); return; }
    showToast(`已应用到白板（${choice==='merge'?'合并':'覆盖'}）`, 'success');
  }catch(e){ showToast('应用失败', 'error'); }
}

function ensureZoomReset(){
  const wrap = el('board') ? el('board').parentElement : null;
  const rect = wrap ? wrap.getBoundingClientRect() : { left:0, top:0, width:0, height:0 };
  const anchored = anchorZoom(Math.round(rect.left + rect.width/2), Math.round(rect.top + rect.height/2), 1);
  applyTransform(anchored.scale, anchored.offsetX, anchored.offsetY);
  const zoomInput = el('zoomInput'); const zoomLabel = el('zoomLabel');
  if (zoomInput) zoomInput.value = '100';
  if (zoomLabel) zoomLabel.textContent = '缩放: 100%';
}
function clampTransform(scale, offsetX, offsetY, wrapRect){
  const w = Math.max(1, Number(wrapRect.width || 0));
  const h = Math.max(1, Number(wrapRect.height || 0));
  const scaledW = w * scale;
  const scaledH = h * scale;
  const minX = Math.min(0, w - scaledW);
  const maxX = 0;
  const minY = Math.min(0, h - scaledH);
  const maxY = 0;
  const ox = Math.max(minX, Math.min(maxX, offsetX));
  const oy = Math.max(minY, Math.min(maxY, offsetY));
  return { scale, offsetX: ox, offsetY: oy };
}

function applyTransform(scale, offsetX, offsetY){
  viewScaleCache = scale;
  viewOffsetXCache = offsetX;
  viewOffsetYCache = offsetY;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(()=>{
      try{ setViewTransform(viewScaleCache, viewOffsetXCache, viewOffsetYCache); }catch(e){}
      rafPending = false;
      updateEdgeFeedback();
    });
  }
}

function anchorZoom(centerX, centerY, targetScale){
  const wrap = el('board') ? el('board').parentElement : null;
  const rect = wrap ? wrap.getBoundingClientRect() : { left:0, top:0, width:0, height:0 };
  const vt = getViewTransform();
  const s0 = Math.max(0.1, Math.min(10.0, Number(vt.scale) || 1));
  const tx0 = Number(vt.offsetX) || 0;
  const ty0 = Number(vt.offsetY) || 0;
  const ax = (centerX - tx0) / s0;
  const ay = (centerY - ty0) / s0;
  const ts = Math.max(0.1, Math.min(10.0, Number(targetScale) || 1));
  let tx1 = centerX - ax * ts;
  let ty1 = centerY - ay * ts;
  const clamped = clampTransform(ts, tx1, ty1, rect);
  return clamped;
}

function showZoomHint(text){
  const hint = el('zoomHint');
  if (!hint) return;
  hint.textContent = String(text || '');
  hint.classList.add('show');
  setTimeout(()=>{ try{ hint.classList.remove('show'); }catch(e){} }, 800);
}

function updateEdgeFeedback(){
  const board = el('board');
  const wrap = board ? board.parentElement : null;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const vt = getViewTransform();
  const s = Number(vt.scale) || 1;
  const ox = Number(vt.offsetX) || 0;
  const oy = Number(vt.offsetY) || 0;
  const w = Math.max(1, Number(rect.width || 0));
  const h = Math.max(1, Number(rect.height || 0));
  const minX = Math.min(0, w - w * s);
  const minY = Math.min(0, h - h * s);
  const left = el('edgeLeft'), right = el('edgeRight'), top = el('edgeTop'), bottom = el('edgeBottom');
  if (left) { if (Math.round(ox) <= Math.round(minX)) left.classList.add('show'); else left.classList.remove('show'); }
  if (right) { if (Math.round(ox) >= 0) right.classList.add('show'); else right.classList.remove('show'); }
  if (top) { if (Math.round(oy) >= 0) top.classList.add('show'); else top.classList.remove('show'); }
  if (bottom) { if (Math.round(oy) <= Math.round(minY)) bottom.classList.add('show'); else bottom.classList.remove('show'); }
}

function initWheelZoom(board, wrap){
  wrap.addEventListener('wheel', (e)=>{
    if (!e.ctrlKey) return;
    e.preventDefault();
    const vt = getViewTransform();
    const s0 = Math.max(0.1, Math.min(10.0, Number(vt.scale) || 1));
    const factor = e.deltaY < 0 ? 1.2 : 0.8;
    const target = Math.max(0.1, Math.min(10.0, s0 * factor));
    const cx = Math.round(e.clientX);
    const cy = Math.round(e.clientY);
    const anchored = anchorZoom(cx, cy, target);
    applyTransform(anchored.scale, anchored.offsetX, anchored.offsetY);
    const percent = Math.round(anchored.scale * 100);
    const zoomInput = el('zoomInput'); const zoomLabel = el('zoomLabel');
    if (zoomInput) zoomInput.value = String(percent);
    if (zoomLabel) zoomLabel.textContent = `缩放: ${percent}%`;
    showZoomHint(`${percent}%`);
  }, { passive: false });
}

function initPointerInteractions(board, wrap){
  board.addEventListener('contextmenu', (e)=>{ e.preventDefault(); });
  board.addEventListener('pointerdown', (e)=>{
    stopInertia();
    const isMouse = (e.pointerType === 'mouse');
    const rect = wrap.getBoundingClientRect();
    const vt = getViewTransform();
    viewScaleCache = Number(vt.scale) || 1;
    viewOffsetXCache = Number(vt.offsetX) || 0;
    viewOffsetYCache = Number(vt.offsetY) || 0;
    if (isMouse && e.button === 2) {
      panActive = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartOffsetX = viewOffsetXCache;
      panStartOffsetY = viewOffsetYCache;
      lastMoveTs = performance.now();
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      try{ board.setPointerCapture(e.pointerId); }catch(err){}
      e.preventDefault();
      return;
    }
    if (e.pointerType === 'touch') {
      if (!pinchActive && !p1) {
        p1 = { id: e.pointerId, x: e.clientX, y: e.clientY };
      } else if (!pinchActive && !p2) {
        p2 = { id: e.pointerId, x: e.clientX, y: e.clientY };
        pinchActive = true;
        pinchStartDist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const vt = getViewTransform();
        pinchStartScale = Number(vt.scale) || 1;
      }
      try{ board.setPointerCapture(e.pointerId); }catch(err){}
      e.preventDefault();
      return;
    }
  });
  board.addEventListener('pointermove', (e)=>{
    if (pinchActive && p1 && p2) {
      if (e.pointerId === p1.id) { p1.x = e.clientX; p1.y = e.clientY; }
      if (e.pointerId === p2.id) { p2.x = e.clientX; p2.y = e.clientY; }
      const dist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const target = Math.max(0.1, Math.min(10.0, pinchStartScale * (dist / Math.max(1, pinchStartDist))));
      const cx = Math.round((p1.x + p2.x) / 2);
      const cy = Math.round((p1.y + p2.y) / 2);
      const anchored = anchorZoom(cx, cy, target);
      applyTransform(anchored.scale, anchored.offsetX, anchored.offsetY);
      const percent = Math.round(anchored.scale * 100);
      const zoomInput = el('zoomInput'); const zoomLabel = el('zoomLabel');
      if (zoomInput) zoomInput.value = String(percent);
      if (zoomLabel) zoomLabel.textContent = `缩放: ${percent}%`;
      showZoomHint(`${percent}%`);
      e.preventDefault();
      return;
    }
    if (panActive) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      const targetX = panStartOffsetX + dx;
      const targetY = panStartOffsetY + dy;
      const clamped = clampTransform(viewScaleCache, targetX, targetY, rect);
      applyTransform(clamped.scale, clamped.offsetX, clamped.offsetY);
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTs);
      const vx = (e.clientX - lastMoveX) / dt;
      const vy = (e.clientY - lastMoveY) / dt;
      inertiaVX = vx * 16;
      inertiaVY = vy * 16;
      lastMoveTs = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      e.preventDefault();
      return;
    }
  });
  board.addEventListener('pointerup', (e)=>{
    if (pinchActive) {
      if (p2 && e.pointerId === p2.id) { p2 = null; }
      if (p1 && e.pointerId === p1.id) { p1 = p2; p2 = null; }
      if (!p1 || !p2) { pinchActive = false; pinchStartDist = 0; }
    } else if (panActive) {
      panActive = false;
      startInertia(wrap.getBoundingClientRect());
    }
    try{ board.releasePointerCapture(e.pointerId); }catch(err){}
  });
  board.addEventListener('pointercancel', (e)=>{
    panActive = false;
    pinchActive = false;
    p1 = null; p2 = null;
    stopInertia();
    try{ board.releasePointerCapture(e.pointerId); }catch(err){}
  });
}

function updatePreviewPageToolbar(){
  const tb = el('previewPageToolbar');
  const prev = el('previewPrev');
  const next = el('previewNext');
  const label = el('previewLabel');
  const total = Array.isArray(previewPages) ? previewPages.length : 1;
  let current = Math.max(1, Math.min(total, previewPageIndex + 1));
  if (tb) tb.style.display = total > 1 ? 'block' : 'none';
  if (label) label.textContent = `${current}/${total}`;
  if (prev) { prev.disabled = current <= 1; prev.style.opacity = prev.disabled ? '0.5' : '1'; }
  if (next) { next.disabled = current >= total; next.style.opacity = next.disabled ? '0.5' : '1'; }
}

function buildPreviewPagesFromState(state){
  previewPages = [];
  previewPageIndex = 0;
  try{
    const s = (state && typeof state === 'object') ? state : null;
    if (!s || s.format !== 'cubenote-state') { previewPages = [state]; return; }
    const docs = s.documents && typeof s.documents === 'object' ? s.documents : {};
    previewDocKey = (s.activeDocKey === 'annotation') ? 'annotation' : 'whiteboard';
    const doc = docs[previewDocKey] || {};
    const pages = Array.isArray(doc.pages) ? doc.pages : null;
    if (pages && pages.length > 0) {
      for (const pg of pages) {
        const derived = deriveStateForPage(s, pg, previewDocKey);
        previewPages.push(derived);
      }
    } else {
      previewPages.push(deriveStateForPage(s, null, previewDocKey));
    }
  }catch(e){
    previewPages = [state];
  }
}

function deriveStateForPage(baseState, pageEntry, docKey){
  const clone = JSON.parse(JSON.stringify(baseState || {}));
  try{
    clone.activeDocKey = docKey || (clone.activeDocKey || 'whiteboard');
    const doc = clone.documents && clone.documents[docKey] ? clone.documents[docKey] : null;
    if (!doc) return clone;
    if (pageEntry && typeof pageEntry === 'object') {
      if (Array.isArray(pageEntry.ops)) {
        doc.ops = JSON.parse(JSON.stringify(pageEntry.ops));
        doc.history = Array.isArray(pageEntry.history) ? JSON.parse(JSON.stringify(pageEntry.history)) : [[]];
        doc.historyIndex = Number.isFinite(Number(pageEntry.historyIndex)) ? Number(pageEntry.historyIndex) : 0;
        if (pageEntry.view && typeof pageEntry.view === 'object') {
          doc.view = {
            scale: Number(pageEntry.view.scale) || 1,
            offsetX: Number(pageEntry.view.offsetX) || 0,
            offsetY: Number(pageEntry.view.offsetY) || 0,
            rotation: Number(pageEntry.view.rotation) || 0
          };
        }
      } else if (pageEntry.state && typeof pageEntry.state === 'object') {
        return JSON.parse(JSON.stringify(pageEntry.state));
      } else if (pageEntry.document && typeof pageEntry.document === 'object') {
        clone.documents[docKey] = JSON.parse(JSON.stringify(pageEntry.document));
      }
    } else {
      doc.ops = Array.isArray(doc.ops) ? doc.ops : [];
      doc.history = Array.isArray(doc.history) ? doc.history : [[]];
      doc.historyIndex = Number.isFinite(Number(doc.historyIndex)) ? Number(doc.historyIndex) : 0;
      doc.view = doc.view && typeof doc.view === 'object'
        ? { scale: Number(doc.view.scale) || 1, offsetX: Number(doc.view.offsetX) || 0, offsetY: Number(doc.view.offsetY) || 0, rotation: Number(doc.view.rotation) || 0 }
        : { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
    }
  }catch(e){}
  return clone;
}

function applyPreviewPage(idx){
  const total = Array.isArray(previewPages) ? previewPages.length : 1;
  const next = Math.max(0, Math.min(total - 1, Number(idx) || 0));
  previewPageIndex = next;
  try{
    const state = previewPages[next] || currentState;
    applyCubenoteState(state, { conflict: 'overwrite' });
    setInputEnabled(false);
    fitPreviewToContent();
    setTextRender(state);
  }catch(e){ showToast('页面切换失败', 'error'); }
  updatePreviewPageToolbar();
}

function startInertia(wrapRect){
  if (inertiaActive) return;
  const friction = 0.92;
  const minSpeed = 0.08;
  inertiaActive = true;
  const step = ()=>{
    if (!inertiaActive) return;
    inertiaVX *= friction;
    inertiaVY *= friction;
    const vt = getViewTransform();
    const s = Number(vt.scale) || 1;
    const ox = Number(vt.offsetX) || 0;
    const oy = Number(vt.offsetY) || 0;
    const targetX = ox + inertiaVX;
    const targetY = oy + inertiaVY;
    const clamped = clampTransform(s, targetX, targetY, wrapRect);
    applyTransform(clamped.scale, clamped.offsetX, clamped.offsetY);
    const speed = Math.hypot(inertiaVX, inertiaVY);
    const stuckX = Math.abs(clamped.offsetX - ox) < 0.01;
    const stuckY = Math.abs(clamped.offsetY - oy) < 0.01;
    if (speed < minSpeed || (stuckX && stuckY)) { stopInertia(); return; }
    inertiaFrame = requestAnimationFrame(step);
  };
  inertiaFrame = requestAnimationFrame(step);
}

function stopInertia(){
  inertiaActive = false;
  try{ if (inertiaFrame) cancelAnimationFrame(inertiaFrame); }catch(e){}
  inertiaFrame = 0;
  inertiaVX = 0;
  inertiaVY = 0;
}

function getPreviewOps(){
  try{
    const state = Array.isArray(previewPages) && previewPages[previewPageIndex] ? previewPages[previewPageIndex] : getCubenoteState();
    const docs = state && state.documents ? state.documents : {};
    const doc = docs[previewDocKey] || docs.whiteboard || docs.annotation || null;
    const ops = doc && Array.isArray(doc.ops) ? doc.ops : [];
    return ops;
  }catch(e){ return []; }
}
function calculateBboxFromOps(ops){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || op.type !== 'stroke' || !Array.isArray(op.points)) continue;
    for (const p of op.points) {
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { minX, minY, maxX, maxY, width, height, cx, cy };
}
function fitPreviewToContent(){
  const board = el('board');
  const wrap = board ? board.parentElement : null;
  if (!board || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const ops = getPreviewOps();
  const bbox = calculateBboxFromOps(ops);
  if (!isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) return;
  const targetScale = Math.max(0.1, Math.min(10.0, Math.min(board.width / bbox.width, board.height / bbox.height) * 0.9));
  const offsetX = Math.round(rect.width * (0.5 - (bbox.cx * targetScale) / (board.width * 1)));
  const offsetY = Math.round(rect.height * (0.5 - (bbox.cy * targetScale) / (board.height * 1)));
  const clamped = clampTransform(targetScale, offsetX, offsetY, rect);
  applyTransform(clamped.scale, clamped.offsetX, clamped.offsetY);
  const percent = Math.round(clamped.scale * 100);
  const zoomInput = el('zoomInput'); const zoomLabel = el('zoomLabel');
  if (zoomInput) zoomInput.value = String(percent);
  if (zoomLabel) zoomLabel.textContent = `缩放: ${percent}%`;
}
