'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');

const { waitForHealthy } = require('./integration/helpers.cjs');

test('waitForHealthy aborts hung requests and honors the timeout budget', async () => {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    // Intentionally accept and hang without responding.
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const start = Date.now();

  try {
    await assert.rejects(
      () => waitForHealthy(`http://127.0.0.1:${address.port}`, {
        timeout: 300,
        interval: 50,
        requestTimeoutMs: 75,
      }),
      /did not return HTTP 200/
    );
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `Expected hung-health timeout to resolve quickly, got ${elapsed}ms`);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
