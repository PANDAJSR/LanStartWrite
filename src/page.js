// page.js — 分页管理与底部左侧翻页工具栏
import { getSnapshot, loadSnapshot, getCanvasImage } from './renderer.js';
import Message, { EVENTS } from './message.js';

function initPageToolbar(){
  let pages = [];
  let current = 0;
  let enabled = true;

  // 尝试恢复上一次 Session（用于重启等场景）
  try {
    const savedSession = localStorage.getItem('whiteboard_pages_session');
    if (savedSession) {
      const { pages: savedPages, current: savedCurrentIdx, timestamp } = JSON.parse(savedSession);
      // Session 有效期 10 分钟
      if (Date.now() - timestamp < 10 * 60 * 1000 && Array.isArray(savedPages) && savedPages.length > 0) {
        pages = savedPages;
        current = Math.min(savedCurrentIdx, pages.length - 1);
        loadSnapshot(pages[current].ops || []);
        localStorage.removeItem('whiteboard_pages_session');
      }
    }
  } catch (e) {
    console.warn('Failed to restore session:', e);
  }

  // 如果没有恢复成功，则初始化第一页
  if (pages.length === 0) {
    try { 
      pages.push({ 
        ops: getSnapshot(), 
        thumbnail: getCanvasImage(240) 
      }); 
    } catch (e) { 
      pages.push({ ops: [], thumbnail: '' }); 
    }
  }

  let toolbar = document.getElementById('pageToolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'pageToolbar';
    toolbar.setAttribute('role', 'toolbar');
    document.body.appendChild(toolbar);
  }

  let sidebar = document.getElementById('pagePreviewSidebar');
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.id = 'pagePreviewSidebar';
    sidebar.innerHTML = `
      <div class="page-preview-header">页面预览</div>
      <div class="page-preview-list"></div>
    `;
    document.body.appendChild(sidebar);
  }

  let previewList = sidebar.querySelector('.page-preview-list');
  if (!previewList) {
    previewList = document.createElement('div');
    previewList.className = 'page-preview-list';
    sidebar.appendChild(previewList);
  }

  function makeBtn(text, title, id){
    const b = document.createElement('button');
    b.className = 'page-btn';
    b.textContent = text;
    b.title = title || '';
    if (id) b.id = id;
    return b;
  }

  let prevBtn = document.getElementById('pagePrevBtn');
  if (!prevBtn) {
    prevBtn = makeBtn('‹', '上一页', 'pagePrevBtn');
    toolbar.appendChild(prevBtn);
  }

  let label = document.getElementById('pageLabel');
  if (!label) {
    label = document.createElement('div');
    label.id = 'pageLabel';
    label.className = 'page-label';
    label.title = '点击查看页面预览';
    toolbar.appendChild(label);
  }

  let nextBtn = document.getElementById('pageNextBtn');
  if (!nextBtn) {
    nextBtn = makeBtn('›', '下一页', 'pageNextBtn');
    toolbar.appendChild(nextBtn);
  }

  let newBtn = document.getElementById('pageNewBtn');
  if (!newBtn) {
    const newContainer = document.createElement('div');
    newContainer.className = 'page-new';
    newBtn = document.createElement('button');
    newBtn.id = 'pageNewBtn';
    newBtn.className = 'page-new-btn';
    newBtn.textContent = '+ 新建';
    newBtn.title = '新建页面';
    newContainer.appendChild(newBtn);
    toolbar.appendChild(newContainer);
  }

  function applyEnabled(nextEnabled){
    enabled = !!nextEnabled;
    try{ toolbar.style.display = enabled ? 'flex' : 'none'; }catch(e){}
    try{ toolbar.setAttribute('aria-hidden', enabled ? 'false' : 'true'); }catch(e){}
    if (!enabled) hideSidebar();
  }

  function updateUI(){
    label.textContent = `${current+1} / ${pages.length}`;
    prevBtn.disabled = current <= 0;
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    // 下一页始终可点击（若在末页则会创建新页面）
    nextBtn.style.opacity = '1';
  }

  function saveCurrent(){
    try { 
      pages[current] = { 
        ops: getSnapshot(), 
        thumbnail: getCanvasImage(240) 
      }; 
    } catch(e){ 
      pages[current] = { ops: [], thumbnail: '' }; 
    }
  }

  function renderThumbnails() {
    previewList.innerHTML = '';
    pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = `page-preview-item${index === current ? ' active' : ''}`;
      item.innerHTML = `
        <img src="${page.thumbnail || ''}" alt="Page ${index + 1}" loading="lazy">
        <div class="page-preview-num">${index + 1}</div>
      `;
      item.addEventListener('click', () => {
        if (index === current) return;
        saveCurrent();
        current = index;
        loadSnapshot(pages[current].ops || []);
        updateUI();
        renderThumbnails();
        // 如果是点击切换，可以考虑是否关闭侧边栏，根据需求通常保持开启以便连续操作
      });
      previewList.appendChild(item);
      
      // 确保当前激活项可见
      if (index === current) {
        setTimeout(() => {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    });
  }

  function toggleSidebar(e) {
    if (e) e.stopPropagation();
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      hideSidebar();
    } else {
      saveCurrent(); // 弹出前先保存当前页缩略图
      renderThumbnails();
      sidebar.classList.add('open');
    }
  }

  function hideSidebar() {
    sidebar.classList.remove('open');
  }

  // 同步缩略图机制
  let syncTimer = null;
  function scheduleSyncThumbnail() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (sidebar.classList.contains('open')) {
        saveCurrent();
        const activeItem = previewList.querySelector('.page-preview-item.active img');
        if (activeItem && pages[current].thumbnail) {
          activeItem.src = pages[current].thumbnail;
        }
      }
    }, 1000); // 1秒停顿后同步，避免性能抖动
  }

  Message.on(EVENTS.HISTORY_CHANGED, () => {
    if (sidebar.classList.contains('open')) {
      scheduleSyncThumbnail();
    }
  });

  label.addEventListener('click', toggleSidebar);

  // 点击外部关闭
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !label.contains(e.target)) {
      hideSidebar();
    }
  });

  prevBtn.addEventListener('click', ()=>{
    if (!enabled) return;
    if (current <= 0) return;
    saveCurrent();
    current -= 1;
    loadSnapshot(pages[current].ops || []);
    updateUI();
    if (sidebar.classList.contains('open')) renderThumbnails();
  });

  nextBtn.addEventListener('click', ()=>{
    if (!enabled) return;
    saveCurrent();
    if (current >= pages.length - 1) {
      // 在末页时，下一页操作等同于新建页面
      pages.push({ ops: [], thumbnail: '' });
      current = pages.length - 1;
      loadSnapshot([]);
    } else {
      current += 1;
      loadSnapshot(pages[current].ops || []);
    }
    updateUI();
    if (sidebar.classList.contains('open')) renderThumbnails();
  });

  newBtn.addEventListener('click', ()=>{
    if (!enabled) return;
    saveCurrent();
    pages.push({ ops: [], thumbnail: '' });
    current = pages.length - 1;
    loadSnapshot([]);
    updateUI();
    if (sidebar.classList.contains('open')) renderThumbnails();
  });

  updateUI();

  try{
    const bootMode = document && document.body && document.body.dataset ? document.body.dataset.appMode : '';
    applyEnabled(bootMode !== 'annotation');
  }catch(e){}

  try{
    Message.on(EVENTS.APP_MODE_CHANGED, (st)=>{
      const m = st && st.mode;
      applyEnabled(m !== 'annotation');
    });
  }catch(e){}

  // 监听应用准备退出信号，持久化当前 Session
  Message.on(EVENTS.APP_PREPARE_EXIT, () => {
    try {
      saveCurrent();
      localStorage.setItem('whiteboard_pages_session', JSON.stringify({
        pages,
        current,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Failed to save pages session on exit:', e);
    }
  });
}

// initialize immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initPageToolbar);
} else {
  initPageToolbar();
}

export { initPageToolbar };
