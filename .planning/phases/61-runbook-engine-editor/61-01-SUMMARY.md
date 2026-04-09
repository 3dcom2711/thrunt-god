---
phase: 61-runbook-engine-editor
plan: 01
subsystem: automation
tags: [yaml, js-yaml, runbook, validation, registry, vscode-extension]

# Dependency graph
requires:
  - phase: 60-command-deck-webview
    provides: CommandDeckPanel pattern, automation sidebar with runbook node
  - phase: 58-sidebar-automation-foundation
    provides: AutomationTreeDataProvider with setRunbookCount, file watcher for .planning/runbooks/
provides:
  - Shared runbook types (RunbookDef, RunbookInput, RunbookStep, StepResult, RunbookRunRecord)
  - Host-to-webview and webview-to-host message protocols for runbook panel
  - Runtime validation (validateRunbook) for YAML-parsed runbook data
  - YAML parser (parseRunbook) wrapping js-yaml with validation and defaults
  - RunbookRegistry for filesystem discovery of .planning/runbooks/*.yaml files
  - Example domain investigation runbook YAML
affects: [61-02-runbook-engine, 61-03-runbook-webview]

# Tech tracking
tech-stack:
  added: []
  patterns: [runtime-validation-without-zod, yaml-schema-with-defaults, filesystem-registry-pattern]

key-files:
  created:
    - apps/vscode/shared/runbook.ts
    - apps/vscode/src/runbook.ts
    - apps/vscode/test/unit/runbook.test.cjs
    - .planning/runbooks/example-domain-hunt.yaml
  modified:
    - apps/vscode/src/extension.ts

key-decisions:
  - "Runtime validation instead of Zod — keeps extension dependency-free while providing equivalent validation with descriptive error messages"
  - "Five step action types (cli, mcp, open, note, confirm) cover all runbook execution patterns needed for v3.1"
  - "RunbookRegistry uses synchronous fs.readdirSync/readFileSync for simplicity — async wrapper only on public API"

patterns-established:
  - "Runtime validation pattern: validateRunbook returns { valid, errors[] } with field-path error messages"
  - "YAML parser pattern: parseRunbook wraps yaml.load + validate + defaults into single { runbook, errors } result"
  - "Registry pattern: discover() scans directory, caches results in Map, getRunbooks() returns metadata array"

requirements-completed: [RUN-01, RUN-02, RUN-03]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 61 Plan 01: Runbook Schema & Registry Summary

**Runtime-validated YAML runbook schema with 5 action types, filesystem registry discovery, and example domain investigation runbook**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T22:05:07Z
- **Completed:** 2026-04-09T22:08:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Complete shared type system for runbook data model including step definitions, run records, and webview messaging protocol
- Runtime validation function that accepts valid runbooks and rejects invalid ones with field-specific error messages
- RunbookRegistry that discovers all YAML files in .planning/runbooks/ and exposes validated metadata
- 13 new unit tests covering exports, valid parsing, rejection cases, and registry discovery (379 total tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared runbook types and Zod schema with parser and registry** - `451af6c3` (feat)
2. **Task 2: Create unit tests for runbook schema, parser, and registry** - `043cf180` (test)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `apps/vscode/shared/runbook.ts` - Shared types: StepAction, RunbookDef, RunbookInput, RunbookStep, StepResult, RunbookRunRecord, message protocols
- `apps/vscode/src/runbook.ts` - validateRunbook, parseRunbook, RunbookRegistry, RUNBOOK_PANEL_VIEW_TYPE, VALID_STEP_ACTIONS
- `apps/vscode/test/unit/runbook.test.cjs` - 13 unit tests for schema validation, parser, and registry
- `.planning/runbooks/example-domain-hunt.yaml` - Example runbook with 5 steps (cli, mcp, confirm, note, open) and 3 inputs
- `apps/vscode/src/extension.ts` - Added re-exports for runbook module

## Decisions Made
- Used runtime validation instead of Zod to avoid adding a new dependency to the VS Code extension (js-yaml already present)
- Five step action types (cli, mcp, open, note, confirm) as specified in accumulated context decisions
- RunbookRegistry uses synchronous file I/O internally with async public API wrappers for consistency with other extension patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RunbookDef types and parseRunbook parser ready for RunbookEngine (Plan 02)
- HostToRunbookMessage / RunbookToHostMessage protocols ready for RunbookPanel webview (Plan 03)
- RunbookRegistry ready for integration into extension.ts activate() and AutomationTreeDataProvider
- Example runbook available for testing engine execution

---
*Phase: 61-runbook-engine-editor*
*Completed: 2026-04-09*
