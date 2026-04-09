---
phase: 60-command-deck-webview
plan: 03
subsystem: ui
tags: [vscode, preact, webview, command-deck, templates, cli-execution, parameterized-commands]

# Dependency graph
requires:
  - phase: 60-command-deck-webview
    provides: CommandDeckRegistry, CommandDeckPanel, shared types, Preact webview grid, context-aware highlighting
provides:
  - Parameterized command templates with {placeholder} syntax and workspaceState persistence
  - Template creation form (TemplateForm) and placeholder value prompt (PlaceholderPrompt) in webview
  - Full command execution via vscode.commands.executeCommand (commandId) and subprocess spawn (cliArgs)
  - Template execution with placeholder value substitution before CLI invocation
  - Template CRUD messages (template:save, template:delete, template:exec) in shared protocol
  - 8 new unit tests for extractPlaceholders and built-in command properties
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [resolveCliPath() and runCli() helper pattern for CLI subprocess execution, {placeholder} template syntax with extractPlaceholders static helper]

key-files:
  created: []
  modified:
    - apps/vscode/shared/command-deck.ts
    - apps/vscode/src/commandDeck.ts
    - apps/vscode/webview/command-deck/index.tsx
    - apps/vscode/test/unit/command-deck.test.cjs

key-decisions:
  - "CLI execution uses direct subprocess spawn with process.execPath + cliPath rather than CLIBridge instance to keep command deck self-contained"
  - "resolveCliPath prefers thruntGod.cli.path config, falls back to workspace-local dist/thrunt-god/bin/thrunt-tools.cjs"
  - "Template IDs generated from label via slugification with tpl- prefix for namespace separation from built-in commands"

patterns-established:
  - "Template CRUD: getTemplates/saveTemplate/deleteTemplate backed by vscode.Memento with TEMPLATES_KEY"
  - "Placeholder extraction: static extractPlaceholders() using regex /\\{([a-zA-Z][a-zA-Z0-9]*)\\}/g with Set deduplication"
  - "Template execution: substitute placeholders in cliArgs before spawning, same error handling as built-in commands"

requirements-completed: [CMD-06]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 60 Plan 03: Parameterized Templates and Command Execution Summary

**Parameterized command templates with {placeholder} syntax, template CRUD persistence, and full CLI/vscode.commands execution bridge replacing Plan 01 placeholder**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T21:42:43Z
- **Completed:** 2026-04-09T21:47:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CommandDeckRegistry supports template CRUD (getTemplates, saveTemplate, deleteTemplate) with workspaceState persistence
- extractPlaceholders static helper extracts unique {placeholder} names from template cliArgs strings
- Full command execution replaces Plan 01 placeholder: built-in commands execute via vscode.commands.executeCommand (commandId) or subprocess spawn (cliArgs)
- Template execution substitutes {placeholder} values in cliArgs before spawning CLI subprocess
- TemplateForm component allows creating templates with label, description, category, CLI args, and mutating flag
- PlaceholderPrompt component prompts for placeholder values before template execution
- All 364 tests pass (8 new tests for extractPlaceholders, execution targets, and mutating flags)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add template CRUD to registry and execution bridge to CommandDeckPanel** - `bebc4bce` (feat)
2. **Task 2: Add template UI to webview and write unit tests** - `c6b3b559` (feat)

## Files Created/Modified
- `apps/vscode/shared/command-deck.ts` - Added template:save, template:delete, template:exec to webview->host messages; added templates and templatePrompt to host->webview messages; added templates to init message
- `apps/vscode/src/commandDeck.ts` - Added TEMPLATES_KEY, getTemplates(), saveTemplate(), deleteTemplate(), extractPlaceholders() to CommandDeckRegistry; replaced placeholder execution with full CLI spawn and vscode.commands.executeCommand; added handleTemplateExec(), resolveCliPath(), runCli() helpers
- `apps/vscode/webview/command-deck/index.tsx` - Added TemplateForm and PlaceholderPrompt components; added templates state, showTemplateForm, templatePrompt state; added Templates section with run/delete actions; added CSS for form fields and placeholder prompt
- `apps/vscode/test/unit/command-deck.test.cjs` - Added 8 tests: extractPlaceholders (5 tests), execution targets (1 test), mutating flags (2 tests)

## Decisions Made
- CLI execution uses direct subprocess spawn with process.execPath + cliPath rather than CLIBridge instance to keep command deck self-contained
- resolveCliPath prefers thruntGod.cli.path config, falls back to workspace-local dist/thrunt-god/bin/thrunt-tools.cjs
- Template IDs generated from label via slugification with tpl- prefix for namespace separation from built-in commands

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 60 (Command Deck Webview) is fully complete: foundation, context-aware highlighting, and parameterized templates all implemented
- 364 total tests passing across the full suite
- Ready for Phase 61 (next milestone phase)

## Self-Check: PASSED

All 4 modified files found. Both task commits (bebc4bce, c6b3b559) verified.

---
*Phase: 60-command-deck-webview*
*Completed: 2026-04-09*
