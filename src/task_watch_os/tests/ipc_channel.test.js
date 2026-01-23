'use strict';

// 测试 IPC 通道的基本 JSON 行收发能力

const assert = require('assert');
const { IpcChannel } = require('../src/ipc_channel');
const stream = require('stream');

async function run() {
  const input = new stream.PassThrough();
  const output = new stream.PassThrough();
  const ipc = new IpcChannel(input, output);

  let received = null;
  ipc.onCommand(msg => {
    received = msg;
  });

  const msg = {
    type: 'request',
    id: 'test1',
    command: 'ping',
    payload: { foo: 'bar' }
  };

  input.write(JSON.stringify(msg) + '\n');

  await new Promise(resolve => setTimeout(resolve, 50));

  assert(received, 'message should be received');
  assert.strictEqual(received.command, 'ping', 'command should be ping');

  ipc.sendResponse('test1', { ok: true });

  const chunks = [];
  output.on('data', chunk => chunks.push(chunk));

  await new Promise(resolve => setTimeout(resolve, 50));

  const out = Buffer.concat(chunks).toString('utf8').trim();
  assert(out.includes('"type":"response"'), 'should write response JSON');

  console.log('[PASS] ipc_channel basic behavior');
}

run().catch(err => {
  console.error('[FAIL] ipc_channel basic behavior', err);
  process.exitCode = 1;
});

