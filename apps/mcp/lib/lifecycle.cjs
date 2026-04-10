'use strict';

function createShutdownHandler({ server, db, log = () => {}, exit = process.exit }) {
  let closed = false;

  return async function shutdown(code = 0) {
    if (closed) return;
    closed = true;

    try {
      if (server && typeof server.close === 'function') {
        await server.close();
      }
    } catch (err) {
      log('Error while closing MCP server:', err && err.message ? err.message : String(err));
    }

    try {
      if (db && typeof db.close === 'function') {
        db.close();
      }
    } catch (err) {
      log('Error while closing intel database:', err && err.message ? err.message : String(err));
    }

    exit(code);
  };
}

module.exports = {
  createShutdownHandler,
};
