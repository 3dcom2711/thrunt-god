---
phase: 15-query-analysis-upgrades
plan: 01
subsystem: ui
tags: [preact, webview, vscode-extension, query-analysis, receipt-inspector, heatmap]

# Dependency graph
requires:
  - phase: 14-evidence-board
    provides: EvidenceBoardPanel singleton pattern, store derivation pattern
  - phase: 12-design-system
    provides: shared/query-analysis.ts stub types, webview entry points
provides:
  - deriveQueryAnalysis() store method with comparison, heatmap, sort, receipt inspector
  - QueryAnalysisPanel webview provider (singleton)
  - Expanded QueryAnalysisViewModel contract with ComparisonData, HeatmapData, ReceiptInspectorData
  - thrunt-god.openQueryAnalysis and thrunt-god.openReceiptInspector commands
affects: [15-02-PLAN, 15-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [prototype.call() unit testing for store derivation, inline sort to avoid private method inaccessibility in prototype.call tests]

key-files:
  created:
    - src/queryAnalysisPanel.ts
    - test/unit/storeDeriveQueryAnalysis.test.cjs
  modified:
    - shared/query-analysis.ts
    - src/store.ts
    - src/extension.ts
    - package.json
    - test/_setup/vscode-mock.cjs

key-decisions:
  - "Inline sort logic in deriveQueryAnalysis instead of private method (prototype.call() pattern cannot access private methods)"
  - "QueryAnalysisPanel defaults selectedQueryIds to first 2 queries from store"
  - "Inspector mode opens via initialReceiptId parameter on createOrShow"

patterns-established:
  - "deriveQueryAnalysis follows same derivation-method-on-store pattern as deriveHuntOverview and deriveEvidenceBoard"
  - "QueryAnalysisPanel follows EvidenceBoardPanel singleton pattern exactly"

requirements-completed: [QANL-01, QANL-02, QANL-03, QANL-04]

# Metrics
duration: 6min
completed: 2026-04-03
---

# Phase 15 Plan 01: Query Analysis Data Pipeline Summary

**deriveQueryAnalysis() with 2-query comparison, 3+-query heatmap, sort controls, and receipt QA inspector -- wired to QueryAnalysisPanel singleton provider**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-03T00:31:07Z
- **Completed:** 2026-04-03T00:37:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Expanded shared/query-analysis.ts with ComparisonData, HeatmapData, ReceiptInspectorData, ReceiptInspectorItem types and new webview-to-host messages
- Implemented deriveQueryAnalysis() on HuntDataStore with comparison (2 queries), heatmap (3+ queries), 4 sort modes, available-sorts metadata, and receipt inspector derivation
- Created QueryAnalysisPanel following EvidenceBoardPanel singleton pattern with all message handlers
- Registered thrunt-god.openQueryAnalysis and thrunt-god.openReceiptInspector commands
- All 6 unit tests pass with 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for deriveQueryAnalysis** - `4631fcb` (test)
2. **Task 1 GREEN: Expand ViewModel and add deriveQueryAnalysis** - `c993a51` (feat)
3. **Task 2: Create QueryAnalysisPanel and register commands** - `ad62925` (feat)

## Files Created/Modified
- `shared/query-analysis.ts` - Expanded ViewModel types: ComparisonData, HeatmapData, ReceiptInspectorData, new messages
- `src/store.ts` - Added deriveQueryAnalysis() method with comparison, heatmap, sort, and inspector logic
- `src/queryAnalysisPanel.ts` - Singleton webview provider following EvidenceBoardPanel pattern
- `src/extension.ts` - Registered openQueryAnalysis and openReceiptInspector commands, added re-exports
- `package.json` - Added command declarations and activation events
- `test/unit/storeDeriveQueryAnalysis.test.cjs` - 6 unit tests covering empty store, comparison, heatmap, sort, and inspector
- `test/_setup/vscode-mock.cjs` - Added CodeActionKind mock for test compatibility

## Decisions Made
- Inlined sort logic directly in deriveQueryAnalysis instead of using a private helper method, because the prototype.call() testing pattern cannot access private methods on mock stores
- QueryAnalysisPanel defaults selectedQueryIds to the first 2 queries available in the store for immediate comparison on open
- Inspector mode is activated via optional initialReceiptId parameter on createOrShow, allowing both command-based and context-action-based opening

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CodeActionKind to vscode mock**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** vscode mock missing CodeActionKind.QuickFix, causing require of dist/extension.js to crash
- **Fix:** Added CodeActionKind, Diagnostic, and DiagnosticSeverity stubs to vscode-mock.cjs
- **Files modified:** test/_setup/vscode-mock.cjs
- **Verification:** All tests load and pass
- **Committed in:** c993a51 (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Inlined sort logic to fix prototype.call() incompatibility**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** this.sortTemplateList() not a function when called via prototype.call() on mock store
- **Fix:** Moved sort logic inline inside deriveQueryAnalysis, removed private helper method
- **Files modified:** src/store.ts
- **Verification:** All 6 tests pass
- **Committed in:** c993a51 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct test execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- deriveQueryAnalysis() and QueryAnalysisPanel ready for Plan 02 (comparison/heatmap webview rendering)
- Plan 03 (receipt QA inspector rendering) can consume ReceiptInspectorData from the store
- All types exported and accessible from the built bundle

## Self-Check: PASSED

All 7 files found, all 3 commits found, all content assertions verified, 6 test cases present.

---
*Phase: 15-query-analysis-upgrades*
*Completed: 2026-04-03*
