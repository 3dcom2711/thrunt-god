---
phase: 19-promotion-workflow-integrations
plan: 01
subsystem: detection
tags: [promotion, rejection, gates, receipts, hooks, evidence-quality, cli]

# Dependency graph
requires:
  - phase: 18-detection-generation-backtesting
    provides: backtestDetection, scoreNoise, validateStructure, atomic writes, promotion_readiness scoring
  - phase: 16-evidence-review-publish-gates
    provides: scoreEvidenceQuality composite scoring, publish_quality_threshold config pattern
  - phase: 14-evidence-manifest-signing
    provides: computeContentHash, canonicalSerialize, detectRuntimeName, applySignatureHooks pattern
provides:
  - Three-gate promotion workflow (backtest_passed + readiness_threshold + analyst_approval)
  - Promotion receipt (PROM-*.json) with full provenance and content hash
  - Rejection receipt (REJ-*.json) with audit trail and reason
  - Bulk promotion with per-candidate error isolation
  - Detection status grouping by lifecycle (draft/promoted/rejected)
  - Promotion hooks (beforePromote/afterPromote) when promotion_hooks_enabled is true
  - Config keys: promotion_readiness_threshold and promotion_hooks_enabled
  - CLI commands: detection promote, reject, status
  - Evidence quality promotion bonus (+0.05 per promoted detection, capped at +0.15)
affects: [20-learning-feedback-loops, evidence-review, detection-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-gate promotion pattern (cheapest gate first evaluation order)
    - Atomic receipt writes (tmp + rename) for promotion and rejection
    - Hook-based integration surface following manifest.cjs applySignatureHooks pattern
    - Filesystem-based feedback loop (review.cjs reads PROM-*.json directly, no circular import)

key-files:
  created: []
  modified:
    - thrunt-god/bin/lib/detection.cjs
    - thrunt-god/bin/lib/config.cjs
    - thrunt-god/bin/lib/core.cjs
    - thrunt-god/bin/lib/review.cjs
    - thrunt-god/bin/thrunt-tools.cjs
    - tests/detection.test.cjs
    - tests/config.test.cjs
    - tests/review.test.cjs

key-decisions:
  - "Three gates evaluated cheapest-first: backtest lookup, readiness threshold, analyst approval"
  - "review.cjs reads PROM-*.json via filesystem to avoid circular dependency with detection.cjs"
  - "Promotion bonus is additive to composite score, not a 4th dimension in the average"
  - "Bulk promote filters to draft-status candidates, wraps each in try/catch for error isolation"
  - "detectRuntimeName() used as default promoted_by/rejected_by identifier"

patterns-established:
  - "Three-gate promotion: backtest_passed, readiness_threshold, analyst_approval evaluated in order"
  - "Atomic receipt writes for PROM-*.json and REJ-*.json using tmp + rename"
  - "Promotion hooks: beforePromote/afterPromote following manifest.cjs hook pattern"
  - "Filesystem-based feedback: review.cjs reads receipts directly, no cross-module import"

hypotheses-completed: [HYP-04]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 19 Plan 01: Promotion Workflow Summary

**Three-gate detection promotion with receipts, rejection audit trail, bulk ops, status reporting, hook integration, and evidence quality feedback from promoted detections**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T20:52:04Z
- **Completed:** 2026-03-27T20:58:24Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Built complete three-gate promotion engine (backtest_passed, readiness_threshold, analyst_approval) with structured gate results
- Implemented PROM-*.json and REJ-*.json receipt system with atomic writes, content hashes, and full provenance
- Added promotion_coverage bonus to evidence quality scoring (+0.05/promoted, capped at +0.15) with zero circular dependencies
- Wired CLI commands (promote, reject, status) with bulk promotion support and per-candidate error isolation
- Registered promotion_readiness_threshold and promotion_hooks_enabled config keys in all 3 locations
- All 1826 tests pass with 30 new tests added (23 detection + 7 review)

## Task Commits

Each task was committed atomically:

1. **Task 1: Config registration, promotion/rejection/status engine, hooks, and CLI wiring** - `f7d25c3` (feat)
2. **Task 2: Evidence quality feedback from promoted detections in review.cjs** - `839bbdf` (feat)

## Files Created/Modified

- `thrunt-god/bin/lib/detection.cjs` - Added promoteDetection, rejectDetection, detectionStatus, checkPromotionGates, applyPromotionHooks, makePromotionId, makeRejectionId, findLatestBacktest, writePromotedRule, cmdDetectionPromote, cmdDetectionReject, cmdDetectionStatus
- `thrunt-god/bin/lib/config.cjs` - Registered promotion_readiness_threshold and promotion_hooks_enabled in VALID_CONFIG_KEYS and CONFIG_VALUE_RULES
- `thrunt-god/bin/lib/core.cjs` - Added promotion_readiness_threshold (default 0.6) and promotion_hooks_enabled (default false) to loadConfig defaults and return object
- `thrunt-god/bin/lib/review.cjs` - Added readPromotionReceipts helper and promotion_coverage bonus in scoreEvidenceQuality
- `thrunt-god/bin/thrunt-tools.cjs` - Added promote, reject, status subcommands to detection case block
- `tests/detection.test.cjs` - 23 new tests for gates, promote, reject, status, hooks, bulk, CLI
- `tests/config.test.cjs` - 6 new tests for promotion_readiness_threshold and promotion_hooks_enabled
- `tests/review.test.cjs` - 7 new tests for promotion coverage feedback

## Decisions Made

- Three gates evaluated cheapest-first: backtest file lookup (disk), then readiness threshold comparison (memory), then analyst approval flag check (options)
- review.cjs reads PROM-*.json files directly via fs.readdirSync to avoid circular dependency with detection.cjs
- Promotion bonus is additive to the composite score (not a 4th dimension in the 3-way average) per research guidance
- Bulk promote filters to draft-status candidates matching the phase, wraps each in try/catch for error isolation
- detectRuntimeName() from manifest.cjs used as default promoted_by/rejected_by identifier when not explicitly provided
- Promoted rule files written to DETECTIONS/promotions/rules/ with .meta.json sidecar containing candidate metadata

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired with real data sources.

## Next Phase Readiness

- Detection promotion pipeline is complete: candidates can be promoted through three explicit gates with full provenance
- Evidence quality scoring reflects promotion coverage, closing the hunt-to-detection feedback loop
- Hook interface (beforePromote/afterPromote) ready for external integration when promotion_hooks_enabled is set to true
- Ready for Phase 20: learning feedback loops

## Self-Check: PASSED

All files exist, all commits verified (f7d25c3, 839bbdf). Full test suite: 1826 pass, 0 fail.

---
*Phase: 19-promotion-workflow-integrations*
*Completed: 2026-03-27*
