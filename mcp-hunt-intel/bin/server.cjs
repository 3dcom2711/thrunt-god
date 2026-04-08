#!/usr/bin/env node
'use strict';

// CRITICAL: All logging to stderr for stdout purity (JSON-RPC only on stdout)
const log = (...args) => console.error('[mcp-hunt-intel]', ...args);

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { openIntelDb } = require('../lib/intel.cjs');
const { registerTools } = require('../lib/tools.cjs');

const server = new McpServer({
  name: 'mcp-hunt-intel',
  version: '0.1.0',
});

// Open global intel database (creates + populates on first run)
// Support THRUNT_INTEL_DB_DIR env var for testing
const dbOpts = {};
if (process.env.THRUNT_INTEL_DB_DIR) {
  dbOpts.dbDir = process.env.THRUNT_INTEL_DB_DIR;
}
log('Opening intel database...');
const db = openIntelDb(dbOpts);
log('Intel database ready');

// Register all tools
registerTools(server, db);
log('Tools registered');

// Connect via stdio transport
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  log('MCP server started on stdio');
}).catch(err => {
  log('Failed to start:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
