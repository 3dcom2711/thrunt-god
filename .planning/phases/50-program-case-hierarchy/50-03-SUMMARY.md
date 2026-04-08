---
phase: 50-program-case-hierarchy
plan: 03
subsystem: core
tags: [migration, case-hierarchy, rollback, cli, flat-to-case]

# Dependency graph
requires:
  - "50-01: Case-aware planningDir/planningPaths, getActiveCase/setActiveCase"
  - "50-02: addCaseToRoster, getCaseRoster, reconstructFrontmatter array-of-objects support"
provides:
  - "cmdMigrateCase(cwd, slug, raw) for flat-to-case migration with rollback"
  - "migrate-case top-level CLI command in thrunt-tools"
  - "Safe migration pattern: move artifacts, rollback on failure, update roster, set active case"
affects: [51, 52, 53, 56]

# Tech tracking
tech-stack:
  added: []
  patterns: ["rollback-on-failure migration (renameSync with tracked filesMoved array)", "case-scoped artifact list constant (toMove array)", "non-fatal roster/pointer updates after successful migration"]

key-files:
  created: []
  modified:
    - "thrunt-god/bin/lib/commands.cjs"
    - "thrunt-god/bin/thrunt-tools.cjs"
    - "tests/commands.test.cjs"

key-decisions:
  - "migrate-case is a top-level command (not under 'case' subgroup) per CONTEXT.md decision"
  - "Roster and active-case pointer updates are non-fatal -- migration succeeds even if they fail"
  - "Migrated case uses slug as default name (no separate name parameter for migration)"
  - "technique_count initialized to '0' as string for YAML round-trip compatibility"

patterns-established:
  - "Safe migration pattern: create target dir, move files with rollback tracking, create metadata, update indices"
  - "Non-fatal post-migration steps: roster update and pointer set wrapped in try/catch to not undo successful file moves"

requirements-completed: [HIER-05]

# Metrics
duration: 33min
completed: 2026-04-08
---

# Phase 50 Plan 03: Migrate-Case Command Summary

**Safe flat-to-case migration command with rollback-on-failure, roster update, active-case pointer, and case-level STATE.md creation via cmdMigrateCase**

## Performance

- **Duration:** 33 min
- **Started:** 2026-04-08T06:08:46Z
- **Completed:** 2026-04-08T06:42:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented cmdMigrateCase that moves flat .planning/ hunt artifacts (HUNTMAP.md, HYPOTHESES.md, SUCCESS_CRITERIA.md, FINDINGS.md, EVIDENCE_REVIEW.md, phases/, QUERIES/, RECEIPTS/, MANIFESTS/, DETECTIONS/, published/) into cases/<slug>/
- Built rollback-on-failure mechanism that restores all moved files to their original location if any renameSync fails mid-migration
- Wired migrate-case as a top-level CLI command in thrunt-tools dispatcher with usage string documentation
- Added 10 test cases covering: successful migration, shared artifact preservation, case STATE.md creation, active-case pointer, slug validation, duplicate rejection, skip-missing-artifacts, roster update, and rollback behavior
- All 5 HIER requirements now addressed across Plans 01-03

## Task Commits

Each task was committed atomically using TDD (red then green):

1. **Task 1: Implement cmdMigrateCase with rollback and roster update**
   - `6712cb9` (test: add failing tests for cmdMigrateCase migration command)
   - `b12c908` (feat: implement cmdMigrateCase with rollback and roster update)

2. **Task 2: Wire migrate-case into thrunt-tools dispatcher and run full integration verification**
   - `01b1900` (chore: add migrate-case to usage string in thrunt-tools)

## Files Created/Modified

- `thrunt-god/bin/lib/commands.cjs` - Added cmdMigrateCase function with validation, rollback-safe migration, case STATE.md creation, roster update, and active-case pointer; added reconstructFrontmatter import
- `thrunt-god/bin/thrunt-tools.cjs` - Added migrate-case as top-level command route, updated usage string
- `tests/commands.test.cjs` - Added cmdMigrateCase describe block with 10 test cases covering all migration behaviors

## Decisions Made

- migrate-case is a top-level command (not under 'case' subgroup) per CONTEXT.md architectural decision -- migration is a one-time operation distinct from ongoing case management
- Roster and active-case pointer updates are non-fatal -- if migration file moves succeed but roster/pointer fail, the migration is still considered successful (data integrity over metadata completeness)
- Migrated case uses slug as default name since migration is typically from a single flat hunt where the slug is the meaningful identifier
- technique_count initialized as string '0' for YAML round-trip compatibility (matching Plan 02 convention)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added thrunt-tools routing in Task 1 GREEN phase instead of Task 2**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Tests call `runThruntTools('migrate-case ...')` which routes through the CLI dispatcher. Without the dispatcher route, all 8 new tests fail with "Unknown command" even after implementing cmdMigrateCase.
- **Fix:** Added `case 'migrate-case':` routing block to thrunt-tools.cjs in the Task 1 GREEN commit alongside the function implementation
- **Files modified:** thrunt-god/bin/thrunt-tools.cjs
- **Verification:** All 87 commands tests pass
- **Committed in:** b12c908 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for tests to pass. Task 2 still contributed the usage string update and full integration verification. No scope creep.

## Issues Encountered

- Pre-existing failure in untracked `tests/integration-helpers.test.cjs` (waitForHealthy timeout test at 300s) -- confirmed unrelated to this plan's changes. All 451 tests across relevant modules (commands, core, state, init, frontmatter) pass with zero failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 HIER requirements are now complete: HIER-01 (init), HIER-02 (case new), HIER-03 (case roster), HIER-04 (planningPaths refactor), HIER-05 (migrate-case)
- Phase 50 is fully complete -- downstream phases (51-57) can proceed with case-aware operations
- Existing flat-mode programs can be migrated non-destructively via `thrunt-tools migrate-case <slug>`
- The migration command serves as a safe transition path for all existing hunters

## Self-Check: PASSED

All files verified present. All 3 commit hashes confirmed in git log.

---
*Phase: 50-program-case-hierarchy*
*Completed: 2026-04-08*
