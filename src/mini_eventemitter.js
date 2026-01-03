/**
 * mini_eventemitter.js
 *
 * 一个极简事件发射器（同步触发），提供：
 * - on：订阅事件（返回取消订阅函数）
 * - off：取消订阅
 * - emit：触发事件
 * - once：只触发一次的订阅
 *
 * 设计取舍：
 * - 保持零依赖与较低代码体积
 * - emit 中捕获回调异常并打印，避免单个监听器影响全局
 */
export default class MiniEventEmitter {
  /**
   * @constructor
   */
  constructor(){ this._listeners = Object.create(null); }
  
  /**
   * 订阅事件。
   * @param {string} name - 事件名
   * @param {Function} fn - 回调函数
   * @returns {Function} 取消订阅函数
   */
  on(name, fn){ 
    if (!this._listeners[name]) this._listeners[name] = []; 
    this._listeners[name].push(fn); 
    return ()=>this.off(name, fn); 
  }
  
  /**
   * 取消订阅事件。
   * @param {string} name - 事件名
   * @param {Function} fn - 回调函数
   * @returns {void}
   */
  off(name, fn){ 
    if (!this._listeners[name]) return; 
    this._listeners[name] = this._listeners[name].filter(f=>f!==fn); 
  }
  
  /**
   * 触发事件（同步）。
   * @param {string} name - 事件名
   * @param {...*} args - 传递给回调的数据
   * @returns {void}
   */
  emit(name, ...args){ 
    const arr = this._listeners[name]; 
    if (!arr || !arr.length) return; 
    arr.slice().forEach(fn=>{ 
      try{ fn(...args); }
      catch(e){ console.error('event handler error', e); } 
    }); 
  }
  
  /**
   * 订阅一次性事件：第一次触发后自动解绑。
   * @param {string} name - 事件名
   * @param {Function} fn - 回调函数
   * @returns {Function} 取消订阅函数
   */
  once(name, fn) {
    const wrapper = (...args) => {
      fn(...args);
      this.off(name, wrapper);
    };
    this.on(name, wrapper);
    return () => this.off(name, wrapper);
  }
}
