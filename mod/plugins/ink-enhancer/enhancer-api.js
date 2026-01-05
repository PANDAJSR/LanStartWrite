(function() {
  'use strict';

  if (window._inkEnhancerApiLoaded) {
    console.log('[Ink Enhancer API] Already loaded, skipping');
    return;
  }

  window._inkEnhancerApiLoaded = true;
  console.log('[Ink Enhancer API] Loading enhancer API');

  const _originalDrawBufferedStrokeSegment = window.drawBufferedStrokeSegment;
  const _originalDrawOp = window.drawOp;
  const _originalDrawOpSegment = window.drawOpSegment;
  const _strokeEnhancements = new Map();
  let _currentStrokeId = null;
  let _enhancerEnabled = true;
  let _useEnhancedRendering = false;

  function generateStrokeId() {
    return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function publishToPlugin(topic, payload) {
    if (!window.Mod || typeof window.Mod.publish !== 'function') {
      console.warn('[Ink Enhancer API] Mod.publish not available');
      return;
    }
    
    try {
      window.Mod.publish(topic, payload);
    } catch (e) {
      console.error('[Ink Enhancer API] Failed to publish:', e);
    }
  }

  function applyEnhancedStroke(segments, color) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return;
    }

    const canvas = document.getElementById('board');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color || '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const segment of segments) {
      const size1 = segment.size1 || 4;
      const size2 = segment.size2 || 4;

      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.quadraticCurveTo(segment.x1, segment.y1, segment.midX, segment.midY);
      ctx.lineTo(segment.x2, segment.y2);
      
      ctx.lineWidth = (size1 + size2) / 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  function enhanceDrawBufferedStrokeSegment(op, flush) {
    if (!_enhancerEnabled || !_useEnhancedRendering || !op || op.type !== 'stroke') {
      return _originalDrawBufferedStrokeSegment && _originalDrawBufferedStrokeSegment(op, flush);
    }

    if (!_currentStrokeId) {
      _currentStrokeId = generateStrokeId();
      _strokeEnhancements.set(_currentStrokeId, {
        color: op.color,
        size: op.size,
        points: []
      });
      
      publishToPlugin('ink-enhancer/start-stroke', {
        strokeId: _currentStrokeId,
        x: op.points[0]?.x,
        y: op.points[0]?.y,
        size: op.size,
        color: op.color
      });
    }

    const enhancement = _strokeEnhancements.get(_currentStrokeId);
    if (enhancement) {
      const points = op.points || [];
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        enhancement.points.push(lastPoint);
        
        publishToPlugin('ink-enhancer/move-stroke', {
          strokeId: _currentStrokeId,
          x: lastPoint.x,
          y: lastPoint.y
        });
      }
    }

    const result = _originalDrawBufferedStrokeSegment && _originalDrawBufferedStrokeSegment(op, flush);

    if (flush) {
      publishToPlugin('ink-enhancer/end-stroke', {
        strokeId: _currentStrokeId
      });
      _currentStrokeId = null;
    }

    return result;
  }

  function listenToEnhancerEvents() {
    if (!window.Mod || typeof window.Mod.subscribe !== 'function') {
      console.warn('[Ink Enhancer API] Mod.subscribe not available');
      return;
    }

    try {
      window.Mod.subscribe('ink-enhancer/stroke-segments');
      window.Mod.subscribe('ink-enhancer/stroke-finalized');
      window.Mod.subscribe('ink-enhancer/stroke-enhanced');
    } catch (e) {
      console.error('[Ink Enhancer API] Failed to subscribe:', e);
    }
  }

  function handleEnhancerEvents() {
    if (!window.Mod) return;

    const originalOn = window.Mod.on;
    if (typeof originalOn === 'function') {
      window.Mod.on('bus', (e) => {
        const topic = e && e.topic;
        const payload = e && e.payload;

        if (topic === 'ink-enhancer/stroke-segments') {
          const strokeId = payload && payload.strokeId;
          const segments = payload && payload.segments;

          if (strokeId && Array.isArray(segments) && _useEnhancedRendering) {
            const enhancement = _strokeEnhancements.get(strokeId);
            if (enhancement) {
              applyEnhancedStroke(segments, enhancement.color);
            }
          }
        }

        if (topic === 'ink-enhancer/stroke-finalized') {
          const strokeId = payload && payload.strokeId;
          const enhancedPoints = payload && payload.enhancedPoints;

          if (strokeId && Array.isArray(enhancedPoints)) {
            console.log('[Ink Enhancer API] Stroke finalized:', strokeId, enhancedPoints.length, 'points');
          }
        }
      });
    }
  }

  function initializeEnhancer() {
    console.log('[Ink Enhancer API] Initializing enhancer integration');

    if (typeof window.drawBufferedStrokeSegment === 'function') {
      window.drawBufferedStrokeSegment = enhanceDrawBufferedStrokeSegment;
      console.log('[Ink Enhancer API] Enhanced drawBufferedStrokeSegment');
    }

    listenToEnhancerEvents();
    handleEnhancerEvents();

    window._inkEnhancerApiReady = true;
    console.log('[Ink Enhancer API] Integration complete');
  }

  function waitForRendererReady() {
    if (typeof window.drawBufferedStrokeSegment === 'function') {
      initializeEnhancer();
    } else {
      setTimeout(waitForRendererReady, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForRendererReady);
  } else {
    waitForRendererReady();
  }

  window._inkEnhancerApi = {
    setEnabled: (enabled) => {
      _enhancerEnabled = !!enabled;
      console.log('[Ink Enhancer API] Enhancer', _enhancerEnabled ? 'enabled' : 'disabled');
    },
    isEnabled: () => _enhancerEnabled,
    setUseEnhancedRendering: (useEnhanced) => {
      _useEnhancedRendering = !!useEnhanced;
      console.log('[Ink Enhancer API] Enhanced rendering', _useEnhancedRendering ? 'enabled' : 'disabled');
    },
    isEnhancedRenderingEnabled: () => _useEnhancedRendering,
    getStrokeEnhancements: () => new Map(_strokeEnhancements),
    enhanceStroke: (strokeId, size, points) => {
      publishToPlugin('ink-enhancer/enhance-stroke', {
        strokeId: strokeId,
        size: size,
        points: points
      });
    }
  };

  console.log('[Ink Enhancer API] API loaded');
})();
