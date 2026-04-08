---
phase: 57-agent-wiring-workflow-integration
plan: 01
subsystem: cli, agents
tags: [mcp, att&ck, detection-coverage, agent-frontmatter, hunt-intel]

requires:
  - phase: 55-detection-analysis
    provides: "compareDetections coverage analysis function"
  - phase: 53-mcp-server
    provides: "openIntelDb and intel.db schema"
  - phase: 52-cross-case-intelligence
    provides: "extractTechniqueIds, past_case_matches in cmdCaseNew"
provides:
  - "Agent frontmatter with mcp__thrunt_hunt_intel__* tool access"
  - "Detection coverage auto-lookup in cmdCaseNew output"
  - "Non-fatal coverage degradation when mcp-hunt-intel unavailable"
affects: [57-02, agent-workflows, hunt-planner, signal-triager, query-writer]

tech-stack:
  added: []
  patterns: ["lazy require for optional MCP module dependencies", "non-fatal coverage lookup with try/catch"]

key-files:
  created: []
  modified:
    - agents/thrunt-query-writer.md
    - agents/thrunt-signal-triager.md
    - agents/thrunt-hunt-planner.md
    - thrunt-god/bin/lib/commands.cjs
    - tests/commands.test.cjs

key-decisions:
  - "Wildcard mcp__thrunt_hunt_intel__* grants all 10 MCP tools to each agent via single entry"
  - "Detection coverage lookup uses same lazy require pattern as db.cjs for non-fatal degradation"
  - "Coverage results mapped to flat source strings (not full objects) for concise CLI output"

patterns-established:
  - "Agent MCP tool wiring: single wildcard entry per MCP server in tools field"
  - "Lazy require pattern for optional cross-package dependencies (intel.cjs, coverage.cjs)"

requirements-completed: [WIRE-01, WIRE-02]

duration: 3min
completed: 2026-04-08
---

# Phase 57 Plan 01: Agent Wiring & Workflow Integration Summary

**MCP hunt intel tools wired into 3 agent frontmatter files; cmdCaseNew auto-runs detection coverage lookup for technique IDs in case name**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T20:08:51Z
- **Completed:** 2026-04-08T20:12:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All 3 hunt agents (query-writer, signal-triager, hunt-planner) now have `mcp__thrunt_hunt_intel__*` in their tools field, granting access to all 10 MCP hunt intel tools
- cmdCaseNew extracts technique IDs from case name and auto-runs detection coverage lookup via compareDetections, returning results in output JSON alongside past_case_matches
- Coverage lookup is non-fatal: gracefully returns empty array when mcp-hunt-intel modules are unavailable or intel.db has no matching detections
- 4 new tests verify detection_coverage output, field structure, empty results, and degradation behavior; all 110 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mcp__thrunt_hunt_intel__* tools to agent frontmatter** - `eecfa8d` (feat)
2. **Task 2 RED: Add failing tests for detection coverage** - `b2ec7e6` (test)
3. **Task 2 GREEN: Implement detection coverage auto-lookup** - `587485f` (feat)

## Files Created/Modified
- `agents/thrunt-query-writer.md` - Added mcp__thrunt_hunt_intel__* to tools field
- `agents/thrunt-signal-triager.md` - Added mcp__thrunt_hunt_intel__* to tools field
- `agents/thrunt-hunt-planner.md` - Added mcp__thrunt_hunt_intel__* to tools field
- `thrunt-god/bin/lib/commands.cjs` - Lazy require for intel/coverage modules; detection coverage lookup in cmdCaseNew; detection_coverage in output
- `tests/commands.test.cjs` - 4 new tests for cmdCaseNew detection coverage

## Decisions Made
- Used wildcard `mcp__thrunt_hunt_intel__*` pattern (consistent with existing mcp__context7__*, mcp__firecrawl__*, mcp__exa__* patterns) to grant all 10 tools with a single entry
- Lazy require with try/catch for mcp-hunt-intel modules follows same pattern established in Phase 52 for db.cjs
- Coverage sources mapped to flat strings (`result.sources.map(s => s.source)`) for concise JSON output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent frontmatter is wired; agents can now call all 10 MCP hunt intel tools natively
- cmdCaseNew returns both past_case_matches and detection_coverage for full situational awareness
- Ready for Plan 02: pre-built MCP prompts for common hunt workflows

---
*Phase: 57-agent-wiring-workflow-integration*
*Completed: 2026-04-08*
