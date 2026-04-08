---
phase: 57-agent-wiring-workflow-integration
plan: 02
subsystem: mcp
tags: [mcp, prompts, att&ck, threat-profiles, workflows]

# Dependency graph
requires:
  - phase: 55-coverage-analysis-threat-profiles
    provides: THREAT_PROFILES, getThreatProfile, listThreatProfiles, compareDetections
  - phase: 53-mcp-intel-server-attck-tools
    provides: MCP server infrastructure, intel.cjs lookupTechnique, openIntelDb
provides:
  - 4 pre-built MCP prompts for common hunt workflows (ransomware-readiness, apt-emulation, detection-sprint, soc-investigation)
  - registerPrompts function for server wiring
  - buildPromptContent function for structured prompt assembly
affects: [mcp-hunt-intel, hunt-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MCP prompt registration via server.prompt() alongside tool registration"
    - "Prompt content assembly from threat profiles + detection coverage + suggested approach"

key-files:
  created:
    - mcp-hunt-intel/lib/prompts.cjs
    - tests/mcp-prompts.test.cjs
  modified:
    - mcp-hunt-intel/bin/server.cjs

key-decisions:
  - "buildPromptContent uses lookupTechnique + compareDetections per technique for real-time coverage data"
  - "detection-sprint uses null profiles (listThreatProfiles()) to dynamically include all profiles"
  - "Prompt output structured as markdown with Threat Profiles, Coverage Summary, Technique Details (gaps/covered), Suggested Approach sections"

patterns-established:
  - "MCP prompt registration: define PROMPT_DEFS constant, registerPrompts iterates and calls server.prompt()"
  - "Prompt content builder: gather profiles -> resolve techniques -> check coverage -> assemble markdown sections"

requirements-completed: [WIRE-03]

# Metrics
duration: 3min
completed: 2026-04-08
---

# Phase 57 Plan 02: MCP Workflow Prompts Summary

**4 pre-built MCP prompts (ransomware-readiness, apt-emulation, detection-sprint, soc-investigation) backed by THREAT_PROFILES with real-time detection coverage and structured guidance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T20:08:49Z
- **Completed:** 2026-04-08T20:11:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created prompts.cjs module with 4 prompt definitions backed by existing THREAT_PROFILES from coverage.cjs
- Each prompt returns structured content: threat profile summary, coverage stats (covered/gap counts), technique details grouped by coverage status, and actionable suggested approach
- Wired registerPrompts into server.cjs startup alongside registerTools
- 9 tests validating all 4 prompts produce correct content with expected sections and techniques

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompts.cjs module with 4 MCP prompt registrations (RED)** - `dea8cc7` (test)
2. **Task 1: Create prompts.cjs module with 4 MCP prompt registrations (GREEN)** - `7c60044` (feat)
3. **Task 2: Wire registerPrompts into MCP server entry point** - `e6c4930` (feat)

_Note: Task 1 was TDD with RED/GREEN commits_

## Files Created/Modified
- `mcp-hunt-intel/lib/prompts.cjs` - Prompt definitions, buildPromptContent, registerPrompts (187 lines)
- `mcp-hunt-intel/bin/server.cjs` - Added require and registerPrompts call after registerTools
- `tests/mcp-prompts.test.cjs` - 9 tests across 3 describe blocks verifying all 4 prompts

## Decisions Made
- buildPromptContent calls lookupTechnique + compareDetections per technique for real-time coverage data rather than caching
- detection-sprint uses `profiles: null` which triggers `listThreatProfiles()` to dynamically include all 6 profiles
- Prompt output uses markdown sections (Threat Profiles, Coverage Summary, Technique Details, Suggested Approach) for LLM-friendly structured content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failure in mcp-intel.test.cjs: "registers exactly 7 tools on the server" expects 7 but gets 10 (Phase 56 added 3 KG tools). Not caused by this plan's changes. Out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 MCP prompts registered and functional
- Hunters can list prompts and receive structured workflow context
- Phase 57 complete if Plan 01 also done

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 57-agent-wiring-workflow-integration*
*Completed: 2026-04-08*
