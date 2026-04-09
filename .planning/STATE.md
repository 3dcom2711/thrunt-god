---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Sidebar Automation & Operations
status: executing
stopped_at: Completed 59-03-PLAN.md (Phase 59 complete)
last_updated: "2026-04-09T21:12:19.000Z"
last_activity: 2026-04-09 -- Completed 59-03 (MCP Control Panel webview, tool testing, profile selector)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** Hunters can move from signal intake to executable hunts, evidence-grade receipts, publishable findings, promotable detections, and data-backed hunt recommendations inside one consistent workflow surface.
**Current focus:** v3.1 Sidebar Automation & Operations — Phase 59: MCP Runtime Control Panel

## Current Milestone: v3.1 Sidebar Automation & Operations

**Goal:** Add a dedicated Automation section to the VS Code sidebar that separates artifact navigation (Investigation) from execution (Automation), with MCP runtime controls, a curated command deck, reusable YAML runbooks, and full execution history with safety guardrails.

## Current Position

Phase: 59 of 62 (MCP Runtime Control Panel)
Plan: 3 of 3 plans in phase (COMPLETE)
Status: Phase complete
Last activity: 2026-04-09 -- Completed 59-03 (MCP Control Panel webview, tool testing, profile selector)

Progress: [██████████] 100% (v3.1 Phase 59: 3/3 plans)

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

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-09T21:12:19.000Z
Stopped at: Completed 59-03-PLAN.md (Phase 59 complete)
Resume: Phase 59 complete (3/3 plans). MCPStatusManager, 6 MCP commands, McpControlPanel webview with server status, tool inventory, tool test form, profile selector. --run-tool flag on MCP server for one-shot tool execution. 323 total tests passing. Phase 59 fully delivered. Ready for Phase 60.
