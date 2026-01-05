// Enhanced renderer.js with InkCanvas integration
// Core drawing logic with dynamic brush effects and low-latency rendering

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0, lastY = 0;
let brushSize = 4;
let eraserSize = 20;
let brushColor = '#000000';
let erasing = false;
let eraserMode = 'pixel';

const _documents = {
  whiteboard: { ops: [], history: [], historyIndex: -1, brushSize: 4, eraserSize: 20, brushColor: '#000000', erasing: false, eraserMode: 'pixel', view: { scale: 1, offsetX: 0, offsetY: 0 } },
  annotation: { ops: [], history: [], historyIndex: -1, brushSize: 4, eraserSize: 20, brushColor: '#ff0000', erasing: false, eraserMode: 'pixel', view: { scale: 1, offsetX: 0, offsetY: 0 } }
};
let _activeDocKey = 'whiteboard';

let ops = _documents[_activeDocKey].ops;
let currentOp = null;
let _strokePoints = [];
let _drawPending = false;
let _lastMid = null;
let _rafId = null;
let history = _documents[_activeDocKey].history;
let historyIndex = _documents[_activeDocKey].historyIndex;
const HISTORY_LIMIT = 30;

import Message, { EVENTS } from './message.js';

let _noteMeta = { createdAt: Date.now(), modifiedAt: Date.now() };

function snapshotOps(srcOps) {
  const cloned = JSON.parse(JSON.stringify(Array.isArray(srcOps) ? srcOps : []));
  for (const op of cloned) {
    if (op && op.type === 'stroke' && Array.isArray(op.points) && op.points.length > 600) {
      const maxPoints = 600;
      const step = Math.ceil(op.points.length / maxPoints);
      op.points = op.points.filter((p, i) => (i % step) === 0);
    }
  }
  return cloned;
}

function pushHistory() {
  if (historyIndex < history.length - 1) history.splice(historyIndex + 1);
  history.push(snapshotOps(ops));
  historyIndex = history.length - 1;
  if (history.length > HISTORY_LIMIT) { history.shift(); historyIndex--; }
  try{ _documents[_activeDocKey].historyIndex = historyIndex; }catch(e){}
  try{ _noteMeta.modifiedAt = Date.now(); }catch(e){}
  try{ Message.emit(EVENTS.HISTORY_CHANGED, { canUndo: canUndo(), canRedo: canRedo() }); }catch(e){}
}

function updateCanvasSize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const widthCss = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const heightCss = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  canvas.style.width = widthCss + 'px';
  canvas.style.height = heightCss + 'px';
  canvas.width = Math.floor(widthCss * dpr);
  canvas.height = Math.floor(heightCss * dpr);
  if (ctx.resetTransform) ctx.resetTransform(); else ctx.setTransform(1,0,0,1,0,0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;

let inputEnabled = true;
let multiTouchPenEnabled = false;
const touchStrokeMap = new Map();

export function setInputEnabled(enabled){ inputEnabled = !!enabled; }

export function setMultiTouchPenEnabled(enabled){
  multiTouchPenEnabled = !!enabled;
}

let _inkSeq = 0;
let _inkDebounceId = 0;
let _inkHoldId = 0;
let _inkPending = [];
let _inkPreview = null;
let _inkUi = null;
let _inkAutoConfirmId = 0;
let _activePointerId = 0;
let _inkLastScheduleAt = 0;
let _inkRecognitionEnabled = false;

export function setInkRecognitionEnabled(enabled){
  _inkRecognitionEnabled = !!enabled;
  _cancelInkTimers();
  if (!_inkRecognitionEnabled) _dismissInkPreview(false);
}

function applyViewTransform(){
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = `translate(${viewOffsetX}px, ${viewOffsetY}px) scale(${viewScale})`;
}

export function setViewTransform(scale, offsetX, offsetY){
  viewScale = Math.max(0.1, Math.min(3.0, scale));
  viewOffsetX = Number(offsetX) || 0;
  viewOffsetY = Number(offsetY) || 0;
  try{ _documents[_activeDocKey].view = { scale: viewScale, offsetX: viewOffsetX, offsetY: viewOffsetY }; }catch(e){}
  applyViewTransform();
}

export function getViewTransform(){ return { scale: viewScale, offsetX: viewOffsetX, offsetY: viewOffsetY }; }

function screenToCanvas(clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cssX = clientX - rect.left - viewOffsetX;
  const cssY = clientY - rect.top - viewOffsetY;
  const x = (cssX * scaleX) / viewScale;
  const y = (cssY * scaleY) / viewScale;
  return { x, y };
}

window.addEventListener('resize', () => { updateCanvasSize(); redrawAll(); });

function shouldUseMultiTouchStroke(e){
  return !!(multiTouchPenEnabled && inputEnabled && !erasing && e && e.pointerType === 'touch' && e.pointerId);
}

const _inkCanvasConfig = {
  dynamicBrushEnabled: true,
  pressureSensitivity: 0.7,
  speedSensitivity: 0.8,
  minBrushRatio: 0.4,
  maxBrushRatio: 1.6,
  smoothingFactor: 0.3,
  adaptiveSmoothing: true
};

const _strokeMetrics = {
  startTime: 0,
  lastPointTime: 0,
  pointCount: 0,
  totalDistance: 0,
  avgSpeed: 0,
  speedHistory: []
};

function calculateSpeed(p1, p2, deltaTime) {
  if (deltaTime <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance / deltaTime;
}

function calculateDynamicWidth(baseWidth, speed, pressure = 1.0) {
  if (!_inkCanvasConfig.dynamicBrushEnabled) return baseWidth;

  const speedFactor = Math.min(speed / 2.5, 1);
  const speedRatio = _inkCanvasConfig.minBrushRatio + 
                     (_inkCanvasConfig.maxBrushRatio - _inkCanvasConfig.minBrushRatio) * 
                     (1 - speedFactor * _inkCanvasConfig.speedSensitivity);

  const pressureRatio = 1.0 - (1.0 - pressure) * _inkCanvasConfig.pressureSensitivity;

  return baseWidth * speedRatio * pressureRatio;
}

function enhanceStrokePoints(points, baseSize, pressures = []) {
  if (!Array.isArray(points) || points.length < 2) {
    return points.map((p, i) => ({
      x: p.x,
      y: p.y,
      size: baseSize,
      pressure: pressures[i] || 1.0,
      timestamp: p.timestamp || Date.now()
    }));
  }

  const enhanced = [];
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const pressure = pressures[i] || 1.0;
    let dynamicSize = baseSize;

    if (i > 0) {
      const prevPoint = points[i - 1];
      const deltaTime = (point.timestamp || Date.now()) - (prevPoint.timestamp || Date.now());
      const speed = calculateSpeed(prevPoint, point, deltaTime);
      dynamicSize = calculateDynamicWidth(baseSize, speed, pressure);
    }

    enhanced.push({
      x: point.x,
      y: point.y,
      size: dynamicSize,
      pressure: pressure,
      timestamp: point.timestamp || Date.now()
    });
  }

  return enhanced;
}

function smoothDynamicSizes(points, adaptive = true) {
  if (!Array.isArray(points) || points.length < 3) {
    return points;
  }

  const smoothed = [points[0]];
  const smoothingFactor = adaptive ? 
    Math.min(_inkCanvasConfig.smoothingFactor * (1 + 1 / points.length), 0.5) :
    _inkCanvasConfig.smoothingFactor;

  for (let i = 1; i < points.length - 1; i++) {
    const prevSize = points[i - 1].size;
    const currSize = points[i].size;
    const nextSize = points[i + 1].size;
    
    const smoothedSize = prevSize * smoothingFactor + 
                        currSize * (1 - 2 * smoothingFactor) + 
                        nextSize * smoothingFactor;
    
    smoothed.push({
      x: points[i].x,
      y: points[i].y,
      size: Math.max(smoothedSize, points[i].size * 0.8),
      pressure: points[i].pressure,
      timestamp: points[i].timestamp
    });
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

function drawEnhancedStrokeSegment(p1, p2, size1, size2, color) {
  ctx.save();
  ctx.strokeStyle = color || '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const midSize = (size1 + size2) / 2;

  ctx.lineWidth = midSize;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.restore();
}

function drawBufferedStrokeSegmentFromState(state, flush = false) {
  if (!state || !state.strokePoints || state.strokePoints.length === 0) return;
  const op = state.op;
  const pts = state.strokePoints.slice();
  const pressures = state.pressures || [];
  
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = (op && op.color) || '#000';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (pts.length === 1) {
    const p = pts[0];
    const size = (op && op.size) || 1;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.restore();
    if (flush) state.strokePoints.length = 0;
    return;
  }

  const enhancedPoints = enhanceStrokePoints(pts, op.size, pressures);
  const smoothedPoints = smoothDynamicSizes(enhancedPoints);

  for (let i = 0; i < smoothedPoints.length - 1; i++) {
    const p1 = smoothedPoints[i];
    const p2 = smoothedPoints[i + 1];
    drawEnhancedStrokeSegment(p1, p2, p1.size, p2.size, op.color);
  }

  ctx.restore();
  if (flush) {
    state.strokePoints.length = 0;
    state.pressures = [];
  } else if (pts.length > 1) {
    state.strokePoints = [pts[pts.length - 2], pts[pts.length - 1]];
    state.pressures = [pressures[pressures.length - 2] || 1.0, pressures[pressures.length - 1] || 1.0];
  }
}

function finalizeOp(op){
  if (!op) return;
  if (op.type === 'stroke' || op.type === 'erase' || op.type === 'clearRect') {
    ops.push(op);
    pushHistory();
    if (op.type === 'stroke') _enqueueInkRecognition(op);
  }
}

function finalizeMultiTouchStroke(e){
  const state = touchStrokeMap.get(e.pointerId);
  if (!state) return false;
  if (state.strokePoints && state.strokePoints.length > 0 && state.op && state.op.type === 'stroke') {
    drawBufferedStrokeSegmentFromState(state, true);
  }
  try { if (e && e.pointerId && canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId); } catch(err) {}
  finalizeOp(state.op);
  touchStrokeMap.delete(e.pointerId);
  return true;
}

function pointerDown(e){
  if (!inputEnabled) return;
  _inkSeq += 1;
  _inkLastScheduleAt = 0;
  _cancelInkTimers();
  _dismissInkPreview(true);
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const pressure = e.pressure !== undefined ? e.pressure : 1.0;

  if (shouldUseMultiTouchStroke(e)) {
    const op = { type: 'stroke', color: brushColor, size: brushSize, points: [{x, y}] };
    const state = { op, lastX: x, lastY: y, strokePoints: [{x, y}], pressures: [pressure], drawPending: false, lastMid: null, rafId: null };
    touchStrokeMap.set(e.pointerId, state);
    try { if (e.pointerId && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch(err) {}
    return;
  }

  if (erasing && eraserMode === 'rect') {
    drawing = true;
    currentOp = { type: 'rectSelect', startX: x, startY: y, x: x, y: y };
    return;
  }

  if (erasing && eraserMode === 'stroke') {
    deleteStrokesAtPoint(x, y);
    drawing = true;
    return;
  }

  drawing = true;
  lastX = x; lastY = y;
  _activePointerId = (e && e.pointerId) || 0;
  try { if (_activePointerId && canvas.setPointerCapture) canvas.setPointerCapture(_activePointerId); } catch(err) {}
  
  _strokePoints.length = 0;
  _strokePoints.push({x, y, timestamp: Date.now()});
  _lastMid = null;
  _drawPending = false;

  _strokeMetrics.startTime = Date.now();
  _strokeMetrics.lastPointTime = Date.now();
  _strokeMetrics.pointCount = 1;
  _strokeMetrics.totalDistance = 0;
  _strokeMetrics.speedHistory = [];

  if (erasing && eraserMode === 'pixel') {
    currentOp = { type: 'erase', size: eraserSize, points: [{x, y}] };
  } else {
    currentOp = { type: 'stroke', color: brushColor, size: brushSize, points: [{x, y}] };
  }
}

function pointerMove(e){
  if (multiTouchPenEnabled && e && e.pointerType === 'touch' && e.pointerId && touchStrokeMap.has(e.pointerId)) {
    if (!inputEnabled) return;
    const state = touchStrokeMap.get(e.pointerId);
    if (!state) return;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const pressure = e.pressure !== undefined ? e.pressure : 1.0;
    if (state.op && state.op.type === 'stroke') {
      state.op.points.push({x, y});
      state.strokePoints.push({x, y, timestamp: Date.now()});
      state.pressures.push(pressure);
      if (!state.drawPending) {
        state.drawPending = true;
        state.rafId = requestAnimationFrame(() => {
          state.drawPending = false;
          drawBufferedStrokeSegmentFromState(state, false);
        });
      }
      state.lastX = x; state.lastY = y;
    }
    return;
  }

  if (!drawing) return;
  if (!inputEnabled) return;
  const { x, y } = screenToCanvas(e.clientX, e.clientY);
  const pressure = e.pressure !== undefined ? e.pressure : 1.0;

  if (currentOp && currentOp.type === 'rectSelect') { currentOp.x = x; currentOp.y = y; redrawAll(); drawRectOverlay(currentOp.startX, currentOp.startY, x, y); return; }
  if (erasing && eraserMode === 'stroke') { deleteStrokesAtPoint(x, y); return; }
  if (currentOp && (currentOp.type === 'stroke' || currentOp.type === 'erase')) {
    currentOp.points.push({x, y});
    if (currentOp.type === 'stroke') {
      _scheduleInkHoldFromMove(currentOp);
      _strokePoints.push({x, y, timestamp: Date.now()});
      if (!_drawPending) {
        _drawPending = true;
        _rafId = requestAnimationFrame(() => {
          _drawPending = false;
          drawBufferedStrokeSegment(currentOp, pressure);
        });
      }
    } else {
      drawOpSegment(currentOp, lastX, lastY, x, y);
    }
    lastX = x; lastY = y;
  }
}

function pointerUp(evt){
  if (!drawing) return;
  if (multiTouchPenEnabled && evt && evt.pointerType === 'touch' && evt.pointerId && touchStrokeMap.has(evt.pointerId)) {
    finalizeMultiTouchStroke(evt);
    drawing = false;
    return;
  }
  if (currentOp && currentOp.type === 'rectSelect') {
    const sel = getSelection(currentOp.startX, currentOp.startY, currentOp.x, currentOp.y);
    if (sel && sel.length > 0) {
      Message.emit(EVENTS.SELECTION_CHANGED, sel);
    }
    drawing = false;
    currentOp = null;
    redrawAll();
    return;
  }
  if (currentOp && (currentOp.type === 'stroke' || currentOp.type === 'erase')) {
    if (currentOp.type === 'stroke' && _rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    if (currentOp.type === 'stroke') {
      drawBufferedStrokeSegment(currentOp, undefined, true);
    }
    finalizeOp(currentOp);
  }
  drawing = false;
  currentOp = null;
  try { if (evt && evt.pointerId && canvas.releasePointerCapture) canvas.releasePointerCapture(evt.pointerId); } catch(err) {}
  _activePointerId = 0;
}

function drawBufferedStrokeSegment(op, pressure = 1.0, flush = false) {
  if (!_strokePoints || _strokePoints.length === 0) return;
  const pts = _strokePoints.slice();
  const pressures = [];
  
  for (let i = 0; i < pts.length; i++) {
    pressures.push(pressure);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = op.color || '#000';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (pts.length === 1) {
    const p = pts[0];
    ctx.lineWidth = op.size || 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    ctx.restore();
    if (flush) _strokePoints.length = 0;
    return;
  }

  const enhancedPoints = enhanceStrokePoints(pts, op.size, pressures);
  const smoothedPoints = smoothDynamicSizes(enhancedPoints);

  for (let i = 0; i < smoothedPoints.length - 1; i++) {
    const p1 = smoothedPoints[i];
    const p2 = smoothedPoints[i + 1];
    drawEnhancedStrokeSegment(p1, p2, p1.size, p2.size, op.color);
  }

  if (flush && pts.length >= 2) {
    const last = pts[pts.length - 1];
    const secondLast = pts[pts.length - 2];
    const p1 = smoothedPoints[smoothedPoints.length - 2];
    const p2 = smoothedPoints[smoothedPoints.length - 1];
    drawEnhancedStrokeSegment(p1, p2, p1.size, p2.size, op.color);
  }

  ctx.restore();
  if (flush) _strokePoints.length = 0;
  else if (pts.length > 1) _strokePoints = [pts[pts.length - 2], pts[pts.length - 1]];
}

function drawOpSegment(op, x1, y1, x2, y2){
  if (!op) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = op.color || '#000';
  ctx.lineWidth = op.size || 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawOp(op){
  if (!op) return;
  if (op.type === 'stroke') {
    const pts = op.points || [];
    if (pts.length === 0) return;
    const pressures = op.pressures || [];
    const enhancedPoints = enhanceStrokePoints(pts, op.size, pressures);
    const smoothedPoints = smoothDynamicSizes(enhancedPoints);
    
    for (let i = 0; i < smoothedPoints.length - 1; i++) {
      const p1 = smoothedPoints[i];
      const p2 = smoothedPoints[i + 1];
      drawEnhancedStrokeSegment(p1, p2, p1.size, p2.size, op.color);
    }
  } else if (op.type === 'erase') {
    const pts = op.points || [];
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = op.size || 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (pts.length > 0) ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  } else if (op.type === 'clearRect') {
    ctx.clearRect(op.x || 0, op.y || 0, op.w || 0, op.h || 0);
  }
}

function redrawAll(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const op of ops) drawOp(op);
}

function deleteStrokesAtPoint(x, y){
  const threshold = 20;
  const toDelete = [];
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.type !== 'stroke') continue;
    const pts = op.points || [];
    for (const pt of pts) {
      const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
      if (dist < threshold) {
        toDelete.push(i);
        break;
      }
    }
  }
  if (toDelete.length > 0) {
    for (const idx of toDelete) ops.splice(idx, 1);
    redrawAll();
    pushHistory();
  }
}

function getSelection(x1, y1, x2, y2){
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const selected = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type !== 'stroke') continue;
    const pts = op.points || [];
    let inRect = false;
    for (const pt of pts) {
      if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
        inRect = true;
        break;
      }
    }
    if (inRect) selected.push(i);
  }
  return selected;
}

function drawRectOverlay(x1, y1, x2, y2){
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 120, 215, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.restore();
}

function _cancelInkTimers(){
  if (_inkDebounceId) { clearTimeout(_inkDebounceId); _inkDebounceId = 0; }
  if (_inkHoldId) { clearTimeout(_inkHoldId); _inkHoldId = 0; }
  if (_inkAutoConfirmId) { clearTimeout(_inkAutoConfirmId); _inkAutoConfirmId = 0; }
}

function _dismissInkPreview(animate){
  if (_inkPreview) {
    if (animate && _inkPreview.style) {
      _inkPreview.style.opacity = '0';
      setTimeout(() => {
        if (_inkPreview && _inkPreview.parentNode) _inkPreview.parentNode.removeChild(_inkPreview);
        _inkPreview = null;
      }, 200);
    } else {
      if (_inkPreview.parentNode) _inkPreview.parentNode.removeChild(_inkPreview);
      _inkPreview = null;
    }
  }
}

function _enqueueInkRecognition(op){
  if (!_inkRecognitionEnabled) return;
  _inkPending.push({ seq: _inkSeq, op });
  _scheduleInkRecognition();
}

function _scheduleInkRecognition(){
  if (!_inkRecognitionEnabled || _inkPending.length === 0) return;
  if (_inkDebounceId) clearTimeout(_inkDebounceId);
  _inkDebounceId = setTimeout(() => {
    _inkDebounceId = 0;
    _processInkPending();
  }, 300);
}

function _scheduleInkHoldFromMove(op){
  if (!_inkRecognitionEnabled) return;
  const now = Date.now();
  if (now - _inkLastScheduleAt < 100) return;
  _inkLastScheduleAt = now;
  if (_inkHoldId) clearTimeout(_inkHoldId);
  _inkHoldId = setTimeout(() => {
    _inkHoldId = 0;
    _showInkPreview(op);
  }, 500);
}

function _showInkPreview(op){
  if (!_inkRecognitionEnabled || !op || op.type !== 'stroke') return;
  const pts = op.points || [];
  if (pts.length < 2) return;
  const last = pts[pts.length - 1];
  _dismissInkPreview(false);
  _inkPreview = document.createElement('div');
  _inkPreview.style.cssText = 'position:fixed;left:0;top:0;padding:8px 12px;background:rgba(0,0,0,0.75);color:#fff;border-radius:6px;font-size:13px;pointer-events:none;z-index:9999;opacity:0;transition:opacity 0.2s;';
  _inkPreview.textContent = '识别中...';
  document.body.appendChild(_inkPreview);
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  const cssX = rect.left + last.x * scaleX * viewScale + viewOffsetX;
  const cssY = rect.top + last.y * scaleY * viewScale + viewOffsetY;
  _inkPreview.style.left = (cssX + 20) + 'px';
  _inkPreview.style.top = (cssY - 20) + 'px';
  requestAnimationFrame(() => { if (_inkPreview) _inkPreview.style.opacity = '1'; });
}

function _processInkPending(){
  if (!_inkRecognitionEnabled || _inkPending.length === 0) return;
  const items = _inkPending.splice(0);
  _dismissInkPreview(false);
  if (window.Mod && typeof Mod.publish === 'function') {
    try {
      Mod.publish('ink-enhancer/stroke-recognized', { items });
    } catch (e) {}
  }
}

export function getOpsInRect(x0,y0,w,h){
  const result = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type !== 'stroke') continue;
    const pts = op.points || [];
    for (const pt of pts) {
      if (pt.x >= x0 && pt.x <= x0 + w && pt.y >= y0 && pt.y <= y0 + h) {
        result.push(i);
        break;
      }
    }
  }
  return result;
}

export function moveOpsByIds(ids, dx, dy){
  const idSet = new Set(ids);
  for (const i of idSet) {
    if (i >= 0 && i < ops.length) {
      const op = ops[i];
      if (op.type === 'stroke' && Array.isArray(op.points)) {
        for (const pt of op.points) { pt.x += dx; pt.y += dy; }
      }
    }
  }
  redrawAll();
  pushHistory();
}

export function scaleOpsByIds(ids, scaleX, scaleY, originX, originY){
  const idSet = new Set(ids);
  for (const i of idSet) {
    if (i >= 0 && i < ops.length) {
      const op = ops[i];
      if (op.type === 'stroke' && Array.isArray(op.points)) {
        for (const pt of op.points) {
          const dx = pt.x - originX;
          const dy = pt.y - originY;
          pt.x = originX + dx * scaleX;
          pt.y = originY + dy * scaleY;
        }
      }
    }
  }
  redrawAll();
  pushHistory();
}

export function setBrushSize(v){ brushSize = Number(v); try{ _documents[_activeDocKey].brushSize = brushSize; }catch(e){} }
export function setEraserSize(v){ eraserSize = Number(v); try{ _documents[_activeDocKey].eraserSize = eraserSize; }catch(e){} }
export function setBrushColor(c){ brushColor = c; try{ _documents[_activeDocKey].brushColor = brushColor; }catch(e){} }
export function setErasing(b){ erasing = !!b; try{ _documents[_activeDocKey].erasing = erasing; }catch(e){} }
export function setEraserMode(m){ eraserMode = m; try{ _documents[_activeDocKey].eraserMode = eraserMode; }catch(e){} }
export function getToolState(){ return { brushColor, brushSize, eraserSize, eraserMode, erasing }; }
export function clearAll(){ ops.push({type:'clearRect', x:0, y:0, w:canvas.width, h:canvas.height}); redrawAll(); pushHistory(); }
export function undo(){ if (historyIndex <= 0) return; historyIndex -= 1; const snap = JSON.parse(JSON.stringify(history[historyIndex])); ops.length = 0; Array.prototype.push.apply(ops, snap); redrawAll(); try{ Message.emit(EVENTS.HISTORY_CHANGED, { canUndo: canUndo(), canRedo: canRedo() }); }catch(e){} }
export function redo(){ if (historyIndex >= history.length - 1) return; historyIndex += 1; const snap = JSON.parse(JSON.stringify(history[historyIndex])); ops.length = 0; Array.prototype.push.apply(ops, snap); redrawAll(); try{ Message.emit(EVENTS.HISTORY_CHANGED, { canUndo: canUndo(), canRedo: canRedo() }); }catch(e){} }
export function canUndo(){ return historyIndex > 0; }
export function canRedo(){ return historyIndex < history.length - 1; }

export function getSnapshot(){
  return {
    ops: JSON.parse(JSON.stringify(ops)),
    history: JSON.parse(JSON.stringify(history)),
    historyIndex,
    noteMeta: { ..._noteMeta },
    toolState: getToolState(),
    viewTransform: getViewTransform()
  };
}

export function loadSnapshot(snap){
  if (!snap || typeof snap !== 'object') return;
  try {
    ops.length = 0;
    Array.prototype.push.apply(ops, JSON.parse(JSON.stringify(snap.ops || [])));
    history.length = 0;
    Array.prototype.push.apply(history, JSON.parse(JSON.stringify(snap.history || [])));
    historyIndex = Number(snap.historyIndex) || 0;
    _noteMeta = { ...snap.noteMeta };
    if (snap.toolState) {
      setBrushSize(snap.toolState.brushSize);
      setEraserSize(snap.toolState.eraserSize);
      setBrushColor(snap.toolState.brushColor);
      setErasing(snap.toolState.erasing);
      setEraserMode(snap.toolState.eraserMode);
    }
    if (snap.viewTransform) {
      setViewTransform(snap.viewTransform.scale, snap.viewTransform.offsetX, snap.viewTransform.offsetY);
    }
    redrawAll();
  } catch (e) {}
}

export function getCubenoteState(){
  return {
    ops: JSON.parse(JSON.stringify(ops)),
    history: JSON.parse(JSON.stringify(history)),
    historyIndex,
    noteMeta: { ..._noteMeta },
    toolState: getToolState(),
    viewTransform: getViewTransform(),
    documents: JSON.parse(JSON.stringify(_documents)),
    activeDocKey: _activeDocKey
  };
}

export function applyCubenoteState(state, opts){
  if (!state || typeof state !== 'object') return;
  try {
    ops.length = 0;
    Array.prototype.push.apply(ops, JSON.parse(JSON.stringify(state.ops || [])));
    history.length = 0;
    Array.prototype.push.apply(history, JSON.parse(JSON.stringify(state.history || [])));
    historyIndex = Number(state.historyIndex) || 0;
    _noteMeta = { ...state.noteMeta };
    if (state.toolState) {
      setBrushSize(state.toolState.brushSize);
      setEraserSize(state.toolState.eraserSize);
      setBrushColor(state.toolState.brushColor);
      setErasing(state.toolState.erasing);
      setEraserMode(state.toolState.eraserMode);
    }
    if (state.viewTransform) {
      setViewTransform(state.viewTransform.scale, state.viewTransform.offsetX, state.viewTransform.offsetY);
    }
    if (state.documents && state.activeDocKey) {
      _documents.whiteboard = state.documents.whiteboard || _documents.whiteboard;
      _documents.annotation = state.documents.annotation || _documents.annotation;
      _activeDocKey = state.activeDocKey;
      ops = _documents[_activeDocKey].ops;
      history = _documents[_activeDocKey].history;
      historyIndex = _documents[_activeDocKey].historyIndex;
    }
    if (!opts || !opts.noRedraw) redrawAll();
  } catch (e) {}
}

export function replaceStrokeColors(oldColor, newColor){
  let changed = false;
  for (const op of ops) {
    if (op.type === 'stroke' && op.color === oldColor) {
      op.color = newColor;
      changed = true;
    }
  }
  if (changed) {
    redrawAll();
    pushHistory();
  }
}

export function setCanvasMode(mode){
  if (mode === 'whiteboard' || mode === 'annotation') {
    if (_activeDocKey !== mode) {
      _activeDocKey = mode;
      ops = _documents[_activeDocKey].ops;
      history = _documents[_activeDocKey].history;
      historyIndex = _documents[_activeDocKey].historyIndex;
      brushSize = _documents[_activeDocKey].brushSize;
      eraserSize = _documents[_activeDocKey].eraserSize;
      brushColor = _documents[_activeDocKey].brushColor;
      erasing = _documents[_activeDocKey].erasing;
      eraserMode = _documents[_activeDocKey].eraserMode;
      redrawAll();
    }
  }
}

export function getInkCanvasConfig(){
  return { ..._inkCanvasConfig };
}

export function setInkCanvasConfig(config){
  if (config && typeof config === 'object') {
    if (typeof config.dynamicBrushEnabled === 'boolean') {
      _inkCanvasConfig.dynamicBrushEnabled = config.dynamicBrushEnabled;
    }
    if (typeof config.pressureSensitivity === 'number' && config.pressureSensitivity >= 0 && config.pressureSensitivity <= 1) {
      _inkCanvasConfig.pressureSensitivity = config.pressureSensitivity;
    }
    if (typeof config.speedSensitivity === 'number' && config.speedSensitivity >= 0 && config.speedSensitivity <= 1) {
      _inkCanvasConfig.speedSensitivity = config.speedSensitivity;
    }
    if (typeof config.minBrushRatio === 'number' && config.minBrushRatio > 0 && config.minBrushRatio < 1) {
      _inkCanvasConfig.minBrushRatio = config.minBrushRatio;
    }
    if (typeof config.maxBrushRatio === 'number' && config.maxBrushRatio > 1) {
      _inkCanvasConfig.maxBrushRatio = config.maxBrushRatio;
    }
    if (typeof config.smoothingFactor === 'number' && config.smoothingFactor >= 0 && config.smoothingFactor <= 0.5) {
      _inkCanvasConfig.smoothingFactor = config.smoothingFactor;
    }
    if (typeof config.adaptiveSmoothing === 'boolean') {
      _inkCanvasConfig.adaptiveSmoothing = config.adaptiveSmoothing;
    }
  }
}

canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);

updateCanvasSize();
redrawAll();

console.log('[Enhanced Renderer] InkCanvas integration loaded with dynamic brush effects');
