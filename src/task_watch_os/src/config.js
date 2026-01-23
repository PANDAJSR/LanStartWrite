'use strict';

const fs = require('fs');
const path = require('path');

// 默认配置
const DEFAULT_CONFIG = {
  samplingIntervalMs: 500,
  foregroundIntervalMs: 500,
  maxInMemorySnapshots: 600,
  maxMemoryMbSelf: 100,
  dataDir: 'data',
  reportIntervalMs: 60000
};

function resolveBaseDir() {
  // 以当前文件所在目录为基准
  return path.resolve(__dirname, '..');
}

function loadConfig() {
  const baseDir = resolveBaseDir();
  const configPath = path.join(baseDir, 'config', 'default.json');
  let fileConfig = {};
  try {
    const txt = fs.readFileSync(configPath, 'utf8');
    fileConfig = JSON.parse(txt);
  } catch (e) {
    fileConfig = {};
  }
  const merged = Object.assign({}, DEFAULT_CONFIG, fileConfig);
  if (!merged.dataDir) merged.dataDir = DEFAULT_CONFIG.dataDir;
  merged.baseDir = baseDir;
  merged.dataPath = path.join(baseDir, merged.dataDir);
  return merged;
}

function ensureDataDir(config) {
  const dir = config && config.dataPath ? config.dataPath : path.join(resolveBaseDir(), 'data');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
  }
  return dir;
}

/**
 * 简单的 JSON 追加式持久化
 * 每个快照写为单独一行，便于后续离线分析
 * @param {Object} config
 */
function createSnapshotPersister(config) {
  const dir = ensureDataDir(config);
  const filePath = path.join(dir, 'snapshots.log');
  return function persistSnapshot(snapshot) {
    try {
      const line = JSON.stringify(snapshot) + '\n';
      fs.appendFile(filePath, line, () => {});
    } catch (e) {
    }
  };
}

module.exports = {
  loadConfig,
  createSnapshotPersister,
  DEFAULT_CONFIG
};

