/**
 * ppt_vsto_service.js
 * 
 * 使用 edge-js 调用 C# VSTO/COM 接口，实现与 PowerPoint 的深度联动。
 * 支持 PPT 状态监听、页面切换、总页数获取等。
 */

const path = require('path');

// 注意：实际运行时需要确保安装了 edge-js
let edge;
try {
    edge = require('edge-js');
} catch (e) {
    console.error('VSTO Service: edge-js is not installed. Please run "npm install edge-js".');
}

/**
 * C# 源代码：使用 Microsoft.Office.Interop.PowerPoint 进行 COM 操作
 */
const pptSource = `
    using System;
    using System.Threading.Tasks;
    using System.Runtime.InteropServices;
    using Microsoft.Office.Interop.PowerPoint;
    using Microsoft.Office.Core;

    public class Startup
    {
        private static Application _pptApp;

        private static bool EnsurePptApp()
        {
            try
            {
                if (_pptApp == null)
                {
                    _pptApp = (Application)Marshal.GetActiveObject("PowerPoint.Application");
                }
                return _pptApp != null;
            }
            catch
            {
                _pptApp = null;
                return false;
            }
        }

        public async Task<object> GetStatus(object input)
        {
            if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
            try
            {
                var presentation = _pptApp.ActivePresentation;
                var view = _pptApp.SlideShowWindows.Count > 0 ? _pptApp.SlideShowWindows[1].View : null;
                
                return new {
                    success = true,
                    isRunning = true,
                    inPresentation = _pptApp.SlideShowWindows.Count > 0,
                    totalSlides = presentation.Slides.Count,
                    currentSlide = view != null ? view.Slide.SlideIndex : 1
                };
            }
            catch (Exception ex)
            {
                return new { success = false, message = ex.Message };
            }
        }

        public async Task<object> GotoPage(object input)
        {
            if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
            try
            {
                int pageIndex = (int)input;
                if (_pptApp.SlideShowWindows.Count > 0)
                {
                    _pptApp.SlideShowWindows[1].View.GotoSlide(pageIndex);
                }
                else
                {
                    _pptApp.ActivePresentation.Slides[pageIndex].Select();
                }
                return new { success = true };
            }
            catch (Exception ex)
            {
                return new { success = false, message = ex.Message };
            }
        }

        public async Task<object> ExitSlideshow(object input)
        {
            if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
            try
            {
                if (_pptApp.SlideShowWindows.Count > 0)
                {
                    _pptApp.SlideShowWindows[1].Exit();
                }
                return new { success = true };
            }
            catch (Exception ex)
            {
                return new { success = false, message = ex.Message };
            }
        }
    }
`;

class PptVstoService {
    constructor() {
        this.status = 'disconnected'; // disconnected, connecting, connected, error
        this._pptGetStatus = null;
        this._pptGotoPage = null;
        this._pptExitSlideshow = null;
        this._pollTimer = null;
        this._lastState = null;
    }

    init() {
        if (!edge) return false;
        try {
            this._pptGetStatus = edge.func({
                source: pptSource,
                methodName: 'GetStatus',
                references: [
                    'Microsoft.Office.Interop.PowerPoint.dll',
                    'OFFICE.dll'
                ]
            });
            this._pptGotoPage = edge.func({
                source: pptSource,
                methodName: 'GotoPage',
                references: [
                    'Microsoft.Office.Interop.PowerPoint.dll',
                    'OFFICE.dll'
                ]
            });
            this._pptExitSlideshow = edge.func({
                source: pptSource,
                methodName: 'ExitSlideshow',
                references: [
                    'Microsoft.Office.Interop.PowerPoint.dll',
                    'OFFICE.dll'
                ]
            });
            this.status = 'connected';
            return true;
        } catch (e) {
            console.error('VSTO Service Init Error:', e);
            this.status = 'error';
            return false;
        }
    }

    async getStatus() {
        if (!this._pptGetStatus) return { success: false, message: 'Not initialized' };
        return new Promise((resolve) => {
            this._pptGetStatus(null, (error, result) => {
                if (error) resolve({ success: false, message: error.message });
                else resolve(result);
            });
        });
    }

    async gotoPage(pageIndex) {
        if (!this._pptGotoPage) return { success: false, message: 'Not initialized' };
        return new Promise((resolve) => {
            this._pptGotoPage(pageIndex, (error, result) => {
                if (error) resolve({ success: false, message: error.message });
                else resolve(result);
            });
        });
    }

    async exitSlideshow() {
        if (!this._pptExitSlideshow) return { success: false, message: 'Not initialized' };
        return new Promise((resolve) => {
            this._pptExitSlideshow(null, (error, result) => {
                if (error) resolve({ success: false, message: error.message });
                else resolve(result);
            });
        });
    }

    startPolling(callback, interval = 10000) {
        if (this._pollTimer) clearTimeout(this._pollTimer);
        
        const MAX_CONSECUTIVE_ERRORS = 5;
        let consecutiveErrors = 0;
        let lastCpuUsage = process.cpuUsage();
        let lastCpuTime = Date.now();

        const poll = async () => {
            const startTime = Date.now();
            try {
                const state = await this.getStatus();

                // 性能监控：计算 CPU 和内存占用
                const currentCpuUsage = process.cpuUsage(lastCpuUsage);
                const currentCpuTime = Date.now();
                const deltaTime = (currentCpuTime - lastCpuTime) * 1000;
                
                const cpuPercent = deltaTime > 0 
                    ? ((currentCpuUsage.user + currentCpuUsage.system) / deltaTime * 100).toFixed(2)
                    : 0;
                
                lastCpuUsage = process.cpuUsage();
                lastCpuTime = currentCpuTime;

                if (state.success) {
                    consecutiveErrors = 0;
                    if (JSON.stringify(state) !== JSON.stringify(this._lastState)) {
                        this._lastState = state;
                        callback(state);
                    }
                    if (this.status !== 'connected') {
                        this.status = 'connected';
                        callback({ type: 'status', status: 'connected' });
                    }
                } else {
                    consecutiveErrors++;
                    if (this.status !== 'disconnected') {
                        this.status = 'disconnected';
                        callback({ type: 'status', status: 'disconnected' });
                    }
                    
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        this.init();
                        consecutiveErrors = 0;
                    }
                }

                // 性能日志记录
                this._pollCount = (this._pollCount || 0) + 1;
                if (this._pollCount % 10 === 0) {
                    console.log(`[VSTO Perf Stats] CPU: ${cpuPercent}%, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
                }

            } catch (err) {
                console.error('VSTO Polling Loop Error:', err);
            }

            // 智能节流：非放映模式下降低频率
            const nextInterval = this._lastState && !this._lastState.inPresentation ? interval * 2 : interval;
            this._pollTimer = setTimeout(poll, nextInterval);
        };

        this._pollTimer = setTimeout(poll, 0);
    }

    stopPolling() {
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = null;
    }
}

module.exports = new PptVstoService();
