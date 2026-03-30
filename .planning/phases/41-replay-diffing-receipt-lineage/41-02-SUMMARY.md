---
phase: 41-replay-diffing-receipt-lineage
plan: 02
subsystem: cli
tags: [replay, cli, diff, lineage, telemetry, thrunt-tools]

# Dependency graph
requires:
  - phase: 41-01
    provides: buildDiff engine, lineage-aware writeRuntimeArtifacts, recordReplayExecution telemetry
provides:
  - cmdRuntimeReplay CLI command for replaying previous hunt queries with diff/shift/ioc support
  - cmdReplayList CLI command for listing replay execution records from METRICS/
  - cmdReplayDiff CLI command for reading and formatting stored diff artifacts
  - CLI routing for runtime replay, replay list, replay diff subcommands
  - parseRuntimeArgs --ioc array collector extension
affects: [42-tenant-registry, replay-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [subprocess-cli-testing, ioc-array-collection, diff-artifact-persistence]

key-files:
  created: []
  modified:
    - thrunt-god/bin/lib/commands.cjs
    - thrunt-god/bin/thrunt-tools.cjs
    - tests/replay.test.cjs

key-decisions:
  - "SUBPROCESS-REPLAY-TESTS: CLI command tests use execFileSync subprocess approach because output() uses fs.writeSync(1,...) which cannot be monkey-patched in-process"
  - "PARSE-RUNTIME-ARGS-EXPORT: Exported parseRuntimeArgs from commands.cjs for direct testability of flag parsing"
  - "DIFF-NO-RAW-FLAG: cmdReplayDiff passes human_summary as rawValue so --raw outputs text; tests omit --raw to get JSON"

patterns-established:
  - "Replay CLI subprocess test pattern: spawn thrunt-tools.cjs in tmp directory with prepared METRICS/QUERIES fixtures"
  - "IOC array collector in parseRuntimeArgs: --ioc flag joins hypothesis/tag as array-type argument collectors"

requirements-completed: [REPLAY-04]

# Metrics
duration: 7min
completed: 2026-03-30
---

# Phase 41 Plan 02: Replay CLI Commands Summary

**Three CLI commands (runtime replay, replay list, replay diff) with full routing and 11 new tests completing the REPLAY-04 requirement**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T22:51:58Z
- **Completed:** 2026-03-30T22:59:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Implemented cmdRuntimeReplay with --source, --diff, --shift, --ioc, --dry-run support and full replay execution pipeline
- Implemented cmdReplayList and cmdReplayDiff for browsing replay history and diff artifacts
- Wired all three commands in thrunt-tools.cjs routing (runtime replay + top-level replay list/diff)
- Added 11 new CLI tests (8 parseRuntimeArgs flag tests + 3 cmdReplayList subprocess tests + 3 cmdReplayDiff subprocess tests) -- all 147 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI command handlers in commands.cjs** - `231b473` (feat)
2. **Task 2: CLI routing in thrunt-tools.cjs and command tests** - `3fc4976` (feat)

## Files Created/Modified
- `thrunt-god/bin/lib/commands.cjs` - Three new command handlers (cmdRuntimeReplay, cmdReplayList, cmdReplayDiff), parseRuntimeArgs --ioc extension, exports
- `thrunt-god/bin/thrunt-tools.cjs` - Runtime replay routing, top-level replay case, header documentation
- `tests/replay.test.cjs` - 11 new test cases across 3 describe blocks

## Decisions Made
- SUBPROCESS-REPLAY-TESTS: Used execFileSync subprocess approach for cmdReplayList/cmdReplayDiff tests because core.cjs output() uses fs.writeSync(1,...) which bypasses process.stdout.write monkey-patching
- PARSE-RUNTIME-ARGS-EXPORT: Exported parseRuntimeArgs to enable direct unit testing of flag parsing without subprocess overhead
- DIFF-NO-RAW-FLAG: cmdReplayDiff passes human_summary as rawValue to output(), so --raw returns human-readable text; tests use JSON mode (no --raw) for structured assertions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] parseRuntimeArgs not exported**
- **Found during:** Task 2 (writing arg parsing tests)
- **Issue:** parseRuntimeArgs was a module-private function, preventing direct unit testing
- **Fix:** Added parseRuntimeArgs to module.exports in commands.cjs
- **Files modified:** thrunt-god/bin/lib/commands.cjs
- **Verification:** Tests import and call parseRuntimeArgs directly
- **Committed in:** 3fc4976 (Task 2 commit)

**2. [Rule 1 - Bug] Output capture incompatible with fs.writeSync**
- **Found during:** Task 2 (running initial tests)
- **Issue:** Tests monkey-patched process.stdout.write but output() uses fs.writeSync(1,...), causing null captures
- **Fix:** Rewrote cmdReplayList/cmdReplayDiff tests to use subprocess execution via execFileSync
- **Files modified:** tests/replay.test.cjs
- **Verification:** All 147 tests pass
- **Committed in:** 3fc4976 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 41 (Replay Diffing & Receipt Lineage) is now complete with all 4 success criteria met
- Full replay pipeline: engine core (38), rewriters (39), retargeting/IOC (40), diffing/lineage/CLI (41)
- Ready for Phase 42 (Tenant Registry & Auth) -- first multi-tenant phase

## Self-Check: PASSED

All files exist, all commit hashes verified.

---
*Phase: 41-replay-diffing-receipt-lineage*
*Completed: 2026-03-30*
