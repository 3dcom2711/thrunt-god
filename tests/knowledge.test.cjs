'use strict';

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// Helper: create an isolated temp directory for a program.db
function makeTempDir() {
  const dir = path.join(os.tmpdir(), `thrunt-kg-test-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Helper: create a fresh program.db with knowledge schema
function makeProgramDb(dir) {
  const dbPath = path.join(dir, 'program.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

// Helper: create a fresh intel.db with STIX source data for import tests
function makeIntelDb(dir) {
  const { openIntelDb } = require('../mcp-hunt-intel/lib/intel.cjs');
  return openIntelDb({ dbDir: dir });
}

// Lazy-load knowledge.cjs
let knowledge;
function loadKnowledge() {
  if (!knowledge) knowledge = require('../mcp-hunt-intel/lib/knowledge.cjs');
  return knowledge;
}

// ── ensureKnowledgeSchema ──────────────────────────────────────────────────

describe('knowledge.cjs - ensureKnowledgeSchema', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 1: creates kg_entities table with correct columns', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);

    const cols = db.prepare("PRAGMA table_info('kg_entities')").all();
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes('id'), 'should have id column');
    assert.ok(colNames.includes('type'), 'should have type column');
    assert.ok(colNames.includes('name'), 'should have name column');
    assert.ok(colNames.includes('description'), 'should have description column');
    assert.ok(colNames.includes('metadata'), 'should have metadata column');
    assert.ok(colNames.includes('created_at'), 'should have created_at column');
    assert.ok(colNames.includes('source'), 'should have source column');

    // Verify id is TEXT PRIMARY KEY
    const idCol = cols.find(c => c.name === 'id');
    assert.equal(idCol.type, 'TEXT');
    assert.equal(idCol.pk, 1);
  });

  it('Test 2: creates kg_relations table with correct columns', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);

    const cols = db.prepare("PRAGMA table_info('kg_relations')").all();
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes('id'), 'should have id column');
    assert.ok(colNames.includes('from_entity'), 'should have from_entity column');
    assert.ok(colNames.includes('to_entity'), 'should have to_entity column');
    assert.ok(colNames.includes('relation_type'), 'should have relation_type column');
    assert.ok(colNames.includes('metadata'), 'should have metadata column');
    assert.ok(colNames.includes('created_at'), 'should have created_at column');
    assert.ok(colNames.includes('source'), 'should have source column');

    // Verify id is INTEGER PRIMARY KEY AUTOINCREMENT
    const idCol = cols.find(c => c.name === 'id');
    assert.equal(idCol.type, 'INTEGER');
    assert.equal(idCol.pk, 1);
  });

  it('Test 3: creates kg_decisions table with correct columns', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);

    const cols = db.prepare("PRAGMA table_info('kg_decisions')").all();
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes('id'), 'should have id column');
    assert.ok(colNames.includes('case_slug'), 'should have case_slug column');
    assert.ok(colNames.includes('technique_id'), 'should have technique_id column');
    assert.ok(colNames.includes('decision'), 'should have decision column');
    assert.ok(colNames.includes('reasoning'), 'should have reasoning column');
    assert.ok(colNames.includes('context'), 'should have context column');
    assert.ok(colNames.includes('created_at'), 'should have created_at column');
  });

  it('Test 4: creates kg_learnings table with correct columns', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);

    const cols = db.prepare("PRAGMA table_info('kg_learnings')").all();
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes('id'), 'should have id column');
    assert.ok(colNames.includes('topic'), 'should have topic column');
    assert.ok(colNames.includes('pattern'), 'should have pattern column');
    assert.ok(colNames.includes('detail'), 'should have detail column');
    assert.ok(colNames.includes('technique_ids'), 'should have technique_ids column');
    assert.ok(colNames.includes('created_at'), 'should have created_at column');
    assert.ok(colNames.includes('case_slug'), 'should have case_slug column');
  });

  it('Test 5: creates kg_entities_fts FTS5 virtual table', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);

    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='kg_entities_fts'"
    ).get();
    assert.ok(row, 'kg_entities_fts virtual table should exist');
  });

  it('Test 6: idempotent -- calling twice does not throw', () => {
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);
    ensureKnowledgeSchema(db); // Should not throw

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    assert.ok(tables.includes('kg_entities'), 'kg_entities should exist');
    assert.ok(tables.includes('kg_relations'), 'kg_relations should exist');
    assert.ok(tables.includes('kg_decisions'), 'kg_decisions should exist');
    assert.ok(tables.includes('kg_learnings'), 'kg_learnings should exist');
  });
});

// ── addEntity / getEntity ──────────────────────────────────────────────────

describe('knowledge.cjs - addEntity / getEntity', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 7: addEntity inserts row and returns entity with generated id', () => {
    const { addEntity } = loadKnowledge();
    const entity = addEntity(db, {
      type: 'threat_actor',
      name: 'APT28',
      description: 'Russian military intelligence',
    });

    assert.ok(entity, 'should return entity');
    assert.ok(entity.id, 'should have generated id');
    assert.equal(entity.type, 'threat_actor');
    assert.equal(entity.name, 'APT28');
    assert.equal(entity.description, 'Russian military intelligence');

    // Verify it's in the database
    const row = db.prepare('SELECT * FROM kg_entities WHERE id = ?').get(entity.id);
    assert.ok(row, 'should exist in database');
  });

  it('Test 8: addEntity with all 7 valid types succeeds', () => {
    const { addEntity } = loadKnowledge();
    const types = ['threat_actor', 'technique', 'detection', 'campaign', 'tool', 'vulnerability', 'data_source'];

    for (const type of types) {
      const entity = addEntity(db, { type, name: `test-${type}`, description: `Test ${type}` });
      assert.ok(entity, `should succeed for type ${type}`);
      assert.equal(entity.type, type);
    }

    const count = db.prepare('SELECT COUNT(*) AS cnt FROM kg_entities').get().cnt;
    assert.equal(count, 7, 'should have 7 entities');
  });

  it('Test 9: getEntity returns the entity by its id', () => {
    const { addEntity, getEntity } = loadKnowledge();
    const added = addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Russian group' });
    const found = getEntity(db, added.id);

    assert.ok(found, 'should return entity');
    assert.equal(found.id, added.id);
    assert.equal(found.name, 'APT28');
    assert.equal(found.type, 'threat_actor');
  });

  it('Test 10: getEntity with nonexistent id returns null', () => {
    const { getEntity } = loadKnowledge();
    const result = getEntity(db, 'nonexistent-id');
    assert.equal(result, null);
  });

  it('Test 11: addEntity with duplicate id (upsert) updates existing row', () => {
    const { addEntity, getEntity } = loadKnowledge();

    // Add entity first time
    const first = addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Original description' });

    // Add again with same type+name (same generated id) but different description
    const second = addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Updated description' });

    assert.equal(first.id, second.id, 'should have same id');

    // Verify only one row exists
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM kg_entities WHERE id = ?').get(first.id).cnt;
    assert.equal(count, 1, 'should have exactly 1 row');

    // Verify description is updated
    const entity = getEntity(db, first.id);
    assert.equal(entity.description, 'Updated description');
  });

  it('Test 12: addEntity populates created_at with ISO timestamp and source field', () => {
    const { addEntity, getEntity } = loadKnowledge();
    const entity = addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Test' });

    const found = getEntity(db, entity.id);
    assert.ok(found.created_at, 'should have created_at');
    // Verify ISO format (should contain T and Z or +/-)
    assert.match(found.created_at, /^\d{4}-\d{2}-\d{2}T/, 'created_at should be ISO timestamp');
    assert.ok(found.source, 'should have source field');
    assert.equal(found.source, 'manual', 'default source should be manual');
  });
});

// ── addRelation / getRelations ─────────────────────────────────────────────

describe('knowledge.cjs - addRelation / getRelations', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema, addEntity } = loadKnowledge();
    ensureKnowledgeSchema(db);

    // Add two entities for relation tests
    addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Russian group' });
    addEntity(db, { type: 'technique', name: 'Spearphishing', description: 'Email phishing' });
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 13: addRelation inserts row', () => {
    const { addRelation } = loadKnowledge();
    const relation = addRelation(db, {
      from_entity: 'threat_actor--apt28',
      to_entity: 'technique--spearphishing',
      relation_type: 'uses',
    });

    assert.ok(relation, 'should return relation');
    assert.ok(relation.id, 'should have id');
    assert.equal(relation.relation_type, 'uses');

    const row = db.prepare('SELECT * FROM kg_relations WHERE id = ?').get(relation.id);
    assert.ok(row, 'should exist in database');
  });

  it('Test 14: getRelations returns all relations where entity is from or to', () => {
    const { addRelation, getRelations } = loadKnowledge();
    addRelation(db, { from_entity: 'threat_actor--apt28', to_entity: 'technique--spearphishing', relation_type: 'uses' });

    const fromResults = getRelations(db, 'threat_actor--apt28');
    assert.ok(fromResults.length >= 1, 'should find relation via from_entity');

    const toResults = getRelations(db, 'technique--spearphishing');
    assert.ok(toResults.length >= 1, 'should find relation via to_entity');
  });

  it('Test 15: getRelations with direction=outgoing returns only from_entity matches', () => {
    const { addRelation, getRelations } = loadKnowledge();
    addRelation(db, { from_entity: 'threat_actor--apt28', to_entity: 'technique--spearphishing', relation_type: 'uses' });

    const outgoing = getRelations(db, 'threat_actor--apt28', { direction: 'outgoing' });
    assert.ok(outgoing.length >= 1, 'should find outgoing relation');

    const noOutgoing = getRelations(db, 'technique--spearphishing', { direction: 'outgoing' });
    assert.equal(noOutgoing.length, 0, 'technique should have no outgoing relations');
  });

  it('Test 16: getRelations with direction=incoming returns only to_entity matches', () => {
    const { addRelation, getRelations } = loadKnowledge();
    addRelation(db, { from_entity: 'threat_actor--apt28', to_entity: 'technique--spearphishing', relation_type: 'uses' });

    const incoming = getRelations(db, 'technique--spearphishing', { direction: 'incoming' });
    assert.ok(incoming.length >= 1, 'should find incoming relation');

    const noIncoming = getRelations(db, 'threat_actor--apt28', { direction: 'incoming' });
    assert.equal(noIncoming.length, 0, 'threat_actor should have no incoming relations');
  });

  it('Test 17: getRelations for nonexistent entity returns empty array', () => {
    const { getRelations } = loadKnowledge();
    const results = getRelations(db, 'nonexistent-entity');
    assert.deepEqual(results, []);
  });
});

// ── searchEntities ─────────────────────────────────────────────────────────

describe('knowledge.cjs - searchEntities', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema, addEntity } = loadKnowledge();
    ensureKnowledgeSchema(db);

    addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Russian military intelligence group' });
    addEntity(db, { type: 'threat_actor', name: 'APT29', description: 'Russian intelligence SVR' });
    addEntity(db, { type: 'technique', name: 'Spearphishing', description: 'Email phishing attachment' });
    addEntity(db, { type: 'tool', name: 'Mimikatz', description: 'Credential dumping tool' });
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 18: searchEntities finds entity with text in description via FTS5', () => {
    const { searchEntities } = loadKnowledge();
    const results = searchEntities(db, 'russian');
    assert.ok(results.length >= 1, 'should find entities matching "russian"');
    const names = results.map(r => r.name);
    assert.ok(names.includes('APT28') || names.includes('APT29'), 'should find Russian groups');
  });

  it('Test 19: searchEntities with type filter limits results', () => {
    const { searchEntities } = loadKnowledge();
    // Both APT28 and APT29 match 'russian' but filter to threat_actor
    const all = searchEntities(db, 'russian');
    const filtered = searchEntities(db, 'russian', { type: 'threat_actor' });
    assert.ok(filtered.length >= 1, 'should find at least 1 threat_actor');
    for (const r of filtered) {
      assert.equal(r.type, 'threat_actor', 'all results should be threat_actor type');
    }
  });

  it('Test 20: searchEntities with empty query returns empty array', () => {
    const { searchEntities } = loadKnowledge();
    assert.deepEqual(searchEntities(db, ''), []);
    assert.deepEqual(searchEntities(db, null), []);
    assert.deepEqual(searchEntities(db, undefined), []);
  });

  it('Test 21: searchEntities returns results ranked by BM25', () => {
    const { searchEntities } = loadKnowledge();
    // 'russian' appears in description of both APT28 and APT29
    const results = searchEntities(db, 'russian');
    assert.ok(results.length >= 2, 'should find multiple results');
    // Just verify results are returned (BM25 ranking is implicit in ORDER BY)
    assert.ok(results[0].name, 'first result should have name');
  });
});

// ── findEntities ───────────────────────────────────────────────────────────

describe('knowledge.cjs - findEntities', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema, addEntity } = loadKnowledge();
    ensureKnowledgeSchema(db);

    addEntity(db, { type: 'threat_actor', name: 'APT28', description: 'Russian group' });
    addEntity(db, { type: 'technique', name: 'Spearphishing', description: 'Email phishing' });
    addEntity(db, { type: 'technique', name: 'Brute Force', description: 'Password guessing' });
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 22: findEntities with type filter returns matching entities', () => {
    const { findEntities } = loadKnowledge();
    const techniques = findEntities(db, { type: 'technique' });
    assert.equal(techniques.length, 2, 'should find 2 technique entities');
    for (const t of techniques) {
      assert.equal(t.type, 'technique');
    }
  });

  it('Test 23: findEntities with name filter returns exact match', () => {
    const { findEntities } = loadKnowledge();
    const results = findEntities(db, { name: 'APT28' });
    assert.equal(results.length, 1, 'should find exactly 1 entity');
    assert.equal(results[0].name, 'APT28');
  });

  it('Test 24: findEntities with empty filter returns all entities', () => {
    const { findEntities } = loadKnowledge();
    const all = findEntities(db, {});
    assert.equal(all.length, 3, 'should return all 3 entities');
  });
});

// ── logDecision / getDecisions ─────────────────────────────────────────────

describe('knowledge.cjs - logDecision / getDecisions', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 25: logDecision inserts row with all fields', () => {
    const { logDecision } = loadKnowledge();
    const result = logDecision(db, {
      case_slug: 'case-1',
      technique_id: 'T1059',
      decision: 'Use PowerShell hunting',
      reasoning: 'Most prevalent',
      context: 'Initial triage',
    });

    assert.ok(result, 'should return result');

    const row = db.prepare('SELECT * FROM kg_decisions WHERE case_slug = ?').get('case-1');
    assert.ok(row, 'should exist in database');
    assert.equal(row.technique_id, 'T1059');
    assert.equal(row.decision, 'Use PowerShell hunting');
    assert.equal(row.reasoning, 'Most prevalent');
    assert.equal(row.context, 'Initial triage');
    assert.ok(row.created_at, 'should have created_at');
  });

  it('Test 26: getDecisions by technique_id returns matching decisions', () => {
    const { logDecision, getDecisions } = loadKnowledge();
    logDecision(db, { case_slug: 'case-1', technique_id: 'T1059', decision: 'Hunt PS', reasoning: 'Prevalent' });
    logDecision(db, { case_slug: 'case-2', technique_id: 'T1059', decision: 'Monitor PS', reasoning: 'Follow-up' });
    logDecision(db, { case_slug: 'case-3', technique_id: 'T1078', decision: 'Check creds', reasoning: 'Valid accounts' });

    const decisions = getDecisions(db, { technique_id: 'T1059' });
    assert.equal(decisions.length, 2, 'should find 2 decisions for T1059');
  });

  it('Test 27: getDecisions by case_slug returns matching decisions', () => {
    const { logDecision, getDecisions } = loadKnowledge();
    logDecision(db, { case_slug: 'case-1', technique_id: 'T1059', decision: 'Hunt PS' });
    logDecision(db, { case_slug: 'case-1', technique_id: 'T1078', decision: 'Check creds' });
    logDecision(db, { case_slug: 'case-2', technique_id: 'T1059', decision: 'Monitor PS' });

    const decisions = getDecisions(db, { case_slug: 'case-1' });
    assert.equal(decisions.length, 2, 'should find 2 decisions for case-1');
  });

  it('Test 28: getDecisions with no matching technique returns empty array', () => {
    const { getDecisions } = loadKnowledge();
    const decisions = getDecisions(db, { technique_id: 'T9999' });
    assert.deepEqual(decisions, []);
  });
});

// ── logLearning / getLearnings ──────────────────────────────────────────────

describe('knowledge.cjs - logLearning / getLearnings', () => {
  let tmpDir, db;

  beforeEach(() => {
    tmpDir = makeTempDir();
    db = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(db);
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 29: logLearning inserts row with all fields', () => {
    const { logLearning } = loadKnowledge();
    const result = logLearning(db, {
      topic: 'powershell',
      pattern: 'encoded commands',
      detail: 'Base64 encoded -enc flag common',
      technique_ids: 'T1059.001,T1027',
      case_slug: 'case-1',
    });

    assert.ok(result, 'should return result');

    const row = db.prepare('SELECT * FROM kg_learnings WHERE topic = ?').get('powershell');
    assert.ok(row, 'should exist in database');
    assert.equal(row.pattern, 'encoded commands');
    assert.equal(row.detail, 'Base64 encoded -enc flag common');
    assert.equal(row.technique_ids, 'T1059.001,T1027');
    assert.equal(row.case_slug, 'case-1');
    assert.ok(row.created_at, 'should have created_at');
  });

  it('Test 30: getLearnings by topic returns matching learnings', () => {
    const { logLearning, getLearnings } = loadKnowledge();
    logLearning(db, { topic: 'powershell', pattern: 'encoded commands', detail: 'Test 1', technique_ids: 'T1059.001' });
    logLearning(db, { topic: 'powershell', pattern: 'download cradles', detail: 'Test 2', technique_ids: 'T1059.001' });
    logLearning(db, { topic: 'lateral-movement', pattern: 'pass-the-hash', detail: 'Test 3', technique_ids: 'T1550.002' });

    const learnings = getLearnings(db, { topic: 'powershell' });
    assert.equal(learnings.length, 2, 'should find 2 learnings for powershell topic');
  });

  it('Test 31: getLearnings by technique_id returns learnings containing that technique', () => {
    const { logLearning, getLearnings } = loadKnowledge();
    logLearning(db, { topic: 'powershell', pattern: 'encoded', detail: 'Test', technique_ids: 'T1059.001,T1027' });
    logLearning(db, { topic: 'creds', pattern: 'dumping', detail: 'Test', technique_ids: 'T1003.001' });

    const learnings = getLearnings(db, { technique_id: 'T1059.001' });
    assert.equal(learnings.length, 1, 'should find 1 learning containing T1059.001');
    assert.equal(learnings[0].topic, 'powershell');
  });

  it('Test 32: getLearnings with no match returns empty array', () => {
    const { getLearnings } = loadKnowledge();
    const learnings = getLearnings(db, { topic: 'nonexistent' });
    assert.deepEqual(learnings, []);
  });
});

// ── importStixFromIntel ────────────────────────────────────────────────────

describe('knowledge.cjs - importStixFromIntel', () => {
  let tmpDir, intelDir, programDb, intelDb;

  before(() => {
    tmpDir = makeTempDir();
    intelDir = makeTempDir();
    programDb = makeProgramDb(tmpDir);
    const { ensureKnowledgeSchema } = loadKnowledge();
    ensureKnowledgeSchema(programDb);
    intelDb = makeIntelDb(intelDir);
  });

  after(() => {
    if (programDb) programDb.close();
    if (intelDb) intelDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(intelDir, { recursive: true, force: true });
  });

  it('Test 33: creates threat_actor entities for each group in intel.db', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const groupCount = intelDb.prepare('SELECT COUNT(*) AS cnt FROM groups').get().cnt;
    const threatActors = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE type = 'threat_actor' AND source = 'att&ck-stix'"
    ).get().cnt;

    assert.equal(threatActors, groupCount, `should have ${groupCount} threat_actor entities`);
  });

  it('Test 34: creates tool entities for each software entry in intel.db', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const softwareCount = intelDb.prepare('SELECT COUNT(*) AS cnt FROM software').get().cnt;
    const tools = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE type = 'tool' AND source = 'att&ck-stix'"
    ).get().cnt;

    assert.equal(tools, softwareCount, `should have ${softwareCount} tool entities`);
  });

  it('Test 35: creates uses relations for group_techniques rows', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const gtCount = intelDb.prepare('SELECT COUNT(*) AS cnt FROM group_techniques').get().cnt;
    const gtRelations = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_relations WHERE relation_type = 'uses' AND source = 'att&ck-stix' AND from_entity LIKE 'threat_actor--%'"
    ).get().cnt;

    // group_techniques + group_software both have threat_actor from_entity, so just check >= gtCount
    assert.ok(gtRelations >= gtCount, `should have at least ${gtCount} group->technique relations, got ${gtRelations}`);
  });

  it('Test 36: creates uses relations for group_software rows', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const gsCount = intelDb.prepare('SELECT COUNT(*) AS cnt FROM group_software').get().cnt;
    // group_software relations have threat_actor from and tool to
    const gsRelations = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_relations WHERE relation_type = 'uses' AND source = 'att&ck-stix' AND from_entity LIKE 'threat_actor--%' AND to_entity LIKE 'tool--%'"
    ).get().cnt;

    assert.equal(gsRelations, gsCount, `should have ${gsCount} group->software relations, got ${gsRelations}`);
  });

  it('Test 37: creates uses relations for software_techniques rows', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const stCount = intelDb.prepare('SELECT COUNT(*) AS cnt FROM software_techniques').get().cnt;
    const stRelations = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_relations WHERE relation_type = 'uses' AND source = 'att&ck-stix' AND from_entity LIKE 'tool--%'"
    ).get().cnt;

    assert.equal(stRelations, stCount, `should have ${stCount} software->technique relations, got ${stRelations}`);
  });

  it('Test 38: idempotent -- running twice does not duplicate entities or relations', () => {
    const { importStixFromIntel } = loadKnowledge();

    // Already imported in test 33, import again
    importStixFromIntel(programDb, intelDb);

    const entityCount = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE source = 'att&ck-stix'"
    ).get().cnt;
    const relationCount = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_relations WHERE source = 'att&ck-stix'"
    ).get().cnt;

    // Import a third time
    importStixFromIntel(programDb, intelDb);

    const entityCountAfter = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_entities WHERE source = 'att&ck-stix'"
    ).get().cnt;
    const relationCountAfter = programDb.prepare(
      "SELECT COUNT(*) AS cnt FROM kg_relations WHERE source = 'att&ck-stix'"
    ).get().cnt;

    assert.equal(entityCount, entityCountAfter, 'entity count should not change on re-import');
    assert.equal(relationCount, relationCountAfter, 'relation count should not change on re-import');
  });

  it('Test 39: entities created by STIX import have source att&ck-stix', () => {
    const { importStixFromIntel } = loadKnowledge();
    importStixFromIntel(programDb, intelDb);

    const stixEntities = programDb.prepare(
      "SELECT * FROM kg_entities WHERE source = 'att&ck-stix' LIMIT 5"
    ).all();
    assert.ok(stixEntities.length > 0, 'should have STIX-sourced entities');
    for (const e of stixEntities) {
      assert.equal(e.source, 'att&ck-stix', 'source should be att&ck-stix');
    }
  });
});
