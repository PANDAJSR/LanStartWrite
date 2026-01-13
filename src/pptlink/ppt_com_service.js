/**
 * ppt_com_service.js
 * 
 * 使用 edge-js 调用 PPT COM 接口，实现与 PowerPoint 的深度联动。
 * 支持页面获取、跳转、状态监听等。
 * 
 * 优化：
 * 1. 线程安全：使用 lock 确保 COM 调用不冲突。
 * 2. 鲁棒性：完善的错误处理和资源释放。
 * 3. 兼容性：支持 32/64 位 Office 环境。
 */

const path = require('path');
const fs = require('fs');

let edge;
try {
    edge = require('edge-js');
} catch (e) {
    console.error('COM Service: edge-js is not installed.');
}

// 详细的日志记录
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create log directory:', e);
    }
}
const logFile = path.join(logDir, 'ppt_com_service.log');

function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}\n`;
    try {
        fs.appendFileSync(logFile, line);
    } catch (e) {}
    console.log(`[${level}] ${msg}`);
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
        private static readonly object _lock = new object();

        private static bool EnsurePptApp()
        {
            lock (_lock)
            {
                try
                {
                    if (_pptApp == null)
                    {
                        try {
                            _pptApp = (Application)Marshal.GetActiveObject("PowerPoint.Application");
                        } catch {
                            // Try to create if not running? Usually we only want to link to active one
                            return false;
                        }
                    }
                    // Test if still alive
                    string name = _pptApp.Name;
                    return true;
                }
                catch
                {
                    if (_pptApp != null) {
                        try { Marshal.ReleaseComObject(_pptApp); } catch {}
                        _pptApp = null;
                    }
                    return false;
                }
            }
        }

        public async Task<object> GetStatus(object input)
        {
            return await Task.Run(() => {
                lock (_lock)
                {
                    if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
                    try
                    {
                        Presentations presentations = _pptApp.Presentations;
                        if (presentations.Count == 0) {
                            return new { success = true, isRunning = true, hasPresentation = false };
                        }

                        Presentation activePres = null;
                        try { activePres = _pptApp.ActivePresentation; } catch {}
                        
                        if (activePres == null) {
                             return new { success = true, isRunning = true, hasPresentation = false };
                        }

                        var slideShowWindows = _pptApp.SlideShowWindows;
                        var view = slideShowWindows.Count > 0 ? slideShowWindows[1].View : null;
                        
                        var result = new {
                            success = true,
                            isRunning = true,
                            hasPresentation = true,
                            inPresentation = slideShowWindows.Count > 0,
                            totalSlides = activePres.Slides.Count,
                            currentSlide = view != null ? view.Slide.SlideIndex : 1,
                            presentationName = activePres.Name
                        };

                        return result;
                    }
                    catch (Exception ex)
                    {
                        return new { success = false, message = ex.Message };
                    }
                }
            });
        }

        public async Task<object> GotoPage(object input)
        {
            return await Task.Run(() => {
                lock (_lock)
                {
                    if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
                    try
                    {
                        int pageIndex = 1;
                        if (input is int) pageIndex = (int)input;
                        else if (input is string) int.TryParse((string)input, out pageIndex);
                        else if (input != null && input.GetType().GetProperty("page") != null) {
                             pageIndex = (int)input.GetType().GetProperty("page").GetValue(input);
                        }

                        var presentations = _pptApp.Presentations;
                        if (presentations.Count == 0) return new { success = false, message = "No active presentation" };

                        var activePres = _pptApp.ActivePresentation;
                        int total = activePres.Slides.Count;
                        if (pageIndex < 1) pageIndex = 1;
                        if (pageIndex > total) pageIndex = total;

                        var slideShowWindows = _pptApp.SlideShowWindows;
                        if (slideShowWindows.Count > 0)
                        {
                            slideShowWindows[1].View.GotoSlide(pageIndex);
                        }
                        else
                        {
                            activePres.Slides[pageIndex].Select();
                        }
                        return new { success = true, currentSlide = pageIndex };
                    }
                    catch (Exception ex)
                    {
                        return new { success = false, message = ex.Message };
                    }
                }
            });
        }

        public async Task<object> ExitSlideshow(object input)
        {
            return await Task.Run(() => {
                lock (_lock)
                {
                    if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
                    try
                    {
                        var slideShowWindows = _pptApp.SlideShowWindows;
                        if (slideShowWindows.Count > 0)
                        {
                            slideShowWindows[1].View.Exit();
                        }
                        return new { success = true };
                    }
                    catch (Exception ex)
                    {
                        return new { success = false, message = ex.Message };
                    }
                }
            });
        }

        public async Task<object> ExitSlideshow(object input)
        {
            return await Task.Run(() => {
                lock (_lock)
                {
                    if (!EnsurePptApp()) return new { success = false, message = "PowerPoint is not running" };
                    try
                    {
                        var slideShowWindows = _pptApp.SlideShowWindows;
                        if (slideShowWindows.Count > 0)
                        {
                            slideShowWindows[1].Exit();
                        }
                        return new { success = true };
                    }
                    catch (Exception ex)
                    {
                        return new { success = false, message = ex.Message };
                    }
                }
            });
        }
    }
`;

class PptComService {
    constructor() {
        this.status = 'disconnected';
        this._pptGetStatus = null;
        this._pptGotoPage = null;
        this._pptExitSlideshow = null;
        this._pollTimer = null;
        this._lastState = null;
        this._pollCount = 0;
    }

    init() {
        log('Initializing COM Service...');
        if (!edge) {
            log('Error: edge-js not found', 'ERROR');
            return false;
        }
        try {
            // 自动引用所需的 DLL
            // 注意：在不同版本的 Office 中，这些 DLL 可能位于不同的位置，
            // 但通常可以通过程序集名称直接引用。
            const references = [
                'Microsoft.Office.Interop.PowerPoint.dll',
                'OFFICE.dll'
            ];

            this._pptGetStatus = edge.func({
                source: pptSource,
                methodName: 'GetStatus',
                references: references
            });
            this._pptGotoPage = edge.func({
                source: pptSource,
                methodName: 'GotoPage',
                references: references
            });
            this._pptExitSlideshow = edge.func({
                source: pptSource,
                methodName: 'ExitSlideshow',
                references: references
            });
            
            this.status = 'connected';
            log('COM Service initialized successfully');
            return true;
        } catch (e) {
            log(`COM Service Init Error: ${e.message}`, 'ERROR');
            this.status = 'error';
            return false;
        }
    }

    async getStatus() {
        if (!this._pptGetStatus) return { success: false, message: 'Not initialized' };
        return new Promise((resolve) => {
            this._pptGetStatus(null, (error, result) => {
                if (error) {
                    log(`GetStatus Error: ${error.message}`, 'ERROR');
                    resolve({ success: false, message: error.message });
                } else {
                    resolve(result);
                }
            });
        });
    }

    async gotoPage(pageIndex) {
        log(`Requested gotoPage: ${pageIndex}`);
        if (!this._pptGotoPage) return { success: false, message: 'Not initialized' };
        
        // 支持传入对象 { page: number }
        const input = typeof pageIndex === 'object' ? pageIndex.page : pageIndex;

        return new Promise((resolve) => {
            this._pptGotoPage(input, (error, result) => {
                if (error) {
                    log(`GotoPage Error: ${error.message}`, 'ERROR');
                    resolve({ success: false, message: error.message });
                } else {
                    log(`GotoPage Success: ${input}`);
                    resolve(result);
                }
            });
        });
    }

    async exitSlideshow() {
        log('Requested exitSlideshow');
        if (!this._pptExitSlideshow) return { success: false, message: 'Not initialized' };
        return new Promise((resolve) => {
            this._pptExitSlideshow(null, (error, result) => {
                if (error) {
                    log(`ExitSlideshow Error: ${error.message}`, 'ERROR');
                    resolve({ success: false, message: error.message });
                } else {
                    log('ExitSlideshow Success');
                    resolve(result);
                }
            });
        });
    }

    startPolling(callback, interval = 2000) {
        log(`Starting polling with interval: ${interval}ms`);
        if (this._pollTimer) clearTimeout(this._pollTimer);

        const MAX_CONSECUTIVE_ERRORS = 3;
        let consecutiveErrors = 0;

        const poll = async () => {
            const startTime = Date.now();
            try {
                const state = await this.getStatus();
                
                if (state.success) {
                    consecutiveErrors = 0;
                    
                    // 状态变化检测
                    const stateStr = JSON.stringify(state);
                    if (stateStr !== JSON.stringify(this._lastState)) {
                        this._lastState = state;
                        callback({ type: 'sync', data: state });
                    }
                    
                    if (this.status !== 'connected') {
                        this.status = 'connected';
                        callback({ type: 'status', status: 'connected' });
                    }
                } else {
                    consecutiveErrors++;
                    if (this.status !== 'disconnected' && consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        this.status = 'disconnected';
                        log(`Polling disconnected: ${state.message}`, 'WARN');
                        callback({ type: 'status', status: 'disconnected', error: state.message });
                    }
                }
                
                this._pollCount++;
                if (this._pollCount % 30 === 0) {
                    const mem = process.memoryUsage();
                    log(`[Status] Polling active. Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
                }

                const duration = Date.now() - startTime;
                if (duration > 1000) {
                    log(`Performance Warning: Polling took ${duration}ms`, 'WARN');
                }
            } catch (err) {
                log(`Polling loop error: ${err.message}`, 'ERROR');
            }

            // 智能节流：如果没有演示文稿，降低频率
            let nextInterval = interval;
            if (this._lastState && !this._lastState.hasPresentation) {
                nextInterval = interval * 2.5; // 5s
            } else if (this._lastState && !this._lastState.inPresentation) {
                nextInterval = interval * 1.5; // 3s
            }

            this._pollTimer = setTimeout(poll, nextInterval);
        };

        this._pollTimer = setTimeout(poll, 0);
    }

    stopPolling() {
        log('Stopping polling');
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
        }
    }
}

module.exports = new PptComService();

