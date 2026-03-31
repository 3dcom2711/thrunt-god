---
phase: 46-plugin-manifest-discovery
plan: 02
subsystem: plugin-ecosystem
tags: [plugin, discovery, registry, node_modules, precedence, connector-sdk]

requires:
  - phase: 46-plugin-manifest-discovery
    provides: "validatePluginManifest, loadPluginManifest, loadPlugin, BUILT_IN_CONNECTOR_IDS from Plan 01"
  - phase: 45-connector-sdk-package
    provides: "createConnectorRegistry, createConnectorCapabilities, validateConnectorAdapter"
provides:
  - "createPluginRegistry() factory with provenance-aware PluginRegistry (get/has/list/getPluginInfo/listPlugins/isBuiltIn/isOverridden)"
  - "discoverPlugins() with triple-precedence: built-in fallback > node_modules scan > config plugins > config overrides"
  - "_scanNodeModules() with @thrunt/connector-* and thrunt-connector-* pattern matching and lockfile-based cache"
  - "runtime.cjs re-exports all 7 plugin-registry symbols"
affects: [47-contract-testing, 48-builtin-migration, 49-ecosystem-tooling]

tech-stack:
  added: []
  patterns: ["Triple-precedence plugin resolution", "Lockfile-mtime cache invalidation for node_modules scan", "PluginInfo provenance tracking with source field"]

key-files:
  created: []
  modified:
    - thrunt-god/bin/lib/plugin-registry.cjs
    - thrunt-god/bin/lib/runtime.cjs
    - tests/plugin-registry.test.cjs
    - tests/sdk-exports.test.cjs

key-decisions:
  - "PluginRegistry is a standalone object (not extending ConnectorRegistry via prototype) for simplicity and zero coupling"
  - "Triple-precedence order: built-in (lowest) -> node_modules -> config-path -> config-override (highest)"
  - "Lockfile mtime used for _scanNodeModules cache invalidation, avoiding full re-scan on every call"
  - "Mismatched connector_id in config overrides logged to stderr and skipped, not treated as fatal error"

patterns-established:
  - "PluginInfo provenance: source field ('built-in' | 'node_modules' | 'config-path' | 'config-override') for every connector"
  - "Lazy require of runtime.cjs inside discoverPlugins() to avoid circular dependency at module load time"
  - "Plugin registry spread into runtime.cjs module.exports alongside sdk spread"

requirements-completed: [ECO-02]

duration: 3min
completed: 2026-03-31
---

# Phase 46 Plan 02: Plugin Discovery Engine & PluginRegistry Summary

**Plugin discovery with triple-precedence resolution (config > node_modules > built-in), PluginRegistry with provenance tracking, and runtime.cjs integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T02:28:14Z
- **Completed:** 2026-03-31T02:31:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- createPluginRegistry factory producing PluginRegistry with get/has/list/register/getPluginInfo/listPlugins/isBuiltIn/isOverridden
- discoverPlugins() with four-tier precedence: built-in fallback, node_modules scan, config plugins (config-path), config overrides (config-override)
- _scanNodeModules with @thrunt/connector-* and thrunt-connector-* pattern matching, .cache/.package-lock.json skipping, and lockfile-mtime cache
- runtime.cjs re-exports all 7 plugin-registry symbols (79 total exports, up from 72)
- 40 tests in plugin-registry.test.cjs (22 from Plan 01 + 18 from Plan 02), full suite 2342 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Plugin registry discovery tests** - `2015c8a` (test)
2. **Task 1 (GREEN): Plugin discovery engine and PluginRegistry** - `b94d797` (feat)
3. **Task 2: Runtime re-exports and full suite verification** - `e50e0c5` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `thrunt-god/bin/lib/plugin-registry.cjs` - Added createPluginRegistry, _scanNodeModules, discoverPlugins (310 lines added, total 699 lines)
- `thrunt-god/bin/lib/runtime.cjs` - Added pluginRegistry require and spread into module.exports
- `tests/plugin-registry.test.cjs` - 18 new tests for registry, discovery, and node_modules scanning (total 40 tests, 700 lines)
- `tests/sdk-exports.test.cjs` - Updated export count assertion: 72 -> 79

## Decisions Made
- **PluginRegistry as plain object:** Used Map-based standalone object rather than class inheritance from ConnectorRegistry, keeping the pattern consistent with existing registry factory approach
- **Lazy require for circular dependency:** discoverPlugins() requires runtime.cjs lazily (inside function body) to avoid circular dependency at module load time
- **Lockfile-mtime cache:** _scanNodeModules caches results keyed by cwd, invalidated when package-lock.json mtime changes
- **Mismatched override handling:** When config.overrides key does not match plugin connector_id, log error to stderr and skip (non-fatal)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated sdk-exports.test.cjs export count assertion**
- **Found during:** Task 2 (Runtime re-exports verification)
- **Issue:** Export count test expected 72 but runtime now has 79 exports after spreading plugin-registry
- **Fix:** Updated assertion from 72 to 79, updated description to include Phase 46 plugin-registry count
- **Files modified:** tests/sdk-exports.test.cjs
- **Verification:** Full test suite passes (2342/2342)
- **Committed in:** e50e0c5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test assertion update was necessary consequence of adding new exports. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plugin ecosystem foundation complete: manifest validation (Plan 01) + discovery/registry (Plan 02)
- Phase 46 fully complete, ready for Phase 47 (Contract Testing)
- All 79 runtime exports verified, full test suite (2342 tests) passes

## Self-Check: PASSED

- FOUND: thrunt-god/bin/lib/plugin-registry.cjs
- FOUND: thrunt-god/bin/lib/runtime.cjs
- FOUND: tests/plugin-registry.test.cjs
- FOUND: tests/sdk-exports.test.cjs
- FOUND: 46-02-SUMMARY.md
- FOUND: 2015c8a (RED commit)
- FOUND: b94d797 (GREEN commit)
- FOUND: e50e0c5 (Task 2 commit)

---
*Phase: 46-plugin-manifest-discovery*
*Completed: 2026-03-31*
