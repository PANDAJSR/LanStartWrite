# InkCanvas Enhanced Plugin 使用说明

## 快速开始

### 什么是 InkCanvas Enhanced Plugin?

InkCanvas Enhanced Plugin 是一个为 LanStartWrite 设计的增强型书写插件,它可以在不改变现有界面的情况下,显著提升书写体验。

### 主要功能

1. **动态笔锋效果** - 根据书写速度自动调整线条粗细,模拟真实书写感觉
2. **低延迟响应** - 优化渲染机制,让书写更加流畅自然
3. **智能平滑** - 自动平滑笔画,消除抖动和锯齿

### 安装插件

插件已包含在 LanStartWrite 中,无需额外安装。只需确保插件文件位于正确位置:

```
LanStartWrite/mod/plugins/inkcanvas-enhanced/
```

## 使用指南

### 基本使用

#### 1. 启动应用

打开 LanStartWrite 应用,插件会自动加载。

#### 2. 开始书写

在画布上直接书写,插件会自动应用以下效果:

- **快速书写**: 线条变细,流畅轻盈
- **慢速书写**: 线条变粗,沉稳有力
- **转折停顿**: 线条加粗,形成自然的笔锋效果

#### 3. 观察效果

尝试以不同速度书写,观察线条粗细的变化:

- 快速画直线 → 线条较细
- 慢速画曲线 → 线条较粗
- 快速书写后停顿 → 形成笔锋

### 高级功能

#### 查看性能指标

插件会自动收集性能数据,包括:

- 平均延迟
- 最大延迟
- 笔画计数
- 处理速度

在浏览器控制台中查看:

```javascript
// 获取性能统计数据
Mod.publish('inkcanvas-enhanced/get-performance-stats');

// 订阅性能更新
Mod.on('inkcanvas-enhanced/performance-metrics', (metrics) => {
  console.log('当前性能指标:');
  console.log('平均延迟:', metrics.avgLatency, 'ms');
  console.log('最大延迟:', metrics.maxLatency, 'ms');
  console.log('笔画数量:', metrics.strokeCount);
});
```

#### 自定义配置

可以通过事件总线动态调整插件配置:

```javascript
// 调整速度灵敏度 (0.0 - 1.0)
Mod.publish('inkcanvas-enhanced/update-config', {
  speedSensitivity: 0.9  // 更强的速度响应
});

// 调整压感灵敏度 (0.0 - 1.0)
Mod.publish('inkcanvas-enhanced/update-config', {
  pressureSensitivity: 0.8  // 更强的压感响应
});

// 调整笔刷粗细范围
Mod.publish('inkcanvas-enhanced/update-config', {
  minBrushRatio: 0.3,  // 最细为基础宽度的 30%
  maxBrushRatio: 1.8   // 最粗为基础宽度的 180%
});

// 调整平滑程度 (0.0 - 0.5)
Mod.publish('inkcanvas-enhanced/update-config', {
  smoothingFactor: 0.4  // 更强的平滑效果
});
```

#### 禁用/启用功能

```javascript
// 禁用动态笔锋效果
Mod.publish('inkcanvas-enhanced/update-config', {
  dynamicBrushEnabled: false
});

// 重新启用动态笔锋效果
Mod.publish('inkcanvas-enhanced/update-config', {
  dynamicBrushEnabled: true
});

// 禁用性能监控
Mod.publish('inkcanvas-enhanced/update-config', {
  performanceMetrics: {
    enabled: false
  }
});
```

## 书写技巧

### 获得最佳书写效果

#### 1. 速度控制

- **快速书写**: 适合画直线、快速勾勒轮廓
- **慢速书写**: 适合画曲线、精细描绘
- **速度变化**: 在转折处自然减速,形成优美的笔锋

#### 2. 压力控制

如果你的设备支持压感:

- **轻按**: 线条较细
- **重按**: 线条较粗
- **压力变化**: 在起笔和收笔时调整压力,形成自然的笔锋

#### 3. 笔画连贯

- 保持笔画连贯,避免频繁停顿
- 在需要转折时自然减速,而不是完全停顿
- 利用速度变化来表达笔画的重心和节奏

### 常见书写场景

#### 场景 1: 写字

```
技巧:
- 横画: 快速起笔,中间匀速,收笔时减速
- 竖画: 起笔稍慢,中间快速,收笔自然
- 撇捺: 起笔快速,中间减速,收笔时形成笔锋
```

#### 场景 2: 画图

```
技巧:
- 轮廓: 快速勾勒,形成流畅线条
- 细节: 慢速描绘,保持线条稳定
- 阴影: 快速排线,保持间距均匀
```

#### 场景 3: 标注

```
技巧:
- 箭头: 快速画直线,箭头处稍慢
- 圈注: 快速画圆,保持速度均匀
- 下划线: 快速画线,保持直线度
```

## 性能优化建议

### 根据设备性能调整

#### 高性能设备

```javascript
{
  "smoothingFactor": 0.4,
  "adaptiveSmoothing": true,
  "speedSensitivity": 0.9,
  "pressureSensitivity": 0.8
}
```

#### 中等性能设备

```javascript
{
  "smoothingFactor": 0.3,
  "adaptiveSmoothing": true,
  "speedSensitivity": 0.8,
  "pressureSensitivity": 0.7
}
```

#### 低性能设备

```javascript
{
  "smoothingFactor": 0.2,
  "adaptiveSmoothing": false,
  "speedSensitivity": 0.7,
  "pressureSensitivity": 0.6
}
```

### 根据使用场景调整

#### 快速书写场景

```javascript
{
  "smoothingFactor": 0.2,
  "adaptiveSmoothing": false,
  "speedSensitivity": 0.9
}
```

#### 精细书写场景

```javascript
{
  "smoothingFactor": 0.4,
  "adaptiveSmoothing": true,
  "speedSensitivity": 0.6
}
```

#### 演示场景

```javascript
{
  "smoothingFactor": 0.3,
  "adaptiveSmoothing": true,
  "speedSensitivity": 0.8,
  "performanceMetrics": {
    "enabled": false
  }
}
```

## 故障排除

### 问题: 感觉有延迟

**可能原因**:
- 平滑因子设置过高
- 设备性能不足
- 系统负载过高

**解决方案**:
```javascript
// 降低平滑因子
Mod.publish('inkcanvas-enhanced/update-config', {
  smoothingFactor: 0.2,
  adaptiveSmoothing: false
});

// 禁用性能监控
Mod.publish('inkcanvas-enhanced/update-config', {
  performanceMetrics: {
    enabled: false
  }
});
```

### 问题: 笔锋效果不明显

**可能原因**:
- 速度灵敏度设置过低
- 书写速度变化不明显

**解决方案**:
```javascript
// 提高速度灵敏度
Mod.publish('inkcanvas-enhanced/update-config', {
  speedSensitivity: 0.9
});

// 扩大笔刷粗细范围
Mod.publish('inkcanvas-enhanced/update-config', {
  minBrushRatio: 0.3,
  maxBrushRatio: 1.8
});
```

### 问题: 笔画不平滑

**可能原因**:
- 平滑因子设置过低
- 输入设备采样率低

**解决方案**:
```javascript
// 提高平滑因子
Mod.publish('inkcanvas-enhanced/update-config', {
  smoothingFactor: 0.4,
  adaptiveSmoothing: true
});
```

### 问题: 性能监控数据不准确

**可能原因**:
- 采样间隔设置不当
- 浏览器不支持相关 API

**解决方案**:
```javascript
// 调整采样间隔
Mod.publish('inkcanvas-enhanced/update-config', {
  performanceMetrics: {
    sampleInterval: 1000
  }
});

// 重置统计数据
Mod.publish('inkcanvas-enhanced/reset-performance-stats');
```

## 最佳实践

### 1. 定期检查性能

```javascript
// 定期获取性能报告
setInterval(() => {
  Mod.publish('inkcanvas-enhanced/get-performance-stats');
}, 60000); // 每分钟一次

Mod.on('inkcanvas-enhanced/performance-stats-response', (data) => {
  console.log('性能报告:', data.stats);
});
```

### 2. 根据反馈调整配置

根据用户反馈和使用体验,动态调整配置:

```javascript
// 如果用户反馈延迟高
if (avgLatency > 10) {
  Mod.publish('inkcanvas-enhanced/update-config', {
    smoothingFactor: 0.2,
    adaptiveSmoothing: false
  });
}

// 如果用户反馈笔锋不明显
if (userFeedback.brushEffectWeak) {
  Mod.publish('inkcanvas-enhanced/update-config', {
    speedSensitivity: 0.9,
    minBrushRatio: 0.3,
    maxBrushRatio: 1.8
  });
}
```

### 3. 保存用户偏好

将用户的配置偏好保存到本地存储:

```javascript
// 保存配置
function saveUserConfig(config) {
  localStorage.setItem('inkcanvas-enhanced-config', JSON.stringify(config));
}

// 加载配置
function loadUserConfig() {
  const saved = localStorage.getItem('inkcanvas-enhanced-config');
  if (saved) {
    const config = JSON.parse(saved);
    Mod.publish('inkcanvas-enhanced/update-config', config);
  }
}

// 应用启动时加载
loadUserConfig();
```

## 常见问题

### Q: 插件会影响原有功能吗?

A: 不会。插件只增强书写效果,不会改变原有界面和功能。

### Q: 如何知道插件是否正常工作?

A: 在浏览器控制台中查看插件初始化信息:

```javascript
Mod.on('inkcanvas-enhanced/ready', (data) => {
  console.log('插件已就绪,版本:', data.version);
});
```

### Q: 可以同时使用多个插件吗?

A: 可以。插件之间通过事件总线通信,不会相互冲突。

### Q: 如何恢复默认配置?

A: 重启应用即可恢复默认配置,或者手动设置:

```javascript
Mod.publish('inkcanvas-enhanced/update-config', {
  dynamicBrushEnabled: true,
  pressureSensitivity: 0.7,
  speedSensitivity: 0.8,
  minBrushRatio: 0.4,
  maxBrushRatio: 1.6,
  smoothingFactor: 0.3,
  adaptiveSmoothing: true
});
```

### Q: 插件支持哪些输入设备?

A: 插件支持所有标准输入设备:
- 鼠标
- 触控板
- 触摸屏
- 数字绘图板 (支持压感)

### Q: 如何获得更好的书写体验?

A: 建议:
1. 使用支持压感的数字绘图板
2. 调整速度和压感灵敏度以适应个人习惯
3. 练习速度控制,掌握快慢变化的节奏
4. 定期检查性能指标,优化配置

## 技术支持

### 获取帮助

如果遇到问题:

1. 查看本使用说明
2. 查看技术文档 (README.md)
3. 检查浏览器控制台错误信息
4. 运行性能测试并导出结果
5. 联系技术支持

### 提供反馈

我们欢迎您的反馈和建议:

- 功能建议
- 性能问题
- 使用体验
- Bug 报告

### 资源链接

- 技术文档: [README.md](./README.md)
- 性能测试: [performance-test.js](./performance-test.js)
- 插件配置: [manifest.json](./manifest.json)

---

**文档版本**: 1.0.0  
**最后更新**: 2026-01-05  
**适用版本**: InkCanvas Enhanced Plugin v1.0.0
