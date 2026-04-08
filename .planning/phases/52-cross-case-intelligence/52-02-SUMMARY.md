---
phase: 52-cross-case-intelligence
plan: 02
subsystem: commands
tags: [sqlite, fts5, case-lifecycle, auto-search, cross-case-intelligence, cli]

requires:
  - phase: 52-cross-case-intelligence plan 01
    provides: db.cjs module with openProgramDb, indexCase, searchCases, findTechniqueOverlap, extractTechniqueIds
  - phase: 50-case-management
    provides: cmdCaseNew, cmdCaseClose, case roster, active-case pointer
provides:
  - cmdCaseClose triggers automatic case artifact indexing into program.db on close
  - cmdCaseNew auto-searches past cases and returns past_case_matches[] in output
  - cmdCaseSearch command with --limit, --technique, --program flags
  - case-search top-level CLI route in thrunt-tools.cjs
affects: [52-03 future enrichment, vscode extension case intelligence, program dashboard cross-case views]

tech-stack:
  added: []
  patterns: [lazy require with try/catch for native modules, OR-joined FTS queries for multi-word names, parent-to-subtechnique expansion for technique overlap]

key-files:
  created: []
  modified: [thrunt-god/bin/lib/commands.cjs, thrunt-god/bin/thrunt-tools.cjs, tests/commands.test.cjs]

key-decisions:
  - "db.cjs require made lazy (try/catch) in commands.cjs to prevent crashes in install-manifest environments without better-sqlite3"
  - "cmdCaseNew FTS query OR-joins name tokens for broader matching (AND semantics too restrictive for case names)"
  - "cmdCaseNew expands parent technique IDs (T1059) to sub-techniques (T1059.001) via DB lookup for overlap matching"
  - "cmdCaseSearch technique_overlap always populated as array (from DB lookup even without --technique flag)"

patterns-established:
  - "Lazy native module require: try { dbModule = require('./db.cjs') } catch { dbModule = null } with if(dbModule) guards"
  - "FTS query preprocessing: split multi-word input on whitespace and OR-join for broader search"
  - "Parent technique expansion: when technique ID has no dot, LIKE query expands to sub-techniques"
  - "Non-fatal indexing: try/catch wrapping with db.close() in finally block, if(!raw) console.error for warnings"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, INTEL-04]

duration: 19min
completed: 2026-04-08
---

# Phase 52 Plan 02: Cross-Case Intelligence Command Integration Summary

**cmdCaseClose indexing, cmdCaseNew auto-search with past_case_matches, and cmdCaseSearch CLI with --limit/--technique/--program flags, all wired to db.cjs FTS5 layer**

## Performance

- **Duration:** 19 min
- **Started:** 2026-04-08T14:45:23Z
- **Completed:** 2026-04-08T15:04:41Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- cmdCaseClose calls indexCase after roster/STATE update with non-fatal try/catch and db.close() in finally
- cmdCaseNew auto-searches past cases using OR-joined FTS query and parent-to-subtechnique technique expansion, returns past_case_matches[] in output JSON
- cmdCaseSearch command supports --limit (default 10), --technique (exact filter), --program (alternate DB path) flags
- Search results include all INTEL-04 required fields: slug, name, match_snippet, technique_overlap, outcome_summary, relevance_score
- case-search routed as top-level command in thrunt-tools.cjs (not under 'case' subgroup per CONTEXT.md pattern)
- Lazy db.cjs require prevents crash in install-manifest test environments without better-sqlite3
- 14 new tests (6 indexing + 8 search), all 2710 tests pass including full suite

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for cmdCaseClose indexing + cmdCaseNew auto-search** - `4de188f` (test)
2. **Task 1 (GREEN): Wire indexCase into cmdCaseClose and auto-search into cmdCaseNew** - `bda6f5d` (feat)
3. **Task 2 (RED): Failing tests for cmdCaseSearch and case-search CLI** - `846e4b8` (test)
4. **Task 2 (GREEN): Add cmdCaseSearch command and case-search CLI route** - `52bb9e1` (feat)

## Files Created/Modified
- `thrunt-god/bin/lib/commands.cjs` - Added db.cjs lazy require, indexCase in cmdCaseClose, auto-search in cmdCaseNew, new cmdCaseSearch function (~130 lines added)
- `thrunt-god/bin/thrunt-tools.cjs` - Added case-search top-level CLI route with --limit, --technique, --program arg parsing
- `tests/commands.test.cjs` - 14 new tests across 2 describe blocks (cmdCaseClose indexing + cmdCaseNew auto-search, cmdCaseSearch)

## Decisions Made
- db.cjs require made lazy with try/catch to prevent install-manifest test failures (hunt-install.test.cjs copies files to temp dirs without node_modules)
- FTS query for cmdCaseNew OR-joins name tokens instead of passing raw name (FTS5 AND semantics too restrictive for multi-word case names like "PowerShell T1059 Investigation")
- Parent technique ID expansion: when extractTechniqueIds returns T1059 (no sub-technique), LIKE query finds T1059.001 etc. in DB for broader overlap matching
- technique_overlap always populated as array on search results, even without --technique flag, via direct DB lookup per result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy require for db.cjs to prevent install-manifest test crash**
- **Found during:** Task 2 (full test suite verification)
- **Issue:** Direct `require('./db.cjs')` in commands.cjs throws when better-sqlite3 native module unavailable in install-manifest temp dirs
- **Fix:** Wrapped require in try/catch, destructure from dbModule || {}, added if(dbModule) guards on all 3 call sites
- **Files modified:** thrunt-god/bin/lib/commands.cjs
- **Verification:** hunt-install.test.cjs passes (was failing before fix)
- **Committed in:** `52bb9e1`

**2. [Rule 1 - Bug] FTS query OR-joining for case name search**
- **Found during:** Task 1 (GREEN phase, test failure)
- **Issue:** FTS5 MATCH interprets multi-word input as AND query; "PowerShell T1059 Investigation" returns 0 results because not all tokens present in indexed content
- **Fix:** Split name on whitespace and OR-join tokens before passing to searchCases
- **Files modified:** thrunt-god/bin/lib/commands.cjs
- **Verification:** "cmdCaseNew returns matches after past case indexed" test passes
- **Committed in:** `bda6f5d`

**3. [Rule 1 - Bug] Parent technique ID expansion for overlap matching**
- **Found during:** Task 1 (GREEN phase, test failure)
- **Issue:** extractTechniqueIds("T1059") returns "T1059" but DB stores "T1059.001"; findTechniqueOverlap uses exact match, so no overlap found
- **Fix:** When technique ID has no dot (parent), LIKE query expands to all sub-techniques in DB
- **Files modified:** thrunt-god/bin/lib/commands.cjs
- **Verification:** Auto-search finds technique overlap between parent and sub-technique IDs
- **Committed in:** `bda6f5d`

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. FTS OR-joining and technique expansion improve search quality beyond minimum spec. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full cross-case intelligence pipeline operational: close -> index -> search/auto-search
- End-to-end flow verified: cmdCaseNew -> cmdCaseClose (indexes) -> cmdCaseNew (auto-search returns matches) -> cmdCaseSearch (explicit search returns results)
- All 2710 tests pass (pre-existing integration-helpers timeout excluded per STATE.md)
- Ready for future enrichment (e.g., VS Code extension integration, program dashboard views)

## Self-Check: PASSED

All files exist, all 4 commits verified.

---
*Phase: 52-cross-case-intelligence*
*Completed: 2026-04-08*
