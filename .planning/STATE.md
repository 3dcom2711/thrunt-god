---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Sidebar Automation & Operations
status: in-progress
stopped_at: Completed 61-01-PLAN.md
last_updated: "2026-04-09T22:08:08Z"
last_activity: 2026-04-09 -- Completed 61-01 (Runbook schema, parser, registry, example YAML)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 11
  completed_plans: 9
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Hunters can move from signal intake to executable hunts, evidence-grade receipts, publishable findings, promotable detections, and data-backed hunt recommendations inside one consistent workflow surface.
**Current focus:** v3.1 Sidebar Automation & Operations — Phase 61: Runbook Engine & Editor

## Current Milestone: v3.1 Sidebar Automation & Operations

**Goal:** Add a dedicated Automation section to the VS Code sidebar that separates artifact navigation (Investigation) from execution (Automation), with MCP runtime controls, a curated command deck, reusable YAML runbooks, and full execution history with safety guardrails.

## Current Position

Phase: 61 of 62 (Runbook Engine & Editor)
Plan: 1 of 3 plans in phase
Status: In progress
Last activity: 2026-04-09 -- Completed 61-01 (Runbook schema, parser, registry, example YAML)

Progress: [████████░░] 82% (v3.1 Phase 61: 1/3 plans)

## Accumulated Context

### Decisions

- v3.1 Architecture: Second tree view (automationTree) below existing huntTree — not integrated into investigation tree
- Mental model: Top = evidence/investigation, Bottom = execution/automation
- MCP integration via subprocess only — no in-process import of @modelcontextprotocol/sdk into the extension
- Runbooks as YAML files in .planning/runbooks/ — tree for discovery, webview for execution
- 5 runbook step types: cli, mcp, open, note, confirm
- Command deck is curated (10 built-in) + user templates, not every CLI command
- All mutating actions require confirmation dialog with environment indicator
- Execution history persisted to .planning/.run-history.json with configurable retention (default 100)
- AutomationTreeDataProvider is independent from HuntTreeDataProvider (separate event emitters)
- [Phase 58]: AutomationTreeDataProvider uses own EventEmitter, independent from HuntTreeDataProvider (confirmed in implementation)
- [Phase 58]: Root node contextValue naming convention: automationMcp, automationCommandDeck, automationRunbooks, automationRecentRuns
- [Phase 58]: AutomationTreeDataProvider and AutomationTreeItem re-exported from extension.ts for test bundle access
- [Phase 58]: File watcher for runbooks uses RelativePattern with .planning/runbooks/*.{yaml,yml} glob

- [Phase 59]: MCPStatusManager uses subprocess spawn for health checks, consistent with MCP subprocess-only integration pattern
- [Phase 59]: Health check timeout at 10 seconds with SIGTERM then SIGKILL after 2s grace period
- [Phase 59]: dbOpts declaration moved before --health/--list-tools blocks to support early-exit paths
- [Phase 59]: MCP server path resolution: prefer thruntGod.mcp.serverPath config, fall back to workspace-local apps/mcp/bin/server.cjs
- [Phase 59]: MCP command handler pattern: async try/catch with showInformationMessage on success, showErrorMessage on failure
- [Phase 59]: McpControlPanel follows ProgramDashboardPanel pattern exactly for webview host consistency
- [Phase 59]: Tool testing via --run-tool subprocess flag with 30s timeout, keeping MCP SDK out of extension host
- [Phase 59]: Profile switching updates workspace config then restarts MCPStatusManager

- [Phase 60]: CommandDeckPanel follows McpControlPanel pattern exactly for webview host consistency
- [Phase 60]: CLI command execution uses placeholder in Plan 01; full CLIBridge wiring deferred to Plan 03
- [Phase 60]: 10 built-in commands: Investigation (2), Execution (3), Intelligence (3), Maintenance (2)
- [Phase 60]: Context relevance mapping mirrored in extension host and webview for decoupled operation
- [Phase 60]: Hunt tree changed from registerTreeDataProvider to createTreeView for onDidChangeSelection events
- [Phase 60]: setCommandCount follows setRunbookCount pattern for consistency in AutomationTreeDataProvider
- [Phase 60]: CLI execution uses direct subprocess spawn with process.execPath + cliPath rather than CLIBridge instance to keep command deck self-contained
- [Phase 60]: resolveCliPath prefers thruntGod.cli.path config, falls back to workspace-local dist/thrunt-god/bin/thrunt-tools.cjs
- [Phase 60]: Template IDs generated from label via slugification with tpl- prefix for namespace separation from built-in commands

- [Phase 61]: Runtime validation (validateRunbook) instead of Zod — avoids new dependency while providing equivalent validation
- [Phase 61]: Five step action types (cli, mcp, open, note, confirm) as established in architecture decisions
- [Phase 61]: RunbookRegistry uses sync fs reads internally with async public API for pattern consistency

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-09T22:08:08Z
Stopped at: Completed 61-01-PLAN.md
Resume: Phase 61 Plan 01 complete. Shared types (shared/runbook.ts), runtime validation + parser + registry (src/runbook.ts), example YAML, and 13 new unit tests. 379 total tests passing. Next: Plan 02 (RunbookEngine) and Plan 03 (RunbookPanel webview).
