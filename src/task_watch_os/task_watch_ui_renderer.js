'use strict';

const statusText = document.getElementById('statusText');
const sampleTimeEl = document.getElementById('sampleTime');
const foregroundTextEl = document.getElementById('foregroundText');
const processTableBody = document.getElementById('processTableBody');
const resourceWarningTextEl = document.getElementById('resourceWarningText');
const errorTextEl = document.getElementById('errorText');
const btnRefresh = document.getElementById('btnRefresh');
const btnClose = document.getElementById('btnClose');
const btnTop = document.getElementById('btnTop');
const btnToggleMonitor = document.getElementById('btnToggleMonitor');
const intervalSelect = document.getElementById('intervalSelect');
const metricsChart = document.getElementById('metricsChart');

let lastState = null;
let chartInited = false;
const cpuHistory = [];
const memHistory = [];
const tsHistory = [];
const MAX_POINTS = 60;
let isTop = false;
let appliedInterval = 0;

function formatTime(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return '--';
  try {
    const d = new Date(n);
    return d.toLocaleTimeString();
  } catch (e) {
    return '--';
  }
}

function formatNumber(v, digits) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  const d = typeof digits === 'number' && digits >= 0 ? digits : 1;
  return n.toFixed(d);
}

function buildProcessRows(state) {
  const s = state && typeof state === 'object' ? state : {};
  const snapshot = s.lastMetrics && typeof s.lastMetrics === 'object' ? s.lastMetrics : null;
  const processes = Array.isArray(snapshot && snapshot.processes) ? snapshot.processes.slice(0) : [];
  if (!processes.length) {
    return '<tr class="placeholder-row"><td colspan="5">暂无数据</td></tr>';
  }
  processes.sort((a, b) => {
    const ac = Number(a && a.cpu != null ? a.cpu : 0);
    const bc = Number(b && b.cpu != null ? b.cpu : 0);
    return bc - ac;
  });
  const rows = [];
  for (const p of processes) {
    const pid = p && p.pid != null ? String(p.pid) : '';
    const name = p && p.processName ? String(p.processName) : '';
    const cpu = p && p.cpu != null ? formatNumber(p.cpu * 100, 1) : '--';
    const mem = p && p.memoryMb != null ? formatNumber(p.memoryMb, 1) : '--';
    const status = p && p.status ? String(p.status) : '';
    const safePid = pid || '--';
    const safeName = name || '(未知)';
    const safeStatus = status || '--';
    rows.push(
      '<tr>' +
        '<td>' + safePid + '</td>' +
        '<td>' + safeName + '</td>' +
        '<td class="cell-number">' + cpu + '</td>' +
        '<td class="cell-number">' + mem + '</td>' +
        '<td class="cell-status">' + safeStatus + '</td>' +
      '</tr>'
    );
  }
  return rows.join('');
}

function renderState(state) {
  const s = state && typeof state === 'object' ? state : {};
  lastState = s;
  const ready = !!s.ready;
  const running = !!s.running;
  if (statusText) {
    if (!ready) {
      statusText.textContent = '未启动';
      statusText.classList.remove('ok');
    } else if (running) {
      statusText.textContent = '运行中';
      statusText.classList.add('summary-value', 'ok');
    } else {
      statusText.textContent = '已停止';
      statusText.classList.remove('ok');
    }
  }

  const snapshot = s.lastMetrics && typeof s.lastMetrics === 'object' ? s.lastMetrics : null;
  const ts = snapshot && snapshot.ts != null ? snapshot.ts : null;
  if (sampleTimeEl) {
    sampleTimeEl.textContent = ts ? formatTime(ts) : '--';
  }

  if (snapshot && typeof snapshot === 'object') {
    const list = Array.isArray(snapshot.processes) ? snapshot.processes : [];
    let totalCpu = 0;
    let totalMem = 0;
    for (const p of list) {
      const c = Number(p && p.cpu != null ? p.cpu : 0);
      const m = Number(p && p.memoryMb != null ? p.memoryMb : 0);
      if (Number.isFinite(c)) totalCpu += c;
      if (Number.isFinite(m)) totalMem += m;
    }
    cpuHistory.push(totalCpu * 100);
    memHistory.push(totalMem);
    tsHistory.push(typeof ts === 'number' ? ts : Date.now());
    if (cpuHistory.length > MAX_POINTS) cpuHistory.shift();
    if (memHistory.length > MAX_POINTS) memHistory.shift();
    if (tsHistory.length > MAX_POINTS) tsHistory.shift();
    drawChart();
  }

  const fg = s.lastForegroundChange && typeof s.lastForegroundChange === 'object' ? s.lastForegroundChange : null;
  const fgNext = fg && fg.next && typeof fg.next === 'object' ? fg.next : null;
  if (foregroundTextEl) {
    if (fgNext) {
      const name = fgNext.processName ? String(fgNext.processName) : '';
      const title = fgNext.windowTitle ? String(fgNext.windowTitle) : '';
      const pid = fgNext.pid != null ? String(fgNext.pid) : '';
      const parts = [];
      if (title) parts.push(title);
      if (name) parts.push(name);
      if (pid) parts.push('PID ' + pid);
      foregroundTextEl.textContent = parts.length ? parts.join(' · ') : '未获取到前台窗口';
      foregroundTextEl.classList.remove('muted');
    } else {
      foregroundTextEl.textContent = '--';
      foregroundTextEl.classList.add('muted');
    }
  }

  if (processTableBody) {
    processTableBody.innerHTML = buildProcessRows(s);
  }

  const warn = s.lastResourceWarning && typeof s.lastResourceWarning === 'object' ? s.lastResourceWarning : null;
  if (resourceWarningTextEl) {
    if (warn && warn.type === 'memory') {
      const rss = warn.rssMb != null ? formatNumber(warn.rssMb, 1) : '--';
      const limit = warn.limitMb != null ? formatNumber(warn.limitMb, 0) : '--';
      resourceWarningTextEl.textContent = '内存 ' + rss + ' / ' + limit + ' MB';
      resourceWarningTextEl.classList.remove('muted');
      resourceWarningTextEl.classList.add('warn');
    } else {
      resourceWarningTextEl.textContent = '无';
      resourceWarningTextEl.classList.remove('warn');
      resourceWarningTextEl.classList.add('muted');
    }
  }

  const err = s.lastError && typeof s.lastError === 'object' ? s.lastError : null;
  if (errorTextEl) {
    if (err && (err.message || err.scope)) {
      const scope = err.scope ? String(err.scope) : '';
      const msg = err.message ? String(err.message) : '';
      const parts = [];
      if (scope) parts.push(scope);
      if (msg) parts.push(msg);
      errorTextEl.textContent = parts.join(' · ');
      errorTextEl.classList.remove('muted');
      errorTextEl.classList.add('error');
    } else {
      errorTextEl.textContent = '无';
      errorTextEl.classList.remove('error');
      errorTextEl.classList.add('muted');
    }
  }

  if (btnToggleMonitor) {
    if (!ready) {
      btnToggleMonitor.textContent = '暂停监控';
      btnToggleMonitor.disabled = true;
    } else {
      btnToggleMonitor.disabled = false;
      btnToggleMonitor.textContent = running ? '暂停监控' : '恢复监控';
    }
  }

  if (intervalSelect && s.config && typeof s.config === 'object') {
    const iv = Number(s.config.samplingIntervalMs);
    if (Number.isFinite(iv) && iv > 0 && appliedInterval !== iv) {
      appliedInterval = iv;
      const options = Array.from(intervalSelect.options || []);
      let matched = false;
      for (const opt of options) {
        if (Number(opt.value) === iv) {
          opt.selected = true;
          matched = true;
        } else {
          opt.selected = false;
        }
      }
      if (!matched) {
        intervalSelect.value = String(iv);
      }
    }
  }
}

function drawChart() {
  if (!metricsChart) return;
  const ctx = metricsChart.getContext('2d');
  if (!ctx) return;
  const w = metricsChart.clientWidth || metricsChart.width || 0;
  const h = metricsChart.clientHeight || metricsChart.height || 0;
  if (!chartInited) {
    if (w > 0) metricsChart.width = w;
    if (h > 0) metricsChart.height = h;
    chartInited = true;
  }
  const cw = metricsChart.width;
  const ch = metricsChart.height;
  ctx.clearRect(0, 0, cw, ch);
  if (!cpuHistory.length || cpuHistory.length !== memHistory.length) {
    ctx.fillStyle = '#999999';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无趋势数据', cw / 2, ch / 2);
    return;
  }
  const n = cpuHistory.length;
  let maxCpu = 0;
  let maxMem = 0;
  for (let i = 0; i < n; i++) {
    if (cpuHistory[i] > maxCpu) maxCpu = cpuHistory[i];
    if (memHistory[i] > maxMem) maxMem = memHistory[i];
  }
  if (maxCpu <= 0) maxCpu = 1;
  if (maxMem <= 0) maxMem = 1;
  const leftPad = 4;
  const rightPad = 4;
  const topPad = 4;
  const bottomPad = 4;
  const plotW = cw - leftPad - rightPad;
  const plotH = ch - topPad - bottomPad;
  const step = n > 1 ? plotW / (n - 1) : 0;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = leftPad + step * i;
    const v = cpuHistory[i];
    const y = topPad + (1 - v / maxCpu) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#3478F6';
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = leftPad + step * i;
    const v = memHistory[i];
    const y = topPad + (1 - v / maxMem) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#E89A11';
  ctx.stroke();
}

function requestState() {
  try {
    if (window && window.electronAPI && typeof window.electronAPI.invokeMain === 'function') {
      window.electronAPI.invokeMain('message', 'taskwatch:get-state', {}).then((res) => {
        const payload = res && typeof res === 'object' ? res : null;
        if (!payload || payload.success === false) return;
        renderState(payload.state || null);
      }).catch(() => {});
    }
  } catch (e) {}
}

if (btnRefresh) {
  btnRefresh.addEventListener('click', () => {
    requestState();
  });
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    try {
      window.close();
    } catch (e) {}
  });
}

if (btnTop) {
  btnTop.addEventListener('click', () => {
    const target = !isTop;
    try {
      if (window && window.electronAPI && typeof window.electronAPI.invokeMain === 'function') {
        window.electronAPI.invokeMain('message', 'taskwatch:set-always-on-top', { enabled: target }).then((res) => {
          const r = res && typeof res === 'object' ? res : null;
          if (!r || r.success === false) return;
          isTop = !!r.enabled;
          btnTop.textContent = isTop ? '取消置顶' : '置顶';
        }).catch(() => {});
      }
    } catch (e) {}
  });
}

if (btnToggleMonitor) {
  btnToggleMonitor.addEventListener('click', () => {
    const running = !!(lastState && lastState.running);
    const channel = running ? 'taskwatch:stop' : 'taskwatch:start';
    try {
      if (window && window.electronAPI && typeof window.electronAPI.invokeMain === 'function') {
        window.electronAPI.invokeMain('message', channel, {}).then(() => {
        }).catch(() => {});
      }
    } catch (e) {}
  });
}

if (intervalSelect) {
  intervalSelect.addEventListener('change', () => {
    const v = Number(intervalSelect.value);
    if (!Number.isFinite(v) || v <= 0) return;
    try {
      if (window && window.electronAPI && typeof window.electronAPI.invokeMain === 'function') {
        window.electronAPI.invokeMain('message', 'taskwatch:configure', {
          patch: {
            samplingIntervalMs: v,
            foregroundIntervalMs: v
          }
        }).then(() => {
        }).catch(() => {});
      }
    } catch (e) {}
  });
}

try {
  if (window && window.electronAPI && typeof window.electronAPI.onReplyFromMain === 'function') {
    window.electronAPI.onReplyFromMain('taskwatch:update', (state) => {
      renderState(state);
    });
  }
} catch (e) {}

requestState();
