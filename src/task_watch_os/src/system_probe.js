'use strict';

const { execFile } = require('child_process');

/**
 * 系统探针接口定义
 * 不直接依赖具体平台，便于在测试中用假实现替换
 */
class SystemProbe {
  /**
   * 采样指定进程的 CPU / 内存等指标
   * @param {Array<{id:string, kind:'pid'|'name', target:number|string}>} targets
   * @returns {Promise<Array<Object>>}
   */
  /* eslint-disable no-unused-vars */
  async sampleProcesses(targets) {
    throw new Error('not implemented');
  }

  /**
   * 采样当前前台任务 / 窗口信息
   * @returns {Promise<{ pid:number, processName:string, windowTitle:string }|null>}
   */
  async sampleForeground() {
    throw new Error('not implemented');
  }
  /* eslint-enable no-unused-vars */
}

/**
 * Windows 上的简单实现，基于 PowerShell / Get-Process
 * 为避免开销，每次调用仅拉取必要字段
 */
class WindowsSystemProbe extends SystemProbe {
  constructor() {
    super();
  }

  async sampleProcesses(targets) {
    if (!targets || !targets.length) return [];
    const byPid = targets.filter(t => t.kind === 'pid');
    const byName = targets.filter(t => t.kind === 'name');

    const results = [];

    if (byPid.length) {
      const pids = Array.from(new Set(byPid.map(t => Number(t.target)))).filter(n => Number.isFinite(n));
      if (pids.length) {
        const rows = await psGetProcessesByPid(pids);
        for (const row of rows) {
          results.push({
            pid: row.Id,
            processName: row.ProcessName,
            cpu: row.CPU || 0,
            memoryMb: row.WorkingSet / (1024 * 1024),
            status: row.Responding ? 'running' : 'not-responding'
          });
        }
      }
    }

    if (byName.length) {
      const names = Array.from(new Set(byName.map(t => String(t.target))));
      if (names.length) {
        const rows = await psGetProcessesByName(names);
        for (const row of rows) {
          results.push({
            pid: row.Id,
            processName: row.ProcessName,
            cpu: row.CPU || 0,
            memoryMb: row.WorkingSet / (1024 * 1024),
            status: row.Responding ? 'running' : 'not-responding'
          });
        }
      }
    }

    return results;
  }

  async sampleForeground() {
    try {
      const row = await psGetForegroundWindow();
      if (!row) return null;
      return {
        pid: row.Id,
        processName: row.ProcessName,
        windowTitle: row.MainWindowTitle || ''
      };
    } catch (e) {
      return null;
    }
  }
}

function execPowershell(args) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', ...args], { windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || ''));
    });
  });
}

async function psGetProcessesByPid(pids) {
  const script = `
    $ids = @(${pids.join(',')});
    $procs = Get-Process | Where-Object { $ids -contains $_.Id };
    $procs | Select-Object Id,ProcessName,CPU,WorkingSet,Responding | ConvertTo-Json -Compress
  `;
  const raw = await execPowershell([script]);
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch (e) {
    return [];
  }
}

async function psGetProcessesByName(names) {
  const nameList = names.map(n => `'${String(n).replace(/'/g, "''")}'`).join(',');
  const script = `
    $names = @(${nameList});
    $procs = Get-Process | Where-Object { $names -contains $_.ProcessName };
    $procs | Select-Object Id,ProcessName,CPU,WorkingSet,Responding | ConvertTo-Json -Compress
  `;
  const raw = await execPowershell([script]);
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch (e) {
    return [];
  }
}

async function psGetForegroundWindow() {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
"@;
$h = [WinApi]::GetForegroundWindow();
if ($h -eq [IntPtr]::Zero) {
  $null | ConvertTo-Json -Compress
} else {
  $p = Get-Process | Where-Object { $_.MainWindowHandle -eq $h } | Select-Object -First 1;
  if ($p -eq $null) {
    $null | ConvertTo-Json -Compress
  } else {
    $p | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress
  }
}
`;
  const raw = await execPowershell([script]);
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === 'null') return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return null;
  }
}

function createDefaultSystemProbe() {
  if (process.platform === 'win32') {
    return new WindowsSystemProbe();
  }
  // 其它平台暂时提供一个空实现，避免崩溃
  return new (class extends SystemProbe {
    async sampleProcesses() { return []; }
    async sampleForeground() { return null; }
  })();
}

module.exports = {
  SystemProbe,
  WindowsSystemProbe,
  createDefaultSystemProbe
};

