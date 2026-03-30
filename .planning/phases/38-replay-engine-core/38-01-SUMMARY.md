---
phase: 38-replay-engine-core
plan: 01
subsystem: runtime
tags: [replay, zod, mutation-engine, query-artifacts, time-window]

# Dependency graph
requires:
  - phase: 33-sdk-export-surface
    provides: "createQuerySpec, normalizeTimeWindow, isPlainObject, cloneObject exports from runtime.cjs"
  - phase: 24-evidence-integrity
    provides: "computeContentHash from manifest.cjs, extractFrontmatter from frontmatter.cjs, evidence artifact format"
provides:
  - "ReplaySpec Zod schema (ReplaySpecSchema) for validation"
  - "createReplaySpec() with auto-generated RPL-prefixed IDs"
  - "resolveReplaySource() with three-strategy artifact resolution"
  - "applyMutations() with absolute/shift/lookback time modes"
  - "parseShiftDuration() for [-]N[d|h|m] to milliseconds conversion"
  - "makeReplayId() for RPL-{YYYYMMDDHHMMSS}-{RANDOM8} generation"
affects: [39-query-rewriter, 40-ioc-injection, 41-diff-engine, replay-cli]

# Tech tracking
tech-stack:
  added: [zod-replay-schema]
  patterns: [replay-spec-schema, source-resolution-pipeline, mutation-engine, manifest-first-integrity]

key-files:
  created:
    - thrunt-god/bin/lib/replay.cjs
    - tests/replay.test.cjs
  modified: []

key-decisions:
  - "REPLAY-NO-EVIDENCE-IMPORT: Do not import evidence.cjs or telemetry.cjs at top level -- Phase 38 scope is schema + source resolution + mutations only; execution pipeline is Phase 39+"
  - "MANIFEST-FIRST-INTEGRITY: Source resolution checks MANIFESTS/*.json first for content hash verification before reading QUERIES/*.md"
  - "UNIFORM-SHIFT-PRESERVES-GAP: Shift mode applies same delta to both start and end, always preserving the original time window duration"
  - "HUNT-PHASE-STUB: hunt_phase source type returns empty array with warning -- full implementation deferred to later phase"

patterns-established:
  - "ReplaySpec schema: Transformation descriptor (not a query) with source, mutations, diff, evidence.lineage fields"
  - "Three-strategy source resolution: MANIFESTS/*.json (preferred) > QUERIES/*.md (fallback) > METRICS/*.json (cross-ref)"
  - "Graceful degradation: Missing files produce warnings in results array, never throw"
  - "Mutation pipeline: Deep-clone original, apply mutations, validate through createQuerySpec()"

requirements-completed: [REPLAY-01]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 38 Plan 01: Replay Engine Core Summary

**ReplaySpec Zod schema with three-strategy source resolution, time window mutation engine (absolute/shift/lookback), and 30 comprehensive tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T21:53:53Z
- **Completed:** 2026-03-30T21:58:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ReplaySpec Zod schema validating version, replay_id, source, mutations, diff, evidence.lineage fields
- createReplaySpec() with auto-generated RPL-{YYYYMMDDHHMMSS}-{RANDOM8} replay IDs and Zod validation
- resolveReplaySource() handling MANIFESTS/*.json (preferred), QUERIES/*.md (fallback), METRICS/*.json (cross-ref) with manifest-first integrity verification
- applyMutations() supporting three time mutation modes (absolute, shift, lookback) plus connector, parameters, execution mutations
- parseShiftDuration() converting [-]N[d|h|m] format to milliseconds
- 30 passing tests, 2044 total suite passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: ReplaySpec Zod schema, createReplaySpec, parseShiftDuration, applyMutations** - `b97b2f5` (feat)
2. **Task 2: resolveReplaySource with three-strategy artifact resolution** - `8416247` (feat)

## Files Created/Modified
- `thrunt-god/bin/lib/replay.cjs` - Core replay engine: ReplaySpec schema, createReplaySpec, resolveReplaySource, applyMutations, parseShiftDuration (446 lines)
- `tests/replay.test.cjs` - Comprehensive test suite: schema validation, shift parsing, mutation application, source resolution from all artifact types (570 lines)

## Decisions Made
- **REPLAY-NO-EVIDENCE-IMPORT:** Do not import evidence.cjs or telemetry.cjs at top level -- Phase 38 scope is schema + source resolution + mutations only; execution pipeline is Phase 39+
- **MANIFEST-FIRST-INTEGRITY:** Source resolution checks MANIFESTS/*.json first for content hash verification before reading QUERIES/*.md, emitting integrity warnings on hash mismatch
- **UNIFORM-SHIFT-PRESERVES-GAP:** Shift mode applies same delta to both start and end, always preserving the original time window duration; only absolute mode can cause start >= end violations
- **HUNT-PHASE-STUB:** hunt_phase source type returns empty array with warning -- full implementation deferred to later phase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shift-makes-start->=end test**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Plan specified testing that a shift could make start >= end, but uniform shift mode always preserves the time window duration -- both start and end shift by the same delta
- **Fix:** Changed test to verify absolute mode rejects start >= end (correct behavior the code enforces)
- **Files modified:** tests/replay.test.cjs
- **Verification:** All 20 Task 1 tests pass
- **Committed in:** b97b2f5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test logic)
**Impact on plan:** Test correction reflects actual mutation semantics. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- replay.cjs module exports all 6 functions needed by Phases 39-41
- ReplaySpec schema fully defined and validated via Zod
- Source resolution pipeline tested with all three artifact strategies
- Mutation engine ready for query rewriting (Phase 39), IOC injection (Phase 40), and diff engine (Phase 41)
- No circular imports: replay.cjs safely imports from runtime.cjs, core.cjs, manifest.cjs, frontmatter.cjs

## Self-Check: PASSED

- FOUND: thrunt-god/bin/lib/replay.cjs
- FOUND: tests/replay.test.cjs
- FOUND: .planning/phases/38-replay-engine-core/38-01-SUMMARY.md
- FOUND: b97b2f5 (Task 1 commit)
- FOUND: 8416247 (Task 2 commit)

---
*Phase: 38-replay-engine-core*
*Completed: 2026-03-30*
