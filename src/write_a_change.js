/**
 * write_a_change.js
 *
 * 跨模块的“副作用入口”封装：
 * - updateAppSettings：写入设置并广播 SETTINGS_CHANGED
 * - requestFileWrite：通过消息总线向主进程请求文件写入（渲染进程不直接进行磁盘 I/O）
 */
import Message, { EVENTS } from './message.js';
import Settings, { buildSettingsHistoryRecord } from './setting.js';

export function installHyperOs3Controls(root){
  const doc = (root && root.nodeType === 9) ? root : document;
  const key = '__lsHyperOs3ControlsInstalled';
  try{ if (doc && doc[key]) return; }catch(e){}
  try{ if (doc) doc[key] = true; }catch(e){}

  try{
    const styleId = 'ls-hyperos3-controls';
    const existing = doc.getElementById(styleId);
    if (!existing) {
      const st = doc.createElement('style');
      st.id = styleId;
      st.textContent = `
.settings-control{
  width:100%;
  justify-content:space-between;
  gap:14px;
}
.settings-control>span{
  order:1;
  flex:1 1 auto;
}
.settings-control input[type="checkbox"]{
  order:2;
  flex:0 0 auto;
  width:46px;
  height:28px;
  border-radius:999px;
  -webkit-appearance:none;
  appearance:none;
  border:1px solid rgba(0,0,0,0.10);
  background:rgba(0,0,0,0.10);
  position:relative;
  outline:none;
  cursor:pointer;
  transition:background-color 220ms var(--ls-ease),border-color 220ms var(--ls-ease),transform 180ms var(--ls-ease);
}
[data-theme="dark"] .settings-control input[type="checkbox"],
.theme-dark .settings-control input[type="checkbox"]{
  border-color:rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.14);
}
.settings-control input[type="checkbox"]::before{
  content:"";
  position:absolute;
  top:3px;
  left:3px;
  width:22px;
  height:22px;
  border-radius:999px;
  background:rgba(255,255,255,0.98);
  box-shadow:0 2px 8px rgba(0,0,0,0.16);
  transform:translateX(0);
  transition:transform 220ms var(--ls-ease),box-shadow 220ms var(--ls-ease);
}
.settings-control input[type="checkbox"]:checked{
  background:var(--ls-sys-color-primary);
  border-color:rgba(0,0,0,0.00);
}
.settings-control input[type="checkbox"]:checked::before{
  transform:translateX(18px);
  box-shadow:0 6px 14px rgba(0,0,0,0.18);
}
.settings-control input[type="checkbox"]:active{
  transform:scale(0.98);
}
.settings-control input[type="checkbox"]:focus-visible{
  box-shadow:0 0 0 3px rgba(52,120,246,0.20);
}

.settings-field-label .ls-range-value{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:2px 8px;
  border-radius:999px;
  margin-left:8px;
  font-size:12px;
  font-weight:700;
  letter-spacing:0.2px;
  color:var(--ls-sys-color-primary);
  background:rgba(52,120,246,0.10);
}

.settings-field input[type="range"]{
  -webkit-appearance:none;
  appearance:none;
  width:100%;
  height:28px;
  padding:0;
  background:transparent;
  outline:none;
}
.settings-field input[type="range"]::-webkit-slider-runnable-track{
  height:6px;
  border-radius:999px;
  background:linear-gradient(to right, var(--ls-sys-color-primary) 0%, var(--ls-sys-color-primary) var(--ls-range-pct, 50%), rgba(0,0,0,0.12) var(--ls-range-pct, 50%), rgba(0,0,0,0.12) 100%);
}
[data-theme="dark"] .settings-field input[type="range"]::-webkit-slider-runnable-track,
.theme-dark .settings-field input[type="range"]::-webkit-slider-runnable-track{
  background:linear-gradient(to right, var(--ls-sys-color-primary) 0%, var(--ls-sys-color-primary) var(--ls-range-pct, 50%), rgba(255,255,255,0.14) var(--ls-range-pct, 50%), rgba(255,255,255,0.14) 100%);
}
.settings-field input[type="range"]::-webkit-slider-thumb{
  -webkit-appearance:none;
  appearance:none;
  width:20px;
  height:20px;
  border-radius:999px;
  margin-top:-7px;
  background:var(--ls-sys-color-surface-variant);
  border:1px solid rgba(0,0,0,0.10);
  box-shadow:0 6px 16px rgba(0,0,0,0.12);
  transition:transform 180ms var(--ls-ease),box-shadow 180ms var(--ls-ease);
}
[data-theme="dark"] .settings-field input[type="range"]::-webkit-slider-thumb,
.theme-dark .settings-field input[type="range"]::-webkit-slider-thumb{
  border-color:rgba(255,255,255,0.14);
  box-shadow:0 10px 20px rgba(0,0,0,0.42);
}
.settings-field input[type="range"]:active::-webkit-slider-thumb{
  transform:scale(1.06);
}
.settings-field input[type="range"]:focus-visible::-webkit-slider-thumb{
  box-shadow:0 0 0 3px rgba(52,120,246,0.22), 0 6px 16px rgba(0,0,0,0.12);
}

.ls-color-field{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  flex-wrap:wrap;
}
.ls-color-swatch{
  width:34px;
  height:34px;
  border-radius:12px;
  border:1px solid rgba(0,0,0,0.10);
  box-shadow:0 8px 18px rgba(0,0,0,0.10);
  cursor:pointer;
  padding:0;
  background:var(--ls-sys-color-surface-variant);
}
[data-theme="dark"] .ls-color-swatch,
.theme-dark .ls-color-swatch{
  border-color:rgba(255,255,255,0.12);
  box-shadow:0 12px 22px rgba(0,0,0,0.46);
}
.ls-color-hex{
  width:110px;
  text-transform:uppercase;
  letter-spacing:0.4px;
}
.ls-color-triplet{
  display:flex;
  align-items:center;
  gap:6px;
}
.ls-color-triplet input{
  width:64px;
  padding:10px 10px;
  text-align:center;
}
.ls-recent-colors{
  width:100%;
  display:flex;
  align-items:center;
  gap:8px;
  padding-top:8px;
  flex-wrap:wrap;
}
.ls-recent-chip{
  width:26px;
  height:26px;
  border-radius:10px;
  border:1px solid rgba(0,0,0,0.10);
  cursor:pointer;
  box-shadow:0 6px 14px rgba(0,0,0,0.10);
}
[data-theme="dark"] .ls-recent-chip,
.theme-dark .ls-recent-chip{
  border-color:rgba(255,255,255,0.12);
  box-shadow:0 10px 18px rgba(0,0,0,0.40);
}

.ls-history-toolbar{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}
.ls-history-meta{
  padding-top:10px;
  color:var(--text-medium);
  font-size:12px;
}
.ls-history-timeline{
  position:relative;
  padding:14px 0 8px 18px;
}
.ls-history-timeline::before{
  content:"";
  position:absolute;
  left:8px;
  top:8px;
  bottom:8px;
  width:2px;
  border-radius:999px;
  background:rgba(0,0,0,0.10);
}
[data-theme="dark"] .ls-history-timeline::before,
.theme-dark .ls-history-timeline::before{
  background:rgba(255,255,255,0.14);
}
.ls-history-item{
  position:relative;
  padding:0 0 14px 0;
}
.ls-history-item::before{
  content:"";
  position:absolute;
  left:-14px;
  top:16px;
  width:10px;
  height:10px;
  border-radius:999px;
  background:var(--ls-sys-color-primary);
  box-shadow:0 6px 16px rgba(0,0,0,0.14);
}
.ls-history-card{
  border:1px solid rgba(0,0,0,0.08);
  border-radius:16px;
  background:rgba(255,255,255,0.55);
  backdrop-filter: blur(16px) saturate(1.2);
  overflow:hidden;
  transition:transform 180ms var(--ls-ease), box-shadow 180ms var(--ls-ease), opacity 180ms var(--ls-ease);
  box-shadow:0 10px 20px rgba(0,0,0,0.08);
}
[data-theme="dark"] .ls-history-card,
.theme-dark .ls-history-card{
  border-color:rgba(255,255,255,0.10);
  background:rgba(255,255,255,0.06);
  box-shadow:0 14px 26px rgba(0,0,0,0.42);
}
.ls-history-card.is-undone{
  opacity:0.65;
}
.ls-history-card-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  padding:12px 12px 10px;
  cursor:pointer;
}
.ls-history-card-title{
  display:flex;
  flex-direction:column;
  gap:2px;
}
.ls-history-time{
  color:var(--text-medium);
  font-size:12px;
}
.ls-history-main{
  color:var(--text-high);
  font-size:14px;
  font-weight:700;
  letter-spacing:0.2px;
}
.ls-history-badges{
  display:flex;
  align-items:center;
  gap:8px;
}
.ls-history-badge{
  font-size:11px;
  padding:2px 8px;
  border-radius:999px;
  background:rgba(52,120,246,0.10);
  color:var(--ls-sys-color-primary);
  border:1px solid rgba(52,120,246,0.18);
}
.ls-history-badge-undone{
  background:rgba(0,0,0,0.06);
  color:var(--text-medium);
  border-color:rgba(0,0,0,0.08);
}
[data-theme="dark"] .ls-history-badge-undone,
.theme-dark .ls-history-badge-undone{
  background:rgba(255,255,255,0.06);
  border-color:rgba(255,255,255,0.10);
}
.ls-history-card-body{
  padding:0 12px 12px;
  display:none;
}
.ls-history-card.expanded .ls-history-card-body{
  display:block;
}
.ls-history-diff{
  display:flex;
  flex-direction:column;
  gap:8px;
  padding-top:6px;
}
.ls-history-diff-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 10px;
  border-radius:12px;
  background:rgba(0,0,0,0.03);
  border:1px solid rgba(0,0,0,0.06);
}
[data-theme="dark"] .ls-history-diff-row,
.theme-dark .ls-history-diff-row{
  background:rgba(255,255,255,0.05);
  border-color:rgba(255,255,255,0.08);
}
.ls-history-diff-row button{
  border:0;
  background:transparent;
  color:inherit;
  padding:0;
  cursor:pointer;
  text-align:left;
  flex:1 1 auto;
}
.ls-history-diff-path{
  font-weight:700;
  color:var(--text-high);
  font-size:13px;
}
.ls-history-diff-values{
  color:var(--text-medium);
  font-size:12px;
  flex:0 0 auto;
}
.ls-history-actions{
  display:flex;
  align-items:center;
  gap:8px;
  padding-top:10px;
}
.ls-history-footer{
  padding-top:12px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.ls-history-select{
  width:16px;
  height:16px;
  accent-color: var(--ls-sys-color-primary);
  margin-right:8px;
}
.ls-jump-highlight{
  outline:2px solid rgba(52,120,246,0.45);
  outline-offset:4px;
  border-radius:12px;
  box-shadow:0 0 0 6px rgba(52,120,246,0.16);
}
`;
      (doc.head || doc.documentElement).appendChild(st);
    }
  }catch(e){}

  const decorateRangeValueSpans = ()=>{
    try{
      const spans = doc.querySelectorAll('#micaIntensityText,#penTailIntensityText,#penTailSamplePointsText,#penTailSpeedText,#penTailPressureText');
      spans.forEach(s=>{ try{ s.classList.add('ls-range-value'); }catch(e){} });
    }catch(e){}
  };

  const setRangePct = (input)=>{
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const v = Number(input.value);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(v) || max === min) return;
    const pct = Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
    try{ input.style.setProperty('--ls-range-pct', `${pct}%`); }catch(e){}
  };

  const syncAllRanges = ()=>{
    try{ doc.querySelectorAll('input[type="range"]').forEach(setRangePct); }catch(e){}
  };

  const maybeVibrate = (ms)=>{
    try{
      const nav = doc.defaultView && doc.defaultView.navigator ? doc.defaultView.navigator : navigator;
      if (nav && typeof nav.vibrate === 'function') nav.vibrate(ms);
    }catch(e){}
  };

  doc.addEventListener('change', (e)=>{
    const t = e && e.target;
    if (!t || t.nodeType !== 1) return;
    if (t.matches && t.matches('input[type="checkbox"]')) {
      maybeVibrate(8);
    }
  }, true);

  doc.addEventListener('input', (e)=>{
    const t = e && e.target;
    if (!t || t.nodeType !== 1) return;
    if (t.matches && t.matches('input[type="range"]')) setRangePct(t);
  }, true);

  decorateRangeValueSpans();
  syncAllRanges();
}

const _SETTINGS_HISTORY_KEY = 'ls_settings_history_v1';
const _SETTINGS_HISTORY_LIMIT = 2000;

let _historyCache = null;

// Invalidate cache on external storage changes
try {
  window.addEventListener('storage', (e) => {
    if (e.key === _SETTINGS_HISTORY_KEY) {
      _historyCache = null;
    }
  });
} catch (e) {}

function _readSettingsHistoryRaw(){
  if (_historyCache) return _historyCache;
  try{
    const raw = localStorage.getItem(_SETTINGS_HISTORY_KEY);
    if (!raw) {
      _historyCache = [];
      return _historyCache;
    }
    const arr = JSON.parse(raw);
    _historyCache = Array.isArray(arr) ? arr : [];
    return _historyCache;
  }catch(e){
    _historyCache = [];
    return _historyCache;
  }
}

function _writeSettingsHistoryRaw(list){
  _historyCache = Array.isArray(list) ? list : [];
  try{ localStorage.setItem(_SETTINGS_HISTORY_KEY, JSON.stringify(_historyCache)); }catch(e){}
}

function _emitHistoryChanged(payload){
  try{ Message.emit(EVENTS.SETTINGS_HISTORY_CHANGED, payload); }catch(e){}
}

export function loadSettingsHistory(limit){
  const lim = Math.max(1, Math.min(5000, Math.round(Number(limit || 1000) || 1000)));
  const list = _readSettingsHistoryRaw();
  return list.slice(0, lim);
}

export function clearSettingsHistory(){
  _writeSettingsHistoryRaw([]);
  _emitHistoryChanged({ action: 'clear' });
  return true;
}

function _appendSettingsHistoryRecord(record){
  if (!record || typeof record !== 'object') return false;
  const list = _readSettingsHistoryRaw();
  list.unshift(record);
  if (list.length > _SETTINGS_HISTORY_LIMIT) list.length = _SETTINGS_HISTORY_LIMIT;
  _writeSettingsHistoryRaw(list);
  _emitHistoryChanged({ action: 'append', record });
  return true;
}

function _markHistoryUndone(ids){
  const set = new Set((Array.isArray(ids) ? ids : []).map(v => String(v || '')).filter(Boolean));
  if (!set.size) return 0;
  const list = _readSettingsHistoryRaw();
  let changed = 0;
  const now = Date.now();
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const id = String(r.id || '');
    if (!id || !set.has(id)) continue;
    if (r.undone) continue;
    r.undone = true;
    r.undoneAt = now;
    changed += 1;
  }
  if (changed) {
    _writeSettingsHistoryRaw(list);
    _emitHistoryChanged({ action: 'undone', ids: Array.from(set) });
  }
  return changed;
}

export function undoSettingsHistoryEntry(id, opts){
  const targetId = String(id || '');
  if (!targetId) return null;
  const o = (opts && typeof opts === 'object') ? opts : {};
  const list = _readSettingsHistoryRaw();
  const rec = list.find(r => r && typeof r === 'object' && String(r.id || '') === targetId);
  if (!rec || rec.undone) return null;
  const patch = (rec.undoPatch && typeof rec.undoPatch === 'object') ? rec.undoPatch : null;
  if (!patch) return null;
  const merged = updateAppSettings(patch, { history: { skipRecord: true, source: String(o.source || 'history_undo') } });
  _markHistoryUndone([targetId]);
  return merged;
}

export function undoSettingsHistoryBatch(ids, opts){
  const arr = Array.isArray(ids) ? ids.map(v => String(v || '')).filter(Boolean) : [];
  if (!arr.length) return null;
  const o = (opts && typeof opts === 'object') ? opts : {};
  const set = new Set(arr);
  const list = _readSettingsHistoryRaw().filter(r => r && typeof r === 'object' && set.has(String(r.id || '')) && !r.undone);
  if (!list.length) return null;
  list.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  let merged = null;
  for (const rec of list) {
    const patch = (rec.undoPatch && typeof rec.undoPatch === 'object') ? rec.undoPatch : null;
    if (!patch) continue;
    merged = updateAppSettings(patch, { history: { skipRecord: true, source: String(o.source || 'history_batch_undo') } });
  }
  _markHistoryUndone(list.map(r => String(r.id || '')).filter(Boolean));
  return merged;
}

/**
 * 合并并持久化设置，然后广播 SETTINGS_CHANGED。
 * @param {Object} partial - 需要更新的设置字段（会与当前设置合并）
 * @returns {Object} 合并后的完整设置对象
 */
export function updateAppSettings(partial, opts){
  const before = (Settings && typeof Settings.loadSettings === 'function') ? Settings.loadSettings() : {};
  const merged = Settings.saveSettings(partial);
  try{
    if (merged && merged.__lsPersistOk === false) console.warn('[updateAppSettings] persist failed', merged.__lsPersistError || '');
  }catch(e){}
  try{ Message.emit(EVENTS.SETTINGS_CHANGED, merged); }catch(e){}
  try{
    const p = partial && typeof partial === 'object' ? partial : {};
    const hasToolbarOrder = Object.prototype.hasOwnProperty.call(p, 'toolbarButtonOrder');
    const hasToolbarHidden = Object.prototype.hasOwnProperty.call(p, 'toolbarButtonHidden');
    const hasPluginDisplay = Object.prototype.hasOwnProperty.call(p, 'pluginButtonDisplay');
    if (hasToolbarOrder || hasToolbarHidden || hasPluginDisplay) {
      const entry = {
        ts: Date.now(),
        kind: 'toolbar_config_change',
        patch: {
          toolbarButtonOrder: hasToolbarOrder ? p.toolbarButtonOrder : undefined,
          toolbarButtonHidden: hasToolbarHidden ? p.toolbarButtonHidden : undefined,
          pluginButtonDisplay: hasPluginDisplay ? p.pluginButtonDisplay : undefined
        }
      };
      try{ localStorage.setItem('toolbar_config_change_last', JSON.stringify(entry)); }catch(e){}
    }
  }catch(e){}
  try{
    const o = (opts && typeof opts === 'object') ? opts : {};
    const hist = (o.history && typeof o.history === 'object') ? o.history : {};
    if (!hist.skipRecord) {
      const rec = buildSettingsHistoryRecord(before, merged, partial, { source: String(hist.source || 'settings') });
      if (rec) _appendSettingsHistoryRecord(rec);
    }
  }catch(e){}
  return merged;
}

/**
 * 请求主进程写入文件。
 * @param {string} path - 目标路径（相对路径会在主进程内解析到 userData 下；绝对路径会直接写入）
 * @param {string} content - 写入内容（utf8）
 * @returns {void}
 */
export function requestFileWrite(path, content){
  try{ Message.emit(EVENTS.REQUEST_FILE_WRITE, { path, content }); }catch(e){ console.warn('requestFileWrite emit failed', e); }
}

export default { updateAppSettings, requestFileWrite, installHyperOs3Controls, loadSettingsHistory, clearSettingsHistory, undoSettingsHistoryEntry, undoSettingsHistoryBatch };
