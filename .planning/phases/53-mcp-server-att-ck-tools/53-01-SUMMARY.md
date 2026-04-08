---
phase: 53-mcp-server-att-ck-tools
plan: 01
subsystem: database
tags: [sqlite, fts5, att&ck, mitre, better-sqlite3, threat-intelligence, mcp]

# Dependency graph
requires:
  - phase: 52-cross-case-intelligence
    provides: "db.cjs WAL+FTS5 patterns, better-sqlite3 dependency"
provides:
  - "mcp-hunt-intel package scaffold with package.json"
  - "intel.cjs data layer module for ~/.thrunt/intel.db"
  - "mitre-attack-groups.json curated data (16 groups, 10 software)"
  - "8 exported query functions: openIntelDb, lookupTechnique, searchTechniques, lookupGroup, getGroupTechniques, getGroupSoftware, getTechniquesByTactic, getAllTactics"
affects: [53-02, 53-03, 54-sigma-rules]

# Tech tracking
tech-stack:
  added: ["@modelcontextprotocol/sdk (declared, not yet used)"]
  patterns: ["global ~/.thrunt/intel.db with WAL+busy_timeout", "regular FTS5 (not external content) for immutable data", "BEGIN IMMEDIATE for population race prevention", "opts.dbDir/dbPath pattern for test isolation"]

key-files:
  created:
    - mcp-hunt-intel/package.json
    - mcp-hunt-intel/lib/intel.cjs
    - thrunt-god/data/mitre-attack-groups.json
    - tests/intel-db.test.cjs
  modified: []

key-decisions:
  - "Regular FTS5 (not external content) for techniques_fts since intel.db data is write-once/immutable"
  - "FTS5 includes id column to enable direct join back to techniques table without rowid"
  - "Sub-techniques inherit parent description, tactic, platforms, data_sources"
  - "3 invalid technique IDs (T1074.001, T1112) in groups data replaced with valid IDs from bundled JSON"

patterns-established:
  - "openIntelDb(opts) accepts dbDir/dbPath for test isolation without touching ~/.thrunt/"
  - "populateIfEmpty uses BEGIN IMMEDIATE + count check for idempotent concurrent-safe population"
  - "buildTechniqueUrl generates ATT&CK URLs from technique IDs (dot -> slash for sub-techniques)"

requirements-completed: [MCP-06, MCP-02, MCP-03]

# Metrics
duration: 15min
completed: 2026-04-08
---

# Phase 53 Plan 01: Intel DB Data Layer Summary

**SQLite intel.db with 557 ATT&CK techniques (FTS5 search), 16 threat groups, 10 software entries, and 8 query functions for MCP tool consumption**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-08T15:49:00Z
- **Completed:** 2026-04-08T16:03:48Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files created:** 4

## Accomplishments
- Created mcp-hunt-intel package scaffold with package.json declaring MCP SDK, better-sqlite3, zod dependencies
- Built intel.cjs data layer that creates and populates ~/.thrunt/intel.db from bundled JSON on first access
- Created curated mitre-attack-groups.json with 16 APT groups and 10 software/malware entries, all cross-referenced with valid technique IDs
- Implemented 8 exported query functions: openIntelDb, lookupTechnique, searchTechniques (FTS5 BM25), lookupGroup, getGroupTechniques, getGroupSoftware, getTechniquesByTactic, getAllTactics
- 35 new tests covering all functions, 1793 total tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for intel.cjs** - `34d13ba` (test)
2. **Task 1 (GREEN): Implement intel.cjs + groups data + package.json** - `0b6c252` (feat)

**Plan metadata:** (pending) (docs: complete plan)

_Note: TDD task has RED + GREEN commits_

## Files Created/Modified
- `mcp-hunt-intel/package.json` - Package manifest for @thrunt/mcp-hunt-intel with MCP SDK, better-sqlite3, zod
- `mcp-hunt-intel/lib/intel.cjs` - intel.db schema, population from JSON, 8 query functions
- `thrunt-god/data/mitre-attack-groups.json` - Curated ATT&CK groups (16), software (10), technique mappings
- `tests/intel-db.test.cjs` - 35 tests covering all intel.cjs functions

## Decisions Made
- Used regular FTS5 (not external content) per RESEARCH.md Pitfall 3 since intel.db data is immutable after population
- Added `id` column to FTS5 table to enable direct JOIN back to techniques table by ID
- Sub-techniques inherit parent description, tactic, platforms, data_sources from bundled JSON structure
- Replaced 3 invalid technique IDs in groups data (T1074.001, T1112 not in bundled enterprise JSON) with valid alternatives

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid technique IDs in groups data**
- **Found during:** Task 1 (data file creation)
- **Issue:** T1074.001 (used in G0007, G0016) and T1112 (used in G0082) do not exist in bundled mitre-attack-enterprise.json
- **Fix:** Replaced T1074.001 with T1119 (Automated Collection) in both groups, replaced T1112 with T1119 in G0082
- **Files modified:** thrunt-god/data/mitre-attack-groups.json
- **Verification:** Node script validated all technique_ids in groups/software reference valid enterprise IDs
- **Committed in:** 0b6c252 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Data integrity fix necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- intel.cjs module is fully functional and ready for MCP tool integration (Plan 02: server.cjs + tool registration)
- All 8 query functions exported and tested
- Package.json declares MCP SDK dependency (needs `npm install` in mcp-hunt-intel/ before server.cjs)

---
*Phase: 53-mcp-server-att-ck-tools*
*Completed: 2026-04-08*
