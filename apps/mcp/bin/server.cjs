#!/usr/bin/env node
'use strict';

// All logging to stderr (JSON-RPC only on stdout)
const log = (...args) => console.error('[thrunt-mcp]', ...args);

const fs = require('fs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { openIntelDb } = require('../lib/intel.cjs');
const { createShutdownHandler } = require('../lib/lifecycle.cjs');
const { getToolDefinitions, registerTools } = require('../lib/tools.cjs');
const { registerPrompts } = require('../lib/prompts.cjs');
const { version: SERVER_VERSION } = require('../package.json');

const dbOpts = {};
if (process.env.THRUNT_INTEL_DB_DIR) {
  dbOpts.dbDir = process.env.THRUNT_INTEL_DB_DIR;
}

function safeCloseDb(db) {
  if (!db || typeof db.close !== 'function') {
    return;
  }

  try {
    db.close();
  } catch {
    // ignore close failures during shutdown paths
  }
}

function getMainDbSizeBytes(db) {
  const mainDb = db
    .prepare('PRAGMA database_list')
    .all()
    .find((entry) => entry.name === 'main');

  if (!mainDb?.file || !fs.existsSync(mainDb.file)) {
    return 0;
  }

  return fs.statSync(mainDb.file).size;
}

// --- Health check mode (no MCP server, no transport) ---
if (process.argv.includes('--health')) {
  const startTime = Date.now();
  const toolDefinitions = getToolDefinitions();
  let db = null;
  try {
    db = openIntelDb(dbOpts);
    const tables = db.prepare(
      "SELECT count(*) as c FROM sqlite_master WHERE type='table'"
    ).get();

    const result = {
      status: 'healthy',
      toolCount: toolDefinitions.length,
      dbSizeBytes: getMainDbSizeBytes(db),
      dbTableCount: tables.c,
      uptimeMs: Date.now() - startTime,
      serverVersion: SERVER_VERSION,
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    safeCloseDb(db);
    process.exit(0);
  } catch (err) {
    safeCloseDb(db);
    const result = {
      status: 'unhealthy',
      toolCount: 0,
      dbSizeBytes: 0,
      dbTableCount: 0,
      uptimeMs: Date.now() - startTime,
      error: err.message,
    };
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(1);
  }
}

// --- List tools mode (output tool metadata as JSON, no transport) ---
if (process.argv.includes('--list-tools')) {
  process.stdout.write(JSON.stringify(getToolDefinitions()) + '\n');
  process.exit(0);
}

// --- Run tool mode (one-shot tool execution, no transport) ---
const runToolIdx = process.argv.indexOf('--run-tool');
if (runToolIdx !== -1) {
  const toolName = process.argv[runToolIdx + 1];
  const inputIdx = process.argv.indexOf('--input');
  const positionalInputJson = process.argv[runToolIdx + 2];
  const inputJson = inputIdx !== -1
    ? process.argv[inputIdx + 1]
    : (positionalInputJson && !positionalInputJson.startsWith('--') ? positionalInputJson : '{}');

  if (!toolName) {
    process.stdout.write(JSON.stringify({ error: 'Missing tool name after --run-tool' }) + '\n');
    process.exit(1);
  }

  const handlers = require('../lib/tools.cjs');
  const handlerMap = {
    lookup_technique: handlers.handleLookupTechnique,
    search_techniques: handlers.handleSearchTechniques,
    lookup_group: handlers.handleLookupGroup,
    generate_layer: handlers.handleGenerateLayer,
    analyze_coverage: handlers.handleAnalyzeCoverage,
    compare_detections: handlers.handleCompareDetections,
    suggest_detections: handlers.handleSuggestDetections,
    query_knowledge: handlers.handleQueryKnowledge,
    log_decision: handlers.handleLogDecision,
    log_learning: handlers.handleLogLearning,
  };

  const handler = handlerMap[toolName];
  if (!handler) {
    process.stdout.write(JSON.stringify({ error: `Unknown tool: ${toolName}` }) + '\n');
    process.exit(1);
  }

  let db = null;
  try {
    db = openIntelDb(dbOpts);
    const args = JSON.parse(inputJson);
    const result = handler(db, args);
    // Handle both sync and async results
    Promise.resolve(result).then((res) => {
      process.stdout.write(JSON.stringify(res) + '\n');
      safeCloseDb(db);
      process.exit(0);
    }).catch((err) => {
      process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
      safeCloseDb(db);
      process.exit(1);
    });
  } catch (err) {
    safeCloseDb(db);
    process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
    process.exit(1);
  }
} else {
  const server = new McpServer({
    name: 'thrunt-mcp',
    version: SERVER_VERSION,
  });

  log('Opening intel database...');
  const db = openIntelDb(dbOpts);
  log('Intel database ready');

  const shutdown = createShutdownHandler({ server, db, log });

  registerTools(server, db);
  log('Tools registered');

  registerPrompts(server, db);
  log('Prompts registered');

  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    log('MCP server started on stdio');
  }).catch(err => {
    log('Failed to start:', err.message);
    void shutdown(1);
  });

  process.on('SIGINT', () => { void shutdown(0); });
  process.on('SIGTERM', () => { void shutdown(0); });
}
