'use strict';

// 简单测试：验证 TaskWatchOS 的基本行为（不依赖真实系统 API）

const assert = require('assert');
const { TaskWatchOS } = require('../src/monitor_core');

class FakeProbe {
  constructor() {
    this.processSamples = [];
    this.foregroundSamples = [];
  }

  async sampleProcesses(targets) {
    this.processSamples.push(targets);
    return targets.map(t => ({
      targetId: t.id,
      cpu: 0.1,
      memoryMb: 50,
      status: 'running'
    }));
  }

  async sampleForeground() {
    const sample = this.foregroundSamples.shift();
    return sample || null;
  }
}

class FakeIpc {
  constructor() {
    this.events = [];
    this.responses = [];
    this.errors = [];
    this.onCommandHandler = null;
  }

  onCommand(fn) {
    this.onCommandHandler = fn;
  }

  sendEvent(event, payload) {
    this.events.push({ event, payload });
  }

  sendResponse(id, payload) {
    this.responses.push({ id, payload });
  }

  sendError(id, code, message) {
    this.errors.push({ id, code, message });
  }
}

async function run() {
  const probe = new FakeProbe();
  const ipc = new FakeIpc();
  const monitor = new TaskWatchOS({
    probe,
    ipc,
    config: {
      samplingIntervalMs: 50,
      foregroundIntervalMs: 50,
      maxInMemorySnapshots: 10,
      maxMemoryMbSelf: 500
    }
  });

  monitor.addWatchTarget('pid', 1234);

  probe.foregroundSamples.push({
    pid: 1234,
    processName: 'TestApp',
    windowTitle: 'Test Window'
  });

  monitor.start();

  await new Promise(resolve => setTimeout(resolve, 220));
  monitor.stop();

  assert(monitor.getSnapshots().length > 0, 'snapshots should be collected');
  assert(ipc.events.some(e => e.event === 'monitor:started'), 'monitor:started event should exist');
  assert(ipc.events.some(e => e.event === 'monitor:stopped'), 'monitor:stopped event should exist');
  assert(
    ipc.events.some(e => e.event === 'foreground:changed'),
    'foreground:changed event should exist'
  );

  console.log('[PASS] monitor_core basic behavior');
}

run().catch(err => {
  console.error('[FAIL] monitor_core basic behavior', err);
  process.exitCode = 1;
});

