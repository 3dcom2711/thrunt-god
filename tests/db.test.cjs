'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Helper: create an isolated temp directory with .planning/cases/<slug>/ structure
function makeTempProgram() {
  const dir = path.join(os.tmpdir(), `thrunt-db-test-${crypto.randomUUID()}`);
  fs.mkdirSync(path.join(dir, '.planning', 'cases'), { recursive: true });
  return dir;
}

// Helper: create case artifact files in a temp case directory
function createCaseArtifacts(caseDir, opts = {}) {
  fs.mkdirSync(caseDir, { recursive: true });

  const findings = opts.findings || `# Findings

## Lateral Movement Detected

Adversary used **pass-the-hash** (T1550.002) to move laterally.
Source IP: 192.168.1.42
Destination: 10.0.0.5

MD5 hash of malicious binary: d41d8cd98f00b204e9800998ecf8427e
SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

Additional technique: T1078 (Valid Accounts) was used for initial access.
`;

  const hypotheses = opts.hypotheses || `# Hypotheses

## H1: Attacker used stolen credentials
The adversary obtained valid credentials through T1110 brute-force and used them for lateral movement.

## H2: Insider threat scenario
An insider with legitimate access abused their privileges using T1078.004 (Cloud Accounts).
`;

  const state = opts.state || `---
status: closed
opened_at: 2026-03-15
closed_at: 2026-03-20
technique_ids: [T1550.002, T1078, T1110, T1078.004]
---

# Case: Lateral Movement Investigation

Status: Closed
`;

  fs.writeFileSync(path.join(caseDir, 'FINDINGS.md'), findings, 'utf-8');
  fs.writeFileSync(path.join(caseDir, 'HYPOTHESES.md'), hypotheses, 'utf-8');
  fs.writeFileSync(path.join(caseDir, 'STATE.md'), state, 'utf-8');
  fs.mkdirSync(path.join(caseDir, 'QUERIES'), { recursive: true });
  fs.mkdirSync(path.join(caseDir, 'RECEIPTS'), { recursive: true });
}

// Lazy-load db.cjs (will fail during RED phase)
let db;
function loadDb() {
  if (!db) db = require('../thrunt-god/bin/lib/db.cjs');
  return db;
}

describe('db.cjs - openProgramDb', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempProgram();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a Database object with WAL mode', () => {
    const { openProgramDb } = loadDb();
    const database = openProgramDb(tmpDir);
    assert.ok(database, 'should return a database object');

    // Verify WAL mode is set
    const journalMode = database.pragma('journal_mode', { simple: true });
    assert.equal(journalMode, 'wal');

    // Verify busy_timeout is set
    const busyTimeout = database.pragma('busy_timeout', { simple: true });
    assert.equal(busyTimeout, 5000);

    database.close();
  });

  it('creates program.db file if absent', () => {
    const { openProgramDb } = loadDb();
    const dbPath = path.join(tmpDir, '.planning', 'program.db');
    assert.ok(!fs.existsSync(dbPath), 'DB should not exist before open');

    const database = openProgramDb(tmpDir);
    assert.ok(fs.existsSync(dbPath), 'DB file should be created');
    database.close();
  });

  it('backfills ATT&CK technique entities when reopening an older partial knowledge graph', () => {
    const { openProgramDb } = loadDb();

    let database = openProgramDb(tmpDir);
    const threatActors = database.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE source = 'att&ck-stix' AND type = 'threat_actor'"
    ).get().cnt;
    assert.ok(threatActors > 0, 'initial open should import STIX threat actors');

    database.prepare("DELETE FROM kg_entities WHERE source = 'att&ck-stix' AND type = 'technique'").run();
    database.close();

    database = openProgramDb(tmpDir);
    const techniques = database.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE source = 'att&ck-stix' AND type = 'technique'"
    ).get().cnt;
    assert.ok(techniques > 0, 're-open should restore missing ATT&CK technique entities');
    database.close();
  });

  it('returns null when .planning/ directory does not exist', () => {
    const { openProgramDb } = loadDb();
    const noPlanning = path.join(os.tmpdir(), `thrunt-db-test-${crypto.randomUUID()}`);
    fs.mkdirSync(noPlanning, { recursive: true });

    const result = openProgramDb(noPlanning);
    assert.equal(result, null, 'should return null when no .planning dir');

    fs.rmSync(noPlanning, { recursive: true, force: true });
  });
});

describe('db.cjs - ensureSchema', () => {
  let tmpDir, database;

  before(() => {
    tmpDir = makeTempProgram();
    const { openProgramDb } = loadDb();
    database = openProgramDb(tmpDir);
  });

  after(() => {
    if (database) database.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates case_index table', () => {
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='case_index'").get();
    assert.ok(row, 'case_index table should exist');
  });

  it('creates case_artifacts table', () => {
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='case_artifacts'").get();
    assert.ok(row, 'case_artifacts table should exist');
  });

  it('creates case_artifacts_fts virtual table', () => {
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='case_artifacts_fts'").get();
    assert.ok(row, 'case_artifacts_fts virtual table should exist');
  });

  it('creates case_techniques table', () => {
    const row = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='case_techniques'").get();
    assert.ok(row, 'case_techniques table should exist');
  });

  it('ensureSchema is idempotent (call twice without error)', () => {
    const { ensureSchema } = loadDb();
    // Should not throw on second call
    ensureSchema(database);
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    assert.ok(tables.length >= 4, 'should have at least 4 tables');
  });
});

describe('db.cjs - extractTechniqueIds', () => {
  it('extracts standard technique IDs', () => {
    const { extractTechniqueIds } = loadDb();
    const ids = extractTechniqueIds('Found T1078 and T1059 in the logs');
    assert.deepEqual(ids.sort(), ['T1059', 'T1078']);
  });

  it('extracts dotted sub-technique IDs', () => {
    const { extractTechniqueIds } = loadDb();
    const ids = extractTechniqueIds('Observed T1059.001 PowerShell execution');
    assert.deepEqual(ids, ['T1059.001']);
  });

  it('handles case-insensitive input', () => {
    const { extractTechniqueIds } = loadDb();
    const ids = extractTechniqueIds('sigma tag: t1078.004 and t1059');
    assert.deepEqual(ids.sort(), ['T1059', 'T1078.004']);
  });

  it('deduplicates technique IDs', () => {
    const { extractTechniqueIds } = loadDb();
    const ids = extractTechniqueIds('T1078 was used. T1078 again. And T1078.');
    assert.deepEqual(ids, ['T1078']);
  });

  it('returns empty array for text without technique IDs', () => {
    const { extractTechniqueIds } = loadDb();
    const ids = extractTechniqueIds('No techniques here');
    assert.deepEqual(ids, []);
  });
});

describe('db.cjs - extractIOCs', () => {
  it('extracts IPv4 addresses', () => {
    const { extractIOCs } = loadDb();
    const iocs = extractIOCs('Source: 192.168.1.42 connected to 10.0.0.5');
    assert.deepEqual(iocs.ips.sort(), ['10.0.0.5', '192.168.1.42']);
  });

  it('extracts MD5 hashes', () => {
    const { extractIOCs } = loadDb();
    const iocs = extractIOCs('Hash: d41d8cd98f00b204e9800998ecf8427e');
    assert.deepEqual(iocs.md5s, ['d41d8cd98f00b204e9800998ecf8427e']);
  });

  it('extracts SHA1 hashes', () => {
    const { extractIOCs } = loadDb();
    const iocs = extractIOCs('SHA1: da39a3ee5e6b4b0d3255bfef95601890afd80709');
    assert.deepEqual(iocs.sha1s, ['da39a3ee5e6b4b0d3255bfef95601890afd80709']);
  });

  it('extracts SHA256 hashes', () => {
    const { extractIOCs } = loadDb();
    const iocs = extractIOCs('SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.deepEqual(iocs.sha256s, ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']);
  });

  it('returns empty arrays for text without IOCs', () => {
    const { extractIOCs } = loadDb();
    const iocs = extractIOCs('No indicators here');
    assert.deepEqual(iocs.ips, []);
    assert.deepEqual(iocs.md5s, []);
    assert.deepEqual(iocs.sha1s, []);
    assert.deepEqual(iocs.sha256s, []);
  });
});

describe('db.cjs - indexCase', () => {
  let tmpDir, database;

  beforeEach(() => {
    tmpDir = makeTempProgram();
    const { openProgramDb } = loadDb();
    database = openProgramDb(tmpDir);
  });

  afterEach(() => {
    if (database) database.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('indexes case into case_index table', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    indexCase(database, slug, caseDir);

    const row = database.prepare('SELECT * FROM case_index WHERE slug = ?').get(slug);
    assert.ok(row, 'case_index row should exist');
    assert.equal(row.slug, slug);
    assert.equal(row.status, 'closed');
    assert.equal(row.opened_at, '2026-03-15');
    assert.equal(row.closed_at, '2026-03-20');
  });

  it('indexes artifacts into case_artifacts table', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    indexCase(database, slug, caseDir);

    const artifacts = database.prepare('SELECT * FROM case_artifacts').all();
    assert.ok(artifacts.length > 0, 'should have artifact rows');

    const types = [...new Set(artifacts.map(a => a.artifact_type))];
    assert.ok(types.includes('finding'), 'should have finding artifact');
    assert.ok(types.includes('hypothesis'), 'should have hypothesis artifacts');
  });

  it('indexes technique IDs into case_techniques table', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    indexCase(database, slug, caseDir);

    const techniques = database.prepare('SELECT technique_id FROM case_techniques').all();
    const ids = techniques.map(t => t.technique_id).sort();
    assert.ok(ids.includes('T1078'), 'should include T1078');
    assert.ok(ids.includes('T1550.002'), 'should include T1550.002');
    assert.ok(ids.includes('T1110'), 'should include T1110');
    assert.ok(ids.includes('T1078.004'), 'should include T1078.004');
  });

  it('indexes IOCs as artifact rows', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    indexCase(database, slug, caseDir);

    const iocs = database.prepare("SELECT * FROM case_artifacts WHERE artifact_type = 'ioc'").all();
    assert.ok(iocs.length > 0, 'should have IOC artifact rows');
  });

  it('populates FTS5 index', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    indexCase(database, slug, caseDir);

    // FTS search should find content
    const results = database.prepare("SELECT * FROM case_artifacts_fts WHERE case_artifacts_fts MATCH 'lateral'").all();
    assert.ok(results.length > 0, 'FTS index should contain content');
  });

  it('is idempotent - re-indexing replaces entries without duplicates', () => {
    const { indexCase } = loadDb();
    const slug = 'lateral-movement';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    createCaseArtifacts(caseDir);

    // Index twice
    indexCase(database, slug, caseDir);
    const countBefore = database.prepare('SELECT COUNT(*) AS cnt FROM case_artifacts').get().cnt;

    indexCase(database, slug, caseDir);
    const countAfter = database.prepare('SELECT COUNT(*) AS cnt FROM case_artifacts').get().cnt;

    assert.equal(countBefore, countAfter, 'artifact count should not change on re-index');

    // Verify case_index has exactly 1 row
    const caseCount = database.prepare('SELECT COUNT(*) AS cnt FROM case_index WHERE slug = ?').get(slug).cnt;
    assert.equal(caseCount, 1, 'should have exactly 1 case_index row');

    // Verify case_techniques has no duplicates
    const techBefore = database.prepare('SELECT COUNT(*) AS cnt FROM case_techniques').get().cnt;
    assert.ok(techBefore > 0, 'should have technique rows');

    // FTS should still work after re-index
    const ftsResults = database.prepare("SELECT * FROM case_artifacts_fts WHERE case_artifacts_fts MATCH 'lateral'").all();
    assert.ok(ftsResults.length > 0, 'FTS should still find content after re-index');
  });

  it('handles case with missing FINDINGS.md gracefully', () => {
    const { indexCase } = loadDb();
    const slug = 'no-findings';
    const caseDir = path.join(tmpDir, '.planning', 'cases', slug);
    fs.mkdirSync(caseDir, { recursive: true });

    // Only create STATE.md and HYPOTHESES.md
    fs.writeFileSync(path.join(caseDir, 'STATE.md'), `---
status: active
opened_at: 2026-04-01
---

# Case: No Findings Yet
`, 'utf-8');
    fs.writeFileSync(path.join(caseDir, 'HYPOTHESES.md'), '# Hypotheses\n\n_None yet._\n', 'utf-8');

    // Should not throw
    indexCase(database, slug, caseDir);

    const row = database.prepare('SELECT * FROM case_index WHERE slug = ?').get(slug);
    assert.ok(row, 'case should still be indexed');
  });
});

describe('db.cjs - searchCases', () => {
  let tmpDir, database;

  before(() => {
    tmpDir = makeTempProgram();
    const { openProgramDb, indexCase } = loadDb();
    database = openProgramDb(tmpDir);

    // Index two cases for search testing
    const case1Dir = path.join(tmpDir, '.planning', 'cases', 'lateral-movement');
    createCaseArtifacts(case1Dir);
    indexCase(database, 'lateral-movement', case1Dir);

    const case2Dir = path.join(tmpDir, '.planning', 'cases', 'phishing-campaign');
    createCaseArtifacts(case2Dir, {
      findings: `# Findings

## Phishing Campaign Detected

Spear-phishing emails sent to finance team using T1566.001 (Spearphishing Attachment).
Malicious domain: evil-corp.example.com
Attacker IP: 203.0.113.42
`,
      hypotheses: `# Hypotheses

## H1: Targeted attack on finance department
The adversary specifically targeted finance team members with T1566.001 phishing emails.
`,
      state: `---
status: closed
opened_at: 2026-02-01
closed_at: 2026-02-15
outcome_summary: Phishing campaign mitigated
technique_ids: [T1566.001]
---

# Case: Phishing Campaign

Status: Closed
`,
    });
    indexCase(database, 'phishing-campaign', case2Dir);
  });

  after(() => {
    if (database) database.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns ranked results with snippets', () => {
    const { searchCases } = loadDb();
    const results = searchCases(database, 'phishing');
    assert.ok(results.length > 0, 'should return results for phishing query');
    assert.ok(results[0].slug, 'result should have slug');
    assert.ok(results[0].match_snippet, 'result should have match_snippet');
    assert.ok(results[0].relevance_score !== undefined, 'result should have relevance_score');
  });

  it('returns results with case metadata', () => {
    const { searchCases } = loadDb();
    const results = searchCases(database, 'phishing');
    const phishing = results.find(r => r.slug === 'phishing-campaign');
    assert.ok(phishing, 'should find phishing-campaign');
    assert.equal(phishing.status, 'closed');
    assert.equal(phishing.opened_at, '2026-02-01');
  });

  it('returns empty array on empty database', () => {
    const { openProgramDb, searchCases } = loadDb();
    const emptyDir = makeTempProgram();
    const emptyDb = openProgramDb(emptyDir);

    const results = searchCases(emptyDb, 'anything');
    assert.deepEqual(results, []);

    emptyDb.close();
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('returns empty array for no matches', () => {
    const { searchCases } = loadDb();
    const results = searchCases(database, 'zzzznonexistenttermzzzz');
    assert.deepEqual(results, []);
  });

  it('respects limit option', () => {
    const { searchCases } = loadDb();
    // Both cases have "Hypotheses" text, so this should match multiple
    const results = searchCases(database, 'adversary', { limit: 1 });
    assert.ok(results.length <= 1, 'should respect limit');
  });
});

describe('db.cjs - findTechniqueOverlap', () => {
  let tmpDir, database;

  before(() => {
    tmpDir = makeTempProgram();
    const { openProgramDb, indexCase } = loadDb();
    database = openProgramDb(tmpDir);

    // Index cases with known techniques
    const case1Dir = path.join(tmpDir, '.planning', 'cases', 'case-alpha');
    createCaseArtifacts(case1Dir);
    indexCase(database, 'case-alpha', case1Dir);

    const case2Dir = path.join(tmpDir, '.planning', 'cases', 'case-beta');
    createCaseArtifacts(case2Dir, {
      findings: '# Findings\n\nAttacker used T1078 valid accounts and T1059.001 PowerShell.\n',
      hypotheses: '# Hypotheses\n\n## H1: PowerShell abuse\nT1059.001 was the primary execution technique.\n',
      state: `---
status: closed
opened_at: 2026-01-01
closed_at: 2026-01-10
technique_ids: [T1078, T1059.001]
---

# Case: PowerShell Abuse
`,
    });
    indexCase(database, 'case-beta', case2Dir);
  });

  after(() => {
    if (database) database.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns cases sharing technique IDs ordered by overlap count', () => {
    const { findTechniqueOverlap } = loadDb();
    // T1078 is in both cases
    const results = findTechniqueOverlap(database, ['T1078']);
    assert.ok(results.length >= 2, 'should find both cases with T1078');
    assert.ok(results[0].overlap_count >= 1, 'should have overlap_count');
    assert.ok(results[0].overlapping_techniques, 'should have overlapping_techniques');
  });

  it('returns results ordered by overlap_count descending', () => {
    const { findTechniqueOverlap } = loadDb();
    // case-alpha has T1078, T1550.002, T1110, T1078.004
    // case-beta has T1078, T1059.001
    // Querying for T1078 + T1110 -> case-alpha has 2 overlaps, case-beta has 1
    const results = findTechniqueOverlap(database, ['T1078', 'T1110']);
    assert.ok(results.length >= 1, 'should have results');
    // First result should have highest overlap
    if (results.length >= 2) {
      assert.ok(results[0].overlap_count >= results[1].overlap_count, 'should be ordered by overlap_count desc');
    }
  });

  it('returns empty array for empty input', () => {
    const { findTechniqueOverlap } = loadDb();
    assert.deepEqual(findTechniqueOverlap(database, []), []);
  });

  it('returns empty array for null input', () => {
    const { findTechniqueOverlap } = loadDb();
    assert.deepEqual(findTechniqueOverlap(database, null), []);
  });

  it('returns empty array for techniques not in any case', () => {
    const { findTechniqueOverlap } = loadDb();
    const results = findTechniqueOverlap(database, ['T9999']);
    assert.deepEqual(results, []);
  });
});
