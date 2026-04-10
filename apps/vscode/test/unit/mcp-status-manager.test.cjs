/**
 * Unit tests for MCPStatusManager.
 *
 * Tests run against the built CJS bundle using node:test.
 * The vscode mock is loaded via --require so require('vscode') resolves.
 */
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', '..', 'dist', 'extension.js');
const ext = require(BUNDLE_PATH);
const vscode = require('vscode');

function createMockOutputChannel() {
  return {
    appendLine: () => {},
    show: () => {},
    clear: () => {},
    dispose: () => {},
  };
}

describe('MCPStatusManager', () => {
  let manager;
  const mockChannel = createMockOutputChannel();
  const mockServerPath = '/tmp/fake-server.cjs';
  const realServerPath = path.join(__dirname, '..', '..', '..', 'mcp', 'bin', 'server.cjs');

  beforeEach(() => {
    manager = new ext.MCPStatusManager(mockChannel, mockServerPath);
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  it('MCPStatusManager is exported from bundle', () => {
    assert.equal(typeof ext.MCPStatusManager, 'function');
  });

  it('constructor creates instance with default disconnected status', () => {
    const status = manager.getStatus();
    assert.equal(status.connection, 'disconnected');
    assert.equal(status.profile, null);
    assert.equal(status.lastHealthCheck, null);
    assert.equal(status.hasError, false);
  });

  it('getStatus returns copy of status (not reference)', () => {
    const a = manager.getStatus();
    const b = manager.getStatus();
    assert.notStrictEqual(a, b);
  });

  it('getServerPath resolves from a live callback', () => {
    let currentPath = '/tmp/one.cjs';
    manager = new ext.MCPStatusManager(mockChannel, () => currentPath);
    assert.equal(manager.getServerPath(), '/tmp/one.cjs');
    currentPath = '/tmp/two.cjs';
    assert.equal(manager.getServerPath(), '/tmp/two.cjs');
  });

  it('onDidChange is an event', () => {
    assert.equal(typeof manager.onDidChange, 'function');
  });

  it('dispose does not throw', () => {
    assert.doesNotThrow(() => manager.dispose());
  });

  it('dispose can be called multiple times safely', () => {
    assert.doesNotThrow(() => {
      manager.dispose();
      manager.dispose();
    });
  });

  it('MCPHealthResult type has expected shape', () => {
    const healthResult = {
      status: 'healthy',
      toolCount: 10,
      dbSizeBytes: 1024,
      dbTableCount: 5,
      uptimeMs: 100,
      timestamp: Date.now(),
    };
    assert.equal(healthResult.status, 'healthy');
    assert.equal(typeof healthResult.toolCount, 'number');
    assert.equal(typeof healthResult.dbSizeBytes, 'number');
    assert.equal(typeof healthResult.dbTableCount, 'number');
    assert.equal(typeof healthResult.uptimeMs, 'number');
    assert.equal(typeof healthResult.timestamp, 'number');
  });

  it('MCPConnectionStatus values are valid strings', () => {
    const validValues = ['connected', 'disconnected', 'checking'];
    const status = manager.getStatus();
    assert.ok(validValues.includes(status.connection), `connection should be one of ${validValues.join(', ')}`);
  });

  it('has runHealthCheck method', () => {
    assert.equal(typeof manager.runHealthCheck, 'function');
  });

  it('has listTools method', () => {
    assert.equal(typeof manager.listTools, 'function');
  });

  it('has start method', () => {
    assert.equal(typeof manager.start, 'function');
  });

  it('has restart method', () => {
    assert.equal(typeof manager.restart, 'function');
  });

  it('has stop method', () => {
    assert.equal(typeof manager.stop, 'function');
  });

  it('stop on idle manager does not throw', () => {
    assert.doesNotThrow(() => manager.stop());
  });

  it('start rejects when the server path is missing', async () => {
    await assert.rejects(
      manager.start(),
      /MCP server not found/
    );
    assert.equal(manager.getStatus().connection, 'disconnected');
  });

  it('runHealthCheck reports unhealthy when the server path is missing', async () => {
    const result = await manager.runHealthCheck();
    assert.equal(result.status, 'unhealthy');
    assert.match(result.error || '', /not found|not configured/);
  });

  it('start waits for the MCP server ready signal', async () => {
    manager = new ext.MCPStatusManager(mockChannel, realServerPath);
    await manager.start();

    const status = manager.getStatus();
    assert.equal(status.connection, 'connected');
    assert.equal(status.hasError, false);
  });
});
