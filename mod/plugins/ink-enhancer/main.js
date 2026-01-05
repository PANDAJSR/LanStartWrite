Mod.on('init', (ctx) => {
  console.log('[Ink Enhancer] Plugin initialized');

  Mod.subscribe('public/history-changed');
  Mod.subscribe('public/app-mode-changed');
  Mod.subscribe('public/settings-changed');
});

const _strokeEnhancers = new Map();
const _enhancedStrokes = new Map();
let _currentStrokeId = null;

function calculateSpeed(p1, p2, deltaTime) {
  if (deltaTime <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance / deltaTime;
}

function calculateDynamicWidth(baseWidth, speed, minRatio = 0.4, maxRatio = 1.6) {
  const speedFactor = Math.min(speed / 2.5, 1);
  const widthRatio = minRatio + (maxRatio - minRatio) * (1 - speedFactor);
  return baseWidth * widthRatio;
}

function enhanceStrokePoints(points, baseSize) {
  if (!Array.isArray(points) || points.length < 2) {
    return points;
  }

  const enhanced = [];
  const minRatio = 0.4;
  const maxRatio = 1.6;
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    let dynamicSize = baseSize;

    if (i > 0) {
      const prevPoint = points[i - 1];
      const deltaTime = (point.timestamp || Date.now()) - (prevPoint.timestamp || Date.now());
      const speed = calculateSpeed(prevPoint, point, deltaTime);
      dynamicSize = calculateDynamicWidth(baseSize, speed, minRatio, maxRatio);
    }

    enhanced.push({
      x: point.x,
      y: point.y,
      size: dynamicSize,
      timestamp: point.timestamp || Date.now()
    });
  }

  return enhanced;
}

function smoothDynamicSizes(points, smoothingFactor = 0.3) {
  if (!Array.isArray(points) || points.length < 3) {
    return points;
  }

  const smoothed = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prevSize = points[i - 1].size;
    const currSize = points[i].size;
    const nextSize = points[i + 1].size;
    
    const smoothedSize = prevSize * smoothingFactor + currSize * (1 - 2 * smoothingFactor) + nextSize * smoothingFactor;
    
    smoothed.push({
      x: points[i].x,
      y: points[i].y,
      size: smoothedSize,
      timestamp: points[i].timestamp
    });
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

function generateStrokeSegments(enhancedPoints) {
  const segments = [];
  
  for (let i = 0; i < enhancedPoints.length - 1; i++) {
    const p1 = enhancedPoints[i];
    const p2 = enhancedPoints[i + 1];
    
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const midSize = (p1.size + p2.size) / 2;
    
    segments.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      size1: p1.size,
      size2: p2.size,
      midX: midX,
      midY: midY,
      midSize: midSize
    });
  }
  
  return segments;
}

Mod.on('bus', (e) => {
  const topic = e && e.topic;
  const payload = e && e.payload;

  if (topic === 'ink-enhancer/enhance-stroke') {
    const strokeData = payload;
    const strokeId = strokeData && strokeData.strokeId;
    const baseSize = strokeData && strokeData.size;
    const points = strokeData && strokeData.points;
    
    if (strokeId && baseSize && Array.isArray(points)) {
      const enhancedPoints = enhanceStrokePoints(points, baseSize);
      const smoothedPoints = smoothDynamicSizes(enhancedPoints);
      const segments = generateStrokeSegments(smoothedPoints);
      
      Mod.publish('ink-enhancer/stroke-enhanced', {
        strokeId: strokeId,
        enhancedPoints: smoothedPoints,
        segments: segments
      });
    }
  }

  if (topic === 'ink-enhancer/start-stroke') {
    const x = payload && payload.x;
    const y = payload && payload.y;
    const brushSize = payload && payload.brushSize || 4;
    const brushColor = payload && payload.brushColor || '#000000';
    
    if (x !== undefined && y !== undefined) {
      _currentStrokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      _strokeEnhancers.set(_currentStrokeId, {
        baseSize: brushSize,
        color: brushColor,
        points: [{ x, y, timestamp: Date.now() }],
        startTime: Date.now()
      });
      
      Mod.publish('ink-enhancer/stroke-start', {
        strokeId: _currentStrokeId,
        x: x,
        y: y,
        size: brushSize,
        color: brushColor
      });
    }
  }

  if (topic === 'ink-enhancer/move-stroke') {
    const strokeId = _currentStrokeId;
    const x = payload && payload.x;
    const y = payload && payload.y;
    
    if (strokeId && x !== undefined && y !== undefined) {
      const enhancer = _strokeEnhancers.get(strokeId);
      if (enhancer) {
        enhancer.points.push({ x, y, timestamp: Date.now() });

        const enhancedPoints = enhanceStrokePoints(enhancer.points, enhancer.baseSize);
        const smoothedPoints = smoothDynamicSizes(enhancedPoints);
        const segments = generateStrokeSegments(smoothedPoints);

        Mod.publish('ink-enhancer/stroke-segments', {
          strokeId: strokeId,
          segments: segments,
          points: smoothedPoints
        });
      }
    }
  }

  if (topic === 'ink-enhancer/end-stroke') {
    const strokeId = _currentStrokeId;
    
    if (strokeId) {
      const enhancer = _strokeEnhancers.get(strokeId);
      if (enhancer) {
        const enhancedPoints = enhanceStrokePoints(enhancer.points, enhancer.baseSize);
        const smoothedPoints = smoothDynamicSizes(enhancedPoints);
        
        Mod.publish('ink-enhancer/stroke-finalized', {
          strokeId: strokeId,
          enhancedPoints: smoothedPoints,
          originalPoints: enhancer.points,
          color: enhancer.color,
          baseSize: enhancer.baseSize
        });
        
        _enhancedStrokes.set(strokeId, {
          enhancedPoints: smoothedPoints,
          color: enhancer.color,
          baseSize: enhancer.baseSize
        });
        
        _strokeEnhancers.delete(strokeId);
        _currentStrokeId = null;
      }
    }
  }
});
