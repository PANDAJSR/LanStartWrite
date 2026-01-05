(function() {
  'use strict';

  if (window._inkEnhancerInjected) {
    console.log('[Ink Enhancer] Already injected, skipping');
    return;
  }

  window._inkEnhancerInjected = true;
  console.log('[Ink Enhancer] Injecting into renderer process');

  const _originalDrawBufferedStrokeSegment = window.drawBufferedStrokeSegment;
  const _originalDrawOpSegment = window.drawOpSegment;
  const _strokeEnhancements = new Map();
  let _currentStrokeId = null;
  let _enhancerEnabled = true;

  function generateStrokeId() {
    return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function publishStrokeStart(strokeData) {
    if (!_enhancerEnabled) return;
    
    try {
      const event = new CustomEvent('ink-enhancer:stroke-start', {
        detail: {
          strokeId: strokeData.strokeId,
          size: strokeData.size,
          color: strokeData.color,
          timestamp: Date.now()
        },
        bubbles: true
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('[Ink Enhancer] Failed to publish stroke start:', e);
    }
  }

  function publishStrokeMove(strokeData) {
    if (!_enhancerEnabled) return;
    
    try {
      const event = new CustomEvent('ink-enhancer:stroke-move', {
        detail: {
          strokeId: strokeData.strokeId,
          point: strokeData.point,
          timestamp: Date.now()
        },
        bubbles: true
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('[Ink Enhancer] Failed to publish stroke move:', e);
    }
  }

  function publishStrokeEnd(strokeData) {
    if (!_enhancerEnabled) return;
    
    try {
      const event = new CustomEvent('ink-enhancer:stroke-end', {
        detail: {
          strokeId: strokeData.strokeId,
          timestamp: Date.now()
        },
        bubbles: true
      });
      document.dispatchEvent(event);
    } catch (e) {
      console.error('[Ink Enhancer] Failed to publish stroke end:', e);
    }
  }

  function applyEnhancedStroke(strokeId, segments) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return;
    }

    const canvas = document.getElementById('board');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const enhancement = _strokeEnhancements.get(strokeId);
    if (!enhancement) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = enhancement.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const segment of segments) {
      const size1 = segment.size1 || enhancement.size;
      const size2 = segment.size2 || enhancement.size;

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
    if (!_enhancerEnabled || !op || op.type !== 'stroke') {
      return _originalDrawBufferedStrokeSegment && _originalDrawBufferedStrokeSegment(op, flush);
    }

    if (!_currentStrokeId) {
      _currentStrokeId = generateStrokeId();
      _strokeEnhancements.set(_currentStrokeId, {
        color: op.color,
        size: op.size,
        points: []
      });
      publishStrokeStart({
        strokeId: _currentStrokeId,
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
        publishStrokeMove({
          strokeId: _currentStrokeId,
          point: lastPoint
        });
      }
    }

    const result = _originalDrawBufferedStrokeSegment && _originalDrawBufferedStrokeSegment(op, flush);

    if (flush) {
      publishStrokeEnd({
        strokeId: _currentStrokeId
      });
      _currentStrokeId = null;
    }

    return result;
  }

  function listenToEnhancerEvents() {
    document.addEventListener('ink-enhancer:stroke-segments', (e) => {
      const detail = e.detail;
      if (!detail) return;

      const strokeId = detail.strokeId;
      const segments = detail.segments;

      if (strokeId && Array.isArray(segments)) {
        applyEnhancedStroke(strokeId, segments);
      }
    });

    document.addEventListener('ink-enhancer:stroke-finalized', (e) => {
      const detail = e.detail;
      if (!detail) return;

      const strokeId = detail.strokeId;
      const enhancedPoints = detail.enhancedPoints;

      if (strokeId && Array.isArray(enhancedPoints)) {
        console.log('[Ink Enhancer] Stroke finalized:', strokeId, enhancedPoints.length, 'points');
      }
    });
  }

  function initializeEnhancer() {
    console.log('[Ink Enhancer] Initializing enhancer integration');

    if (typeof window.drawBufferedStrokeSegment === 'function') {
      window.drawBufferedStrokeSegment = enhanceDrawBufferedStrokeSegment;
      console.log('[Ink Enhancer] Enhanced drawBufferedStrokeSegment');
    }

    listenToEnhancerEvents();

    window._inkEnhancerReady = true;
    console.log('[Ink Enhancer] Integration complete');
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

  window._inkEnhancer = {
    setEnabled: (enabled) => {
      _enhancerEnabled = !!enabled;
      console.log('[Ink Enhancer] Enhancer', _enhancerEnabled ? 'enabled' : 'disabled');
    },
    isEnabled: () => _enhancerEnabled,
    getStrokeEnhancements: () => new Map(_strokeEnhancements)
  };

  console.log('[Ink Enhancer] Injection script loaded');
})();
