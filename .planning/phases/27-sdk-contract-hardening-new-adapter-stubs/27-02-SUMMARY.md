---
phase: 27-sdk-contract-hardening-new-adapter-stubs
plan: 02
subsystem: connectors
tags: [opensearch, defender-xdr, jdbc, kql, oauth, advanced-hunting, basic-auth]

# Dependency graph
requires:
  - phase: 27-sdk-contract-hardening-new-adapter-stubs
    plan: 01
    provides: "status_override propagation pattern, 3 SIEM adapters (splunk, elastic, sentinel)"
provides:
  - "createOpenSearchAdapter factory: SQL via /_plugins/_sql with JDBC normalization"
  - "createDefenderXDRAdapter factory: KQL via /api/advancedhunting/run with OAuth scope"
  - "normalizeDefenderResults helper for {Schema, Results} response shape"
  - "Registry expanded to 10 connectors (5 SIEM: splunk, elastic, sentinel, opensearch, defender_xdr)"
affects: [29-splunk-integration-tests, 30-elastic-opensearch-integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: ["JDBC {schema, datarows} to normalizeElasticRows shim for OpenSearch", "normalizeDefenderResults for pre-formed {Schema, Results} objects"]

key-files:
  created: []
  modified:
    - "thrunt-god/bin/lib/runtime.cjs"
    - "tests/connectors-siem.test.cjs"

key-decisions:
  - "OpenSearch reuses normalizeElasticRows via adapter shim that maps {schema, datarows} to {columns, values}"
  - "Defender XDR uses dedicated normalizeDefenderResults since Results are pre-formed objects (no column mapping needed)"
  - "Defender XDR defaults to api.security.microsoft.com for both base URL and OAuth scope"

patterns-established:
  - "JDBC shim pattern: adapter normalizeResponse adapts vendor-specific column+row format to {columns, values} before calling shared normalizeElasticRows"
  - "Pre-formed results pattern: when API returns objects directly (Defender XDR), skip column mapping and pass through toArray()"

requirements-completed: [CONN-01, CONN-02]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 27 Plan 02: OpenSearch and Defender XDR Adapter Stubs Summary

**OpenSearch SQL adapter (/_plugins/_sql, JDBC format, basic auth) and Defender XDR Advanced Hunting adapter (/api/advancedhunting/run, OAuth, {Schema,Results} normalizer) registered in connector registry with full entity extraction**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T06:46:22Z
- **Completed:** 2026-03-30T06:50:01Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added createOpenSearchAdapter factory: SQL via /_plugins/_sql with basic/api_key/bearer auth, normalizes JDBC {schema, datarows} via normalizeElasticRows shim, extracts host/user/ip entities
- Added createDefenderXDRAdapter factory: KQL via /api/advancedhunting/run with OAuth client credentials (scope api.security.microsoft.com/.default), normalizes {Schema, Results} via dedicated normalizeDefenderResults, extracts DeviceName/AccountName/RemoteIP entities
- Added normalizeDefenderResults helper for Defender XDR's pre-formed result objects
- Registry expanded from 8 to 10 connectors (5 SIEM + okta, m365, crowdstrike, aws, gcp)
- Registry test updated to assert all 5 SIEM connectors have docs_url and limitations
- Full test suite (1847 tests) passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing test for OpenSearch SQL** - `dfa5ca6` (test)
2. **Task 1 (GREEN): OpenSearch adapter with JDBC normalization** - `946c632` (feat)
3. **Task 2 (RED): Failing test for Defender XDR Advanced Hunting** - `d49d041` (test)
4. **Task 2 (GREEN): Defender XDR adapter and registry update** - `918d754` (feat)

_TDD tasks: RED committed failing tests, GREEN committed implementation passing all tests._

## Files Created/Modified
- `thrunt-god/bin/lib/runtime.cjs` - Added normalizeDefenderResults helper, createOpenSearchAdapter and createDefenderXDRAdapter factory functions, registered both in createBuiltInConnectorRegistry
- `tests/connectors-siem.test.cjs` - Added 2 new end-to-end tests (opensearch JDBC, defender_xdr advanced hunting), updated registry assertion to check all 5 SIEM connectors

## Decisions Made
- OpenSearch reuses normalizeElasticRows via adapter shim that maps {schema, datarows} to {columns, values} -- avoids duplicating column-to-row mapping logic
- Defender XDR uses dedicated normalizeDefenderResults since Results are pre-formed objects (not column+row arrays) -- normalizeAzureTables is NOT compatible
- Defender XDR defaults to api.security.microsoft.com for both base URL fallback and OAuth scope, matching the production API surface

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 SIEM adapters (splunk, elastic, sentinel, opensearch, defender_xdr) are registered and tested via startJsonServer fixtures
- OpenSearch adapter ready for integration testing against Docker OpenSearch in Phase 30
- Defender XDR adapter ready for mock-based integration testing (no Docker image for SaaS service)
- Both adapters support the status_override pattern from Plan 01 (can be extended when needed)
- Registry now has 10 total connectors, providing comprehensive coverage for the connector ecosystem

## Self-Check: PASSED

- All files exist (runtime.cjs, connectors-siem.test.cjs, 27-02-SUMMARY.md)
- All commits verified (dfa5ca6, 946c632, d49d041, 918d754)

---
*Phase: 27-sdk-contract-hardening-new-adapter-stubs*
*Completed: 2026-03-30*
