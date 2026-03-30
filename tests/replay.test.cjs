/**
 * THRUNT Tools Tests - Replay Engine
 *
 * Tests for ReplaySpec schema, createReplaySpec, parseShiftDuration,
 * applyMutations, and resolveReplaySource.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ─── 1. ReplaySpec Schema & createReplaySpec ─────────────────────────────────

describe('createReplaySpec', () => {
  const { createReplaySpec, ReplaySpecSchema } = require('../thrunt-god/bin/lib/replay.cjs');

  test('throws Zod validation error when source is missing', () => {
    assert.throws(() => createReplaySpec({}), (err) => {
      // Zod errors have an issues array
      return err.issues !== undefined || err.message.includes('source');
    });
  });

  test('returns valid spec with auto-generated replay_id matching RPL pattern', () => {
    const spec = createReplaySpec({
      source: { type: 'query', ids: ['QRY-123'] },
    });
    assert.strictEqual(spec.version, '1.0');
    assert.match(spec.replay_id, /^RPL-\d{14}-[A-Z0-9]{8}$/);
    assert.strictEqual(spec.source.type, 'query');
    assert.deepStrictEqual(spec.source.ids, ['QRY-123']);
  });

  test('preserves explicit replay_id', () => {
    const spec = createReplaySpec({
      replay_id: 'RPL-20260330000000-ABCD1234',
      source: { type: 'query', ids: ['QRY-123'] },
    });
    assert.strictEqual(spec.replay_id, 'RPL-20260330000000-ABCD1234');
  });

  test('rejects unknown source.type', () => {
    assert.throws(() => createReplaySpec({
      source: { type: 'invalid', ids: ['QRY-123'] },
    }));
  });

  test('rejects empty ids array', () => {
    assert.throws(() => createReplaySpec({
      source: { type: 'query', ids: [] },
    }));
  });

  test('creates valid spec with all mutation fields', () => {
    const spec = createReplaySpec({
      source: { type: 'query', ids: ['QRY-123'] },
      mutations: {
        time_window: {
          mode: 'absolute',
          start: '2026-03-01T00:00:00Z',
          end: '2026-03-08T00:00:00Z',
        },
        connector: { id: 'elastic', profile: 'production' },
        ioc_injection: {
          mode: 'append',
          iocs: [{ type: 'ip', value: '10.0.0.1' }],
        },
        parameters: { tenant: 'prod' },
        execution: { dry_run: true, timeout_ms: 30000 },
      },
      diff: { enabled: true, mode: 'full' },
      evidence: {
        tags: ['replay:test'],
        lineage: {
          original_query_ids: ['QRY-123'],
          replay_reason: 'Testing',
        },
      },
    });
    assert.strictEqual(spec.version, '1.0');
    assert.strictEqual(spec.mutations.time_window.mode, 'absolute');
    assert.strictEqual(spec.mutations.connector.id, 'elastic');
    assert.strictEqual(spec.mutations.execution.dry_run, true);
    assert.strictEqual(spec.diff.enabled, true);
    assert.strictEqual(spec.evidence.lineage.replay_reason, 'Testing');
  });
});

// ─── 2. parseShiftDuration ───────────────────────────────────────────────────

describe('parseShiftDuration', () => {
  const { parseShiftDuration } = require('../thrunt-god/bin/lib/replay.cjs');

  test('parses 7d to 604800000', () => {
    assert.strictEqual(parseShiftDuration('7d'), 604800000);
  });

  test('parses -24h to -86400000', () => {
    assert.strictEqual(parseShiftDuration('-24h'), -86400000);
  });

  test('parses 30m to 1800000', () => {
    assert.strictEqual(parseShiftDuration('30m'), 1800000);
  });

  test('parses -2d to -172800000', () => {
    assert.strictEqual(parseShiftDuration('-2d'), -172800000);
  });

  test('throws on invalid input', () => {
    assert.throws(() => parseShiftDuration('invalid'), /Invalid shift duration/);
  });
});

// ─── 3. applyMutations ──────────────────────────────────────────────────────

describe('applyMutations', () => {
  const { applyMutations } = require('../thrunt-god/bin/lib/replay.cjs');
  const { createQuerySpec } = require('../thrunt-god/bin/lib/runtime.cjs');

  function makeTestSpec(overrides = {}) {
    return createQuerySpec({
      connector: { id: 'splunk', profile: 'default' },
      dataset: { kind: 'events' },
      time_window: {
        start: '2026-03-01T00:00:00.000Z',
        end: '2026-03-02T00:00:00.000Z',
      },
      query: { statement: 'index=main | head 10' },
      ...overrides,
    });
  }

  test('absolute mode sets new start/end', () => {
    const original = makeTestSpec();
    const result = applyMutations(original, {
      time_window: {
        mode: 'absolute',
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-04-02T00:00:00.000Z',
      },
    });
    assert.strictEqual(result.time_window.start, '2026-04-01T00:00:00.000Z');
    assert.strictEqual(result.time_window.end, '2026-04-02T00:00:00.000Z');
  });

  test('shift mode applies shift_ms delta to original time_window', () => {
    const original = makeTestSpec();
    const shiftMs = 86400000; // +1 day
    const result = applyMutations(original, {
      time_window: { mode: 'shift', shift_ms: shiftMs },
    });
    assert.strictEqual(result.time_window.start, '2026-03-02T00:00:00.000Z');
    assert.strictEqual(result.time_window.end, '2026-03-03T00:00:00.000Z');
  });

  test('lookback mode computes start from lookback_minutes relative to now', () => {
    const original = makeTestSpec();
    const now = new Date('2026-03-30T12:00:00.000Z');
    const result = applyMutations(original, {
      time_window: { mode: 'lookback', lookback_minutes: 60 },
    }, now);
    assert.strictEqual(result.time_window.end, '2026-03-30T12:00:00.000Z');
    assert.strictEqual(result.time_window.start, '2026-03-30T11:00:00.000Z');
  });

  test('preserves all non-mutated QuerySpec fields', () => {
    const original = makeTestSpec();
    const result = applyMutations(original, {
      time_window: {
        mode: 'absolute',
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-04-02T00:00:00.000Z',
      },
    });
    assert.strictEqual(result.connector.id, 'splunk');
    assert.strictEqual(result.dataset.kind, 'events');
    assert.strictEqual(result.query.statement, 'index=main | head 10');
  });

  test('connector mutation changes connector.id and connector.profile', () => {
    const original = makeTestSpec();
    const result = applyMutations(original, {
      connector: { id: 'elastic', profile: 'production' },
    });
    assert.strictEqual(result.connector.id, 'elastic');
    assert.strictEqual(result.connector.profile, 'production');
  });

  test('parameters mutation merges into spec.parameters', () => {
    const original = makeTestSpec({ parameters: { existing: 'value' } });
    const result = applyMutations(original, {
      parameters: { tenant: 'prod-us' },
    });
    assert.strictEqual(result.parameters.existing, 'value');
    assert.strictEqual(result.parameters.tenant, 'prod-us');
  });

  test('execution mutation merges into spec.execution', () => {
    const original = makeTestSpec();
    const result = applyMutations(original, {
      execution: { dry_run: true, timeout_ms: 5000 },
    });
    assert.strictEqual(result.execution.dry_run, true);
    assert.strictEqual(result.execution.timeout_ms, 5000);
  });

  test('result passes createQuerySpec() validation', () => {
    const original = makeTestSpec();
    const result = applyMutations(original, {
      time_window: {
        mode: 'absolute',
        start: '2026-04-01T00:00:00.000Z',
        end: '2026-04-02T00:00:00.000Z',
      },
    });
    // Should not throw -- result is a valid QuerySpec
    const validated = createQuerySpec(result);
    assert.ok(validated.query_id);
  });

  test('throws when absolute mutation makes start >= end', () => {
    const original = makeTestSpec();
    // Absolute mutation with start after end
    assert.throws(() => applyMutations(original, {
      time_window: {
        mode: 'absolute',
        start: '2026-04-02T00:00:00.000Z',
        end: '2026-04-01T00:00:00.000Z',
      },
    }), /time_window\.start must be earlier|Invalid QuerySpec|start/i);
  });
});
