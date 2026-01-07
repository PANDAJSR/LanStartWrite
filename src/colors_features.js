function _clamp01(n){
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function _clampInt(n, min, max){
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function _srgbToLinear(c){
  const v = c / 255;
  if (v <= 0.04045) return v / 12.92;
  return Math.pow((v + 0.055) / 1.055, 2.4);
}

function _relativeLuminance(rgb){
  const r = _srgbToLinear(rgb.r);
  const g = _srgbToLinear(rgb.g);
  const b = _srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function _parseHexColor(input){
  const s = String(input || '').trim();
  const hex = s.startsWith('#') ? s.slice(1) : s;
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

function _rgbToHex(rgb){
  const to2 = (n)=>String(_clampInt(n, 0, 255).toString(16)).padStart(2, '0').toUpperCase();
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

function _mix(a, b, t){
  const u = _clamp01(t);
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
    a: 255
  };
}

function _contrastRatio(fgRgb, bgRgb){
  const L1 = _relativeLuminance(fgRgb);
  const L2 = _relativeLuminance(bgRgb);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

export function contrastRatio(fgHex, bgHex){
  const fg = _parseHexColor(fgHex);
  const bg = _parseHexColor(bgHex);
  if (!fg || !bg) return NaN;
  return _contrastRatio(fg, bg);
}

function _pickOnColor(bgHex){
  const bg = _parseHexColor(bgHex);
  if (!bg) return '#000000';
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const rWhite = _contrastRatio(white, bg);
  const rBlack = _contrastRatio(black, bg);
  return rWhite >= rBlack ? '#FFFFFF' : '#000000';
}

function _hexToHsl(hex){
  const rgb = _parseHexColor(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function _hslToHex(hsl){
  const h = ((Number(hsl.h) % 360) + 360) % 360;
  const s = _clamp01(hsl.s);
  const l = _clamp01(hsl.l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const rgb = { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
  return _rgbToHex(rgb);
}

export function makeTonalScale(baseHex, opts){
  const o = (opts && typeof opts === 'object') ? opts : {};
  const steps = _clampInt(o.steps || 8, 2, 16);
  const bias = _clamp01(typeof o.bias === 'number' ? o.bias : 0.5);
  const hsl = _hexToHsl(baseHex);
  if (!hsl) return [];
  const out = [];
  for (let i = 0; i < steps; i++) {
    const u = steps === 1 ? 0 : i / (steps - 1);
    const curve = u < bias ? (u / Math.max(0.0001, bias)) : (1 + (u - bias) / Math.max(0.0001, (1 - bias)));
    const t = _clamp01(curve / 2);
    const l = 0.10 + t * 0.82;
    out.push(_hslToHex({ h: hsl.h, s: hsl.s, l }));
  }
  return out;
}

export function analyzeColorEmotion(hex){
  const hsl = _hexToHsl(hex);
  if (!hsl) return { mood: 'neutral', hue: 0, saturation: 0, lightness: 0 };
  const hue = ((hsl.h % 360) + 360) % 360;
  const sat = _clamp01(hsl.s);
  const lit = _clamp01(hsl.l);
  let mood = 'neutral';
  if (sat < 0.12) mood = 'neutral';
  else if (hue < 35 || hue >= 330) mood = 'energetic';
  else if (hue < 85) mood = 'optimistic';
  else if (hue < 160) mood = 'fresh';
  else if (hue < 220) mood = 'calm';
  else if (hue < 300) mood = 'mystic';
  else mood = 'creative';
  return { mood, hue, saturation: sat, lightness: lit };
}

export function reportColorTemperature(hex){
  const hsl = _hexToHsl(hex);
  if (!hsl) return { temperature: 'unknown', kelvinHint: null };
  const hue = ((hsl.h % 360) + 360) % 360;
  const warm = (hue <= 90 || hue >= 330);
  const cool = (hue >= 150 && hue <= 270);
  if (warm) return { temperature: 'warm', kelvinHint: 3500 };
  if (cool) return { temperature: 'cool', kelvinHint: 6500 };
  return { temperature: 'neutral', kelvinHint: 5000 };
}

export function sampleGridColors(imageData, opts){
  const o = (opts && typeof opts === 'object') ? opts : {};
  const grid = _clampInt(o.grid || 4, 2, 12);
  const w = imageData && imageData.width ? imageData.width : 0;
  const h = imageData && imageData.height ? imageData.height : 0;
  const data = imageData && imageData.data ? imageData.data : null;
  if (!w || !h || !data) return [];
  const out = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.floor((gx + 0.5) * (w / grid));
      const y = Math.floor((gy + 0.5) * (h / grid));
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 8) continue;
      out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  return out;
}

function _dist2(a, b){
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export function kMeans(colors, k, opts){
  const pts = Array.isArray(colors) ? colors.filter(Boolean) : [];
  const kk = _clampInt(k || 3, 1, 8);
  if (!pts.length) return { centroids: [], clusters: [] };
  const o = (opts && typeof opts === 'object') ? opts : {};
  const iters = _clampInt(o.iters || 12, 1, 50);
  const centroids = [];
  for (let i = 0; i < kk; i++) {
    const p = pts[Math.floor((i / kk) * (pts.length - 1))];
    centroids.push({ r: p.r, g: p.g, b: p.b });
  }
  const clusters = new Array(pts.length).fill(0);
  for (let t = 0; t < iters; t++) {
    let changed = false;
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = _dist2(pts[i], centroids[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (clusters[i] !== best) { clusters[i] = best; changed = true; }
    }
    const sums = centroids.map(()=>({ r: 0, g: 0, b: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) {
      const ci = clusters[i];
      const s = sums[ci];
      s.r += pts[i].r; s.g += pts[i].g; s.b += pts[i].b; s.n += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      const s = sums[c];
      if (s.n > 0) {
        centroids[c] = { r: Math.round(s.r / s.n), g: Math.round(s.g / s.n), b: Math.round(s.b / s.n) };
      }
    }
    if (!changed) break;
  }
  return { centroids, clusters };
}

export function extractPaletteFromImageData(imageData, opts){
  const o = (opts && typeof opts === 'object') ? opts : {};
  const samples = sampleGridColors(imageData, { grid: 4 });
  const km = kMeans(samples, 3, { iters: 14 });
  const cents = Array.isArray(km.centroids) ? km.centroids : [];
  const asHex = cents.map(_rgbToHex);
  const primary = asHex[0] || '#2B7CFF';
  const secondary = asHex[1] || primary;
  const accent = asHex[2] || secondary;
  const temp = reportColorTemperature(primary);
  return { primary, secondary, accent, samples: samples.length, temperature: temp, mood: analyzeColorEmotion(primary), raw: asHex, opts: o };
}

function _ensureRoot(root){
  return (root && root.style) ? root : document.documentElement;
}

export function applyMicaVariables(mica, root){
  const r = _ensureRoot(root);
  const m = mica && typeof mica === 'object' ? mica : {};
  const intensity = _clampInt(m.intensity ?? 60, 0, 100);
  const radius = Number(m.radius ?? 24);
  const feather = Number(m.feather ?? 8);
  const overlayOpacity = _clamp01(Number(m.overlayOpacity ?? 0.30));
  const saturation = Number(m.saturation ?? 1.2);
  const strength = intensity / 100;
  const blurPx = Math.max(0, radius * strength);
  r.style.setProperty('--ls-mica-strength', String(strength));
  r.style.setProperty('--ls-mica-blur', `${blurPx.toFixed(2)}px`);
  r.style.setProperty('--ls-mica-feather', `${Math.max(0, feather).toFixed(2)}px`);
  r.style.setProperty('--ls-mica-overlay', String(overlayOpacity));
  r.style.setProperty('--ls-mica-saturation', String(Math.max(0.5, Math.min(2.0, saturation))));
  return { intensity, blurPx, overlayOpacity, saturation, feather };
}

export function measureApplyCost(fn){
  const t0 = performance.now();
  try{ fn(); }catch(e){}
  const t1 = performance.now();
  return t1 - t0;
}

function _makeSemanticSeeds(mode, custom){
  const c = (custom && typeof custom === 'object') ? custom : {};
  if (mode === 'high-contrast') {
    return {
      primary: '#00A3FF',
      secondary: '#FFD400',
      tertiary: '#B8FF00',
      error: '#FF3B30',
      warning: '#FFB020',
      success: '#00E676',
      info: '#00D1FF',
      surface: '#FFFFFF',
      background: '#FFFFFF',
      outline: '#000000'
    };
  }
  if (mode === 'dark') {
    return {
      primary: '#ADC6FF',
      secondary: '#BBC7DB',
      tertiary: '#E7B7FF',
      error: '#FFB4AB',
      warning: '#FFD8A8',
      success: '#6EE7B7',
      info: '#7DD3FC',
      surface: '#1A1C1E',
      background: '#0B0B0C',
      outline: '#8D9199'
    };
  }
  if (mode === 'custom') {
    const primary = _parseHexColor(c.primary) ? String(c.primary).toUpperCase() : '#2B7CFF';
    const secondary = _parseHexColor(c.secondary) ? String(c.secondary).toUpperCase() : '#535F70';
    const error = _parseHexColor(c.error) ? String(c.error).toUpperCase() : '#E5484D';
    const warning = _parseHexColor(c.warning) ? String(c.warning).toUpperCase() : '#F59E0B';
    const success = _parseHexColor(c.success) ? String(c.success).toUpperCase() : '#22C55E';
    const info = _parseHexColor(c.info) ? String(c.info).toUpperCase() : '#38BDF8';
    const bg = _parseHexColor(c.background) ? String(c.background).toUpperCase() : '#FFFFFF';
    const surface = _parseHexColor(c.surface) ? String(c.surface).toUpperCase() : '#FDFBFF';
    const outline = _parseHexColor(c.outline) ? String(c.outline).toUpperCase() : '#73777F';
    const hsl = _hexToHsl(primary);
    const tertiary = hsl ? _hslToHex({ h: (hsl.h + 60) % 360, s: hsl.s, l: Math.min(0.75, Math.max(0.35, hsl.l)) }) : '#5856D6';
    return { primary, secondary, tertiary, error, warning, success, info, surface, background: bg, outline };
  }
  return {
    primary: '#005AC1',
    secondary: '#535F70',
    tertiary: '#6C5DD3',
    error: '#B3261E',
    warning: '#B45309',
    success: '#166534',
    info: '#0369A1',
    surface: '#FDFBFF',
    background: '#FFFFFF',
    outline: '#73777F'
  };
}

export function buildThemeTokens(mode, custom){
  const seeds = _makeSemanticSeeds(mode, custom);
  const tonal = {};
  for (const k of Object.keys(seeds)) tonal[k] = makeTonalScale(seeds[k], { steps: 8, bias: mode === 'dark' ? 0.65 : 0.45 });

  const sys = {
    primary: mode === 'dark' ? tonal.primary[5] : tonal.primary[2],
    onPrimary: _pickOnColor(mode === 'dark' ? tonal.primary[5] : tonal.primary[2]),
    secondary: mode === 'dark' ? tonal.secondary[5] : tonal.secondary[2],
    onSecondary: _pickOnColor(mode === 'dark' ? tonal.secondary[5] : tonal.secondary[2]),
    tertiary: mode === 'dark' ? tonal.tertiary[5] : tonal.tertiary[2],
    onTertiary: _pickOnColor(mode === 'dark' ? tonal.tertiary[5] : tonal.tertiary[2]),
    error: mode === 'dark' ? tonal.error[5] : tonal.error[2],
    onError: _pickOnColor(mode === 'dark' ? tonal.error[5] : tonal.error[2]),
    surface: mode === 'dark' ? seeds.surface : seeds.surface,
    onSurface: mode === 'dark' ? '#E2E2E6' : '#1A1C1E',
    background: mode === 'dark' ? seeds.background : seeds.background,
    outline: seeds.outline
  };

  const textHigh = mode === 'dark' ? 'rgba(255,255,255,0.87)' : 'rgba(0,0,0,0.87)';
  const textMedium = mode === 'dark' ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.60)';
  const textDisabled = mode === 'dark' ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';

  return { mode, seeds, tonal, sys, text: { high: textHigh, medium: textMedium, disabled: textDisabled } };
}

export function applyThemeTokens(tokens, root){
  const t = tokens && typeof tokens === 'object' ? tokens : null;
  if (!t) return;
  const r = _ensureRoot(root);
  const set = (k, v)=>{ try{ r.style.setProperty(k, String(v)); }catch(e){} };

  const mode = String(t.mode || 'light');
  set('--ls-theme-mode', mode);

  const sys = t.sys || {};
  set('--ls-sys-color-primary', sys.primary);
  set('--ls-sys-color-on-primary', sys.onPrimary);
  set('--ls-sys-color-secondary', sys.secondary);
  set('--ls-sys-color-on-secondary', sys.onSecondary);
  set('--ls-sys-color-tertiary', sys.tertiary);
  set('--ls-sys-color-on-tertiary', sys.onTertiary);
  set('--ls-sys-color-error', sys.error);
  set('--ls-sys-color-on-error', sys.onError);
  set('--ls-sys-color-surface', sys.surface);
  set('--ls-sys-color-on-surface', sys.onSurface);
  set('--ls-sys-color-background', sys.background);
  set('--ls-sys-color-outline', sys.outline);

  set('--md-sys-color-primary', sys.primary);
  set('--md-sys-color-on-primary', sys.onPrimary);
  set('--md-sys-color-secondary', sys.secondary);
  set('--md-sys-color-on-secondary', sys.onSecondary);
  set('--md-sys-color-surface', sys.surface);
  set('--md-sys-color-on-surface', sys.onSurface);
  set('--md-sys-color-outline', sys.outline);

  const text = t.text || {};
  set('--text-high', text.high);
  set('--text-medium', text.medium);
  set('--text-disabled', text.disabled);

  const tonal = t.tonal || {};
  for (const key of Object.keys(tonal)) {
    const arr = tonal[key];
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) set(`--ls-${key}-${i}`, arr[i]);
  }
}

export function resolveThemeMode(requested){
  const req = String(requested || '');
  if (req && req !== 'system') return req;
  let forced = false;
  try{ forced = !!(window.matchMedia && window.matchMedia('(forced-colors: active)').matches); }catch(e){}
  if (forced) return 'high-contrast';
  let prefersContrast = false;
  try{ prefersContrast = !!(window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches); }catch(e){}
  if (prefersContrast) return 'high-contrast';
  let dark = false;
  try{ dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }catch(e){}
  return dark ? 'dark' : 'light';
}

export function applyThemeMode(requested, settings, root){
  const resolved = resolveThemeMode(requested);
  const r = _ensureRoot(root);
  try{ document.body.dataset.theme = String(requested || 'system'); }catch(e){}

  try{
    r.classList.remove('theme-dark', 'theme-high-contrast');
    if (resolved === 'dark') r.classList.add('theme-dark');
    if (resolved === 'high-contrast') r.classList.add('theme-high-contrast');
  }catch(e){}

  let modeForTokens = resolved;
  const s = settings && typeof settings === 'object' ? settings : {};
  if (String(requested || '') === 'custom') modeForTokens = 'custom';
  applyThemeTokens(buildThemeTokens(modeForTokens, s.themeCustom || {}), r);

  try{
    if (s && s.mica) applyMicaVariables(s.mica, r);
  }catch(e){}

  return { requested: String(requested || 'system'), resolved };
}

export function initThemeAutoSync(getSettings){
  const mm = [];
  const attach = (q)=>{
    try{
      if (!window.matchMedia) return;
      const m = window.matchMedia(q);
      const on = ()=>{
        const s = typeof getSettings === 'function' ? getSettings() : {};
        const req = s && s.theme ? String(s.theme) : 'system';
        if (req !== 'system') return;
        applyThemeMode(req, s, document.documentElement);
      };
      if (typeof m.addEventListener === 'function') m.addEventListener('change', on);
      else if (typeof m.addListener === 'function') m.addListener(on);
      mm.push({ m, on });
    }catch(e){}
  };
  attach('(prefers-color-scheme: dark)');
  attach('(prefers-contrast: more)');
  attach('(forced-colors: active)');
  return ()=>{
    for (const it of mm) {
      try{
        if (typeof it.m.removeEventListener === 'function') it.m.removeEventListener('change', it.on);
        else if (typeof it.m.removeListener === 'function') it.m.removeListener(it.on);
      }catch(e){}
    }
  };
}

export function buildContrastReport(){
  const root = document.documentElement;
  const out = [];
  const push = (name, fg, bg, isLarge)=>{
    const r = contrastRatio(fg, bg);
    const okAA = Number.isFinite(r) ? (r >= (isLarge ? 3.0 : 4.5)) : false;
    out.push({ name, fg, bg, ratio: Number.isFinite(r) ? Number(r.toFixed(2)) : null, okAA });
  };

  const css = getComputedStyle(document.body);
  const bodyColor = css.color;
  const bodyBg = css.backgroundColor;
  const parseCssColorToHex = (c)=>{
    const s = String(c || '').trim();
    const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (!m) return null;
    const r = Math.round(Number(m[1]));
    const g = Math.round(Number(m[2]));
    const b = Math.round(Number(m[3]));
    return _rgbToHex({ r, g, b });
  };
  const bodyColorHex = parseCssColorToHex(bodyColor) || '#000000';
  const bodyBgHex = parseCssColorToHex(bodyBg) || (root.classList.contains('theme-dark') ? '#0B0B0C' : '#FFFFFF');
  push('正文文本/背景', bodyColorHex, bodyBgHex, false);

  const getVar = (k)=>String(getComputedStyle(root).getPropertyValue(k) || '').trim();
  const pri = getVar('--ls-sys-color-primary') || getVar('--md-sys-color-primary') || '#2B7CFF';
  const onPri = getVar('--ls-sys-color-on-primary') || getVar('--md-sys-color-on-primary') || _pickOnColor(pri);
  push('primary/onPrimary', onPri, pri, false);
  const sec = getVar('--ls-sys-color-secondary') || getVar('--md-sys-color-secondary') || '#535F70';
  const onSec = getVar('--ls-sys-color-on-secondary') || getVar('--md-sys-color-on-secondary') || _pickOnColor(sec);
  push('secondary/onSecondary', onSec, sec, false);
  const surf = getVar('--ls-sys-color-surface') || getVar('--md-sys-color-surface') || '#FFFFFF';
  const onSurf = getVar('--ls-sys-color-on-surface') || getVar('--md-sys-color-on-surface') || '#111111';
  push('surface/onSurface', onSurf, surf, false);

  return out;
}

export function serializeLanTheme(settings){
  const s = settings && typeof settings === 'object' ? settings : {};
  const payload = {
    format: 'lantheme',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    theme: s.theme || 'system',
    themeCustom: s.themeCustom || {},
    visualStyle: s.visualStyle || 'blur',
    mica: s.mica || {}
  };
  return JSON.stringify(payload, null, 2);
}

export function parseLanTheme(text){
  const raw = String(text || '');
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'invalid' };
  if (String(obj.format || '') !== 'lantheme') return { ok: false, error: 'format' };
  const theme = String(obj.theme || 'system');
  const visualStyle = String(obj.visualStyle || 'blur');
  const themeCustom = obj.themeCustom && typeof obj.themeCustom === 'object' ? obj.themeCustom : {};
  const mica = obj.mica && typeof obj.mica === 'object' ? obj.mica : {};
  return { ok: true, theme, visualStyle, themeCustom, mica, meta: { version: String(obj.version || ''), exportedAt: String(obj.exportedAt || '') } };
}

