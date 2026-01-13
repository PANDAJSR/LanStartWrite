/**
 * pptlink_service_main.js
 * 
 * Unified background service for PPT linkage.
 * Handles PPT detection, COM/VSTO lifecycle, and state synchronization.
 */

const { exec } = require('child_process');
const path = require('path');
const pptComService = require('./ppt_com_service');
const pptVstoService = require('./ppt_vsto_service');

let _pptPollTimer = null;
let _pptInPresentation = false;
let _comEnabled = false;
let _vstoEnabled = false;

console.log('[PPTLinkService] Starting unified service...');

/**
 * PPT Detection Logic
 */
function startPptDetection() {
    if (_pptPollTimer) return;
    
    const DEFAULT_INTERVAL = 10000;
    const IDLE_INTERVAL = 20000;
    let currentInterval = DEFAULT_INTERVAL;

    const poll = () => {
        if (process.platform !== 'win32') return;

        const command = 'powershell "Get-Process powerpnt -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match \'PPT 放映\' -or $_.MainWindowTitle -match \'PowerPoint Slide Show\' } | Select-Object -ExpandProperty MainWindowTitle"';
        
        exec(command, (error, stdout) => {
            const hasPresentation = !!(stdout && stdout.trim());
            
            if (hasPresentation && !_pptInPresentation) {
                _pptInPresentation = true;
                process.send({ type: 'ppt_state_changed', payload: { state: 'opened' } });
                currentInterval = DEFAULT_INTERVAL;
            } else if (!hasPresentation && _pptInPresentation) {
                _pptInPresentation = false;
                process.send({ type: 'ppt_state_changed', payload: { state: 'closed' } });
                currentInterval = IDLE_INTERVAL;
            }
            
            _pptPollTimer = setTimeout(poll, currentInterval);
        });
    };

    poll();
}

function stopPptDetection() {
    if (_pptPollTimer) {
        clearTimeout(_pptPollTimer);
        _pptPollTimer = null;
    }
}

/**
 * Service Lifecycle Management
 */
function handleComToggle(enabled) {
    _comEnabled = enabled;
    if (enabled) {
        const success = pptComService.init();
        if (success) {
            pptComService.startPolling((event) => {
                if (event.type === 'sync') {
                    process.send({ type: 'com_sync_state', payload: event.data });
                } else if (event.type === 'status') {
                    process.send({ type: 'com_status_changed', payload: event });
                }
            });
        }
        process.send({ type: 'com_status_changed', payload: { status: success ? 'connected' : 'error' } });
    } else {
        pptComService.stopPolling();
        process.send({ type: 'com_status_changed', payload: { status: 'disconnected' } });
    }
}

function handleVstoToggle(enabled) {
    _vstoEnabled = enabled;
    if (enabled) {
        const success = pptVstoService.init();
        if (success) {
            pptVstoService.startPolling((event) => {
                if (event.type === 'status') {
                    process.send({ type: 'vsto_status_changed', payload: event });
                } else {
                    // It's a state update
                    process.send({ type: 'vsto_sync_state', payload: event });
                }
            });
        }
        process.send({ type: 'vsto_status_changed', payload: { status: success ? 'connected' : 'error' } });
    } else {
        pptVstoService.stopPolling();
        process.send({ type: 'vsto_status_changed', payload: { status: 'disconnected' } });
    }
}

/**
 * IPC Listener
 */
process.on('message', async (msg) => {
    const { type, payload, id } = msg;

    switch (type) {
        case 'init':
            startPptDetection();
            process.send({ type: 'init_result', payload: { success: true }, id });
            break;

        case 'com_toggle':
            handleComToggle(payload.enabled);
            break;

        case 'vsto_toggle':
            handleVstoToggle(payload.enabled);
            break;

        case 'goto_page':
            let result = { success: false, message: 'No active service' };
            if (_comEnabled) {
                result = await pptComService.gotoPage(payload.page);
            } else if (_vstoEnabled) {
                result = await pptVstoService.gotoPage(payload.page);
            }
            process.send({ type: 'goto_page_result', payload: result, id });
            break;

        case 'exit_slideshow':
            if (_comEnabled) {
                await pptComService.exitSlideshow();
            } else if (_vstoEnabled) {
                await pptVstoService.exitSlideshow();
            }
            break;

        case 'stop':
            stopPptDetection();
            pptComService.stopPolling();
            pptVstoService.stopPolling();
            process.exit(0);
            break;
    }
});

process.on('uncaughtException', (err) => {
    console.error('[PPTLinkService] Uncaught Exception:', err);
    process.send({ type: 'error', payload: { message: err.message } });
});

console.log('[PPTLinkService] Ready');
