# InkCanvas Enhanced Plugin 技术文档

## 目录
- [概述](#概述)
- [技术架构](#技术架构)
- [核心功能](#核心功能)
- [安装与配置](#安装与配置)
- [API参考](#api参考)
- [性能优化](#性能优化)
- [故障排除](#故障排除)

## 概述

InkCanvas Enhanced Plugin 是为 LanStartWrite 应用程序开发的增强型书写插件,专注于提供流畅自然的书写体验。

### 主要特性

1. **动态笔锋效果**
   - 基于书写速度智能调整线条粗细
   - 支持压感灵敏度调节
   - 自适应平滑算法

2. **低延迟渲染**
   - 优化的渲染管道
   - 高效的坐标点处理
   - 局部区域刷新机制

3. **性能监控**
   - 实时性能指标收集
   - 延迟统计分析
   - 资源使用监控

### 技术要求

- LanStartWrite v1.0+
- Electron v26.0.0+
- Canvas 2D API 支持
- Worker 线程支持

## 技术架构

### 插件结构

```
inkcanvas-enhanced/
├── main.js                    # 插件主入口
├── manifest.json             # 插件配置清单
├── renderer-enhanced.js      # 增强渲染器
└── performance-test.js       # 性能测试模块
```

### 架构设计

插件采用事件驱动架构,通过 LanStartWrite 的插件系统与主应用通信:

```
┌─────────────────┐
│   LanStartWrite │
│   主应用        │
└────────┬────────┘
         │
         │ 事件总线
         │
┌────────▼────────┐
│  InkCanvas      │
│  Enhanced       │
│  Plugin         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│ Main  │ │Renderer│
│  JS   │ │Enhanced│
└───────┘ └────────┘
```

### 核心模块

#### 1. main.js
插件主入口,负责:
- 事件监听和处理
- 笔画增强算法
- 性能指标收集
- 配置管理

#### 2. renderer-enhanced.js
增强渲染器,负责:
- Canvas 绘制逻辑
- 动态笔锋渲染
- 低延迟渲染优化
- 视图变换处理

#### 3. performance-test.js
性能测试模块,提供:
- 自动化性能测试
- 结果分析和验证
- 性能报告生成

## 核心功能

### 1. 动态笔锋效果

#### 算法原理

动态笔锋效果基于以下数学模型:

```javascript
speedFactor = min(speed / 2.5, 1)
speedRatio = minBrushRatio + (maxBrushRatio - minBrushRatio) * (1 - speedFactor * speedSensitivity)
pressureRatio = 1.0 - (1.0 - pressure) * pressureSensitivity
dynamicWidth = baseWidth * speedRatio * pressureRatio
```

#### 参数说明

- **speed**: 书写速度 (像素/毫秒)
- **pressure**: 压力值 (0.0 - 1.0)
- **speedSensitivity**: 速度灵敏度 (0.0 - 1.0)
- **pressureSensitivity**: 压感灵敏度 (0.0 - 1.0)
- **minBrushRatio**: 最小笔刷比例 (0.1 - 1.0)
- **maxBrushRatio**: 最大笔刷比例 (1.0 - 3.0)

#### 效果示例

- 快速书写: 线条变细 (约为基础宽度的 40%-60%)
- 慢速书写: 线条变粗 (约为基础宽度的 120%-160%)
- 转折停顿: 线条加粗,模拟真实笔锋

### 2. 低延迟渲染

#### 优化策略

1. **增量渲染**
   - 只渲染新增笔画段
   - 避免全屏重绘

2. **自适应平滑**
   - 根据笔画长度动态调整平滑因子
   - 平衡平滑效果和性能

3. **请求动画帧**
   - 使用 requestAnimationFrame 批量处理渲染
   - 减少不必要的绘制操作

4. **坐标点优化**
   - 智能采样,减少冗余点
   - 保持笔画精度

#### 性能指标

- 平均延迟: < 10ms
- 最大延迟: < 20ms
- 95分位延迟: < 15ms
- 内存占用: < 50MB

### 3. 性能监控

#### 监控指标

- **笔画计数**: 总笔画数量
- **平均延迟**: 平均处理延迟
- **最大延迟**: 最大处理延迟
- **最小延迟**: 最小处理延迟
- **95分位延迟**: 95% 的延迟低于此值
- **99分位延迟**: 99% 的延迟低于此值

#### 数据采集

性能数据每 1000ms 采集一次,通过事件总线发布:

```javascript
Mod.publish('inkcanvas-enhanced/performance-metrics', {
  strokeCount: 100,
  avgLatency: '5.23',
  maxLatency: '12.45',
  minLatency: '2.10',
  renderTimePercentile95: '8.50',
  renderTimePercentile99: '11.20'
});
```

## 安装与配置

### 安装步骤

1. 将插件目录复制到 LanStartWrite 的插件目录:
   ```
   LanStartWrite/mod/plugins/inkcanvas-enhanced/
   ```

2. 重启 LanStartWrite 应用

3. 插件将自动加载并初始化

### 配置选项

#### manifest.json 配置

```json
{
  "id": "inkcanvas-enhanced",
  "name": "InkCanvas Enhanced",
  "version": "1.0.0",
  "type": "feature",
  "permissions": ["ui:override"],
  "overrides": {
    "renderer": {
      "path": "renderer-enhanced.js"
    }
  },
  "config": {
    "dynamicBrushEnabled": true,
    "pressureSensitivity": 0.7,
    "speedSensitivity": 0.8,
    "minBrushRatio": 0.4,
    "maxBrushRatio": 1.6,
    "smoothingFactor": 0.3,
    "adaptiveSmoothing": true,
    "performanceMetrics": {
      "enabled": true,
      "sampleInterval": 1000
    }
  }
}
```

#### 运行时配置

通过事件总线动态更新配置:

```javascript
Mod.publish('inkcanvas-enhanced/update-config', {
  dynamicBrushEnabled: true,
  pressureSensitivity: 0.8,
  speedSensitivity: 0.9,
  minBrushRatio: 0.5,
  maxBrushRatio: 1.5,
  smoothingFactor: 0.25,
  adaptiveSmoothing: true,
  performanceMetrics: {
    enabled: true,
    sampleInterval: 500
  }
});
```

### 配置参数详解

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| dynamicBrushEnabled | Boolean | true | - | 是否启用动态笔锋效果 |
| pressureSensitivity | Number | 0.7 | 0.0-1.0 | 压感灵敏度,值越大压感影响越强 |
| speedSensitivity | Number | 0.8 | 0.0-1.0 | 速度灵敏度,值越大速度影响越强 |
| minBrushRatio | Number | 0.4 | 0.1-1.0 | 最小笔刷比例,相对于基础宽度 |
| maxBrushRatio | Number | 1.6 | 1.0-3.0 | 最大笔刷比例,相对于基础宽度 |
| smoothingFactor | Number | 0.3 | 0.0-0.5 | 平滑因子,值越大平滑效果越强 |
| adaptiveSmoothing | Boolean | true | - | 是否启用自适应平滑 |
| performanceMetrics.enabled | Boolean | true | - | 是否启用性能监控 |
| performanceMetrics.sampleInterval | Number | 1000 | 100-5000 | 性能数据采样间隔(毫秒) |

## API参考

### 事件接口

#### 订阅事件

插件发布以下事件供外部订阅:

##### 1. inkcanvas-enhanced/stroke-enhanced

当笔画被增强处理后触发。

```javascript
Mod.on('inkcanvas-enhanced/stroke-enhanced', (data) => {
  console.log('Stroke enhanced:', data.strokeId);
});
```

**数据结构:**
```javascript
{
  strokeId: String,      // 笔画ID
  points: Array,         // 增强后的点集
  originalPoints: Array, // 原始点集
  baseSize: Number,      // 基础笔刷大小
  color: String          // 笔画颜色
}
```

##### 2. inkcanvas-enhanced/stroke-updated

当笔画更新时触发。

```javascript
Mod.on('inkcanvas-enhanced/stroke-updated', (data) => {
  console.log('Stroke updated:', data.strokeId);
});
```

##### 3. inkcanvas-enhanced/stroke-ended

当笔画结束时触发。

```javascript
Mod.on('inkcanvas-enhanced/stroke-ended', (data) => {
  console.log('Stroke ended:', data.strokeId);
});
```

**数据结构:**
```javascript
{
  strokeId: String,    // 笔画ID
  pointCount: Number,  // 点的数量
  duration: Number,    // 持续时间(毫秒)
  avgSpeed: Number     // 平均速度
}
```

##### 4. inkcanvas-enhanced/performance-metrics

性能指标更新时触发。

```javascript
Mod.on('inkcanvas-enhanced/performance-metrics', (metrics) => {
  console.log('Performance:', metrics);
});
```

##### 5. inkcanvas-enhanced/ready

插件准备就绪时触发。

```javascript
Mod.on('inkcanvas-enhanced/ready', (data) => {
  console.log('Plugin ready:', data.version);
});
```

#### 发布事件

外部可以通过以下事件与插件交互:

##### 1. inkcanvas-enhanced/update-config

更新插件配置。

```javascript
Mod.publish('inkcanvas-enhanced/update-config', {
  dynamicBrushEnabled: false
});
```

##### 2. inkcanvas-enhanced/get-config

获取当前配置。

```javascript
Mod.publish('inkcanvas-enhanced/get-config');

Mod.on('inkcanvas-enhanced/config-response', (data) => {
  console.log('Current config:', data.config);
});
```

##### 3. inkcanvas-enhanced/get-performance-stats

获取性能统计数据。

```javascript
Mod.publish('inkcanvas-enhanced/get-performance-stats');

Mod.on('inkcanvas-enhanced/performance-stats-response', (data) => {
  console.log('Performance stats:', data.stats);
});
```

##### 4. inkcanvas-enhanced/reset-performance-stats

重置性能统计数据。

```javascript
Mod.publish('inkcanvas-enhanced/reset-performance-stats');
```

##### 5. inkcanvas-enhanced/get-version

获取插件版本信息。

```javascript
Mod.publish('inkcanvas-enhanced/get-version');

Mod.on('inkcanvas-enhanced/version-response', (data) => {
  console.log('Plugin version:', data.version);
});
```

### 核心函数

#### enhanceStrokePoints(points, baseSize, pressures)

增强笔画点,应用动态笔锋效果。

**参数:**
- `points`: Array - 原始点集
- `baseSize`: Number - 基础笔刷大小
- `pressures`: Array - 压力值数组

**返回值:**
- Array - 增强后的点集

**示例:**
```javascript
const enhanced = enhanceStrokePoints(
  [{x: 100, y: 100}, {x: 110, y: 105}],
  4,
  [0.8, 0.9]
);
```

#### smoothDynamicSizes(points, adaptive)

平滑动态笔刷大小。

**参数:**
- `points`: Array - 点集
- `adaptive`: Boolean - 是否使用自适应平滑

**返回值:**
- Array - 平滑后的点集

#### calculateSpeed(p1, p2, deltaTime)

计算两点之间的速度。

**参数:**
- `p1`: Object - 起点 {x, y}
- `p2`: Object - 终点 {x, y}
- `deltaTime`: Number - 时间差(毫秒)

**返回值:**
- Number - 速度(像素/毫秒)

#### calculateDynamicWidth(baseWidth, speed, pressure)

计算动态笔刷宽度。

**参数:**
- `baseWidth`: Number - 基础宽度
- `speed`: Number - 速度
- `pressure`: Number - 压力值

**返回值:**
- Number - 动态宽度

## 性能优化

### 优化建议

#### 1. 调整平滑因子

对于高性能设备,可以增加平滑因子以获得更平滑的笔画:

```javascript
{
  "smoothingFactor": 0.4,
  "adaptiveSmoothing": true
}
```

对于低性能设备,可以减少平滑因子以提高响应速度:

```javascript
{
  "smoothingFactor": 0.2,
  "adaptiveSmoothing": false
}
```

#### 2. 调整采样间隔

对于需要更精细性能监控的场景,可以减少采样间隔:

```javascript
{
  "performanceMetrics": {
    "sampleInterval": 500
  }
}
```

#### 3. 禁用动态笔锋

如果不需要动态笔锋效果,可以禁用以提高性能:

```javascript
{
  "dynamicBrushEnabled": false
}
```

### 性能测试

运行性能测试:

```javascript
// 在浏览器控制台中
PerformanceTest.runAllTests();
```

导出测试结果:

```javascript
// JSON 格式
const jsonResults = PerformanceTest.exportResults('json');

// CSV 格式
const csvResults = PerformanceTest.exportResults('csv');

// HTML 格式
const htmlResults = PerformanceTest.exportResults('html');
```

验证测试结果:

```javascript
const validation = PerformanceTest.validateResults();
console.log('Passed:', validation.passed);
console.log('Issues:', validation.issues);
console.log('Recommendations:', validation.recommendations);
```

### 性能基准

| 指标 | 目标值 | 优秀值 |
|------|--------|--------|
| 平均延迟 | < 10ms | < 5ms |
| 最大延迟 | < 20ms | < 10ms |
| 95分位延迟 | < 15ms | < 8ms |
| 内存占用 | < 50MB | < 30MB |
| CPU占用 | < 10% | < 5% |

## 故障排除

### 常见问题

#### 1. 插件未加载

**症状**: 插件功能未生效

**解决方案**:
- 检查插件目录是否正确放置在 `mod/plugins/` 下
- 检查 manifest.json 格式是否正确
- 查看浏览器控制台是否有错误信息
- 重启 LanStartWrite 应用

#### 2. 动态笔锋效果不明显

**症状**: 线条粗细变化不明显

**解决方案**:
- 增加 `speedSensitivity` 值 (如 0.9)
- 调整 `minBrushRatio` 和 `maxBrushRatio` 范围
- 确保 `dynamicBrushEnabled` 为 true
- 尝试以不同速度书写以观察效果

#### 3. 书写延迟较高

**症状**: 书写时感觉有延迟

**解决方案**:
- 减少 `smoothingFactor` 值 (如 0.2)
- 禁用 `adaptiveSmoothing`
- 关闭性能监控: `performanceMetrics.enabled = false`
- 检查系统资源使用情况

#### 4. 性能监控数据不准确

**症状**: 性能指标显示异常

**解决方案**:
- 调整 `sampleInterval` 值
- 重置性能统计数据
- 检查浏览器是否支持 `performance.memory` API

#### 5. 笔画不平滑

**症状**: 笔画出现锯齿或抖动

**解决方案**:
- 增加 `smoothingFactor` 值 (如 0.4)
- 启用 `adaptiveSmoothing`
- 检查输入设备的采样率
- 确保系统没有高负载进程

### 调试技巧

#### 启用详细日志

在浏览器控制台中:

```javascript
// 查看插件初始化信息
Mod.on('inkcanvas-enhanced/ready', (data) => {
  console.log('Plugin ready:', data);
});

// 监听性能指标
Mod.on('inkcanvas-enhanced/performance-metrics', (metrics) => {
  console.log('Metrics:', metrics);
});

// 监听笔画增强
Mod.on('inkcanvas-enhanced/stroke-enhanced', (data) => {
  console.log('Enhanced stroke:', data.strokeId, 'points:', data.points.length);
});
```

#### 性能分析

使用浏览器开发者工具:

1. 打开 Performance 面板
2. 开始录制
3. 进行书写操作
4. 停止录制并分析结果

#### 内存分析

使用 Memory 面板:

1. 拍摄堆快照
2. 进行书写操作
3. 再次拍摄堆快照
4. 比较差异,查找内存泄漏

### 获取帮助

如果遇到无法解决的问题:

1. 检查浏览器控制台错误信息
2. 运行性能测试并导出结果
3. 收集系统信息 (浏览器版本、操作系统等)
4. 联系技术支持并提供详细信息

## 版本历史

### v1.0.0 (2026-01-05)
- 初始版本发布
- 实现动态笔锋效果
- 实现低延迟渲染
- 实现性能监控
- 完整的 API 接口

## 许可证

本插件为 LanStartWrite 项目的一部分,遵循项目的许可证协议。

## 贡献

欢迎提交问题报告和改进建议。

---

**文档版本**: 1.0.0  
**最后更新**: 2026-01-05  
**维护者**: LanStartWrite 开发团队
