---
phase: 56-knowledge-graph
plan: 01
subsystem: database
tags: [sqlite, fts5, knowledge-graph, better-sqlite3, att&ck-stix]

# Dependency graph
requires:
  - phase: 52-cross-case-intelligence
    provides: "program.db patterns (openProgramDb, ensureSchema, WAL+busy_timeout)"
  - phase: 53-unified-mcp
    provides: "intel.db with groups, software, techniques tables for STIX import"
provides:
  - "Knowledge graph data layer (knowledge.cjs) with 12 exported functions"
  - "kg_entities, kg_relations, kg_decisions, kg_learnings tables in program.db"
  - "FTS5 search over entity names and descriptions"
  - "ATT&CK STIX auto-import from intel.db to program.db"
  - "Decision and learning logging with technique/case attribution"
affects: [56-02-knowledge-graph, 57-knowledge-mcp]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-entity-ids, fts5-knowledge-search, stix-cross-db-import, decision-learning-logging]

key-files:
  created:
    - mcp-hunt-intel/lib/knowledge.cjs
    - tests/knowledge.test.cjs
  modified: []

key-decisions:
  - "Entity ID generation uses deterministic type--slugified-name scheme for natural deduplication"
  - "FTS5 cleanup on upsert uses rowid-based DELETE before INSERT OR REPLACE to prevent stale FTS entries"
  - "STIX import deletes all att&ck-stix relations before re-inserting for clean idempotent re-imports"
  - "addEntityDirect internal helper avoids nested transactions during STIX bulk import"

patterns-established:
  - "Deterministic entity IDs: ${type}--${slugified-name} enables upsert-based deduplication across imports"
  - "FTS5 rowid sync: when upserting entities, delete old FTS row by rowid before replacing entity row"
  - "Cross-DB import: read all source data from intel.db, then write to program.db in single IMMEDIATE transaction"

requirements-completed: [KNOW-01, KNOW-02, KNOW-03, KNOW-04]

# Metrics
duration: 5min
completed: 2026-04-08
---

# Phase 56 Plan 01: Knowledge Graph Data Layer Summary

**Knowledge graph persistence layer with entity/relation CRUD, FTS5 search, decision/learning logging, and ATT&CK STIX auto-import from intel.db**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-08T19:38:31Z
- **Completed:** 2026-04-08T19:43:55Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files created:** 2

## Accomplishments
- Built knowledge.cjs module with 12 exported functions for knowledge graph persistence
- 4 tables + 1 FTS5 virtual table created by ensureKnowledgeSchema (kg_entities, kg_relations, kg_decisions, kg_learnings, kg_entities_fts)
- Entity CRUD with 7 types (threat_actor, technique, detection, campaign, tool, vulnerability, data_source) and deterministic ID generation
- ATT&CK STIX import reads groups/software/relations from intel.db and populates program.db idempotently
- FTS5 search with BM25 ranking and type filtering over entity names and descriptions
- Decision and learning logging with technique_id and case_slug attribution for cross-hunt retrieval

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Knowledge graph tests** - `a7fd55e` (test)
2. **Task 1 GREEN: Knowledge graph implementation** - `45d8a72` (feat)

## Files Created/Modified
- `mcp-hunt-intel/lib/knowledge.cjs` - Knowledge graph data layer with 12 exports: ensureKnowledgeSchema, addEntity, getEntity, findEntities, addRelation, getRelations, searchEntities, logDecision, getDecisions, logLearning, getLearnings, importStixFromIntel
- `tests/knowledge.test.cjs` - 39 tests covering all functions, edge cases, FTS search, and STIX import

## Decisions Made
- Entity ID generation uses `${type}--${slugified-name}` (lowercase, spaces to hyphens, strip non-alphanumeric) for natural deduplication across manual and STIX imports
- FTS5 upsert cleanup: on entity replace, delete old FTS row by rowid before inserting new one to prevent stale search results
- STIX import uses bulk DELETE of all att&ck-stix relations followed by re-insert, ensuring clean idempotent re-imports without duplicate counting
- Internal `addEntityDirect` helper avoids wrapping individual entity inserts in their own transaction during bulk STIX import (parent transaction handles atomicity)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- knowledge.cjs ready for Phase 56-02 to wire MCP tools (knowledge_graph, log_decision, log_learning, get_learnings)
- All 4 knowledge graph tables created in program.db alongside existing case_index/case_artifacts tables
- importStixFromIntel ready to be called during program initialization

## Self-Check: PASSED

- FOUND: mcp-hunt-intel/lib/knowledge.cjs
- FOUND: tests/knowledge.test.cjs
- FOUND: 56-01-SUMMARY.md
- FOUND: a7fd55e (RED commit)
- FOUND: 45d8a72 (GREEN commit)
- FOUND: aaa8122 (docs commit)

---
*Phase: 56-knowledge-graph*
*Completed: 2026-04-08*
