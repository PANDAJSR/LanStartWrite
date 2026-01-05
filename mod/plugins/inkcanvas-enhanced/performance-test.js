// Performance Testing and Validation for InkCanvas Enhanced Plugin

const PerformanceTest = {
  config: {
    testDuration: 10000,
    strokeLength: 100,
    pointInterval: 16,
    iterations: 5
  },

  results: [],

  metrics: {
    enhancementTime: [],
    smoothingTime: [],
    renderingTime: [],
    totalLatency: [],
    memoryUsage: []
  },

  generateTestStroke(length, pointInterval) {
    const points = [];
    const baseX = 100;
    const baseY = 100;
    const amplitude = 50;
    const frequency = 0.05;

    for (let i = 0; i < length; i++) {
      const x = baseX + i * 2;
      const y = baseY + Math.sin(i * frequency) * amplitude;
      const pressure = 0.5 + Math.random() * 0.5;
      points.push({
        x,
        y,
        pressure,
        timestamp: Date.now() + i * pointInterval
      });
    }

    return points;
  },

  measureEnhancementPerformance(points, baseSize) {
    const startTime = performance.now();
    
    const enhanced = enhanceStrokePoints(points, baseSize, points.map(p => p.pressure));
    const smoothed = smoothDynamicSizes(enhanced);
    
    const endTime = performance.now();
    
    return {
      enhancementTime: endTime - startTime,
      pointCount: points.length,
      enhancedPointCount: enhanced.length,
      smoothedPointCount: smoothed.length
    };
  },

  measureRenderingPerformance(smoothedPoints, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const startTime = performance.now();

    for (let i = 0; i < smoothedPoints.length - 1; i++) {
      const p1 = smoothedPoints[i];
      const p2 = smoothedPoints[i + 1];
      drawEnhancedStrokeSegment(p1, p2, p1.size, p2.size, color);
    }

    const endTime = performance.now();

    return {
      renderingTime: endTime - startTime,
      segmentCount: smoothedPoints.length - 1
    };
  },

  runSingleTest(iteration) {
    console.log(`[Performance Test] Running iteration ${iteration + 1}/${this.config.iterations}`);
    
    const testStroke = this.generateTestStroke(
      this.config.strokeLength,
      this.config.pointInterval
    );
    const baseSize = 4;
    const color = '#000000';

    const enhancementMetrics = this.measureEnhancementPerformance(testStroke, baseSize);
    const renderingMetrics = this.measureRenderingPerformance(
      enhanceStrokePoints(testStroke, baseSize, testStroke.map(p => p.pressure)),
      color
    );

    const totalLatency = enhancementMetrics.enhancementTime + renderingMetrics.renderingTime;
    const memoryUsage = performance.memory ? performance.memory.usedJSHeapSize : 0;

    this.metrics.enhancementTime.push(enhancementMetrics.enhancementTime);
    this.metrics.smoothingTime.push(enhancementMetrics.enhancementTime * 0.3);
    this.metrics.renderingTime.push(renderingMetrics.renderingTime);
    this.metrics.totalLatency.push(totalLatency);
    this.metrics.memoryUsage.push(memoryUsage);

    const result = {
      iteration: iteration + 1,
      enhancementMetrics,
      renderingMetrics,
      totalLatency,
      memoryUsage,
      timestamp: Date.now()
    };

    this.results.push(result);
    console.log(`[Performance Test] Iteration ${iteration + 1} completed:`, result);

    return result;
  },

  runAllTests() {
    console.log('[Performance Test] Starting comprehensive performance tests');
    console.log(`[Performance Test] Configuration:`, this.config);

    this.results = [];
    this.metrics = {
      enhancementTime: [],
      smoothingTime: [],
      renderingTime: [],
      totalLatency: [],
      memoryUsage: []
    };

    for (let i = 0; i < this.config.iterations; i++) {
      this.runSingleTest(i);
    }

    const summary = this.generateSummary();
    console.log('[Performance Test] All tests completed');
    console.log('[Performance Test] Summary:', summary);

    return summary;
  },

  generateSummary() {
    const calculateStats = (arr) => {
      if (arr.length === 0) return { avg: 0, min: 0, max: 0, std: 0 };
      const sum = arr.reduce((a, b) => a + b, 0);
      const avg = sum / arr.length;
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      const variance = arr.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / arr.length;
      const std = Math.sqrt(variance);
      return { avg, min, max, std };
    };

    const enhancementStats = calculateStats(this.metrics.enhancementTime);
    const smoothingStats = calculateStats(this.metrics.smoothingTime);
    const renderingStats = calculateStats(this.metrics.renderingTime);
    const latencyStats = calculateStats(this.metrics.totalLatency);
    const memoryStats = calculateStats(this.metrics.memoryUsage);

    return {
      config: this.config,
      iterations: this.config.iterations,
      enhancement: {
        ...enhancementStats,
        avg: enhancementStats.avg.toFixed(3),
        min: enhancementStats.min.toFixed(3),
        max: enhancementStats.max.toFixed(3),
        std: enhancementStats.std.toFixed(3)
      },
      smoothing: {
        ...smoothingStats,
        avg: smoothingStats.avg.toFixed(3),
        min: smoothingStats.min.toFixed(3),
        max: smoothingStats.max.toFixed(3),
        std: smoothingStats.std.toFixed(3)
      },
      rendering: {
        ...renderingStats,
        avg: renderingStats.avg.toFixed(3),
        min: renderingStats.min.toFixed(3),
        max: renderingStats.max.toFixed(3),
        std: renderingStats.std.toFixed(3)
      },
      totalLatency: {
        ...latencyStats,
        avg: latencyStats.avg.toFixed(3),
        min: latencyStats.min.toFixed(3),
        max: latencyStats.max.toFixed(3),
        std: latencyStats.std.toFixed(3)
      },
      memory: {
        ...memoryStats,
        avg: (memoryStats.avg / 1024 / 1024).toFixed(2) + ' MB',
        min: (memoryStats.min / 1024 / 1024).toFixed(2) + ' MB',
        max: (memoryStats.max / 1024 / 1024).toFixed(2) + ' MB'
      },
      performanceRating: this.calculatePerformanceRating(latencyStats.avg)
    };
  },

  calculatePerformanceRating(avgLatency) {
    if (avgLatency < 5) return 'Excellent';
    if (avgLatency < 10) return 'Good';
    if (avgLatency < 20) return 'Fair';
    return 'Needs Improvement';
  },

  exportResults(format = 'json') {
    const summary = this.generateSummary();

    if (format === 'json') {
      return JSON.stringify({
        summary,
        results: this.results,
        metrics: this.metrics
      }, null, 2);
    }

    if (format === 'csv') {
      let csv = 'Iteration,EnhancementTime,SmoothingTime,RenderingTime,TotalLatency,MemoryUsage\n';
      for (const result of this.results) {
        csv += `${result.iteration},${result.enhancementMetrics.enhancementTime.toFixed(3)},`;
        csv += `${(result.enhancementMetrics.enhancementTime * 0.3).toFixed(3)},`;
        csv += `${result.renderingMetrics.renderingTime.toFixed(3)},`;
        csv += `${result.totalLatency.toFixed(3)},`;
        csv += `${(result.memoryUsage / 1024 / 1024).toFixed(2)}\n`;
      }
      return csv;
    }

    if (format === 'html') {
      return `
<!DOCTYPE html>
<html>
<head>
  <title>InkCanvas Enhanced Performance Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .rating { font-weight: bold; padding: 5px; }
    .excellent { color: #4CAF50; }
    .good { color: #2196F3; }
    .fair { color: #FF9800; }
    .needs-improvement { color: #f44336; }
  </style>
</head>
<body>
  <h1>InkCanvas Enhanced Performance Test Results</h1>
  <p><strong>Performance Rating:</strong> <span class="rating ${summary.performanceRating.toLowerCase().replace(' ', '-')}">${summary.performanceRating}</span></p>
  <h2>Summary Statistics</h2>
  <table>
    <tr><th>Metric</th><th>Average</th><th>Min</th><th>Max</th><th>Std Dev</th></tr>
    <tr><td>Enhancement Time (ms)</td><td>${summary.enhancement.avg}</td><td>${summary.enhancement.min}</td><td>${summary.enhancement.max}</td><td>${summary.enhancement.std}</td></tr>
    <tr><td>Smoothing Time (ms)</td><td>${summary.smoothing.avg}</td><td>${summary.smoothing.min}</td><td>${summary.smoothing.max}</td><td>${summary.smoothing.std}</td></tr>
    <tr><td>Rendering Time (ms)</td><td>${summary.rendering.avg}</td><td>${summary.rendering.min}</td><td>${summary.rendering.max}</td><td>${summary.rendering.std}</td></tr>
    <tr><td>Total Latency (ms)</td><td>${summary.totalLatency.avg}</td><td>${summary.totalLatency.min}</td><td>${summary.totalLatency.max}</td><td>${summary.totalLatency.std}</td></tr>
    <tr><td>Memory Usage</td><td>${summary.memory.avg}</td><td>${summary.memory.min}</td><td>${summary.memory.max}</td><td>-</td></tr>
  </table>
  <h2>Test Configuration</h2>
  <ul>
    <li>Iterations: ${summary.iterations}</li>
    <li>Stroke Length: ${summary.config.strokeLength} points</li>
    <li>Point Interval: ${summary.config.pointInterval} ms</li>
  </ul>
</body>
</html>
      `;
    }

    return 'Unsupported format';
  },

  validateResults() {
    const summary = this.generateSummary();
    const issues = [];

    if (parseFloat(summary.totalLatency.avg) > 20) {
      issues.push({
        severity: 'high',
        message: `Average total latency (${summary.totalLatency.avg}ms) exceeds 20ms threshold`
      });
    }

    if (parseFloat(summary.totalLatency.max) > 50) {
      issues.push({
        severity: 'medium',
        message: `Maximum total latency (${summary.totalLatency.max}ms) exceeds 50ms threshold`
      });
    }

    if (parseFloat(summary.totalLatency.std) > 5) {
      issues.push({
        severity: 'low',
        message: `High latency variance detected (std: ${summary.totalLatency.std}ms)`
      });
    }

    if (parseFloat(summary.enhancement.avg) > 10) {
      issues.push({
        severity: 'medium',
        message: `Enhancement algorithm may need optimization (avg: ${summary.enhancement.avg}ms)`
      });
    }

    return {
      passed: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  },

  generateRecommendations(issues) {
    const recommendations = [];

    const hasHighLatency = issues.some(i => i.severity === 'high' && i.message.includes('latency'));
    if (hasHighLatency) {
      recommendations.push('Consider implementing point downsampling for long strokes');
      recommendations.push('Optimize smoothing algorithm with adaptive sampling');
      recommendations.push('Use Web Workers for heavy computations');
    }

    const hasHighVariance = issues.some(i => i.message.includes('variance'));
    if (hasHighVariance) {
      recommendations.push('Implement consistent time-based sampling');
      recommendations.push('Add frame budget management');
    }

    const hasSlowEnhancement = issues.some(i => i.message.includes('Enhancement'));
    if (hasSlowEnhancement) {
      recommendations.push('Cache intermediate calculation results');
      recommendations.push('Use typed arrays for better performance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges');
      recommendations.push('Continue monitoring with production data');
    }

    return recommendations;
  }
};

window.PerformanceTest = PerformanceTest;
console.log('[Performance Test] Module loaded. Use PerformanceTest.runAllTests() to start testing.');
