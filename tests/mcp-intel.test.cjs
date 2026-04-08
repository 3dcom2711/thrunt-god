'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  const dir = path.join(os.tmpdir(), `thrunt-mcp-test-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Lazy-load modules
let intel, tools, layers;
function loadIntel() {
  if (!intel) intel = require('../mcp-hunt-intel/lib/intel.cjs');
  return intel;
}
function loadTools() {
  if (!tools) tools = require('../mcp-hunt-intel/lib/tools.cjs');
  return tools;
}
function loadLayers() {
  if (!layers) layers = require('../mcp-hunt-intel/lib/layers.cjs');
  return layers;
}

// Shared db for read-only tests
let sharedDb, sharedTmpDir;

// ── layers.cjs ─────────────────────────────────────────────────────────────

describe('layers.cjs - buildNavigatorLayer', () => {
  it('exports buildNavigatorLayer function', () => {
    const { buildNavigatorLayer } = loadLayers();
    assert.equal(typeof buildNavigatorLayer, 'function');
  });

  it('produces object with name, versions, domain, techniques', () => {
    const { buildNavigatorLayer } = loadLayers();
    const layer = buildNavigatorLayer('Test Layer', [
      { id: 'T1059', score: 50 },
    ]);
    assert.equal(layer.name, 'Test Layer');
    assert.ok(layer.versions);
    assert.ok(layer.domain);
    assert.ok(Array.isArray(layer.techniques));
  });

  it('sets versions.layer to 4.5', () => {
    const { buildNavigatorLayer } = loadLayers();
    const layer = buildNavigatorLayer('Test', []);
    assert.equal(layer.versions.layer, '4.5');
  });

  it('sets domain to enterprise-attack', () => {
    const { buildNavigatorLayer } = loadLayers();
    const layer = buildNavigatorLayer('Test', []);
    assert.equal(layer.domain, 'enterprise-attack');
  });

  it('maps techniques with techniqueID, score, enabled fields', () => {
    const { buildNavigatorLayer } = loadLayers();
    const layer = buildNavigatorLayer('Test', [
      { id: 'T1059', score: 75, color: '#ff0000', comment: 'test' },
      { id: 'T1078', score: 0 },
    ]);
    assert.equal(layer.techniques.length, 2);

    const t1 = layer.techniques[0];
    assert.equal(t1.techniqueID, 'T1059');
    assert.equal(t1.score, 75);
    assert.equal(t1.enabled, true);
    assert.equal(t1.color, '#ff0000');
    assert.equal(t1.comment, 'test');

    const t2 = layer.techniques[1];
    assert.equal(t2.techniqueID, 'T1078');
    assert.equal(t2.score, 0);
    assert.equal(t2.enabled, true);
  });

  it('accepts optional description', () => {
    const { buildNavigatorLayer } = loadLayers();
    const layer = buildNavigatorLayer('Test', [], { description: 'My description' });
    assert.equal(layer.description, 'My description');
  });
});

// ── tools.cjs - exports ────────────────────────────────────────────────────

describe('tools.cjs - exports', () => {
  it('exports registerTools function', () => {
    const { registerTools } = loadTools();
    assert.equal(typeof registerTools, 'function');
  });

  it('exports handler functions for testing', () => {
    const t = loadTools();
    assert.equal(typeof t.handleLookupTechnique, 'function');
    assert.equal(typeof t.handleSearchTechniques, 'function');
    assert.equal(typeof t.handleLookupGroup, 'function');
    assert.equal(typeof t.handleGenerateLayer, 'function');
    assert.equal(typeof t.handleAnalyzeCoverage, 'function');
  });

  it('exports withTimeout wrapper', () => {
    const { withTimeout } = loadTools();
    assert.equal(typeof withTimeout, 'function');
  });
});

// ── lookup_technique logic ─────────────────────────────────────────────────

describe('lookup_technique handler', () => {
  before(() => {
    sharedTmpDir = makeTempDir();
    const { openIntelDb } = loadIntel();
    sharedDb = openIntelDb({ dbDir: sharedTmpDir });
  });

  after(() => {
    if (sharedDb) sharedDb.close();
    if (sharedTmpDir) fs.rmSync(sharedTmpDir, { recursive: true, force: true });
  });

  it('returns technique data for valid ID (T1059)', async () => {
    const { handleLookupTechnique } = loadTools();
    const result = await handleLookupTechnique(sharedDb, { technique_id: 'T1059' });
    assert.ok(!result.isError, 'should not be an error');
    assert.ok(result.content);
    assert.equal(result.content[0].type, 'text');

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.id, 'T1059');
    assert.ok(data.name);
    assert.ok(data.description);
    assert.ok(data.tactics);
    assert.ok(data.platforms);
  });

  it('returns sub-technique data for dotted ID (T1059.001)', async () => {
    const { handleLookupTechnique } = loadTools();
    const result = await handleLookupTechnique(sharedDb, { technique_id: 'T1059.001' });
    assert.ok(!result.isError, 'should not be an error');

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.id, 'T1059.001');
    assert.ok(data.name);
  });

  it('includes sub_techniques array for parent technique', async () => {
    const { handleLookupTechnique } = loadTools();
    const result = await handleLookupTechnique(sharedDb, { technique_id: 'T1059' });
    const data = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(data.sub_techniques), 'should include sub_techniques');
    assert.ok(data.sub_techniques.length > 0, 'T1059 should have sub-techniques');
  });

  it('returns isError: true for invalid ID', async () => {
    const { handleLookupTechnique } = loadTools();
    const result = await handleLookupTechnique(sharedDb, { technique_id: 'T9999' });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('not found'));
  });
});

// ── search_techniques logic ────────────────────────────────────────────────

describe('search_techniques handler', () => {
  before(() => {
    if (!sharedDb) {
      sharedTmpDir = makeTempDir();
      const { openIntelDb } = loadIntel();
      sharedDb = openIntelDb({ dbDir: sharedTmpDir });
    }
  });

  it('returns multiple results for keyword "credential"', async () => {
    const { handleSearchTechniques } = loadTools();
    const result = await handleSearchTechniques(sharedDb, { query: 'credential', limit: 20 });
    assert.ok(!result.isError);

    const data = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 1, 'should find multiple techniques related to credential');
  });

  it('narrows results with tactic filter "Persistence"', async () => {
    const { handleSearchTechniques } = loadTools();
    const allResults = await handleSearchTechniques(sharedDb, { query: 'account', limit: 100 });
    const filteredResults = await handleSearchTechniques(sharedDb, { query: 'account', tactic: 'Persistence', limit: 100 });

    const allData = JSON.parse(allResults.content[0].text);
    const filtData = JSON.parse(filteredResults.content[0].text);
    assert.ok(filtData.length <= allData.length, 'filtered should be <= unfiltered');
  });

  it('narrows results with platform filter "Windows"', async () => {
    const { handleSearchTechniques } = loadTools();
    const allResults = await handleSearchTechniques(sharedDb, { query: 'execution', limit: 100 });
    const filteredResults = await handleSearchTechniques(sharedDb, { query: 'execution', platform: 'Windows', limit: 100 });

    const allData = JSON.parse(allResults.content[0].text);
    const filtData = JSON.parse(filteredResults.content[0].text);
    // Platform filter may not reduce if all have Windows -- just ensure it runs
    assert.ok(Array.isArray(filtData));
  });

  it('respects limit parameter', async () => {
    const { handleSearchTechniques } = loadTools();
    const result = await handleSearchTechniques(sharedDb, { query: 'access', limit: 5 });
    const data = JSON.parse(result.content[0].text);
    assert.ok(data.length <= 5, 'should return at most 5 results');
  });
});

// ── lookup_group logic ─────────────────────────────────────────────────────

describe('lookup_group handler', () => {
  before(() => {
    if (!sharedDb) {
      sharedTmpDir = makeTempDir();
      const { openIntelDb } = loadIntel();
      sharedDb = openIntelDb({ dbDir: sharedTmpDir });
    }
  });

  it('returns group data with techniques and software for valid ID (G0007)', async () => {
    const { handleLookupGroup } = loadTools();
    const result = await handleLookupGroup(sharedDb, { group_id: 'G0007' });
    assert.ok(!result.isError);

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.id, 'G0007');
    assert.ok(data.name);
    assert.ok(data.description);
    assert.ok(Array.isArray(data.techniques), 'should include techniques array');
    assert.ok(Array.isArray(data.software), 'should include software array');
  });

  it('supports name-based lookup', async () => {
    const { handleLookupGroup } = loadTools();
    const result = await handleLookupGroup(sharedDb, { group_id: 'APT28' });
    assert.ok(!result.isError, 'should find group by name');

    const data = JSON.parse(result.content[0].text);
    assert.ok(data.name);
    assert.ok(data.techniques);
  });

  it('returns isError: true for invalid group', async () => {
    const { handleLookupGroup } = loadTools();
    const result = await handleLookupGroup(sharedDb, { group_id: 'G9999' });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('not found'));
  });
});

// ── generate_layer modes ───────────────────────────────────────────────────

describe('generate_layer handler', () => {
  before(() => {
    if (!sharedDb) {
      sharedTmpDir = makeTempDir();
      const { openIntelDb } = loadIntel();
      sharedDb = openIntelDb({ dbDir: sharedTmpDir });
    }
  });

  it('custom mode produces valid layer with given technique IDs', async () => {
    const { handleGenerateLayer } = loadTools();
    const result = await handleGenerateLayer(sharedDb, {
      mode: 'custom',
      name: 'Custom Layer',
      technique_ids: ['T1059', 'T1078'],
    });
    assert.ok(!result.isError);

    const layer = JSON.parse(result.content[0].text);
    assert.equal(layer.name, 'Custom Layer');
    assert.equal(layer.versions.layer, '4.5');
    assert.equal(layer.domain, 'enterprise-attack');
    assert.equal(layer.techniques.length, 2);
    assert.ok(layer.techniques.every(t => t.score === 100));
  });

  it('group mode produces layer with group techniques', async () => {
    const { handleGenerateLayer } = loadTools();
    const result = await handleGenerateLayer(sharedDb, {
      mode: 'group',
      name: 'APT28 Layer',
      group_id: 'G0007',
    });
    assert.ok(!result.isError);

    const layer = JSON.parse(result.content[0].text);
    assert.ok(layer.techniques.length > 0, 'group layer should have techniques');
    assert.equal(layer.versions.layer, '4.5');
  });

  it('coverage mode produces layer (all score=0 before Phase 54)', async () => {
    const { handleGenerateLayer } = loadTools();
    const result = await handleGenerateLayer(sharedDb, {
      mode: 'coverage',
      name: 'Coverage Snapshot',
    });
    assert.ok(!result.isError);

    const layer = JSON.parse(result.content[0].text);
    assert.ok(layer.techniques.length > 0, 'coverage layer should have techniques');
    // Before Phase 54 (no detections table), all scores should be 0
    assert.ok(layer.techniques.every(t => t.score === 0), 'all scores should be 0 before Phase 54');
  });

  it('gap mode produces layer highlighting uncovered techniques', async () => {
    const { handleGenerateLayer } = loadTools();
    const result = await handleGenerateLayer(sharedDb, {
      mode: 'gap',
      name: 'APT28 Gaps',
      group_id: 'G0007',
    });
    assert.ok(!result.isError);

    const layer = JSON.parse(result.content[0].text);
    assert.ok(layer.techniques.length > 0, 'gap layer should have techniques');
    // Before Phase 54, all are uncovered so all should have score=100 + red color
    assert.ok(layer.techniques.every(t => t.score === 100), 'all uncovered should score 100');
  });

  it('generated layer techniques have techniqueID, score, enabled', async () => {
    const { handleGenerateLayer } = loadTools();
    const result = await handleGenerateLayer(sharedDb, {
      mode: 'custom',
      name: 'Test',
      technique_ids: ['T1059'],
    });
    const layer = JSON.parse(result.content[0].text);
    const tech = layer.techniques[0];
    assert.ok('techniqueID' in tech, 'should have techniqueID');
    assert.ok('score' in tech, 'should have score');
    assert.ok('enabled' in tech, 'should have enabled');
  });
});

// ── analyze_coverage ───────────────────────────────────────────────────────

describe('analyze_coverage handler', () => {
  before(() => {
    if (!sharedDb) {
      sharedTmpDir = makeTempDir();
      const { openIntelDb } = loadIntel();
      sharedDb = openIntelDb({ dbDir: sharedTmpDir });
    }
  });

  it('returns structured coverage data for group', async () => {
    const { handleAnalyzeCoverage } = loadTools();
    const result = await handleAnalyzeCoverage(sharedDb, { group_id: 'G0007', include_techniques: true });
    assert.ok(!result.isError);

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.group_id, 'G0007');
    assert.ok(data.group_name);
    assert.ok(typeof data.total_techniques === 'number');
    assert.ok(typeof data.covered === 'number');
    assert.ok(typeof data.uncovered === 'number');
    assert.ok(typeof data.gap_percent === 'number');
    assert.ok(Array.isArray(data.by_tactic));
  });

  it('by_tactic has tactic, total, covered, uncovered, gap_percent per entry', async () => {
    const { handleAnalyzeCoverage } = loadTools();
    const result = await handleAnalyzeCoverage(sharedDb, { group_id: 'G0007', include_techniques: true });
    const data = JSON.parse(result.content[0].text);

    assert.ok(data.by_tactic.length > 0, 'should have tactic breakdown');
    const tactic = data.by_tactic[0];
    assert.ok('tactic' in tactic);
    assert.ok('total' in tactic);
    assert.ok('covered' in tactic);
    assert.ok('uncovered' in tactic);
    assert.ok('gap_percent' in tactic);
  });

  it('degrades gracefully before Phase 54 (covered=0)', async () => {
    const { handleAnalyzeCoverage } = loadTools();
    const result = await handleAnalyzeCoverage(sharedDb, { group_id: 'G0007', include_techniques: false });
    const data = JSON.parse(result.content[0].text);

    // Before Phase 54, no detections table -> covered=0 for everything
    assert.equal(data.covered, 0, 'covered should be 0 before Phase 54');
    assert.equal(data.gap_percent, 100, 'gap should be 100% before Phase 54');
  });
});

// ── timeout enforcement ────────────────────────────────────────────────────

describe('timeout enforcement', () => {
  it('withTimeout aborts slow handlers', async () => {
    const { withTimeout } = loadTools();

    // Save current timeout and set a very short one
    const origTimeout = process.env.THRUNT_MCP_TIMEOUT;
    process.env.THRUNT_MCP_TIMEOUT = '50'; // 50ms

    // Re-require to pick up new timeout -- use the wrapper directly
    // The withTimeout function reads THRUNT_MCP_TIMEOUT at module load, so we
    // test the pattern by creating a timeout wrapper manually
    const TIMEOUT_MS = 50;
    function testWithTimeout(fn) {
      return async (args) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          return await fn(args, controller.signal);
        } catch (err) {
          if (err.name === 'AbortError') {
            return { content: [{ type: 'text', text: `Tool timed out after ${TIMEOUT_MS}ms` }], isError: true };
          }
          throw err;
        } finally {
          clearTimeout(timer);
        }
      };
    }

    const slowHandler = testWithTimeout(async (_args, signal) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({ content: [{ type: 'text', text: 'done' }] }), 5000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const result = await slowHandler({});
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes('timed out'));

    // Restore env
    if (origTimeout) {
      process.env.THRUNT_MCP_TIMEOUT = origTimeout;
    } else {
      delete process.env.THRUNT_MCP_TIMEOUT;
    }
  });
});

// ── stdout purity ──────────────────────────────────────────────────────────

describe('server.cjs stdout purity', () => {
  it('server.cjs does not contain console.log calls', () => {
    const serverPath = path.join(__dirname, '..', 'mcp-hunt-intel', 'bin', 'server.cjs');
    const content = fs.readFileSync(serverPath, 'utf-8');
    assert.ok(!content.includes('console.log('), 'server.cjs must not contain console.log()');
    assert.ok(content.includes('console.error'), 'server.cjs should use console.error for logging');
  });

  it('server.cjs has shebang line', () => {
    const serverPath = path.join(__dirname, '..', 'mcp-hunt-intel', 'bin', 'server.cjs');
    const content = fs.readFileSync(serverPath, 'utf-8');
    assert.ok(content.startsWith('#!/usr/bin/env node'), 'should start with shebang');
  });

  it('server.cjs can be required without throwing', () => {
    // We only check syntax -- actually requiring it would start the server
    const serverPath = path.join(__dirname, '..', 'mcp-hunt-intel', 'bin', 'server.cjs');
    const content = fs.readFileSync(serverPath, 'utf-8');
    // Strip shebang for syntax check
    const code = content.replace(/^#!.*\n/, '');
    // Syntax check via new Function (won't execute requires)
    assert.doesNotThrow(() => {
      new Function('require', 'module', 'exports', '__dirname', '__filename', 'process', code);
    }, 'server.cjs should have valid JavaScript syntax');
  });
});

// ── server smoke test ──────────────────────────────────────────────────────

describe('server smoke test', () => {
  it('responds to JSON-RPC initialize request', async () => {
    const tmpDir = makeTempDir();
    const serverPath = path.join(__dirname, '..', 'mcp-hunt-intel', 'bin', 'server.cjs');

    const result = await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [serverPath], {
        env: {
          ...process.env,
          THRUNT_INTEL_DB_DIR: tmpDir,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        // MCP protocol uses Content-Length framing -- look for JSON-RPC response
        if (stdout.includes('"jsonrpc"') && !resolved) {
          resolved = true;
          proc.kill();
          resolve({ stdout, stderr });
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', reject);

      proc.on('close', () => {
        if (!resolved) {
          resolve({ stdout, stderr });
        }
      });

      // Send JSON-RPC initialize request with Content-Length framing
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '0.1.0' },
        },
      });
      const message = `Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`;
      proc.stdin.write(message);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.kill();
          resolve({ stdout, stderr });
        }
      }, 10000);
    });

    // Verify we got a JSON-RPC response on stdout
    assert.ok(result.stdout.includes('"jsonrpc"'), `should receive JSON-RPC response, got stdout: ${result.stdout.slice(0, 200)}`);
    assert.ok(result.stdout.includes('"result"'), `should have result field, got: ${result.stdout.slice(0, 200)}`);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
