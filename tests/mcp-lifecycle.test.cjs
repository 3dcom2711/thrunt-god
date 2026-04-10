'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createShutdownHandler } = require('../apps/mcp/lib/lifecycle.cjs');

describe('createShutdownHandler', () => {
  it('closes the MCP server before the database and then exits', async () => {
    const calls = [];
    const shutdown = createShutdownHandler({
      server: {
        close: async () => {
          calls.push('server.close');
        },
      },
      db: {
        close: () => {
          calls.push('db.close');
        },
      },
      exit: (code) => {
        calls.push(`exit:${code}`);
      },
    });

    await shutdown(0);
    assert.deepEqual(calls, ['server.close', 'db.close', 'exit:0']);
  });

  it('is idempotent across repeated shutdown signals', async () => {
    let serverCloses = 0;
    let dbCloses = 0;
    let exits = 0;

    const shutdown = createShutdownHandler({
      server: { close: async () => { serverCloses++; } },
      db: { close: () => { dbCloses++; } },
      exit: () => { exits++; },
    });

    await shutdown(0);
    await shutdown(0);

    assert.equal(serverCloses, 1);
    assert.equal(dbCloses, 1);
    assert.equal(exits, 1);
  });
});
