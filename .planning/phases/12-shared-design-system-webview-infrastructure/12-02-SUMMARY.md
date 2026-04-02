---
phase: 12-shared-design-system-webview-infrastructure
plan: 02
subsystem: ui
tags: [css-tokens, preact, a11y, roving-tabindex, aria, webview]

# Dependency graph
requires:
  - phase: 12-01
    provides: "Shared tokens.css with --hunt-* semantic layer, useRovingTabindex and useTheme hooks"
provides:
  - "Drain Template Viewer consuming shared --hunt-* tokens (no --viewer-* references)"
  - "Roving tabindex keyboard navigation on cluster chip and pinned template lists"
  - "ARIA roles and labels on interactive lists in drain viewer"
affects: [13-hunt-overview-dashboard, 14-evidence-board, 15-query-analysis-upgrades]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token migration pattern: remove local :root definitions, import shared tokens.css, rename var() references"
    - "useTheme hook replaces manual document.body.dataset.theme management"
    - "useRovingTabindex applied to list containers with role=list, children get role=listitem"

key-files:
  created: []
  modified:
    - "thrunt-god-vscode/webview/drain-template-viewer/styles.css"
    - "thrunt-god-vscode/webview/drain-template-viewer/index.tsx"
    - "thrunt-god-vscode/webview/drain-template-viewer/app.tsx"

key-decisions:
  - "Drain viewer keeps its own class names (.stat-card, .ghost-button) -- shared hunt-* classes are for new surfaces only"
  - "Drain-viewer-specific body gradient moved to end of styles.css, not into tokens.css"
  - "Kept existing manual message handler in index.tsx (useHostMessage hook adds complexity for complex state deps)"

patterns-established:
  - "Token migration: import shared/tokens.css before component-specific styles.css in entry point"
  - "useRovingTabindex + role=list/listitem + aria-label pattern for all interactive lists"

requirements-completed: [DSYS-05, DSYS-06]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 12 Plan 02: Drain Template Viewer Token Migration Summary

**Drain Template Viewer migrated from --viewer-* to shared --hunt-* token system with roving tabindex keyboard navigation on cluster and pinned template lists**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T21:33:53Z
- **Completed:** 2026-04-02T21:37:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migrated all CSS token references from `--viewer-*` to `--hunt-*` across styles.css and app.tsx (zero `--viewer-*` references remaining)
- Replaced local `:root` token definitions and theme overrides with shared `tokens.css` import
- Replaced manual `isDark`/`setIsDark` state with `useTheme` shared hook
- Added roving tabindex keyboard navigation to both cluster chip list and pinned template list
- Applied ARIA `role="list"`, `role="listitem"`, and `aria-label` attributes to interactive lists

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Drain Template Viewer from --viewer-* to --hunt-* tokens** - `5c64ab3` (feat)
2. **Task 2: Wire roving tabindex keyboard navigation into Drain Template Viewer** - `afbbbdd` (feat)

## Files Created/Modified
- `webview/drain-template-viewer/styles.css` - Removed :root block, theme overrides, base resets; renamed all --viewer-* to --hunt-*; added drain-specific body gradient at end
- `webview/drain-template-viewer/index.tsx` - Added shared tokens.css import, replaced manual theme state with useTheme hook
- `webview/drain-template-viewer/app.tsx` - Renamed inline --viewer-* references to --hunt-*; added useRovingTabindex to cluster and pinned lists; added ARIA roles and labels

## Decisions Made
- Drain viewer keeps its own class names (`.stat-card`, `.ghost-button`, etc.) -- the shared `hunt-*` classes are intended for new surfaces only. The drain viewer just needed the token rename.
- Kept existing manual message handler in index.tsx rather than force-fitting `useHostMessage` hook, which would add complexity due to complex state dependencies in the message handler.
- Drain-viewer-specific body gradient (radial + linear) stays in the viewer's own `styles.css`, not in shared `tokens.css` since it is viewer-specific styling.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared design system validated: tokens.css consumed successfully by the drain viewer, useTheme and useRovingTabindex hooks work in a real webview surface
- Ready for 12-03 (esbuild multi-entry and stub webview surfaces)
- Pre-existing TS6133 warnings in stub webview files (evidence-board, hunt-overview, query-analysis) from plan 12-01 -- unused variables in stub code, will be resolved when those surfaces get real implementations

---
*Phase: 12-shared-design-system-webview-infrastructure*
*Completed: 2026-04-02*
