const PLUGIN_ID = 'inkcanvas-comprehensive';
const PLUGIN_VERSION = '2.0.0';

const _config = {
  dynamicBrushEnabled: true,
  pressureSensitivity: 0.7,
  speedSensitivity: 0.8,
  minBrushRatio: 0.4,
  maxBrushRatio: 1.6,
  smoothingFactor: 0.3,
  adaptiveSmoothing: true,
  performanceMetrics: {
    enabled: true,
    sampleInterval: 1000
  },
  canvas: {
    backgroundColor: '#ffffff',
    zoomLevel: 1.0,
    minZoom: 0.25,
    maxZoom: 4.0
  }
};

const _state = {
  currentTool: 'pen',
  brushSize: 4,
  brushColor: '#000000',
  eraserSize: 20,
  eraserMode: 'pixel',
  pressureEnabled: true,
  currentLayer: 0,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 }
};

const _performanceStats = {
  strokeCount: 0,
  totalPoints: 0,
  avgLatency: 0,
  maxLatency: 0,
  minLatency: Infinity,
  renderTimes: [],
  lastSampleTime: 0
};

class StrokeEnhancer {
  constructor(config) {
    this.config = config;
  }

  calculateSpeed(p1, p2, deltaTime) {
    if (deltaTime <= 0) return 0;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance / deltaTime;
  }

  calculateDynamicWidth(baseWidth, speed, pressure = 1.0) {
    if (!this.config.dynamicBrushEnabled) return baseWidth;

    const speedFactor = Math.min(speed / 2.5, 1);
    const speedRatio = this.config.minBrushRatio + 
                       (this.config.maxBrushRatio - this.config.minBrushRatio) * 
                       (1 - speedFactor * this.config.speedSensitivity);

    const pressureRatio = 1.0 - (1.0 - pressure) * this.config.pressureSensitivity;

    return baseWidth * speedRatio * pressureRatio;
  }

  enhanceStrokePoints(points, baseSize, pressures = []) {
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
        const speed = this.calculateSpeed(prevPoint, point, deltaTime);
        dynamicSize = this.calculateDynamicWidth(baseSize, speed, pressure);
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

  smoothDynamicSizes(points, adaptive = true) {
    if (!Array.isArray(points) || points.length < 3) {
      return points;
    }

    const smoothed = [points[0]];
    const smoothingFactor = adaptive ? 
      Math.min(this.config.smoothingFactor * (1 + 1 / points.length), 0.5) :
      this.config.smoothingFactor;

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
}

class HistoryManager {
  constructor(maxHistory = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  saveState(state) {
    this.undoStack.push(JSON.parse(JSON.stringify(state)));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.notifyChange();
  }

  undo() {
    if (this.undoStack.length === 0) return null;
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);
    const previousState = this.undoStack[this.undoStack.length - 1];
    this.notifyChange();
    return previousState;
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    this.notifyChange();
    return nextState;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  notifyChange() {
    try {
      Mod.publish('inkcanvas-comprehensive/history-changed', {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoCount: this.undoStack.length,
        redoCount: this.redoStack.length
      });
    } catch (e) {}
  }
}

class LayerManager {
  constructor() {
    this.layers = [];
    this.currentLayerIndex = 0;
    this.layerCounter = 0;
    this.addLayer();
  }

  addLayer(name = null) {
    this.layerCounter++;
    const layer = {
      id: this.layerCounter,
      name: name || `图层 ${this.layerCounter}`,
      visible: true,
      locked: false,
      strokes: [],
      opacity: 1.0,
      blendMode: 'source-over'
    };
    this.layers.push(layer);
    this.currentLayerIndex = this.layers.length - 1;
    this.notifyChange();
    return layer;
  }

  deleteLayer(index) {
    if (this.layers.length <= 1) return false;
    if (index < 0 || index >= this.layers.length) return false;
    
    this.layers.splice(index, 1);
    if (this.currentLayerIndex >= this.layers.length) {
      this.currentLayerIndex = this.layers.length - 1;
    }
    this.notifyChange();
    return true;
  }

  setCurrentLayer(index) {
    if (index < 0 || index >= this.layers.length) return false;
    this.currentLayerIndex = index;
    this.notifyChange();
    return true;
  }

  getCurrentLayer() {
    return this.layers[this.currentLayerIndex];
  }

  toggleLayerVisibility(index) {
    if (index < 0 || index >= this.layers.length) return false;
    this.layers[index].visible = !this.layers[index].visible;
    this.notifyChange();
    return true;
  }

  toggleLayerLock(index) {
    if (index < 0 || index >= this.layers.length) return false;
    this.layers[index].locked = !this.layers[index].locked;
    this.notifyChange();
    return true;
  }

  setLayerOpacity(index, opacity) {
    if (index < 0 || index >= this.layers.length) return false;
    this.layers[index].opacity = Math.max(0, Math.min(1, opacity));
    this.notifyChange();
    return true;
  }

  clearLayer(index) {
    if (index < 0 || index >= this.layers.length) return false;
    this.layers[index].strokes = [];
    this.notifyChange();
    return true;
  }

  getLayers() {
    return this.layers;
  }

  notifyChange() {
    try {
      Mod.publish('inkcanvas-comprehensive/layer-changed', {
        currentLayer: this.currentLayerIndex,
        layers: this.layers.map(l => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          strokeCount: l.strokes.length
        }))
      });
    } catch (e) {}
  }
}

class ExportManager {
  constructor() {
    this.supportedFormats = ['png', 'svg', 'pdf', 'json'];
  }

  async exportToPNG(canvas, filename = 'inkcanvas-export.png') {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      return { success: true, format: 'png', filename };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async exportToSVG(strokes, width, height, filename = 'inkcanvas-export.svg') {
    try {
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
      
      strokes.forEach(stroke => {
        if (stroke.points && stroke.points.length > 0) {
          let pathData = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
          for (let i = 1; i < stroke.points.length; i++) {
            pathData += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
          }
          svgContent += `<path d="${pathData}" stroke="${stroke.color}" stroke-width="${stroke.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
      });
      
      svgContent += '</svg>';
      
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      
      return { success: true, format: 'svg', filename };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async exportToJSON(layers, filename = 'inkcanvas-export.json') {
    try {
      const data = {
        version: PLUGIN_VERSION,
        exportDate: new Date().toISOString(),
        layers: layers
      };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      
      return { success: true, format: 'json', filename };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getSupportedFormats() {
    return this.supportedFormats;
  }
}

const strokeEnhancer = new StrokeEnhancer(_config);
const historyManager = new HistoryManager();
const layerManager = new LayerManager();
const exportManager = new ExportManager();

function updatePerformanceMetrics(latency) {
  if (!_config.performanceMetrics.enabled) return;

  _performanceStats.strokeCount++;
  _performanceStats.avgLatency = 
    (_performanceStats.avgLatency * (_performanceStats.strokeCount - 1) + latency) / 
    _performanceStats.strokeCount;
  _performanceStats.maxLatency = Math.max(_performanceStats.maxLatency, latency);
  _performanceStats.minLatency = Math.min(_performanceStats.minLatency, latency);
  _performanceStats.renderTimes.push(latency);

  if (_performanceStats.renderTimes.length > 100) {
    _performanceStats.renderTimes.shift();
  }

  const now = Date.now();
  if (now - _performanceStats.lastSampleTime >= _config.performanceMetrics.sampleInterval) {
    _performanceStats.lastSampleTime = now;
  }
}

function handleStrokeStart(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      const enhancedPoints = strokeEnhancer.enhanceStrokePoints(
        data.points || [], 
        data.size || _state.brushSize, 
        data.pressures || []
      );
      
      const smoothedPoints = strokeEnhancer.smoothDynamicSizes(enhancedPoints);
      
      Mod.publish('inkcanvas-comprehensive/stroke-start', {
        strokeId: data.strokeId,
        points: smoothedPoints,
        baseSize: data.size || _state.brushSize,
        color: data.color || _state.brushColor
      });
    }
  } catch (e) {
    console.error('[InkCanvas Comprehensive] Error handling stroke start:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleStrokeUpdate(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      const enhancedPoints = strokeEnhancer.enhanceStrokePoints(
        data.points || [], 
        data.size || _state.brushSize, 
        data.pressures || []
      );
      
      const smoothedPoints = strokeEnhancer.smoothDynamicSizes(enhancedPoints);
      
      Mod.publish('inkcanvas-comprehensive/stroke-update', {
        strokeId: data.strokeId,
        points: smoothedPoints,
        baseSize: data.size || _state.brushSize,
        color: data.color || _state.brushColor
      });
    }
  } catch (e) {
    console.error('[InkCanvas Comprehensive] Error handling stroke update:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleStrokeEnd(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      _performanceStats.totalPoints += (data.pointCount || 0);
      
      const currentLayer = layerManager.getCurrentLayer();
      if (currentLayer) {
        currentLayer.strokes.push({
          strokeId: data.strokeId,
          points: data.points || [],
          size: data.size || _state.brushSize,
          color: data.color || _state.brushColor,
          timestamp: Date.now()
        });
      }
      
      Mod.publish('inkcanvas-comprehensive/stroke-end', {
        strokeId: data.strokeId,
        pointCount: data.pointCount,
        duration: data.duration,
        avgSpeed: data.avgSpeed
      });
    }
  } catch (e) {
    console.error('[InkCanvas Comprehensive] Error handling stroke end:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleMenuClick(data) {
  try {
    if (data && typeof data === 'object' && data.buttonId === 'toggle-enhanced') {
      _config.dynamicBrushEnabled = !_config.dynamicBrushEnabled;
      
      Mod.publish('inkcanvas-comprehensive/config-updated', { 
        config: _config,
        dynamicBrushEnabled: _config.dynamicBrushEnabled
      });
      
      console.log(`[InkCanvas Comprehensive] Dynamic brush effects ${_config.dynamicBrushEnabled ? 'enabled' : 'disabled'}`);
    }
  } catch (e) {
    console.error('[InkCanvas Comprehensive] Error handling menu click:', e);
  }
}

Mod.on('init', (ctx) => {
  console.log(`[InkCanvas Comprehensive] Plugin v${PLUGIN_VERSION} initialized`);
  
  Mod.registerTool({
    id: 'inkcanvas-pen',
    title: '画笔',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-eraser',
    title: '橡皮擦',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z"/><path d="M17 17L7 7"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-select',
    title: '选择',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-undo',
    title: '撤销',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-redo',
    title: '重做',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-zoom-in',
    title: '放大',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-zoom-out',
    title: '缩小',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-layers',
    title: '图层',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-export',
    title: '导出',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  });

  Mod.registerTool({
    id: 'inkcanvas-settings',
    title: '设置',
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'
  });

  Mod.subscribe('public/stroke-start');
  Mod.subscribe('public/stroke-update');
  Mod.subscribe('public/stroke-end');
  Mod.subscribe('menu-click');

  Mod.publish('inkcanvas-comprehensive/ready', {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    config: _config,
    state: _state
  });
});

Mod.on('tool', (e) => {
  const toolId = e && e.toolId;
  if (!toolId) return;

  _state.currentTool = toolId.replace('inkcanvas-', '');
  
  if (toolId === 'inkcanvas-undo') {
    historyManager.undo();
    return;
  }

  if (toolId === 'inkcanvas-redo') {
    historyManager.redo();
    return;
  }

  if (toolId === 'inkcanvas-zoom-in') {
    _state.zoomLevel = Math.min(_state.zoomLevel * 1.2, _config.canvas.maxZoom);
    Mod.publish('inkcanvas-comprehensive/tool-changed', { tool: 'zoom', level: _state.zoomLevel });
    return;
  }

  if (toolId === 'inkcanvas-zoom-out') {
    _state.zoomLevel = Math.max(_state.zoomLevel / 1.2, _config.canvas.minZoom);
    Mod.publish('inkcanvas-comprehensive/tool-changed', { tool: 'zoom', level: _state.zoomLevel });
    return;
  }

  if (toolId === 'inkcanvas-pen') {
    Mod.showOverlay({
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        <div style="font-weight:600;font-size:16px">画笔工具</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">笔刷大小:</label>
            <input type="range" id="brush-size" min="1" max="50" value="${_state.brushSize}" style="flex:1">
            <span id="brush-size-value" style="font-size:13px;width:30px">${_state.brushSize}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">压力系数:</label>
            <input type="range" id="pressure-factor" min="0" max="100" value="${_config.pressureSensitivity * 100}" style="flex:1">
            <span id="pressure-factor-value" style="font-size:13px;width:30px">${_config.pressureSensitivity}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">笔刷颜色:</label>
            <input type="color" id="brush-color" value="${_state.brushColor}" style="width:40px;height:30px">
            <span id="brush-color-value" style="font-size:13px">${_state.brushColor}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">动态笔触:</label>
            <input type="checkbox" id="dynamic-brush" ${_config.dynamicBrushEnabled ? 'checked' : ''}>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="apply-pen-settings" class="mode-btn">应用设置</button>
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    });
  } else if (toolId === 'inkcanvas-eraser') {
    Mod.showOverlay({
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        <div style="font-weight:600;font-size:16px">橡皮擦工具</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">橡皮大小:</label>
            <input type="range" id="eraser-size" min="5" max="100" value="${_state.eraserSize}" style="flex:1">
            <span id="eraser-size-value" style="font-size:13px;width:30px">${_state.eraserSize}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">橡皮模式:</label>
            <select id="eraser-mode" style="flex:1;padding:4px">
              <option value="pixel" ${_state.eraserMode === 'pixel' ? 'selected' : ''}>像素擦除</option>
              <option value="stroke" ${_state.eraserMode === 'stroke' ? 'selected' : ''}>笔画擦除</option>
              <option value="rect" ${_state.eraserMode === 'rect' ? 'selected' : ''}>矩形擦除</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="apply-eraser-settings" class="mode-btn">应用设置</button>
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    });
  } else if (toolId === 'inkcanvas-layers') {
    const layersHtml = layerManager.getLayers().map((layer, index) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:${index === layerManager.currentLayerIndex ? '#e3f2fd' : '#f5f5f5'};border-radius:4px">
        <input type="checkbox" ${layer.visible ? 'checked' : ''} data-layer-index="${index}" class="layer-visible" style="margin:0">
        <span style="font-size:13px;flex:1">${layer.name}</span>
        <span style="font-size:11px;opacity:0.6">${layer.strokes.length} 笔画</span>
        <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="delete-layer" data-layer-index="${index}" class="mode-btn" style="padding:4px 8px;font-size:11px">删除</button>
      </div>
    `).join('');

    Mod.showOverlay({
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        <div style="font-weight:600;font-size:16px">图层管理</div>
        <div id="layer-list" style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto">
          ${layersHtml}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="add-layer" class="mode-btn">新建图层</button>
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    });
  } else if (toolId === 'inkcanvas-export') {
    const formatsHtml = exportManager.getSupportedFormats().map(format => `
      <option value="${format}">${format.toUpperCase()}</option>
    `).join('');

    Mod.showOverlay({
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        <div style="font-weight:600;font-size:16px">导出文件</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">文件格式:</label>
            <select id="export-format" style="flex:1;padding:4px">
              ${formatsHtml}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">文件名:</label>
            <input type="text" id="export-filename" value="inkcanvas-export" style="flex:1;padding:4px">
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="export-file" class="mode-btn">导出</button>
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    });
  } else if (toolId === 'inkcanvas-settings') {
    Mod.showOverlay({
      kind: 'html',
      html: `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        <div style="font-weight:600;font-size:16px">插件设置</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">动态笔触:</label>
            <input type="checkbox" id="setting-dynamic-brush" ${_config.dynamicBrushEnabled ? 'checked' : ''}>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">压力感应:</label>
            <input type="range" id="setting-pressure" min="0" max="100" value="${_config.pressureSensitivity * 100}" style="flex:1">
            <span id="setting-pressure-value" style="font-size:13px;width:30px">${_config.pressureSensitivity}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">速度感应:</label>
            <input type="range" id="setting-speed" min="0" max="100" value="${_config.speedSensitivity * 100}" style="flex:1">
            <span id="setting-speed-value" style="font-size:13px;width:30px">${_config.speedSensitivity}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:13px">平滑系数:</label>
            <input type="range" id="setting-smoothing" min="0" max="50" value="${_config.smoothingFactor * 100}" style="flex:1">
            <span id="setting-smoothing-value" style="font-size:13px;width:30px">${_config.smoothingFactor}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="apply-settings" class="mode-btn">应用设置</button>
          <button data-mod-plugin="${PLUGIN_ID}" data-mod-action="close" class="mode-btn">关闭</button>
        </div>
      </div>`
    });
  }
});

Mod.on('ui', (e) => {
  const action = e && e.action;
  const value = e && e.value;

  if (action === 'close') {
    Mod.closeOverlay();
    return;
  }

  if (action === 'apply-pen-settings') {
    _state.brushSize = Number(document.getElementById('brush-size')?.value || 4);
    _config.pressureSensitivity = Number(document.getElementById('pressure-factor')?.value || 50) / 100;
    _state.brushColor = String(document.getElementById('brush-color')?.value || '#000000');
    _config.dynamicBrushEnabled = Boolean(document.getElementById('dynamic-brush')?.checked);
    
    Mod.publish('inkcanvas-comprehensive/config-updated', { config: _config, state: _state });
    Mod.closeOverlay();
  }

  if (action === 'apply-eraser-settings') {
    _state.eraserSize = Number(document.getElementById('eraser-size')?.value || 20);
    _state.eraserMode = String(document.getElementById('eraser-mode')?.value || 'pixel');
    
    Mod.publish('inkcanvas-comprehensive/tool-changed', { tool: 'eraser', settings: { size: _state.eraserSize, mode: _state.eraserMode } });
    Mod.closeOverlay();
  }

  if (action === 'add-layer') {
    layerManager.addLayer();
    Mod.showOverlay({
      kind: 'html',
      html: document.querySelector('.mod-panel')?.innerHTML || ''
    });
  }

  if (action === 'delete-layer') {
    const index = Number(e.data?.layerIndex);
    if (layerManager.deleteLayer(index)) {
      Mod.showOverlay({
        kind: 'html',
        html: document.querySelector('.mod-panel')?.innerHTML || ''
      });
    }
  }

  if (action === 'export-file') {
    const format = String(document.getElementById('export-format')?.value || 'png');
    const filename = String(document.getElementById('export-filename')?.value || 'inkcanvas-export');
    
    Mod.publish('inkcanvas-comprehensive/export-request', {
      format: format,
      filename: `${filename}.${format}`
    });
    
    Mod.closeOverlay();
  }

  if (action === 'apply-settings') {
    _config.dynamicBrushEnabled = Boolean(document.getElementById('setting-dynamic-brush')?.checked);
    _config.pressureSensitivity = Number(document.getElementById('setting-pressure')?.value || 50) / 100;
    _config.speedSensitivity = Number(document.getElementById('setting-speed')?.value || 50) / 100;
    _config.smoothingFactor = Number(document.getElementById('setting-smoothing')?.value || 30) / 100;
    
    strokeEnhancer.config = _config;
    Mod.publish('inkcanvas-comprehensive/config-updated', { config: _config });
    Mod.closeOverlay();
  }
});

Mod.on('public/stroke-start', handleStrokeStart);
Mod.on('public/stroke-update', handleStrokeUpdate);
Mod.on('public/stroke-end', handleStrokeEnd);
Mod.on('menu-click', handleMenuClick);

Mod.on('ready', () => {
  console.log('[InkCanvas Comprehensive] Plugin ready');
});