'use strict';

const readline = require('readline');

let _idCounter = 0;

function nextId() {
  _idCounter += 1;
  return `tw_${Date.now()}_${_idCounter}`;
}

/**
 * 基于 stdin/stdout 的简单 JSON 行 IPC 通道
 * 每一行是一个 JSON 对象，包含 type / id / command / payload 等字段
 */
class IpcChannel {
  /**
   * @param {NodeJS.ReadStream} input
   * @param {NodeJS.WriteStream} output
   */
  constructor(input, output) {
    this.input = input || process.stdin;
    this.output = output || process.stdout;
    this._onCommand = null;
    this._closed = false;

    const rl = readline.createInterface({
      input: this.input
    });
    rl.on('line', line => this._handleLine(line));
    rl.on('close', () => {
      this._closed = true;
    });
  }

  /**
   * 注册命令处理回调
   * @param {(msg:Object)=>void} handler
   */
  onCommand(handler) {
    this._onCommand = handler;
  }

  _handleLine(line) {
    let msg = null;
    try {
      const trimmed = String(line || '').trim();
      if (!trimmed) return;
      msg = JSON.parse(trimmed);
    } catch (e) {
      this.send({
        type: 'error',
        id: nextId(),
        error: {
          code: 'bad_json',
          message: String(e && e.message ? e.message : e)
        },
        timestamp: Date.now()
      });
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (this._onCommand && msg.type === 'request') {
      this._onCommand(msg);
    }
  }

  /**
   * 发送任意消息对象
   * @param {Object} msg
   */
  send(msg) {
    if (this._closed) return;
    try {
      const payload = Object.assign({}, msg, { timestamp: Date.now() });
      this.output.write(JSON.stringify(payload) + '\n');
    } catch (e) {
      // 安静失败，避免死循环
    }
  }

  /**
   * 发送事件消息
   * @param {string} event
   * @param {Object} payload
   */
  sendEvent(event, payload) {
    this.send({
      type: 'event',
      id: nextId(),
      event,
      payload: payload || {}
    });
  }

  /**
   * 发送响应
   * @param {string} id
   * @param {Object} payload
   */
  sendResponse(id, payload) {
    this.send({
      type: 'response',
      id,
      payload: payload || {}
    });
  }

  /**
   * 发送错误响应
   * @param {string} id
   * @param {string} code
   * @param {string} message
   */
  sendError(id, code, message) {
    this.send({
      type: 'error',
      id,
      error: {
        code,
        message
      }
    });
  }
}

module.exports = {
  IpcChannel,
  nextId
};

