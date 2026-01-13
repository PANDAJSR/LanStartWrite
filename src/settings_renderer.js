import Settings, { loadSettings, saveSettings } from './setting.js';
import Message, { EVENTS } from './message.js';

// DOM Elements
const sidebar = document.getElementById('sidebar');
const settingsContainer = document.getElementById('settingsContainer');
const tabs = document.querySelectorAll('.settings-tab');
const pages = document.querySelectorAll('.settings-page');
const closeBtn = document.getElementById('closeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const closeWhiteboardBtn = document.getElementById('closeWhiteboardBtn');

// Range inputs and their display text
const rangeInputs = [
    { input: 'optPenTailIntensity', text: 'penTailIntensityText', unit: '%' }
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initWindowControls();
    initRangeInputs();
    initThemeLogic();
    initVstoLogic();
    initComLogic();
    loadCurrentSettings();
});

// VSTO Logic
function initVstoLogic() {
    Message.on(EVENTS.VSTO_STATUS_CHANGED, (data) => {
        updateVstoStatusDisplay(data.status, data.error);
    });

    // Initial status request
    if (window.electronAPI && window.electronAPI.invokeMain) {
        window.electronAPI.invokeMain('message', 'vsto:get-status').then(res => {
            if (res && res.success) {
                updateVstoStatusDisplay(res.status);
            }
        });
    }
}

function updateVstoStatusDisplay(status, error) {
    const dot = document.querySelector('#vstoStatusDisplay .status-dot');
    const text = document.querySelector('#vstoStatusDisplay .status-text');
    if (!dot || !text) return;

    switch (status) {
        case 'connected':
            dot.style.background = '#4caf50';
            text.textContent = '已连接';
            break;
        case 'connecting':
            dot.style.background = '#ff9800';
            text.textContent = '正在连接...';
            break;
        case 'error':
            dot.style.background = '#f44336';
            text.textContent = '连接失败' + (error ? `: ${error.message || error}` : '');
            break;
        case 'disconnected':
        default:
            dot.style.background = '#ccc';
            text.textContent = '未启动';
            break;
    }
}

// COM Logic
function initComLogic() {
    Message.on(EVENTS.COM_STATUS_CHANGED, (data) => {
        updateComStatusDisplay(data.status, data.error);
    });

    // Initial status request
    if (window.electronAPI && window.electronAPI.invokeMain) {
        window.electronAPI.invokeMain('message', 'com:get-status').then(res => {
            if (res && res.success) {
                updateComStatusDisplay(res.status);
            }
        });
    }
}

function updateComStatusDisplay(status, error) {
    const dot = document.querySelector('#comStatusDisplay .status-dot');
    const text = document.querySelector('#comStatusDisplay .status-text');
    if (!dot || !text) return;

    switch (status) {
        case 'connected':
            dot.style.background = '#4caf50';
            text.textContent = '已连接';
            break;
        case 'connecting':
            dot.style.background = '#ff9800';
            text.textContent = '正在连接...';
            break;
        case 'error':
            dot.style.background = '#f44336';
            text.textContent = '连接失败' + (error ? `: ${error.message || error}` : '');
            break;
        case 'disconnected':
        default:
            dot.style.background = '#ccc';
            text.textContent = '未启动';
            break;
    }
}

// Theme Logic
function initThemeLogic() {
    const themeSelect = document.getElementById('optTheme');
    if (!themeSelect) return;

    themeSelect.addEventListener('change', () => {
        applyTheme(themeSelect.value);
    });

    // Listen for system theme changes
    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    darkMedia.addEventListener('change', () => {
        if (themeSelect.value === 'system') {
            applyTheme('system');
        }
    });
}

function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
    } else if (theme === 'system') {
        html.removeAttribute('data-theme');
    } else {
        // Handle custom or high-contrast if needed
        html.removeAttribute('data-theme');
    }
}

// Tab switching logic
function initTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // Update active state of tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active state of pages
            pages.forEach(page => {
                if (page.id === `page-${targetTab}`) {
                    page.classList.add('active');
                } else {
                    page.classList.remove('active');
                }
            });

            // Scroll to top of content area
            settingsContainer.scrollTop = 0;
        });
    });
}

// Window control buttons
function initWindowControls() {
    closeBtn.addEventListener('click', () => {
        window.close();
    });

    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    saveBtn.addEventListener('click', () => {
        handleSave();
    });

    if (closeWhiteboardBtn) {
        closeWhiteboardBtn.addEventListener('click', () => {
            if (window.electronAPI && typeof window.electronAPI.invokeMain === 'function') {
                window.electronAPI.invokeMain('message', 'app:quit', {});
            }
        });
    }
}

// Range input label updates
function initRangeInputs() {
    rangeInputs.forEach(({ input, text, unit }) => {
        const inputEl = document.getElementById(input);
        const textEl = document.getElementById(text);
        if (inputEl && textEl) {
            inputEl.addEventListener('input', () => {
                textEl.textContent = `${inputEl.value}${unit}`;
            });
        }
    });
}

// Load settings into form
function loadCurrentSettings() {
    const s = loadSettings();
    
    // General
    setCheckbox('optAutoResize', s.enableAutoResize);
    setCheckbox('optCollapsed', s.toolbarCollapsed);
    setCheckbox('optTooltips', s.showTooltips);

    // Appearance
    setValue('optTheme', s.theme);
    applyTheme(s.theme);
    setValue('optDesignLanguage', s.designLanguage);
    setValue('optVisualStyle', s.visualStyle);
    setValue('optThemePrimary', s.themeCustom?.primary || '#2B7CFF');
    setValue('optThemeBackground', s.themeCustom?.background || '#FFFFFF');
    setValue('optCanvasColor', s.canvasColor);

    // Input
    setCheckbox('optMultiTouchPen', s.multiTouchPen);
    setValue('optAnnotationPenColor', s.annotationPenColor);
    setCheckbox('optPenTailEnabled', s.penTail?.enabled);
    setValue('optPenTailIntensity', s.penTail?.intensity);
    if (document.getElementById('penTailIntensityText')) {
        document.getElementById('penTailIntensityText').textContent = `${s.penTail?.intensity || 50}%`;
    }

    // Shortcuts
    setValue('keyUndo', s.shortcuts?.undo || 'Ctrl+Z');
    setValue('keyRedo', s.shortcuts?.redo || 'Ctrl+Y');

    // Toolbar
    setCheckbox('optVideoBoothEnabled', s.videoBoothEnabled);

    // Office
    setCheckbox('optVstoEnabled', s.vstoEnabled);
    setCheckbox('optVstoAutoConnect', s.vstoAutoConnect);
    setCheckbox('optComEnabled', s.comEnabled);
    setCheckbox('optComAutoConnect', s.comAutoConnect);
}

// Save settings from form
function handleSave() {
    const patch = {
        enableAutoResize: getCheckbox('optAutoResize'),
        toolbarCollapsed: getCheckbox('optCollapsed'),
        showTooltips: getCheckbox('optTooltips'),
        theme: getValue('optTheme'),
        designLanguage: getValue('optDesignLanguage'),
        visualStyle: getValue('optVisualStyle'),
        themeCustom: {
            primary: getValue('optThemePrimary'),
            background: getValue('optThemeBackground')
        },
        canvasColor: getValue('optCanvasColor'),
        multiTouchPen: getCheckbox('optMultiTouchPen'),
        annotationPenColor: getValue('optAnnotationPenColor'),
        penTail: {
            enabled: getCheckbox('optPenTailEnabled'),
            intensity: parseInt(getValue('optPenTailIntensity'))
        },
        shortcuts: {
            undo: getValue('keyUndo'),
            redo: getValue('keyRedo')
        },
        videoBoothEnabled: getCheckbox('optVideoBoothEnabled'),
        vstoEnabled: getCheckbox('optVstoEnabled'),
        vstoAutoConnect: getCheckbox('optVstoAutoConnect'),
        comEnabled: getCheckbox('optComEnabled'),
        comAutoConnect: getCheckbox('optComAutoConnect')
    };

    const currentSettings = loadSettings();
    saveSettings(patch);

    // Notify other windows/main process
    if (window.electronAPI && typeof window.electronAPI.sendToMain === 'function') {
        window.electronAPI.sendToMain('message', 'ui:settings-changed', patch);
        
        // Handle VSTO service toggle if changed
        if (patch.vstoEnabled !== currentSettings.vstoEnabled) {
             window.electronAPI.invokeMain('message', 'vsto:toggle-service', patch.vstoEnabled);
        }

        // Handle COM service toggle if changed
        if (patch.comEnabled !== currentSettings.comEnabled) {
             window.electronAPI.invokeMain('message', 'com:toggle-service', patch.comEnabled);
        }
    }

    // Close window after saving
    window.close();
}

// Helper functions
function setCheckbox(id, value) {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
}

function getCheckbox(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}
