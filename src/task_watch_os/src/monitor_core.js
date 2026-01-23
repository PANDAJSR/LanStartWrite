// 任务监视与进程管理核心逻辑
// 负责调度系统探针、采样定时器、前台任务跟踪与数据缓存

'use strict';

const { performance } = require('perf_hooks');

class TaskWatchOS {
  /**
   * @param {Object} options
   * @param {import('./system_probe').SystemProbe} options.probe 系统探针，用于实际采样
   * @param {Object} options.config 初始配置
   * @param {import('./ipc_channel').IpcChannel} options.ipc IPC 渠道，用于发送事件与响应
   * @param {function(Object):void} [options.persistSnapshot] 可选的持久化回调
   */
  constructor(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('TaskWatchOS requires options');
    }
    this.probe = options.probe;
    this.ipc = options.ipc;
    this.persistSnapshot = typeof options.persistSnapshot === 'function'
      ? options.persistSnapshot
      : null;

    this.config = Object.assign({
      samplingIntervalMs: 500,
      foregroundIntervalMs: 500,
      maxInMemorySnapshots: 600,
      maxCpuLoadSelf: 0.8,
      maxMemoryMbSelf: 100
    }, options.config || {});

    /** @type {Map<string, { id:string, kind:'pid'|'name', target:string|number }>} */
    this.watchTargets = new Map();
    /** @type {Array<Object>} */
    this.snapshots = [];

    this._processTimer = null;
    this._foregroundTimer = null;
    this._lastForeground = null;
    this._startedAt = Date.now();
    this._running = false;
  }

  /**
   * 启动监控主循环
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._scheduleProcessLoop();
    this._scheduleForegroundLoop();
    if (this.ipc) {
      this.ipc.sendEvent('monitor:started', {
        startedAt: this._startedAt,
        config: this.config
      });
    }
  }

  /**
   * 停止监控主循环
   */
  stop() {
    this._running = false;
    if (this._processTimer) {
      clearTimeout(this._processTimer);
      this._processTimer = null;
    }
    if (this._foregroundTimer) {
      clearTimeout(this._foregroundTimer);
      this._foregroundTimer = null;
    }
    if (this.ipc) {
      this.ipc.sendEvent('monitor:stopped', {
        stoppedAt: Date.now()
      });
    }
  }

  /**
   * 更新配置
   * @param {Object} patch
   */
  configure(patch) {
    if (!patch || typeof patch !== 'object') return;
    const before = Object.assign({}, this.config);
    Object.assign(this.config, patch);
    if (this.ipc) {
      this.ipc.sendEvent('monitor:config-updated', {
        before,
        after: this.config
      });
    }
  }

  /**
   * 添加监控目标
   * @param {'pid'|'name'} kind
   * @param {number|string} target
   * @returns {string} targetId
   */
  addWatchTarget(kind, target) {
    const id = `${kind}:${String(target)}`;
    if (!this.watchTargets.has(id)) {
      this.watchTargets.set(id, { id, kind, target });
      if (this.ipc) {
        this.ipc.sendEvent('process:watch-added', { id, kind, target });
      }
    }
    return id;
  }

  /**
   * 移除监控目标
   * @param {string} id
   */
  removeWatchTarget(id) {
    if (this.watchTargets.delete(id)) {
      if (this.ipc) {
        this.ipc.sendEvent('process:watch-removed', { id });
      }
    }
  }

  /**
   * 获取当前内存中的快照
   */
  getSnapshots() {
    return this.snapshots.slice();
  }

  /**
   * IPC 命令入口
   * @param {Object} msg
   * @param {string} msg.id
   * @param {string} msg.command
   * @param {Object} [msg.payload]
   */
  async handleCommand(msg) {
    const { id, command, payload } = msg;
    const fail = (code, message) => {
      if (this.ipc) this.ipc.sendError(id, code, message);
    };
    try {
      switch (command) {
        case 'ping':
          if (this.ipc) this.ipc.sendResponse(id, { ok: true, ts: Date.now() });
          break;
        case 'monitor.start':
          this.start();
          if (this.ipc) this.ipc.sendResponse(id, { ok: true });
          break;
        case 'monitor.stop':
          this.stop();
          if (this.ipc) this.ipc.sendResponse(id, { ok: true });
          break;
        case 'monitor.configure':
          this.configure(payload && payload.patch ? payload.patch : {});
          if (this.ipc) this.ipc.sendResponse(id, { ok: true, config: this.config });
          break;
        case 'process.watch':
          if (!payload || !payload.kind || payload.target == null) {
            fail('bad_request', 'kind and target required');
            break;
          }
          {
            const wid = this.addWatchTarget(payload.kind, payload.target);
            if (this.ipc) this.ipc.sendResponse(id, { ok: true, id: wid });
          }
          break;
        case 'process.unwatch':
          if (!payload || !payload.id) {
            fail('bad_request', 'id required');
            break;
          }
          this.removeWatchTarget(payload.id);
          if (this.ipc) this.ipc.sendResponse(id, { ok: true });
          break;
        case 'snapshot.get':
          if (this.ipc) {
            this.ipc.sendResponse(id, {
              ok: true,
              snapshots: this.getSnapshots()
            });
          }
          break;
        default:
          fail('unknown_command', `Unknown command: ${command}`);
          break;
      }
    } catch (e) {
      fail('internal_error', String(e && e.message ? e.message : e));
    }
  }

  _scheduleProcessLoop() {
    if (!this._running) return;
    const interval = Math.max(100, Number(this.config.samplingIntervalMs) || 500);
    this._processTimer = setTimeout(() => {
      this._runProcessLoop()
        .catch(() => {})
        .finally(() => this._scheduleProcessLoop());
    }, interval);
  }

  _scheduleForegroundLoop() {
    if (!this._running) return;
    const interval = Math.max(100, Number(this.config.foregroundIntervalMs) || 500);
    this._foregroundTimer = setTimeout(() => {
      this._runForegroundLoop()
        .catch(() => {})
        .finally(() => this._scheduleForegroundLoop());
    }, interval);
  }

  async _runProcessLoop() {
    if (!this._running) return;
    const targets = Array.from(this.watchTargets.values());
    const t0 = performance.now();
    let processMetrics = [];
    try {
      processMetrics = await this.probe.sampleProcesses(targets);
    } catch (e) {
      if (this.ipc) {
        this.ipc.sendEvent('monitor:error', {
          scope: 'processLoop',
          message: String(e && e.message ? e.message : e)
        });
      }
    }
    const t1 = performance.now();
    const selfUsage = this._getSelfUsage();
    const snapshot = {
      kind: 'process',
      ts: Date.now(),
      durationMs: t1 - t0,
      processes: processMetrics,
      self: selfUsage
    };
    this._pushSnapshot(snapshot);
    if (this.ipc) {
      this.ipc.sendEvent('metrics:update', snapshot);
    }
    if (this.persistSnapshot) {
      try{ this.persistSnapshot(snapshot); }catch(e){}
    }
    this._checkSelfLimits(selfUsage);
  }

  async _runForegroundLoop() {
    if (!this._running) return;
    let info = null;
    try {
      info = await this.probe.sampleForeground();
    } catch (e) {
      if (this.ipc) {
        this.ipc.sendEvent('monitor:error', {
          scope: 'foregroundLoop',
          message: String(e && e.message ? e.message : e)
        });
      }
    }
    if (!info) return;
    const same =
      this._lastForeground &&
      this._lastForeground.pid === info.pid &&
      this._lastForeground.processName === info.processName &&
      this._lastForeground.windowTitle === info.windowTitle;
    if (!same) {
      const now = Date.now();
      if (this._lastForeground) {
        const duration = now - this._lastForeground.enteredAt;
        if (this.ipc) {
          this.ipc.sendEvent('foreground:changed', {
            previous: this._lastForeground,
            next: Object.assign({ enteredAt: now }, info),
            durationMs: duration
          });
        }
      } else if (this.ipc) {
        this.ipc.sendEvent('foreground:changed', {
          previous: null,
          next: Object.assign({ enteredAt: Date.now() }, info),
          durationMs: 0
        });
      }
      this._lastForeground = Object.assign({ enteredAt: now }, info);
    }
  }

  _pushSnapshot(snapshot) {
    this.snapshots.push(snapshot);
    const limit = Math.max(10, Number(this.config.maxInMemorySnapshots) || 600);
    if (this.snapshots.length > limit) {
      this.snapshots.splice(0, this.snapshots.length - limit);
    }
  }

  _getSelfUsage() {
    try {
      const m = process.memoryUsage();
      return {
        rss: m.rss,
        heapTotal: m.heapTotal,
        heapUsed: m.heapUsed,
        external: m.external
      };
    } catch (e) {
      return {};
    }
  }

  _checkSelfLimits(selfUsage) {
    if (!selfUsage || typeof selfUsage.rss !== 'number') return;
    const rssMb = selfUsage.rss / (1024 * 1024);
    const maxMb = Number(this.config.maxMemoryMbSelf) || 100;
    if (rssMb > maxMb && this.ipc) {
      this.ipc.sendEvent('monitor:resource-warning', {
        type: 'memory',
        rssMb,
        limitMb: maxMb
      });
    }
  }
}

module.exports = {
  TaskWatchOS
};

