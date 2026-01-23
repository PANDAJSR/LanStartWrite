'use strict';

// 任务监视与进程管理模块入口
// 以独立进程形式运行，通过 stdin/stdout JSON 行实现 IPC

const { TaskWatchOS } = require('./monitor_core');
const { IpcChannel } = require('./ipc_channel');
const { createDefaultSystemProbe } = require('./system_probe');
const { loadConfig, createSnapshotPersister } = require('./config');

function main() {
  const config = loadConfig();
  const ipc = new IpcChannel(process.stdin, process.stdout);
  const probe = createDefaultSystemProbe();
  const persistSnapshot = createSnapshotPersister(config);

  const monitor = new TaskWatchOS({
    probe,
    config,
    ipc,
    persistSnapshot
  });

  ipc.onCommand(msg => {
    monitor.handleCommand(msg);
  });

  process.on('uncaughtException', err => {
    ipc.sendEvent('monitor:fatal-error', {
      type: 'uncaughtException',
      message: String(err && err.message ? err.message : err),
      stack: err && err.stack ? String(err.stack) : ''
    });
  });

  process.on('unhandledRejection', reason => {
    ipc.sendEvent('monitor:fatal-error', {
      type: 'unhandledRejection',
      message: String(reason && reason.message ? reason.message : reason),
      stack: reason && reason.stack ? String(reason.stack) : ''
    });
  });

  ipc.sendEvent('monitor:ready', {
    pid: process.pid,
    config
  });

  monitor.start();
}

main();

