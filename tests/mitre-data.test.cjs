'use strict';

/**
 * MITRE ATT&CK data module tests (TDD RED phase).
 *
 * Covers: data loading, ID search, name search, tactic filter,
 * platform filter, multi-select parsing, and getAllTactics.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  loadAttackData,
  getTechniqueById,
  searchTechniques,
  filterByTactic,
  filterByPlatform,
  parseMultiSelect,
  getAllTactics,
} = require('../thrunt-god/bin/lib/mitre-data.cjs');

describe('loadAttackData', () => {
  it('returns object with version, generated, and techniques array', () => {
    const data = loadAttackData();
    assert.strictEqual(typeof data.version, 'string');
    assert.strictEqual(typeof data.generated, 'string');
    assert.ok(Array.isArray(data.techniques));
  });

  it('techniques array has 50+ entries', () => {
    const data = loadAttackData();
    assert.ok(data.techniques.length >= 50, `Expected 50+ techniques, got ${data.techniques.length}`);
  });

  it('each technique has required fields', () => {
    const data = loadAttackData();
    for (const t of data.techniques) {
      assert.strictEqual(typeof t.id, 'string', `Missing id`);
      assert.strictEqual(typeof t.name, 'string', `Missing name for ${t.id}`);
      assert.strictEqual(typeof t.tactic, 'string', `Missing tactic for ${t.id}`);
      assert.strictEqual(typeof t.description, 'string', `Missing description for ${t.id}`);
      assert.ok(Array.isArray(t.platforms), `Missing platforms for ${t.id}`);
      assert.ok(Array.isArray(t.data_sources), `Missing data_sources for ${t.id}`);
    }
  });
});

describe('getTechniqueById', () => {
  it('returns Valid Accounts for T1078', () => {
    const t = getTechniqueById('T1078');
    assert.ok(t, 'Expected T1078 to exist');
    assert.strictEqual(t.name, 'Valid Accounts');
  });

  it('returns sub-technique with parent_id for T1078.002', () => {
    const t = getTechniqueById('T1078.002');
    assert.ok(t, 'Expected T1078.002 to exist');
    assert.strictEqual(t.id, 'T1078.002');
    assert.strictEqual(t.name, 'Domain Accounts');
    assert.strictEqual(t.parent_id, 'T1078');
  });

  it('returns null for T9999', () => {
    const t = getTechniqueById('T9999');
    assert.strictEqual(t, null);
  });

  it('works case-insensitive', () => {
    const t = getTechniqueById('t1078');
    assert.ok(t, 'Expected case-insensitive match');
    assert.strictEqual(t.name, 'Valid Accounts');
  });
});

describe('searchTechniques', () => {
  it('returns array containing T1078 for "Valid Accounts"', () => {
    const results = searchTechniques('Valid Accounts');
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.id === 'T1078'));
  });

  it('returns exact ID match for "T1078"', () => {
    const results = searchTechniques('T1078');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].id, 'T1078');
  });

  it('returns empty array for "xyznonexistent"', () => {
    const results = searchTechniques('xyznonexistent');
    assert.strictEqual(results.length, 0);
  });
});

describe('filterByTactic', () => {
  it('returns non-empty array for "Initial Access"', () => {
    const results = filterByTactic('Initial Access');
    assert.ok(results.length > 0);
  });

  it('all results contain "Initial Access" in tactic', () => {
    const results = filterByTactic('Initial Access');
    for (const r of results) {
      assert.ok(r.tactic.toLowerCase().includes('initial access'), `${r.id} tactic "${r.tactic}" missing "Initial Access"`);
    }
  });

  it('returns empty array for nonexistent tactic', () => {
    const results = filterByTactic('Nonexistent Tactic');
    assert.strictEqual(results.length, 0);
  });
});

describe('filterByPlatform', () => {
  it('returns non-empty array for "Cloud"', () => {
    const results = filterByPlatform('Cloud');
    assert.ok(results.length > 0);
  });

  it('returns non-empty array for "Windows"', () => {
    const results = filterByPlatform('Windows');
    assert.ok(results.length > 0);
  });
});

describe('parseMultiSelect', () => {
  it('parses comma-separated ATT&CK IDs', () => {
    const ids = parseMultiSelect('T1078,T1195');
    assert.deepStrictEqual(ids, ['T1078', 'T1195']);
  });

  it('parses numeric indices into results array', () => {
    const results = [
      { id: 'T1195', name: 'Supply Chain Compromise' },
      { id: 'T1195.001', name: 'Compromise Software Dependencies' },
      { id: 'T1195.002', name: 'Compromise Software Supply Chain' },
    ];
    const ids = parseMultiSelect('1,3', results);
    assert.deepStrictEqual(ids, ['T1195', 'T1195.002']);
  });

  it('handles whitespace', () => {
    const ids = parseMultiSelect(' T1078 , T1195 ');
    assert.deepStrictEqual(ids, ['T1078', 'T1195']);
  });

  it('"a" or "all" returns all result IDs', () => {
    const results = [
      { id: 'T1195', name: 'Supply Chain Compromise' },
      { id: 'T1195.001', name: 'Compromise Software Dependencies' },
    ];
    const ids = parseMultiSelect('a', results);
    assert.deepStrictEqual(ids, ['T1195', 'T1195.001']);

    const ids2 = parseMultiSelect('all', results);
    assert.deepStrictEqual(ids2, ['T1195', 'T1195.001']);
  });
});

describe('getAllTactics', () => {
  it('returns sorted array of unique tactic names', () => {
    const tactics = getAllTactics();
    assert.ok(Array.isArray(tactics));
    // Check sorted
    const sorted = [...tactics].sort();
    assert.deepStrictEqual(tactics, sorted);
    // Check uniqueness
    assert.strictEqual(tactics.length, new Set(tactics).size);
  });

  it('contains core ATT&CK tactics', () => {
    const tactics = getAllTactics();
    assert.ok(tactics.includes('Initial Access'), 'Missing "Initial Access"');
    assert.ok(tactics.includes('Execution'), 'Missing "Execution"');
    assert.ok(tactics.includes('Persistence'), 'Missing "Persistence"');
  });
});
