---
phase: 33-sdk-export-surface
plan: 01
subsystem: testing
tags: [node, commonjs, sdk, exports, runtime]

# Dependency graph
requires: []
provides:
  - "18 SDK primitive functions exported from runtime.cjs for use by standalone connector adapters"
  - "tests/sdk-exports.test.cjs with 25 presence and invocation tests"
affects:
  - 34-connector-scaffolding
  - 45-connector-plugin-sdk

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive module.exports extension with Phase comment block documenting purpose and count"
    - "TDD: failing test file created before exports added, then exports make them green"

key-files:
  created:
    - tests/sdk-exports.test.cjs
  modified:
    - thrunt-god/bin/lib/runtime.cjs

key-decisions:
  - "EXPORT-COUNT-43: Pre-existing module.exports had 43 symbols (not 32 as plan interface doc stated); Phase 33 brings total to 61 (43+18)"
  - "EXISTING-EXPORTS-UNCHANGED: All 43 pre-existing exports preserved; additions are purely additive"

patterns-established:
  - "Phase comment block: add '// --- SDK export surface (Phase N) ---' comment with description and total count before new exports"

requirements-completed: [SDK-01]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 33 Plan 01: SDK Export Surface Summary

**18 internal runtime.cjs functions exported as SDK primitives (normalizeBaseUrl, executeConnectorRequest, addEntitiesFromRecord, etc.) with TDD-verified export surface for Phase 34 connector adapters**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T19:11:03Z
- **Completed:** 2026-03-30T19:13:49Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added 18 previously-internal functions to module.exports with Phase 33 comment block
- Created tests/sdk-exports.test.cjs with 25 tests across 3 describe blocks (presence, URL utilities, general utilities)
- All 1,875 tests pass (1,850 pre-existing + 25 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 18 SDK functions to module.exports and create export verification tests** - `1bccb2c` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD — test file created first (RED), then exports added (GREEN), all 25 tests pass._

## Files Created/Modified
- `thrunt-god/bin/lib/runtime.cjs` - Added 18 function exports and Phase 33 comment block after `executeQuerySpec`
- `tests/sdk-exports.test.cjs` - 25-test suite: export presence (all 18 new + all 43 pre-existing), URL utility assertions, general utility assertions

## Decisions Made
- EXPORT-COUNT-43: The plan's interface doc listed 32 pre-existing exports but the actual module had 43 (the extra 11 were added in v1.x phases). Total is 61 after Phase 33 additions. Test updated to reflect accurate count with explanatory comment.
- EXISTING-EXPORTS-UNCHANGED: Purely additive change — all pre-existing exports retained verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected export count assertion from 50 to 61**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Plan stated "32 existing + 18 new = 50 total" but runtime.cjs actually had 43 pre-existing exports, making the true total 61
- **Fix:** Updated the count assertion test and EXISTING_EXPORTS array to reflect the accurate 43 pre-existing exports with an explanatory comment
- **Files modified:** tests/sdk-exports.test.cjs
- **Verification:** `node -e "Object.keys(require('./thrunt-god/bin/lib/runtime.cjs')).length"` returns 61; all 25 tests pass
- **Committed in:** 1bccb2c (part of task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - stale count in plan interface doc)
**Impact on plan:** Necessary correction for test accuracy. The exported function set is exactly as specified; only the count assertion was adjusted to match reality.

## Issues Encountered
None — plan executed cleanly. The only wrinkle was the stale export count in the plan's interface comment, which was corrected automatically.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 34 (Connector Scaffolding CLI) can now `require('../thrunt-god/bin/lib/runtime.cjs')` and call any of the 18 newly exported primitives
- Particularly: `normalizeBaseUrl`, `executeConnectorRequest`, `authorizeRequest`, `addEntitiesFromRecord`, and `normalizeEvent` are the most critical for generated adapter files
- No blockers

---
*Phase: 33-sdk-export-surface*
*Completed: 2026-03-30*

## Self-Check: PASSED
- runtime.cjs: FOUND
- tests/sdk-exports.test.cjs: FOUND
- 33-01-SUMMARY.md: FOUND
- commit 1bccb2c: FOUND
