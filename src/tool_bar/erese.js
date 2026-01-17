/**
 * erese.js
 *
 * 橡皮 UI 模块：
 * - 负责橡皮大小、橡皮模式（像素/矩形/整笔）等 UI 交互
 * - 将选择同步到绘图引擎（renderer.js）
 *
 * 注意：
 * - 橡皮模式的具体擦除算法在 renderer.js 内实现
 * - 本模块仅负责 UI 状态与引擎参数的同步
 */
import { setEraserSize, setEraserMode, setErasing, getToolState } from '../renderer.js';
import { cleanupMenuStyles } from './more_decide_windows.js';

const eraserSizeInput = document.getElementById('eraserSize');
const erasePixelBtn = document.getElementById('erasePixel');
const eraseRectBtn = document.getElementById('eraseRect');
const eraseStrokeBtn = document.getElementById('eraseStroke');
const eraserMenu = document.getElementById('eraserMenu');
const eraserTool = document.getElementById('eraserTool');
const eraserModeLabel = document.getElementById('eraserModeLabel');

export function updateEraserModeLabel(){
  const s = getToolState();
  if (eraserModeLabel) eraserModeLabel.textContent = `橡皮模式: ${s.eraserMode} / ${s.eraserSize}`;
}

/**
 * 初始化橡皮 UI 事件。
 * @returns {void}
 */
export function initEraserUI(){
  if (eraserSizeInput) eraserSizeInput.addEventListener('input', (e)=>{ setEraserSize(Number(e.target.value)); updateEraserModeLabel(); try{ window.dispatchEvent(new Event('toolbar:sync')); }catch(err){} });

  /**
   * 同步橡皮模式按钮的选中态与标签显示。
   * @param {'pixel'|'rect'|'stroke'} mode - 橡皮模式
   * @returns {void}
   */
  function updateEraserModeUI(mode){
    if (erasePixelBtn) erasePixelBtn.classList.toggle('active', mode==='pixel');
    if (eraseRectBtn) eraseRectBtn.classList.toggle('active', mode==='rect');
    if (eraseStrokeBtn) eraseStrokeBtn.classList.toggle('active', mode==='stroke');
    updateEraserModeLabel();
    try{ window.dispatchEvent(new Event('toolbar:sync')); }catch(err){}
  }

  if (erasePixelBtn) erasePixelBtn.addEventListener('click', ()=>{ setEraserMode('pixel'); updateEraserModeUI('pixel'); });
  if (eraseRectBtn) eraseRectBtn.addEventListener('click', ()=>{ setEraserMode('rect'); updateEraserModeUI('rect'); });
  if (eraseStrokeBtn) eraseStrokeBtn.addEventListener('click', ()=>{ setEraserMode('stroke'); updateEraserModeUI('stroke'); });

  // clicking a mode should close menu and remove active state if needed
  // ensure eraser UI initialized
  updateEraserModeUI(getToolState().eraserMode || 'pixel');
}

export default {
  initEraserUI,
  updateEraserModeLabel
};
