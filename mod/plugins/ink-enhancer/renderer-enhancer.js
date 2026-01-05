Mod.on('init', (ctx) => {
  console.log('[Ink Enhancer] Renderer optimizer initialized');

  Mod.subscribe('ink-enhancer/stroke-segments');
  Mod.subscribe('ink-enhancer/stroke-finalized');
});

const _renderQueue = [];
const _batchSize = 10;
const _maxQueueSize = 50;
let _renderScheduled = false;
let _lastRenderTime = 0;
const _minRenderInterval = 8;

function scheduleRender() {
  if (_renderScheduled) return;
  
  const now = Date.now();
  const timeSinceLastRender = now - _lastRenderTime;
  
  if (timeSinceLastRender < _minRenderInterval) {
    setTimeout(scheduleRender, _minRenderInterval - timeSinceLastRender);
    return;
  }
  
  _renderScheduled = true;
  requestAnimationFrame(processRenderQueue);
}

function processRenderQueue() {
  const now = Date.now();
  _lastRenderTime = now;
  
  if (_renderQueue.length === 0) {
    _renderScheduled = false;
    return;
  }

  const batch = _renderQueue.splice(0, Math.min(_batchSize, _renderQueue.length));
  
  const optimizedBatch = optimizeRenderBatch(batch);
  
  Mod.publish('ink-enhancer/render-batch', {
    segments: optimizedBatch,
    timestamp: now
  });

  if (_renderQueue.length > 0) {
    requestAnimationFrame(processRenderQueue);
  } else {
    _renderScheduled = false;
  }
}

function optimizeRenderBatch(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return segments;
  }

  const optimized = [];
  let currentSegment = null;

  for (const segment of segments) {
    if (!currentSegment) {
      currentSegment = { ...segment };
      optimized.push(currentSegment);
      continue;
    }

    const isAdjacent = Math.abs(segment.x1 - currentSegment.x2) < 2 && 
                       Math.abs(segment.y1 - currentSegment.y2) < 2;
    
    if (isAdjacent && Math.abs(segment.size1 - currentSegment.size2) < 0.5) {
      currentSegment.x2 = segment.x2;
      currentSegment.y2 = segment.y2;
      currentSegment.size2 = segment.size2;
      currentSegment.midX = segment.midX;
      currentSegment.midY = segment.midY;
      currentSegment.midSize = segment.midSize;
    } else {
      currentSegment = { ...segment };
      optimized.push(currentSegment);
    }
  }

  return optimized;
}

function segmentToCanvasCommands(segment) {
  const commands = [];
  
  if (!segment) return commands;

  commands.push({
    type: 'beginPath'
  });

  commands.push({
    type: 'moveTo',
    x: segment.x1,
    y: segment.y1
  });

  commands.push({
    type: 'quadraticCurveTo',
    cpX: segment.x1,
    cpY: segment.y1,
    x: segment.midX,
    y: segment.midY
  });

  commands.push({
    type: 'lineTo',
    x: segment.x2,
    y: segment.y2
  });

  commands.push({
    type: 'stroke',
    size1: segment.size1,
    size2: segment.size2
  });

  return commands;
}

function generateOptimizedRenderCommands(segments) {
  const commands = [];
  
  for (const segment of segments) {
    const segmentCommands = segmentToCanvasCommands(segment);
    commands.push(...segmentCommands);
  }
  
  return commands;
}

Mod.on('bus', (e) => {
  const topic = e && e.topic;
  const payload = e && e.payload;

  if (topic === 'ink-enhancer/stroke-segments') {
    const segments = payload && payload.segments;
    const strokeId = payload && payload.strokeId;
    
    if (Array.isArray(segments) && strokeId) {
      for (const segment of segments) {
        segment.strokeId = strokeId;
        
        if (_renderQueue.length >= _maxQueueSize) {
          _renderQueue.shift();
        }
        
        _renderQueue.push(segment);
      }
      
      scheduleRender();
    }
  }

  if (topic === 'ink-enhancer/stroke-finalized') {
    const strokeId = payload && payload.strokeId;
    
    if (strokeId) {
      Mod.publish('ink-enhancer/flush-queue', {
        strokeId: strokeId
      });
    }
  }
});
