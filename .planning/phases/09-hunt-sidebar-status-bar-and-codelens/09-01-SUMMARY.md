---
phase: 09-hunt-sidebar-status-bar-and-codelens
plan: 01
subsystem: ui
tags: [vscode, sidebar, tree-view, hunt-navigation, verdict-badges, deviation-scores]

# Dependency graph
requires:
  - phase: 08-artifact-parsers-file-watcher-and-data-store
    provides: HuntDataStore with reactive cross-artifact indexes, ParseResult types, domain interfaces
provides:
  - HuntTreeDataProvider implementing vscode.TreeDataProvider with semantic investigation tree
  - HuntTreeItem class with nodeType, dataId, artifactPath properties
  - package.json view contributions (viewsContainers, views, viewsWelcome, commands, menus)
  - Sidebar commands (openArtifact, revealInExplorer, copyPath, refreshSidebar)
  - Extension activation wiring with thruntGod.huntDetected context key
affects: [09-02-status-bar-codelens, 11-webview-bridge]

# Tech tracking
tech-stack:
  added: []
  patterns: [TreeDataProvider with store subscription, verdict badge icons, deviation score color coding, resolveArtifactPath convention]

key-files:
  created:
    - thrunt-god-vscode/src/sidebar.ts
    - thrunt-god-vscode/test/unit/sidebar.test.cjs
  modified:
    - thrunt-god-vscode/package.json
    - thrunt-god-vscode/src/extension.ts
    - thrunt-god-vscode/test/_setup/vscode-mock.cjs

key-decisions:
  - "Artifact paths derived from huntRoot convention rather than exposing store.artifactPaths -- avoids modifying store.ts"
  - "NodeType discriminant on HuntTreeItem for dispatch in getChildren instead of label-based matching"
  - "Receipt deviation scores color-coded: 0-2 green (pass), 3-4 yellow (warning), 5-6 red (error)"
  - "Verdict badges use ThemeIcon with ThemeColor for native VS Code theme integration"

patterns-established:
  - "TreeDataProvider subscribes to store.onDidChange and fires full tree refresh"
  - "HuntTreeItem extends vscode.TreeItem with nodeType/dataId for child dispatch"
  - "Leaf nodes auto-wire command for double-click open"
  - "resolveArtifactPath derives filesystem path from huntRoot + convention"

requirements-completed: [SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 9 Plan 1: Hunt Sidebar TreeDataProvider Summary

**Semantic sidebar tree with verdict badges, deviation score badges, phase status indicators, and full context menu navigation powered by HuntDataStore subscriptions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T16:02:07Z
- **Completed:** 2026-04-02T16:06:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- HuntTreeDataProvider shows semantic tree: Mission root, Hypotheses with verdict badges (Supported/Disproved/Inconclusive/Open), Phases with status indicators (complete/running/planned), Queries with template counts, Receipts with deviation score badges
- package.json contributes viewsContainers, views, viewsWelcome, 5 commands, and context/title menus
- Extension wires sidebar with thruntGod.huntDetected context key for conditional visibility
- 12 unit tests covering root nodes, verdict badges, phase status, deviation scores, double-click, context menu, store event propagation, and narrow width labels

## Task Commits

Each task was committed atomically:

1. **Task 1: package.json view contributions and HuntTreeDataProvider** - `bbbc35a` (feat)
2. **Task 2: Sidebar unit tests** - `1ffc6a3` (test)

## Files Created/Modified
- `thrunt-god-vscode/src/sidebar.ts` - HuntTreeDataProvider and HuntTreeItem with semantic tree logic
- `thrunt-god-vscode/package.json` - View contributions, commands, menus, viewsWelcome
- `thrunt-god-vscode/src/extension.ts` - Sidebar wiring with context key and command registration
- `thrunt-god-vscode/test/_setup/vscode-mock.cjs` - Added ThemeIcon, ThemeColor, TreeItem, TreeItemCollapsibleState, clipboard, registerTreeDataProvider mocks
- `thrunt-god-vscode/test/unit/sidebar.test.cjs` - 12 unit tests for sidebar tree data provider

## Decisions Made
- Artifact paths derived from huntRoot convention (MISSION.md, QUERIES/{id}.md, RECEIPTS/{id}.md) rather than exposing store.artifactPaths -- avoids modifying store.ts in this plan
- NodeType discriminant property on HuntTreeItem enables clean dispatch in getChildren without label-based matching
- Deviation score color coding: 0-2 green (pass icon), 3-4 yellow (warning icon), 5-6 red (error icon)
- Verdict badges use ThemeIcon with ThemeColor for native VS Code theme integration (charts.green, charts.red, charts.yellow, charts.blue)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sidebar TreeDataProvider complete and wired into extension activation
- Ready for 09-02: StatusBarItem with phase progress, CodeLensProvider with deviation scores and template counts
- All 105 tests passing (93 existing + 12 new sidebar tests)

---
*Phase: 09-hunt-sidebar-status-bar-and-codelens*
*Completed: 2026-04-02*
