---
phase: 26-rebrand-dead-code-removal
plan: 02
subsystem: branding
tags: [rebrand, ascii-art, env-vars, config-paths, cli, mcp, tui]

# Dependency graph
requires:
  - phase: 26-rebrand-dead-code-removal plan 01
    provides: dead code removal clearing the path for clean rename
provides:
  - Zero ClawdStrike references in all .ts source files
  - THRUNT GOD ASCII logo with gothic shimmer animation
  - THRUNT_ environment variable prefix across all adapters
  - .thrunt-god/ config directory paths
  - thrunt-god binary name references
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "THRUNT_ prefix for all environment variables"
    - ".thrunt-god/ directory for all local config/state"
    - "LOGO.main + LOGO.god two-part logo structure"
    - "getAnimatedGod() for gold shimmer animation"

key-files:
  created: []
  modified:
    - apps/terminal/src/tui/theme.ts
    - apps/terminal/src/config/index.ts
    - apps/terminal/src/cli/index.ts
    - apps/terminal/src/index.ts
    - apps/terminal/src/hunt/bridge.ts
    - apps/terminal/src/tui/external/session.ts
    - apps/terminal/src/mcp/index.ts
    - apps/terminal/src/health/index.ts
    - apps/terminal/src/tui/screens/main.ts

key-decisions:
  - "Removed hush.exe from HUNT_BINARY_NAMES (dead binary from hushd era)"
  - "MCP server name changed from 'clawdstrike' to 'thrunt-god' for protocol identity"
  - "Health check ID changed from 'clawdstrike-mcp' to 'thrunt-god-mcp'"
  - "Telemetry event name changed from 'clawdstrike_execution' to 'thrunt_execution'"

patterns-established:
  - "THRUNT_ prefix: All env vars use THRUNT_ (THRUNT_SANDBOX, THRUNT_WORKCELL_ROOT, etc.)"
  - ".thrunt-god/ directory: All local state stored under .thrunt-god/ (config, runs, reports, rules, workcells)"
  - "Binary name: thrunt-god (not clawdstrike) for CLI binary and hunt binary references"

requirements-completed: [BRAND-01, BRAND-02, BRAND-03]

# Metrics
duration: 14min
completed: 2026-03-30
---

# Phase 26 Plan 02: Rebrand to THRUNT GOD Summary

**Complete ClawdStrike-to-THRUNT-GOD rebrand across 35+ files: env vars, config paths, ASCII logo, CLI help, MCP identity, health checks, and all user-facing strings**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-30T05:01:55Z
- **Completed:** 2026-03-30T05:16:00Z
- **Tasks:** 2
- **Files modified:** 35

## Accomplishments
- Zero occurrences of ClawdStrike/clawdstrike/CLAWDSTRIKE/CLAWD in any .ts source file
- All CLAWDSTRIKE_* environment variables systematically renamed to THRUNT_* across 12 adapter and TUI files
- ASCII logo replaced: CLAWD+STRIKE block art swapped for THRUNT+GOD block art with preserved gothic shimmer animation
- Config directory .clawdstrike/ renamed to .thrunt-god/ across config, workcell, telemetry, MCP, and report modules
- CLI help text, MCP server identity, and health check IDs all use thrunt-god branding
- Shell script variables in session.ts renamed from __clawdstrike_external_* to __thrunt_external_*

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename env vars, config paths, and binary references** - `ef9c5af` (feat)
2. **Task 2: Rebrand theme logo and user-facing strings** - `8a09da0` (feat)

## Files Created/Modified
- `apps/terminal/src/config/index.ts` - CONFIG_DIR from .clawdstrike to .thrunt-god
- `apps/terminal/src/tui/theme.ts` - THRUNT+GOD ASCII logo, getAnimatedGod(), LOGO.god
- `apps/terminal/src/tui/app.ts` - THRUNT_ env vars, user-facing strings
- `apps/terminal/src/tui/pty.ts` - THRUNT_ env vars, .thrunt-god paths, user strings
- `apps/terminal/src/tui/pty-runtime.ts` - THRUNT_ env vars, .thrunt-god paths
- `apps/terminal/src/tui/external/session.ts` - __thrunt_external_* shell vars, THRUNT_ env
- `apps/terminal/src/tui/external/tmux.ts` - thrunt-god window name prefix
- `apps/terminal/src/dispatcher/adapters/claude.ts` - THRUNT_ sandbox env vars
- `apps/terminal/src/dispatcher/adapters/codex.ts` - THRUNT_ sandbox env vars
- `apps/terminal/src/dispatcher/adapters/crush.ts` - THRUNT_ env vars, .thrunt-god paths
- `apps/terminal/src/dispatcher/adapters/opencode.ts` - THRUNT_ env vars, .thrunt-god paths
- `apps/terminal/src/hunt/bridge.ts` - THRUNT_ binary env, thrunt-god binary names, .thrunt-god rules
- `apps/terminal/src/hunt/bridge-correlate.ts` - THRUNT_HUNT_NATS_TOKEN/NKEY_SEED
- `apps/terminal/src/workcell/git.ts` - .thrunt-god/workcells, thrunt-god/ branch prefix
- `apps/terminal/src/workcell/index.ts` - .thrunt-god/tmp/ paths
- `apps/terminal/src/workcell/lifecycle.ts` - .thrunt-god metadata dir and file
- `apps/terminal/src/telemetry/index.ts` - .thrunt-god/runs, thrunt_execution event
- `apps/terminal/src/tui/report-export.ts` - .thrunt-god/reports
- `apps/terminal/src/tui/screens/hunt-diff.ts` - .thrunt-god/scan_history.json
- `apps/terminal/src/tui/screens/hunt-rule-builder.ts` - /tmp/thrunt-god-rule, .thrunt-god/rules
- `apps/terminal/src/mcp/index.ts` - .thrunt-god discovery, thrunt-god server/client name
- `apps/terminal/src/health/index.ts` - thrunt-god-mcp ID, THRUNT GOD MCP name
- `apps/terminal/src/cli/index.ts` - All help text, descriptions, env vars
- `apps/terminal/src/index.ts` - Module docstring, .thrunt-god/runs default path
- `apps/terminal/src/types.ts` - THRUNT GOD type definition header
- `apps/terminal/src/tools/index.ts` - THRUNT GOD tool definitions, .thrunt-god paths
- `apps/terminal/src/tui/index.ts` - TUI module docstring
- `apps/terminal/src/tui/runs.ts` - THRUNT GOD restoring message
- `apps/terminal/src/tui/screens/interactive-run.ts` - THRUNT GOD controls
- `apps/terminal/src/tui/screens/main.ts` - getAnimatedGod caller, logo comments

## Decisions Made
- Removed `hush.exe` and `hush` from HUNT_BINARY_NAMES since the hush binary was tied to the dead hushd subsystem; only `thrunt-god` binary name retained
- MCP server name in protocol initialize response changed to "thrunt-god" (affects any external tooling discovering via MCP)
- Health check ID `clawdstrike-mcp` became `thrunt-god-mcp` (consistent with new branding)
- Telemetry analytics event name changed from `clawdstrike_execution` to `thrunt_execution` (shorter, no collision risk)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This completes Phase 26 (Rebrand Dead Code Removal) -- the final phase of v1.5
- All ClawdStrike references purged; the codebase is fully THRUNT GOD branded
- Ready for milestone completion

## Self-Check: PASSED

All key files verified present. Both task commits (ef9c5af, 8a09da0) verified in git history.

---
*Phase: 26-rebrand-dead-code-removal*
*Completed: 2026-03-30*
