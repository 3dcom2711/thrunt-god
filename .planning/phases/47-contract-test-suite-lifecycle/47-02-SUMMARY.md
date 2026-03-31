---
phase: 47-contract-test-suite-lifecycle
plan: 02
subsystem: testing
tags: [contract-tests, plugin-lifecycle, connector-sdk, cli, doctor-connectors]

# Dependency graph
requires:
  - phase: 47-contract-test-suite-lifecycle (plan 01)
    provides: contract-tests.cjs with runContractTests and helper factories
  - phase: 46-plugin-manifest-discovery
    provides: plugin-registry.cjs with discoverPlugins, loadPlugin, createPluginRegistry
provides:
  - Contract test functions re-exported through connector-sdk.cjs and runtime.cjs
  - cmdDoctorConnectors command for per-connector validation
  - CLI routing for `thrunt runtime doctor-connectors`
affects: [48-built-in-connector-migration, 49-ecosystem-tooling]

# Tech tracking
tech-stack:
  added: []
  patterns: [deferred-object-assign-circular-require, fs-writeSync-output-interception]

key-files:
  created:
    - tests/contract-lifecycle.test.cjs
  modified:
    - thrunt-god/bin/lib/connector-sdk.cjs
    - thrunt-god/bin/lib/runtime.cjs
    - thrunt-god/bin/lib/commands.cjs
    - thrunt-god/bin/thrunt-tools.cjs
    - tests/sdk-exports.test.cjs

key-decisions:
  - "Deferred Object.assign for connector-sdk.cjs re-exports avoids circular require with contract-tests.cjs"
  - "Explicit runtime.cjs contract-test re-exports because ...sdk spread evaluates before deferred Object.assign"
  - "cmdDoctorConnectors performs 3 checks per connector: adapter_registered, adapter_valid, capabilities_complete plus manifest_cross_check for non-built-in plugins"

patterns-established:
  - "Deferred re-export pattern: Object.assign after module.exports for circular dependency avoidance"
  - "fs.writeSync(1, ...) interception for testing commands that use core.cjs output()"

requirements-completed: [ECO-03]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 47 Plan 02: Plugin Lifecycle Wiring Summary

**Contract test functions re-exported through connector-sdk.cjs and runtime.cjs, cmdDoctorConnectors validates all plugins through full lifecycle with per-connector readiness checks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T02:51:32Z
- **Completed:** 2026-03-31T02:57:31Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 6

## Accomplishments
- Re-exported runContractTests, createTestQuerySpec, createTestProfile, createTestSecrets through connector-sdk.cjs using deferred Object.assign to avoid circular require
- Added explicit contract-test re-exports in runtime.cjs module.exports (4 new exports, total now 83)
- Implemented cmdDoctorConnectors in commands.cjs: discovers all plugins (built-in + installed), validates adapter registration, adapter structure, manifest cross-check, and capabilities completeness
- Wired `doctor-connectors` subcommand in thrunt-tools.cjs runtime case block
- 15 lifecycle tests covering re-exports, full lifecycle simulation, doctor output shape, and CLI routing

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing lifecycle tests** - `b59bf54` (test)
2. **Task 1 GREEN: Implementation** - `ab74c55` (feat)

**Plan metadata:** (pending final commit)

_TDD task: RED commit (15 failing tests) followed by GREEN commit (all pass)_

## Files Created/Modified
- `tests/contract-lifecycle.test.cjs` - 15 tests: re-export verification, lifecycle simulation, doctor output shape, CLI routing
- `thrunt-god/bin/lib/connector-sdk.cjs` - Deferred Object.assign re-exports for contract-tests.cjs functions
- `thrunt-god/bin/lib/runtime.cjs` - Explicit re-exports for 4 contract-test functions (total exports: 83)
- `thrunt-god/bin/lib/commands.cjs` - cmdDoctorConnectors function with 4-check validation per connector
- `thrunt-god/bin/thrunt-tools.cjs` - CLI routing for `runtime doctor-connectors` subcommand
- `tests/sdk-exports.test.cjs` - Updated expected export count from 79 to 83

## Decisions Made
- **Deferred Object.assign pattern:** connector-sdk.cjs cannot require contract-tests.cjs at module load time (circular). Used `Object.assign(module.exports, ...)` after module.exports to break the cycle. Node.js module cache ensures all consumers see the added properties.
- **Explicit runtime.cjs re-exports:** The `...sdk` spread in runtime.cjs evaluates at module definition time, before connector-sdk.cjs's deferred Object.assign runs. So runtime.cjs needs explicit `require('./contract-tests.cjs').X` entries.
- **Doctor checks structure:** cmdDoctorConnectors performs adapter_registered, adapter_valid, capabilities_complete for all connectors, plus manifest_cross_check for non-built-in plugins. Returns structured JSON with total/passing/failing summary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sdk-exports.test.cjs expected count**
- **Found during:** Task 1 GREEN (regression testing)
- **Issue:** sdk-exports.test.cjs expected 79 total runtime.cjs exports but actual was 83 after adding 4 contract-test re-exports
- **Fix:** Updated expected count from 79 to 83 with updated comment explaining the breakdown
- **Files modified:** tests/sdk-exports.test.cjs
- **Verification:** `node --test tests/sdk-exports.test.cjs` passes
- **Committed in:** ab74c55 (part of Task 1 GREEN commit)

**2. [Rule 1 - Bug] Fixed test output capture for fs.writeSync**
- **Found during:** Task 1 GREEN (test failures in cmdDoctorConnectors tests)
- **Issue:** Tests intercepted process.stdout.write but core.cjs output() uses fs.writeSync(1, data) for synchronous stdout writes
- **Fix:** Updated test captureOutput helper to intercept fs.writeSync instead
- **Files modified:** tests/contract-lifecycle.test.cjs
- **Verification:** All 3 cmdDoctorConnectors tests pass
- **Committed in:** ab74c55 (part of Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 47 complete: contract-tests.cjs with runContractTests, helper factories, re-exports through SDK and runtime
- Plugin lifecycle fully wired: install -> validate -> register -> use
- Ready for Phase 48 (Built-in Connector Migration) or Phase 49 (Ecosystem Tooling)

---
*Phase: 47-contract-test-suite-lifecycle*
*Completed: 2026-03-31*
