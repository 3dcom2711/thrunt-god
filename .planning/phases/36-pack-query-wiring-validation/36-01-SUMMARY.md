---
phase: 36-pack-query-wiring-validation
plan: 01
subsystem: cli
tags: [pack-authoring, query-templates, entity-types, validation, connectors]

# Dependency graph
requires:
  - phase: 35-pack-authoring-interactive-cli
    provides: pack-author.cjs interactive flow, CONNECTOR_LANGUAGES map, pack.cjs validation functions
provides:
  - QUERY_STARTERS constant with starter templates for all 10 built-in connectors
  - ENTITY_SCOPE_TYPES constant with 13 runtime + 7 proposed entity kinds
  - getQueryStarter() lookup function
  - runIncrementalValidation() checkpoint-based validation pipeline
  - formatValidationResults() human-readable output formatter
affects: [36-02-pack-query-wiring, 36-03-pack-query-wiring-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [checkpoint-based-validation, structured-validation-results]

key-files:
  created: [thrunt-god/bin/lib/query-starters.cjs]
  modified: []

key-decisions:
  - "HARDCODED-ENTITY-KINDS: Entity scope types hardcoded from reviewed runtime extraction list rather than dynamically reading runtime.cjs -- keeps module independently testable"

patterns-established:
  - "Checkpoint validation: runIncrementalValidation(partialPack, checkpoint) validates at named stages (identity/attack/query/final) with structured PASS/WARN/FAIL results"
  - "Starter templates: Per-connector query template starters with language and description, keyed by connector ID"

requirements-completed: [PACK-02]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 36 Plan 01: Query Starters Summary

**Per-connector query template starters for 10 connectors, 20 entity scope types, and checkpoint-based incremental validation pipeline in query-starters.cjs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T20:48:29Z
- **Completed:** 2026-03-30T20:51:07Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Created query-starters.cjs with starter query templates for all 10 built-in connectors (splunk/spl, elastic/esql, sentinel/kql, opensearch/sql, defender_xdr/kql, crowdstrike/fql, okta/api, m365/odata, aws/api, gcp/logging-filter)
- Defined 20 entity scope types (13 runtime extraction kinds + 7 proposed scope types) with kind, source, and description fields
- Implemented checkpoint-based incremental validation pipeline (identity, attack, query, final) that wraps pack.cjs validatePackDefinition
- All 35 existing pack-author tests continue to pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create query-starters.cjs with starter templates, entity types, and validation helpers** - `760509b` (feat)
2. **Task 2: Smoke-test query-starters.cjs module integrity** - no commit (verification-only task, all tests passed without fixes)

## Files Created/Modified
- `thrunt-god/bin/lib/query-starters.cjs` - Query starter templates, entity scope types, incremental validation pipeline, and formatted output helpers (226 LOC)

## Decisions Made
- HARDCODED-ENTITY-KINDS: Entity scope types hardcoded from reviewed runtime extraction list rather than dynamically importing runtime.cjs -- keeps the module independently testable and avoids circular dependency risk

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- query-starters.cjs exports are ready for Plan 02 to wire into the interactive pack-author.cjs flow
- All 5 exports (QUERY_STARTERS, ENTITY_SCOPE_TYPES, getQueryStarter, runIncrementalValidation, formatValidationResults) are accessible and tested
- Validation pipeline works at all 4 checkpoints with structured results

## Self-Check: PASSED

- FOUND: thrunt-god/bin/lib/query-starters.cjs
- FOUND: .planning/phases/36-pack-query-wiring-validation/36-01-SUMMARY.md
- FOUND: commit 760509b

---
*Phase: 36-pack-query-wiring-validation*
*Completed: 2026-03-30*
