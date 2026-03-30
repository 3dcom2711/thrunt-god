---
phase: 39-per-language-query-rewriters
plan: 01
subsystem: replay
tags: [regex, spl, esql, eql, kql, opensearch-sql, time-rewriting, query-languages]

requires:
  - phase: 38-replay-engine-core
    provides: ReplaySpec schema, applyMutations pipeline, module.exports surface

provides:
  - rewriteSplTime -- replaces earliest=/latest= patterns with absolute ISO timestamps
  - rewriteEsqlTime -- replaces @timestamp comparisons with new timestamps
  - rewriteEqlTime -- filter-param approach with range filter on @timestamp
  - rewriteKqlTime -- handles TimeGenerated (Sentinel) and Timestamp (Defender XDR)
  - rewriteOpenSearchSqlTime -- replaces WHERE timestamp clauses with single-quoted ISO
  - TIME_REWRITERS registry mapping language keys to rewriter functions
  - rewriteQueryTime dispatcher with NO_TIME_REWRITER fallback

affects: [40-ioc-injection-engine, 41-replay-executor]

tech-stack:
  added: []
  patterns: [per-language-rewriter-registry, filter-param-approach-eql, regex-based-time-substitution]

key-files:
  created: []
  modified:
    - thrunt-god/bin/lib/replay.cjs
    - tests/replay.test.cjs

key-decisions:
  - "REGEX-NOT-PARSER: Rewriters use regex patterns rather than full language parsers -- handles common patterns and warns on complex/ambiguous constructs"
  - "EQL-FILTER-PARAM: EQL uses filter-parameter approach (returns filter object) rather than statement rewriting -- aligns with how prepareQuery passes spec.parameters.filter"
  - "ABSOLUTE-ISO-ALWAYS: All rewriters replace with absolute ISO timestamps to remove relative-time ambiguity"
  - "BETWEEN-FIRST: BETWEEN patterns matched before individual comparisons to avoid double-matching"

patterns-established:
  - "Per-language rewriter registry: TIME_REWRITERS maps language keys to (statement, originalTW, newTW, options) => result functions"
  - "Rewriter return contract: { rewritten, modifications[], warnings[] } with optional filter for EQL"
  - "Warning code taxonomy: STATEMENT_TIME_UNCHANGED, EVAL_TIME_REFERENCE, COMPUTED_TIMESTAMP, RETENTION_EXCEEDED, NO_TIME_REWRITER"

requirements-completed: [REPLAY-02]

duration: 3min
completed: 2026-03-30
---

# Phase 39 Plan 01: Per-Language Query Rewriters Summary

**Regex-based time rewriters for 5 query languages (SPL, ES|QL, EQL, KQL, OpenSearch SQL) with TIME_REWRITERS registry and rewriteQueryTime dispatcher**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T22:06:35Z
- **Completed:** 2026-03-30T22:09:24Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Implemented 5 per-language rewriter functions each following the { rewritten, modifications, warnings } contract
- TIME_REWRITERS registry maps spl/esql/eql/kql/sql to rewriter functions; rewriteQueryTime dispatches with NO_TIME_REWRITER fallback
- EQL rewriter uses filter-param approach (returns filter object, does not modify statement), with optional merge for existing filters
- Warning taxonomy: STATEMENT_TIME_UNCHANGED (4 rewriters), EVAL_TIME_REFERENCE (SPL), COMPUTED_TIMESTAMP (ES|QL), RETENTION_EXCEEDED (Defender XDR 30-day cap)
- 30 new tests cover all rewriters' happy path, no-match path, edge cases, and warning paths; all 60 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement per-language time rewriters and TIME_REWRITERS registry** (TDD)
   - RED: `bafcff3` (test) - 30 failing tests across 7 describe blocks
   - GREEN: `4cf3b21` (feat) - All 5 rewriters, registry, dispatcher; all 60 tests pass

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `thrunt-god/bin/lib/replay.cjs` - Added 5 rewriter functions, TIME_REWRITERS registry, rewriteQueryTime dispatcher (+212 lines)
- `tests/replay.test.cjs` - Added 7 describe blocks with 30 tests covering all rewriters (+291 lines)

## Decisions Made
- REGEX-NOT-PARSER: Rewriters use regex patterns rather than full language parsers -- handles common patterns and warns on complex/ambiguous constructs
- EQL-FILTER-PARAM: EQL uses filter-parameter approach (returns filter object) rather than statement rewriting -- aligns with how prepareQuery passes spec.parameters.filter
- ABSOLUTE-ISO-ALWAYS: All rewriters replace with absolute ISO timestamps to remove relative-time ambiguity
- BETWEEN-FIRST: BETWEEN patterns matched before individual comparisons in ES|QL and OpenSearch SQL to avoid double-matching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 rewriter exports available for downstream phases (IOC injection, replay executor)
- TIME_REWRITERS registry extensible for future language additions
- rewriteQueryTime dispatcher ready for integration with applyMutations pipeline

---
*Phase: 39-per-language-query-rewriters*
*Completed: 2026-03-30*
