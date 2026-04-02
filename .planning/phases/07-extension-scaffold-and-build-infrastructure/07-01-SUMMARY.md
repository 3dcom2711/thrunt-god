---
phase: 07-extension-scaffold-and-build-infrastructure
plan: 01
subsystem: infra
tags: [vscode-extension, esbuild, typescript, cjs, esm, bundling]

# Dependency graph
requires: []
provides:
  - "thrunt-god-vscode/ extension scaffold with package.json manifest"
  - "Dual CJS/ESM esbuild build pipeline (16ms build time)"
  - "VS Code activation on .hunt/MISSION.md and .planning/MISSION.md workspaces"
  - ".vscodeignore packaging configuration"
affects: [08-data-layer-parsers-and-state, 09-native-ui-providers, 10-diagnostics-and-validation, 11-webview-drain-template-viewer]

# Tech tracking
tech-stack:
  added: ["@types/vscode ^1.85.0", "@vscode/vsce ^3.2.0", "esbuild ^0.24.0", "typescript ^5.5.0"]
  patterns: ["dual-entry-point esbuild (CJS extension host + ESM webview)", "async hunt root detection with sync activate()"]

key-files:
  created:
    - thrunt-god-vscode/package.json
    - thrunt-god-vscode/tsconfig.json
    - thrunt-god-vscode/esbuild.config.mjs
    - thrunt-god-vscode/src/extension.ts
    - thrunt-god-vscode/src/constants.ts
    - thrunt-god-vscode/webview/drain-template-viewer/index.ts
    - thrunt-god-vscode/.vscodeignore
    - thrunt-god-vscode/.gitignore
  modified: []

key-decisions:
  - "activate() is sync, fires async findHuntRoot() internally per VS Code best practice"
  - "vscode marked as external in esbuild -- CJS bundle require() verified with mock"

patterns-established:
  - "Dual-entry esbuild: CJS (node18, external vscode) + ESM (es2022, browser platform)"
  - "Hunt workspace detection via HUNT_MARKERS constant iterated in findHuntRoot()"
  - "Constants module pattern for shared extension configuration"

requirements-completed: [BUILD-01, BUILD-02, BUILD-04]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 7 Plan 1: Extension Scaffold and Build Infrastructure Summary

**VS Code extension scaffold with dual CJS/ESM esbuild bundling, workspace activation on hunt markers, and .vsix packaging config**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T14:26:49Z
- **Completed:** 2026-04-02T14:29:10Z
- **Tasks:** 1
- **Files modified:** 9

## Accomplishments
- Created thrunt-god-vscode/ extension project scaffold as sibling to thrunt-god/
- Dual-entry esbuild config producing dist/extension.js (CJS, 3.3KB) and dist/webview-drain.js (ESM, 130B) in 16ms
- Extension activates on workspaces containing .hunt/MISSION.md or .planning/MISSION.md
- .vscodeignore correctly excludes src/, test/, design/, docs/, .planning/ from .vsix packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extension project scaffold with package.json manifest, TypeScript config, and esbuild dual-bundle build** - `c686b40` (feat)

## Files Created/Modified
- `thrunt-god-vscode/package.json` - Extension manifest with activation events, commands, scripts, devDependencies
- `thrunt-god-vscode/tsconfig.json` - TypeScript config with bundler moduleResolution for ESM-only packages
- `thrunt-god-vscode/esbuild.config.mjs` - Dual-entry build: CJS extension host + ESM webview with watch mode
- `thrunt-god-vscode/src/extension.ts` - activate() and deactivate() entry points with async hunt root detection
- `thrunt-god-vscode/src/constants.ts` - HUNT_MARKERS, HUNT_DIRS, OUTPUT_CHANNEL_NAME, COMMAND_PREFIX
- `thrunt-god-vscode/webview/drain-template-viewer/index.ts` - Placeholder ESM entry point for webview bundle
- `thrunt-god-vscode/.vscodeignore` - Exclusion list for .vsix packaging
- `thrunt-god-vscode/.gitignore` - Ignores node_modules/, dist/, *.vsix, .vscode-test/
- `thrunt-god-vscode/package-lock.json` - Lock file for reproducible installs

## Decisions Made
- **activate() is synchronous:** VS Code best practice is for activate() to return void immediately. Hunt root detection runs asynchronously via findHuntRoot().then(). Commands are registered immediately with generic messages, then updated after hunt root is found.
- **CJS bundle require() verification uses mock:** Since `vscode` module is only available inside VS Code runtime, the require() test provides a minimal mock. This is standard for VS Code extension development.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension scaffold complete, ready for Phase 7 Plan 2 (test infrastructure) and Phase 8 (data layer parsers)
- All future extension code will be added to the thrunt-god-vscode/ directory
- Build pipeline produces both CJS and ESM bundles that downstream phases will populate

## Self-Check: PASSED

All 9 created files verified on disk. Both build outputs (dist/extension.js, dist/webview-drain.js) confirmed present. Task commit c686b40 verified in git log.

---
*Phase: 07-extension-scaffold-and-build-infrastructure*
*Completed: 2026-04-02*
