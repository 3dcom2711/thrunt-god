---
phase: 55-detection-coverage-gap-analysis
plan: 02
subsystem: intel
tags: [mcp, coverage, threat-profiles, compare-detections, suggest-detections, gap-analysis]

# Dependency graph
requires:
  - phase: 55-detection-coverage-gap-analysis
    plan: 01
    provides: "coverage.cjs with compareDetections, suggestDetections, getThreatProfile, listThreatProfiles"
  - phase: 53-mcp-hunt-intel-server
    provides: "tools.cjs registerTools pattern, withTimeout, Zod schemas, 5 existing MCP tool registrations"
provides:
  - "compare_detections MCP tool for cross-source detection comparison"
  - "suggest_detections MCP tool for tactic-family detection suggestions"
  - "analyze_coverage extended with profile parameter for threat profile gap analysis"
  - "7 total MCP tools registered (5 existing + 2 new)"
affects: [mcp-hunt-intel server, MCP agent workflows, detection gap analysis]

# Tech tracking
tech-stack:
  added: []
  patterns: [profile-or-group dual-mode tool parameter, coverage.cjs delegation from tool handlers]

key-files:
  created: []
  modified:
    - mcp-hunt-intel/lib/tools.cjs
    - tests/mcp-intel.test.cjs

key-decisions:
  - "handleCompareDetections accepts technique_id or query (one required), delegates to coverage.cjs compareDetections"
  - "handleSuggestDetections validates technique existence before delegating to suggestDetections"
  - "handleAnalyzeCoverage uses resultMeta spread pattern for group_id/group_name vs profile_name in result"
  - "group_id takes precedence over profile when both provided in analyze_coverage"
  - "analyze_coverage returns available profiles list in error message when neither group_id nor profile provided"

patterns-established:
  - "Dual-mode tool parameters (group_id vs profile) with precedence rules"
  - "Tool handlers delegate to coverage.cjs pure functions for testability"

requirements-completed: [DET-07, DET-08, DET-09]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 55 Plan 02: Cross-Case Intelligence MCP Tool Integration Summary

**2 new MCP tools (compare_detections, suggest_detections) and profile-mode analyze_coverage wired through to coverage.cjs data layer for agent-callable gap analysis**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T19:15:38Z
- **Completed:** 2026-04-08T19:20:02Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added handleCompareDetections and handleSuggestDetections tool handlers to tools.cjs, delegating to coverage.cjs
- Extended handleAnalyzeCoverage with optional profile parameter for threat profile gap analysis (ransomware, apt, etc.)
- Registered 7 total MCP tools (5 existing + compare_detections + suggest_detections) with Zod schemas
- 12 new tests (4 compare, 3 suggest, 4 profile-mode, 1 registration count) -- all 45 MCP tests pass
- All 148 tests across 4 test suites pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for new MCP tool handlers** - `556012f` (test)
2. **Task 1 GREEN: Implement tool handlers and registration** - `cba85ef` (feat)

_TDD task with RED and GREEN commits._

## Files Created/Modified
- `mcp-hunt-intel/lib/tools.cjs` - Added handleCompareDetections, handleSuggestDetections handlers; extended handleAnalyzeCoverage with profile mode; registered 7 tools total
- `tests/mcp-intel.test.cjs` - Added 12 new tests across 4 describe blocks for new handlers, profile mode, and tool count

## Decisions Made
- handleCompareDetections accepts technique_id or query (one required), returns error if neither provided
- handleSuggestDetections validates technique existence via lookupTechnique before delegating to suggestDetections
- handleAnalyzeCoverage uses spread pattern (...resultMeta) to cleanly switch between group_id/group_name and profile_name in output
- group_id always takes precedence when both group_id and profile are provided (preserves existing behavior)
- Error messages for missing parameters include available profile names for discoverability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 55 plans complete (2/2)
- 7 MCP tools fully operational: lookup_technique, search_techniques, lookup_group, generate_layer, analyze_coverage, compare_detections, suggest_detections
- Agents can now compare detection sources, analyze gaps against threat profiles, and get suggestions for uncovered techniques

---
*Phase: 55-detection-coverage-gap-analysis*
*Completed: 2026-04-08*
