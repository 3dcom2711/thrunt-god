---
phase: 59-mcp-runtime-control-panel
plan: 03
subsystem: mcp, vscode-extension
tags: [mcp, webview, preact, control-panel, tool-testing, profile-switching, vscode]

# Dependency graph
requires:
  - phase: 59-mcp-runtime-control-panel
    plan: 01
    provides: MCPStatusManager class, shared MCP types in mcp-control.ts
  - phase: 59-mcp-runtime-control-panel
    plan: 02
    provides: 5 MCP context menu commands wired to MCPStatusManager, mcpControlPanel activation event
provides:
  - McpControlPanel webview host class with createOrShow, restorePanel, message handling
  - Preact webview with server status card, profile selector, tool inventory table, tool test form
  - --run-tool one-shot flag on MCP server for subprocess tool testing
  - mcpOpenPanel command and context menu entry for opening the control panel
  - WebviewPanelSerializer for panel persistence across VS Code restarts
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [McpControlPanel webview host following ProgramDashboardPanel pattern, --run-tool subprocess one-shot tool execution, profile switching via workspace config update + server restart]

key-files:
  created:
    - apps/vscode/src/mcpControlPanel.ts
    - apps/vscode/webview/mcp-control-panel/index.tsx
    - apps/vscode/test/unit/mcp-control-panel.test.cjs
  modified:
    - apps/mcp/bin/server.cjs
    - apps/vscode/esbuild.config.mjs
    - apps/vscode/src/extension.ts
    - apps/vscode/package.json
    - apps/vscode/test/unit/manifest.test.cjs

key-decisions:
  - "McpControlPanel follows exact ProgramDashboardPanel pattern for consistency: static createOrShow/restorePanel, private constructor, disposable lifecycle"
  - "Tool testing via --run-tool subprocess flag with 30s timeout, avoiding in-process MCP SDK import"
  - "Profile switching updates workspace config and restarts MCPStatusManager, then re-fetches health and tools"
  - "ProfileSelector uses text input + Switch button since available profiles are not enumerable from the server"

patterns-established:
  - "McpControlPanel webview host pattern: mirrors ProgramDashboardPanel with MCPStatusManager dependency"
  - "MCP server --run-tool flag: one-shot tool execution using direct handler invocation from tools.cjs exports"

requirements-completed: [MCP-12, MCP-13]

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 59 Plan 03: MCP Control Panel Webview Summary

**McpControlPanel webview with server status card, tool inventory table, tool test form via --run-tool subprocess, profile selector, and panel serialization for persistence**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-09T21:06:28Z
- **Completed:** 2026-04-09T21:12:19Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- McpControlPanel host class with createOrShow, restorePanel, full message handling (init, refresh, tool:test, action:start/restart/healthCheck, profile:switch) following ProgramDashboardPanel pattern
- Preact webview entry point with four sections: ServerStatusCard (connection badge, stat cards for tools/DB/uptime, action buttons), ProfileSelector (current profile badge, text input + switch button), ToolInventoryTable (10-tool table with name/description/schema/test button), ToolTestForm (JSON input textarea, execute button, result display)
- --run-tool one-shot flag added to MCP server enabling subprocess tool execution with direct handler invocation from tools.cjs (all 10 handlers wired)
- esbuild config updated with webview-mcp-control entry point, producing dist/webview-mcp-control.js (37.1 KB) and dist/webview-mcp-control.css (31.0 KB)
- mcpOpenPanel command registered with context menu entry at mcp@6 group, WebviewPanelSerializer for panel restoration
- 13 new unit tests (5 export tests + 8 manifest tests), 323 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create McpControlPanel host class and Preact webview entry point** - `46245e6a` (feat)
2. **Task 2: Wire McpControlPanel into extension.ts, add serializer, and create unit tests** - `ad038c7a` (feat)

## Files Created/Modified
- `apps/vscode/src/mcpControlPanel.ts` - McpControlPanel webview host class with createOrShow, restorePanel, status/tool/theme message handling, tool test subprocess, profile switching
- `apps/vscode/webview/mcp-control-panel/index.tsx` - Preact webview with ServerStatusCard, ProfileSelector, ToolInventoryTable, ToolTestForm, inline CSS using VS Code CSS variables
- `apps/vscode/test/unit/mcp-control-panel.test.cjs` - 13 unit tests for exports, manifest entries, build outputs
- `apps/mcp/bin/server.cjs` - Added --run-tool flag for one-shot tool execution via direct handler invocation
- `apps/vscode/esbuild.config.mjs` - Added webview-mcp-control entry to webviewConfigs and reportSizes
- `apps/vscode/src/extension.ts` - Import/register McpControlPanel, mcpOpenPanel command, WebviewPanelSerializer, re-export
- `apps/vscode/package.json` - Added mcpOpenPanel command and context menu entry at mcp@6
- `apps/vscode/test/unit/manifest.test.cjs` - Updated MCP command/menu counts from 5 to 6

## Decisions Made
- McpControlPanel follows exact ProgramDashboardPanel pattern for consistency across all webview hosts
- Tool testing uses --run-tool subprocess flag with 30s timeout (THRUNT_MCP_TIMEOUT env var), keeping MCP SDK out of extension host process
- Profile switching updates workspace config (thruntGod.mcpProfile) then restarts MCPStatusManager, re-fetches health and tools
- ProfileSelector renders as text input + Switch button since available profiles are not enumerable from the MCP server; current profile displayed as read-only badge

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MCP Control Panel is fully functional with server status, tool inventory, tool testing, and profile switching
- All 6 MCP commands registered (start, restart, health check, list tools, open logs, open panel)
- Phase 59 is complete (3/3 plans done)
- 323 total tests passing
- Ready for Phase 60 (next milestone phase)

---
*Phase: 59-mcp-runtime-control-panel*
*Completed: 2026-04-09*
