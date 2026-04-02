/**
 * Unit tests for computeSessionDiff and computeArtifactHashes.
 *
 * Tests run against the built CJS bundle using node:test.
 * The vscode mock is loaded via --require so require('vscode') resolves.
 *
 * Tests cover: session diff detection for added/modified/removed artifacts,
 * summary string formatting, computeArtifactHashes output shape,
 * and mixed-scenario diffs.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', '..', 'dist', 'extension.js');
const ext = require(BUNDLE_PATH);
const vscode = require('vscode');

const { computeSessionDiff, computeArtifactHashes } = ext;

// ---------------------------------------------------------------------------
// computeSessionDiff tests
// ---------------------------------------------------------------------------

describe('computeSessionDiff', () => {

  it('produces all added entries when previous is empty', () => {
    const result = computeSessionDiff({}, { 'QRY-001': 'hash1', 'RCT-001': 'hash2' });

    assert.equal(result.entries.length, 2);
    assert.ok(result.entries.every(e => e.diffKind === 'added'));

    const types = result.entries.map(e => e.artifactType).sort();
    assert.deepEqual(types, ['query', 'receipt']);
  });

  it('produces empty entries when hashes match', () => {
    const result = computeSessionDiff(
      { 'QRY-001': 'hash1' },
      { 'QRY-001': 'hash1' }
    );

    assert.equal(result.entries.length, 0);
  });

  it('detects modified when hash changes', () => {
    const result = computeSessionDiff(
      { 'QRY-001': 'hashOld' },
      { 'QRY-001': 'hashNew' }
    );

    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].diffKind, 'modified');
    assert.equal(result.entries[0].artifactId, 'QRY-001');
    assert.equal(result.entries[0].artifactType, 'query');
  });

  it('detects removed when key missing in current', () => {
    const result = computeSessionDiff(
      { 'QRY-001': 'hash1' },
      {}
    );

    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].diffKind, 'removed');
    assert.equal(result.entries[0].artifactId, 'QRY-001');
  });

  it('formats summary string correctly with counts', () => {
    const result = computeSessionDiff(
      { 'QRY-001': 'hashOld' },
      { 'QRY-001': 'hashNew', 'RCT-001': 'hash1', 'RCT-002': 'hash2' }
    );

    // Should have: QRY-001 modified, RCT-001 added, RCT-002 added
    assert.ok(result.summary.includes('2 added'));
    assert.ok(result.summary.includes('1 modified'));
    assert.ok(result.summary.includes('since last session'));
  });

  it('formats summary with no changes', () => {
    const result = computeSessionDiff(
      { 'QRY-001': 'same' },
      { 'QRY-001': 'same' }
    );

    assert.ok(result.summary.includes('No changes'));
  });

  it('handles mixed scenario: added, modified, and removed', () => {
    const previous = { A: 'h1', B: 'h2' };
    const current = { B: 'h3', C: 'h4' };

    const result = computeSessionDiff(previous, current);

    const added = result.entries.filter(e => e.diffKind === 'added');
    const modified = result.entries.filter(e => e.diffKind === 'modified');
    const removed = result.entries.filter(e => e.diffKind === 'removed');

    assert.equal(added.length, 1);
    assert.equal(added[0].artifactId, 'C');

    assert.equal(modified.length, 1);
    assert.equal(modified[0].artifactId, 'B');

    assert.equal(removed.length, 1);
    assert.equal(removed[0].artifactId, 'A');
  });

  it('entries have valid timestamp strings', () => {
    const result = computeSessionDiff({}, { 'QRY-001': 'hash1' });

    assert.equal(result.entries.length, 1);
    assert.equal(typeof result.entries[0].timestamp, 'string');
    // Should be a valid ISO date string
    assert.ok(result.entries[0].timestamp.length > 0);
  });

  it('infers artifact type from ID prefix', () => {
    const result = computeSessionDiff(
      {},
      { 'QRY-001': 'h1', 'RCT-002': 'h2', 'HYP-03': 'h3', 'MISSION': 'h4' }
    );

    const typeMap = {};
    for (const entry of result.entries) {
      typeMap[entry.artifactId] = entry.artifactType;
    }

    assert.equal(typeMap['QRY-001'], 'query');
    assert.equal(typeMap['RCT-002'], 'receipt');
    assert.equal(typeMap['HYP-03'], 'hypothesis');
    assert.equal(typeMap['MISSION'], 'mission');
  });
});

// ---------------------------------------------------------------------------
// computeArtifactHashes tests
// ---------------------------------------------------------------------------

describe('computeArtifactHashes', () => {

  it('produces a record with artifact IDs as keys', () => {
    // Create a mock store with queries and receipts
    const emitter = new vscode.EventEmitter();
    const queries = new Map([
      ['QRY-001', {
        status: 'loaded',
        data: {
          queryId: 'QRY-001',
          contentHash: 'qhash1',
          templateCount: 2,
        },
      }],
    ]);
    const receipts = new Map([
      ['RCT-001', {
        status: 'loaded',
        data: {
          receiptId: 'RCT-001',
          contentHash: 'rhash1',
        },
      }],
    ]);

    const mockStore = {
      onDidChange: emitter.event,
      getQueries: () => queries,
      getReceipts: () => receipts,
      getHunt: () => ({
        mission: {
          status: 'loaded',
          data: { signal: 'test-signal', owner: 'o', opened: 'd', mode: 'case', scope: 's' },
        },
        hypotheses: {
          status: 'loaded',
          data: {
            active: [{ status: 'Open' }],
            parked: [],
            disproved: [],
          },
        },
        state: {
          status: 'loaded',
          data: { lastActivity: '2026-03-29' },
        },
        huntMap: {
          status: 'loaded',
          data: { overview: '', phases: [] },
        },
      }),
    };

    const hashes = computeArtifactHashes(mockStore);

    assert.equal(typeof hashes, 'object');
    assert.equal(hashes['QRY-001'], 'qhash1');
    assert.equal(hashes['RCT-001'], 'rhash1');
    assert.equal(hashes['MISSION'], 'test-signal');
    assert.ok('HYPOTHESES' in hashes);
    assert.ok('STATE' in hashes);
    assert.equal(hashes['STATE'], '2026-03-29');
  });

  it('returns empty record when store has no artifacts', () => {
    const emitter = new vscode.EventEmitter();
    const mockStore = {
      onDidChange: emitter.event,
      getQueries: () => new Map(),
      getReceipts: () => new Map(),
      getHunt: () => null,
    };

    const hashes = computeArtifactHashes(mockStore);
    assert.deepEqual(hashes, {});
  });
});
