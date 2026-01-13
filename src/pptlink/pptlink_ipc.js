/**
 * pptlink_ipc.js
 * 
 * Main-process side IPC handler for PPTLinkService.
 */

const { fork } = require('child_process');
const path = require('path');
const { BrowserWindow } = require('electron');

class PPTLinkIPC {
    constructor(mainProcess) {
        this.mainProcess = mainProcess;
        this.serviceProcess = null;
        this._pptWindow = null;
        this.comStatus = 'disconnected';
        this.vstoStatus = 'disconnected';
    }

    init() {
        this._startService();
    }

    _startService() {
        if (this.serviceProcess) return;

        const servicePath = path.join(__dirname, 'pptlink_service_main.js');
        this.serviceProcess = fork(servicePath, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });

        this.serviceProcess.on('message', (msg) => {
            this._handleServiceMessage(msg);
        });

        this.serviceProcess.on('exit', (code) => {
            console.log(`[PPTLinkIPC] Service process exited with code ${code}`);
            this.serviceProcess = null;
            // Auto-restart if needed
            setTimeout(() => this._startService(), 3000);
        });

        this.serviceProcess.send({ type: 'init' });
    }

    _handleServiceMessage(msg) {
        const { type, payload } = msg;

        switch (type) {
            case 'ppt_state_changed':
                if (payload.state === 'opened') {
                    this.openPPTWindow();
                } else if (payload.state === 'closed') {
                    this.closePPTWindow();
                }
                break;

            case 'com_sync_state':
                this._syncToUI('com:sync-state', payload);
                break;

            case 'com_status_changed':
                this.comStatus = payload.status;
                this.mainProcess.broadcastMessage('com:status-changed', payload);
                break;

            case 'vsto_sync_state':
                this._syncToUI('vsto:sync-state', payload);
                break;

            case 'vsto_status_changed':
                this.vstoStatus = payload.status;
                this.mainProcess.broadcastMessage('vsto:status-changed', payload);
                break;

            case 'error':
                console.error('[PPTLinkIPC] Service Error:', payload.message);
                break;
        }
    }

    _syncToUI(channel, data) {
        if (this._pptWindow && !this._pptWindow.isDestroyed()) {
            this._pptWindow.webContents.send('ppt:sync-state', {
                current: data.currentSlide,
                total: data.totalSlides,
                success: true
            });
        }
        this.mainProcess.broadcastMessage(channel, data);
    }

    openPPTWindow() {
        if (this._pptWindow && !this._pptWindow.isDestroyed()) {
            this._pptWindow.show();
            return;
        }

        const uiPath = path.join(__dirname, 'PPTLinkUI_page.html');
        const { pathToFileURL } = require('url');
        const fileUrl = pathToFileURL(uiPath).toString();

        this._pptWindow = new BrowserWindow({
            width: 800,
            height: 180,
            resizable: true,
            alwaysOnTop: true,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            show: false,
            title: 'PPT 联动控制',
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: path.join(__dirname, '..', 'preload.js'),
                webSecurity: false
            }
        });

        this._pptWindow.once('ready-to-show', () => {
            this._pptWindow.show();
            this._pptWindow.setAlwaysOnTop(true, 'screen-saver');
        });

        this._pptWindow.loadURL(fileUrl);
        this._pptWindow.on('closed', () => {
            this._pptWindow = null;
        });
    }

    closePPTWindow() {
        if (this._pptWindow && !this._pptWindow.isDestroyed()) {
            this._pptWindow.close();
        }
    }

    sendToService(type, payload) {
        if (this.serviceProcess) {
            this.serviceProcess.send({ type, payload });
        }
    }
}

module.exports = PPTLinkIPC;
