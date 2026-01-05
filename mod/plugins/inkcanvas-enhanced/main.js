// InkCanvas Enhanced Plugin
// Provides dynamic brush effects and low-latency rendering optimization

const PLUGIN_ID = 'inkcanvas-enhanced';
const PLUGIN_VERSION = '1.0.0';

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
  }
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

function calculateSpeed(p1, p2, deltaTime) {
  if (deltaTime <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance / deltaTime;
}

function calculateDynamicWidth(baseWidth, speed, pressure = 1.0) {
  if (!_config.dynamicBrushEnabled) return baseWidth;

  const speedFactor = Math.min(speed / 2.5, 1);
  const speedRatio = _config.minBrushRatio + 
                     (_config.maxBrushRatio - _config.minBrushRatio) * 
                     (1 - speedFactor * _config.speedSensitivity);

  const pressureRatio = 1.0 - (1.0 - pressure) * _config.pressureSensitivity;

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
    Math.min(_config.smoothingFactor * (1 + 1 / points.length), 0.5) :
    _config.smoothingFactor;

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
    publishPerformanceMetrics();
  }
}

function publishPerformanceMetrics() {
  const metrics = {
    strokeCount: _performanceStats.strokeCount,
    avgLatency: _performanceStats.avgLatency.toFixed(2),
    maxLatency: _performanceStats.maxLatency.toFixed(2),
    minLatency: _performanceStats.minLatency === Infinity ? 0 : _performanceStats.minLatency.toFixed(2),
    renderTimePercentile95: calculatePercentile(_performanceStats.renderTimes, 95).toFixed(2),
    renderTimePercentile99: calculatePercentile(_performanceStats.renderTimes, 99).toFixed(2)
  };

  try {
    Mod.publish('inkcanvas-enhanced/performance-metrics', metrics);
  } catch (e) {}
}

function calculatePercentile(arr, percentile) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function handleStrokeStart(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      const enhancedPoints = enhanceStrokePoints(
        data.points || [], 
        data.size || 4, 
        data.pressures || []
      );
      
      const smoothedPoints = smoothDynamicSizes(enhancedPoints);
      
      Mod.publish('inkcanvas-enhanced/stroke-enhanced', {
        strokeId: data.strokeId,
        points: smoothedPoints,
        originalPoints: data.points,
        baseSize: data.size,
        color: data.color
      });
    }
  } catch (e) {
    console.error('[InkCanvas Enhanced] Error handling stroke start:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleStrokeUpdate(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      const enhancedPoints = enhanceStrokePoints(
        data.points || [], 
        data.size || 4, 
        data.pressures || []
      );
      
      const smoothedPoints = smoothDynamicSizes(enhancedPoints);
      
      Mod.publish('inkcanvas-enhanced/stroke-updated', {
        strokeId: data.strokeId,
        points: smoothedPoints,
        baseSize: data.size,
        color: data.color
      });
    }
  } catch (e) {
    console.error('[InkCanvas Enhanced] Error handling stroke update:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleStrokeEnd(data) {
  const startTime = Date.now();
  
  try {
    if (data && typeof data === 'object') {
      _performanceStats.totalPoints += (data.pointCount || 0);
      
      Mod.publish('inkcanvas-enhanced/stroke-ended', {
        strokeId: data.strokeId,
        pointCount: data.pointCount,
        duration: data.duration,
        avgSpeed: data.avgSpeed
      });
    }
  } catch (e) {
    console.error('[InkCanvas Enhanced] Error handling stroke end:', e);
  }

  const latency = Date.now() - startTime;
  updatePerformanceMetrics(latency);
}

function handleConfigUpdate(data) {
  try {
    if (data && typeof data === 'object') {
      if (typeof data.dynamicBrushEnabled === 'boolean') {
        _config.dynamicBrushEnabled = data.dynamicBrushEnabled;
      }
      if (typeof data.pressureSensitivity === 'number') {
        _config.pressureSensitivity = Math.max(0, Math.min(1, data.pressureSensitivity));
      }
      if (typeof data.speedSensitivity === 'number') {
        _config.speedSensitivity = Math.max(0, Math.min(1, data.speedSensitivity));
      }
      if (typeof data.minBrushRatio === 'number') {
        _config.minBrushRatio = Math.max(0.1, Math.min(1, data.minBrushRatio));
      }
      if (typeof data.maxBrushRatio === 'number') {
        _config.maxBrushRatio = Math.max(1, data.maxBrushRatio);
      }
      if (typeof data.smoothingFactor === 'number') {
        _config.smoothingFactor = Math.max(0, Math.min(0.5, data.smoothingFactor));
      }
      if (typeof data.adaptiveSmoothing === 'boolean') {
        _config.adaptiveSmoothing = data.adaptiveSmoothing;
      }
      if (data.performanceMetrics && typeof data.performanceMetrics === 'object') {
        if (typeof data.performanceMetrics.enabled === 'boolean') {
          _config.performanceMetrics.enabled = data.performanceMetrics.enabled;
        }
        if (typeof data.performanceMetrics.sampleInterval === 'number') {
          _config.performanceMetrics.sampleInterval = Math.max(100, data.performanceMetrics.sampleInterval);
        }
      }
      
      Mod.publish('inkcanvas-enhanced/config-updated', { config: _config });
    }
  } catch (e) {
    console.error('[InkCanvas Enhanced] Error handling config update:', e);
  }
}

function handleGetConfig() {
  try {
    Mod.publish('inkcanvas-enhanced/config-response', { config: _config });
  } catch (e) {}
}

function handleGetPerformanceStats() {
  try {
    const stats = {
      ..._performanceStats,
      minLatency: _performanceStats.minLatency === Infinity ? 0 : _performanceStats.minLatency,
      renderTimePercentile95: calculatePercentile(_performanceStats.renderTimes, 95),
      renderTimePercentile99: calculatePercentile(_performanceStats.renderTimes, 99)
    };
    Mod.publish('inkcanvas-enhanced/performance-stats-response', { stats });
  } catch (e) {}
}

function handleResetPerformanceStats() {
  _performanceStats.strokeCount = 0;
  _performanceStats.totalPoints = 0;
  _performanceStats.avgLatency = 0;
  _performanceStats.maxLatency = 0;
  _performanceStats.minLatency = Infinity;
  _performanceStats.renderTimes = [];
  _performanceStats.lastSampleTime = 0;
  
  try {
    Mod.publish('inkcanvas-enhanced/performance-stats-reset', { success: true });
  } catch (e) {}
}

function handleGetVersion() {
  try {
    Mod.publish('inkcanvas-enhanced/version-response', {
      id: PLUGIN_ID,
      version: PLUGIN_VERSION
    });
  } catch (e) {}
}

function handleMenuClick(data) {
  try {
    if (data && typeof data === 'object' && data.buttonId === 'toggle-enhanced') {
      _config.dynamicBrushEnabled = !_config.dynamicBrushEnabled;
      
      Mod.publish('inkcanvas-enhanced/config-updated', { 
        config: _config,
        dynamicBrushEnabled: _config.dynamicBrushEnabled
      });
      
      console.log(`[InkCanvas Enhanced] Dynamic brush effects ${_config.dynamicBrushEnabled ? 'enabled' : 'disabled'}`);
    }
  } catch (e) {
    console.error('[InkCanvas Enhanced] Error handling menu click:', e);
  }
}

Mod.on('inkcanvas-enhanced/stroke-start', handleStrokeStart);
Mod.on('inkcanvas-enhanced/stroke-update', handleStrokeUpdate);
Mod.on('inkcanvas-enhanced/stroke-end', handleStrokeEnd);
Mod.on('inkcanvas-enhanced/update-config', handleConfigUpdate);
Mod.on('inkcanvas-enhanced/get-config', handleGetConfig);
Mod.on('inkcanvas-enhanced/get-performance-stats', handleGetPerformanceStats);
Mod.on('inkcanvas-enhanced/reset-performance-stats', handleResetPerformanceStats);
Mod.on('inkcanvas-enhanced/get-version', handleGetVersion);
Mod.on('menu-click', handleMenuClick);

Mod.on('init', () => {
  console.log(`[InkCanvas Enhanced] Plugin v${PLUGIN_VERSION} initialized`);
  console.log('[InkCanvas Enhanced] Dynamic brush effects enabled:', _config.dynamicBrushEnabled);
  console.log('[InkCanvas Enhanced] Performance metrics enabled:', _config.performanceMetrics.enabled);
});

Mod.on('ready', () => {
  console.log('[InkCanvas Enhanced] Plugin ready');
  Mod.publish('inkcanvas-enhanced/ready', {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    config: _config
  });
});

Mod.on('unload', () => {
  console.log('[InkCanvas Enhanced] Plugin unloading');
  Mod.off('inkcanvas-enhanced/stroke-start', handleStrokeStart);
  Mod.off('inkcanvas-enhanced/stroke-update', handleStrokeUpdate);
  Mod.off('inkcanvas-enhanced/stroke-end', handleStrokeEnd);
  Mod.off('inkcanvas-enhanced/update-config', handleConfigUpdate);
  Mod.off('inkcanvas-enhanced/get-config', handleGetConfig);
  Mod.off('inkcanvas-enhanced/get-performance-stats', handleGetPerformanceStats);
  Mod.off('inkcanvas-enhanced/reset-performance-stats', handleResetPerformanceStats);
  Mod.off('inkcanvas-enhanced/get-version', handleGetVersion);
  Mod.off('menu-click', handleMenuClick);
});
