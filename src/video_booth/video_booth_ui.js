import VideoBoothCore from './video_booth_core.js';
import { attachDragHelper } from '../tool_bar/drag_helper.js';

export default class VideoBoothUI {
  constructor() {
    this.core = new VideoBoothCore();
    this.container = null;
    this.video = null;
    this.controls = null;
    this._isVisible = false;
    
    // 变换状态
    this.transform = {
      scale: 1,
      rotate: 0,
      x: 0,
      y: 0
    };
    
    // 注入 CSS
    this.injectStyles();
  }

  isVisible() {
    return this._isVisible;
  }

  injectStyles() {
    if (document.getElementById('video-booth-styles')) return;
    const link = document.createElement('link');
    link.id = 'video-booth-styles';
    link.rel = 'stylesheet';
    link.href = './video_booth/video_booth.css';
    document.head.appendChild(link);
  }

  /**
   * 初始化 UI 并添加到 DOM
   */
  init() {
    if (this.container) return;

    // 创建主容器
    this.container = document.createElement('div');
    this.container.id = 'videoBoothContainer';
    this.container.className = 'video-booth-window';
    this.container.style.display = 'none';

    // 创建标题栏 (拖动手柄)
    const titleBar = document.createElement('div');
    titleBar.className = 'video-booth-titlebar';
    titleBar.innerHTML = `
      <div class="video-booth-title">视频展台</div>
      <div class="video-booth-window-controls">
        <button class="win-btn minimize-btn" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12"><path fill="currentColor" d="M2 6h8v1H2z"/></svg>
        </button>
        <button class="win-btn close-btn" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12"><path fill="currentColor" d="M2.22 2.22a.75.75 0 0 1 1.06 0L6 4.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L7.06 6l2.72 2.72a.75.75 0 1 1-1.06 1.06L6 7.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 0 1 0-1.06z"/></svg>
        </button>
      </div>
    `;

    // 创建视频区域
    const videoWrap = document.createElement('div');
    videoWrap.className = 'video-booth-wrap';
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.playsInline = true;
    videoWrap.appendChild(this.video);

    // 创建控制条
    const controlBar = document.createElement('div');
    controlBar.className = 'video-booth-controls';
    controlBar.innerHTML = `
      <div class="control-group">
        <button class="ctrl-btn play-pause-btn" title="暂停/播放">
          <svg class="play-icon" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M6 4v12l10-6z"/></svg>
          <svg class="pause-icon" width="20" height="20" viewBox="0 0 20 20" style="display:none"><path fill="currentColor" d="M6 4h3v12H6zm5 0h3v12h-3z"/></svg>
        </button>
        <select class="device-select" title="选择摄像头"></select>
      </div>
      <div class="control-group">
        <button class="ctrl-btn rotate-left-btn" title="向左旋转90°">
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55L13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/></svg>
        </button>
        <button class="ctrl-btn rotate-right-btn" title="向右旋转90°">
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>
        </button>
        <button class="ctrl-btn reset-view-btn" title="重置视图">
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4v3z"/></svg>
        </button>
      </div>
      <div class="control-group">
        <button class="ctrl-btn screenshot-btn" title="截屏到白板">
          <svg width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M10 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4m0 1a3 3 0 1 1 0-6a3 3 0 0 1 0 6M5 5h2.5l1-1.5h3l1 1.5H15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2"/></svg>
        </button>
        <button class="ctrl-btn fullscreen-btn" title="全屏">
          <svg width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M3 3h5v1H4v4H3zm14 0h-5v1h4v4h1zm0 14h-5v-1h4v-4h1zM3 17h5v-1H4v-4H3z"/></svg>
        </button>
      </div>
    `;

    this.container.appendChild(titleBar);
    this.container.appendChild(videoWrap);
    this.container.appendChild(controlBar);
    document.body.appendChild(this.container);

    this.bindEvents(titleBar, controlBar);
    this.initDraggable(titleBar);
  }

  /**
   * 绑定交互事件
   */
  bindEvents(titleBar, controlBar) {
    const closeBtn = titleBar.querySelector('.close-btn');
    const minimizeBtn = titleBar.querySelector('.minimize-btn');
    const playPauseBtn = controlBar.querySelector('.play-pause-btn');
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    const deviceSelect = controlBar.querySelector('.device-select');
    const screenshotBtn = controlBar.querySelector('.screenshot-btn');
    const fullscreenBtn = controlBar.querySelector('.fullscreen-btn');

    const rotateLeftBtn = controlBar.querySelector('.rotate-left-btn');
    const rotateRightBtn = controlBar.querySelector('.rotate-right-btn');
    const resetViewBtn = controlBar.querySelector('.reset-view-btn');

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.hide();
    };

    minimizeBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    };

    rotateLeftBtn.onclick = () => this.rotate(-90);
    rotateRightBtn.onclick = () => this.rotate(90);
    resetViewBtn.onclick = () => this.resetView();

    playPauseBtn.onclick = () => {
      if (this.video.paused) {
        this.video.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
      } else {
        this.video.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
      }
    };

    deviceSelect.onchange = async () => {
      const deviceId = deviceSelect.value;
      try {
        const stream = await this.core.switchDevice(deviceId);
        this.video.srcObject = stream;
      } catch (err) {
        alert('切换设备失败: ' + err.message);
      }
    };

    fullscreenBtn.onclick = () => this.toggleFullscreen();

    screenshotBtn.onclick = () => this.takeScreenshot();

    // Setup transform interactions
    this.setupTransformInteractions();
  }

  setupTransformInteractions() {
    const wrap = this.container.querySelector('.video-booth-wrap');
    if (!wrap) return;

    // Mouse interactions
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Check app mode for interaction restrictions
      const isAnnotation = document.body.dataset.appMode === 'annotation';
      if (isAnnotation) return;

      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      wrap.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || !this._isVisible) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.pan(dx, dy);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        wrap.style.cursor = '';
      }
    });

    // Wheel zoom
    wrap.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 1.1 : 0.9;
        this.zoom(factor);
      }
    }, { passive: false });

    // Touch interactions
    let initialPinchDist = 0;
    let initialPinchAngle = 0;
    let isPinching = false;
    let lastTouchX = 0;
    let lastTouchY = 0;

    wrap.addEventListener('touchstart', (e) => {
      // Check app mode
      const isAnnotation = document.body.dataset.appMode === 'annotation';
      if (isAnnotation) return;

      if (e.touches.length === 1) {
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        isPinching = true;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchAngle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );
      }
    }, { passive: false });

    wrap.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault(); // Prevent scrolling

      if (isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.pan(dx, dy);
      } else if (isPinching && e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const angle = Math.atan2(
          e.touches[1].clientY - e.touches[0].clientY,
          e.touches[1].clientX - e.touches[0].clientX
        );

        // Zoom
        if (initialPinchDist > 0) {
          const factor = dist / initialPinchDist;
          this.zoom(factor, true); // absolute zoom relative to initial? No, incremental is better
          // But implementing incremental with touchmove is tricky because we get continuous events.
          // Better to use delta.
          // Let's reset initialPinchDist each time for incremental change
          initialPinchDist = dist;
        }

        // Rotate (Dual finger rotation)
        const angleDiff = (angle - initialPinchAngle) * 180 / Math.PI;
        if (Math.abs(angleDiff) > 1) { // Threshold
           this.transform.rotate += angleDiff;
           initialPinchAngle = angle;
           this.updateTransform();
        }
      }
    }, { passive: false });

    wrap.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        if (isPinching) {
          // Snap rotation to nearest 90 degrees on release
          const r = this.transform.rotate;
          const snapped = Math.round(r / 90) * 90;
          this.transform.rotate = snapped;
          this.updateTransform();
        }
        isDragging = false;
        isPinching = false;
      } else if (e.touches.length === 1) {
        // Switch to drag
        isDragging = true;
        isPinching = false;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    });
  }

  pan(dx, dy) {
    const wrap = this.container.querySelector('.video-booth-wrap');
    if (!wrap) return;
    
    // Limit translation to keep video somewhat visible
    // Simple heuristic: don't let center move beyond viewport/container bounds too much
    // Since container is fixed size (or fullscreen), use container bounds
    const rect = wrap.getBoundingClientRect();
    const limitX = rect.width * 0.75;
    const limitY = rect.height * 0.75;

    this.transform.x += dx;
    this.transform.y += dy;
    
    this.transform.x = Math.max(-limitX, Math.min(limitX, this.transform.x));
    this.transform.y = Math.max(-limitY, Math.min(limitY, this.transform.y));

    this.updateTransform();
  }

  zoom(factor, isIncremental = true) {
    let newScale = this.transform.scale * factor;
    // Limit scale
    newScale = Math.max(0.1, Math.min(newScale, 5.0));
    this.transform.scale = newScale;
    this.updateTransform();
  }

  rotate(deg) {
    this.transform.rotate += deg;
    this.updateTransform();
  }

  resetView() {
    this.transform = { scale: 1, rotate: 0, x: 0, y: 0 };
    this.updateTransform();
  }

  updateTransform() {
    if (!this.video) return;
    const { x, y, rotate, scale } = this.transform;
    this.video.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
  }

  initDraggable(handle) {
    attachDragHelper(handle, this.container, {
      clampRect: () => ({
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight
      })
    });
  }

  /**
   * 显示展台
   */
  async show() {
    this.init();
    this.container.style.display = 'flex';
    this._isVisible = true;

    try {
      const devices = await this.core.getDevices();
      const select = this.container.querySelector('.device-select');
      select.innerHTML = devices.map(d => `<option value="${d.deviceId}">${d.label || 'Camera ' + d.deviceId.slice(0, 5)}</option>`).join('');

      const stream = await this.core.startStream(devices[0]?.deviceId);
      this.video.srcObject = stream;
      
      // 更新播放状态图标
      const playIcon = this.container.querySelector('.play-icon');
      const pauseIcon = this.container.querySelector('.pause-icon');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';

      // Restore transform state
      this.updateTransform();
    } catch (err) {
      console.error(err);
      alert('无法开启摄像头: ' + err.message);
    }
  }

  /**
   * 隐藏展台
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.core.stopStream();
      this._isVisible = false;
    }
  }

  /**
   * 切换最小化
   */
  toggleMinimize() {
    if (this.container) {
      this.container.classList.toggle('minimized');
    }
  }

  /**
   * 切换全屏
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen().catch(err => {
        alert(`无法进入全屏: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * 截屏并发送到白板 (此处需要与 renderer.js 协同)
   */
  takeScreenshot() {
    const canvas = document.createElement('canvas');
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/png');
    // 发送事件给白板，包含尺寸信息
    window.dispatchEvent(new CustomEvent('video-booth-screenshot', { 
      detail: { 
        dataUrl, 
        width: canvas.width, 
        height: canvas.height 
      } 
    }));
  }
}
