---
phase: 16-evidence-review-publish-gates
plan: 01
subsystem: evidence
tags: [quality-scoring, publish-gate, contradictions, blind-spots, chain-of-custody, cli]

# Dependency graph
requires:
  - phase: 14-hashing-signatures-provenance
    provides: verifyManifestIntegrity, computeManifestHash, buildProvenance in manifest.cjs
  - phase: 15-evidence-export-bundles
    provides: chain-of-custody pattern in bundle.cjs, MANIFESTS directory with provenance metadata
provides:
  - Evidence quality scoring across receipt coverage, integrity, and provenance completeness
  - Publish gate that blocks publication when quality score falls below configurable threshold
  - Contradiction detection for hypotheses with conflicting findings
  - Blind spot detection for hypotheses with zero receipts
  - Chain-of-custody timeline aggregating provenance from all manifests
  - CLI evidence review command with JSON and Markdown output modes
  - publish_quality_threshold config key with 0-1 range validation
affects: [detection-promotion, publication, escalation, evidence-bundles]

# Tech tracking
tech-stack:
  added: []
  patterns: [dimension-based-scoring, composite-score-with-penalty, config-driven-gating]

key-files:
  created:
    - thrunt-god/bin/lib/review.cjs
    - tests/review.test.cjs
  modified:
    - thrunt-god/bin/lib/config.cjs
    - thrunt-god/bin/lib/core.cjs
    - thrunt-god/bin/thrunt-tools.cjs

key-decisions:
  - "Composite score from average of three positive dimensions minus contradiction penalty (0.1 per contradiction), floored at 0.0"
  - "Division by zero for empty dimensions returns 1.0 (vacuously true -- no evidence to fail)"
  - "Non-raw CLI output writes Markdown directly via output() with raw=true to bypass JSON serialization"
  - "Added max validation support to config.cjs number type rules for publish_quality_threshold 0-1 range"

patterns-established:
  - "Dimension-based scoring: each quality dimension returns {score, total, detail_count, detail_array} for uniform inspection"
  - "Config-driven gating: publish threshold stored in config.json, CLI respects --force for override"
  - "Contradiction detection: group findings by hypothesis, check for both confirmed and refuted statuses"

hypotheses-completed: [HYP-03]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 16 Plan 01: Evidence Review & Publish Gates Summary

**Evidence quality scoring with three-dimension composite, publish gate with configurable threshold and force override, contradiction/blind-spot surfacing, chain-of-custody timeline, and CLI evidence review command**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T18:13:47Z
- **Completed:** 2026-03-27T18:19:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built review.cjs with 7 exported functions: scoreEvidenceQuality, checkPublishGate, detectContradictions, detectBlindSpots, buildChainOfCustody, renderReviewMarkdown, cmdEvidenceReview
- Composite quality score from three dimensions (receipt coverage, integrity, provenance completeness) minus contradiction penalty, with division-by-zero safety returning 1.0 for empty dimensions
- Publish gate blocks publication when quality score falls below configurable threshold (default 0.7), with --force override that logs the override reason
- Registered publish_quality_threshold config key with number type validation (min 0, max 1), including new max validation support for number rules
- CLI `evidence review` command producing JSON (--raw) or Markdown output with Score Summary, Dimension Breakdown, Contradictions, Blind Spots, Chain of Custody, and Gate Status sections
- 29 new tests covering all scoring dimensions, gate logic, contradictions, blind spots, chain-of-custody, division-by-zero, phase filtering, CLI integration, and module exports
- Full test suite expanded from 1696 to 1725 tests, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `1fcff4c` (test)
2. **Task 1 GREEN: review.cjs implementation** - `021ad18` (feat)
3. **Task 2: Config registration + CLI wiring** - `0e872db` (feat)

## Files Created/Modified
- `thrunt-god/bin/lib/review.cjs` - Evidence quality scoring, publish gating, contradiction detection, blind spots, chain-of-custody, Markdown rendering, CLI entry point
- `tests/review.test.cjs` - 29 tests covering all review.cjs functions, edge cases, and CLI integration
- `thrunt-god/bin/lib/config.cjs` - Added publish_quality_threshold to VALID_CONFIG_KEYS and CONFIG_VALUE_RULES, added max validation for number rules
- `thrunt-god/bin/lib/core.cjs` - Added publish_quality_threshold to loadConfig defaults (0.7) and return shape
- `thrunt-god/bin/thrunt-tools.cjs` - Wired evidence review subcommand with --phase, --format, --force flags

## Decisions Made
- Composite score formula: average(receipt_coverage, integrity, provenance_completeness) - (0.1 * contradiction_count), floored at 0.0
- Division by zero returns 1.0 (vacuously true) for all three dimensions when denominator is 0
- Non-raw CLI output uses output(result, true, markdownString) to bypass JSON serialization and write Markdown directly
- Added max validation to config.cjs number type rules (was missing) to support publish_quality_threshold 0-1 range

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-raw CLI output writing JSON instead of Markdown**
- **Found during:** Task 1 verification (CLI tests)
- **Issue:** When --raw is not set, output(result, false, md) falls through to JSON branch because raw is falsy
- **Fix:** Changed to output(result, true, md) so the Markdown string is written as raw text
- **Files modified:** thrunt-god/bin/lib/review.cjs
- **Verification:** CLI test "outputs Markdown when --raw is not set" passes
- **Committed in:** 0e872db (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added max validation for number type config rules**
- **Found during:** Task 2 (config.cjs modification)
- **Issue:** CONFIG_VALUE_RULES number validation only handled min, not max -- publish_quality_threshold needs max: 1
- **Fix:** Added max check in normalizeAndValidateConfigValue after the existing min check
- **Files modified:** thrunt-god/bin/lib/config.cjs
- **Verification:** All config tests pass, publish_quality_threshold rejects values > 1
- **Committed in:** 0e872db (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## Known Stubs
None. All functions are fully implemented with real data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Evidence quality evaluation is complete and can be used by downstream publication and escalation workflows
- The publish gate is wired and configurable via config-set
- Contradiction and blind spot detection provides the foundation for evidence review workflows
- Chain-of-custody timeline is ready for trust decision support

---
*Phase: 16-evidence-review-publish-gates*
*Completed: 2026-03-27*
