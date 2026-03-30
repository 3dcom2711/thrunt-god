---
phase: 30-elastic-opensearch-integration
plan: 01
subsystem: connectors
tags: [elasticsearch, opensearch, eql, sigv4, aws, siem]

# Dependency graph
requires:
  - phase: 27-connector-implementations
    provides: createElasticAdapter, createOpenSearchAdapter, signAwsRequest, normalizeElasticRows
provides:
  - EQL sequence query surface in Elastic adapter (/_eql/search endpoint)
  - SigV4 authentication in OpenSearch adapter (AWS managed clusters)
affects: [30-02-integration-tests, connector-sdk]

# Tech tracking
tech-stack:
  added: []
  patterns: [EQL response normalization via hits.events detection, SigV4 service parameter for OpenSearch]

key-files:
  created: []
  modified:
    - thrunt-god/bin/lib/runtime.cjs
    - tests/connectors-siem.test.cjs

key-decisions:
  - "EQL detection uses hits.events array presence rather than spec.query.language to keep normalizeResponse robust against response shape variations"
  - "SigV4 for OpenSearch reuses signAwsRequest with service='es' (same pattern as AWS CloudTrail adapter with service='cloudtrail')"
  - "EQL prepareQuery sends {query, filter, size} body shape matching Elasticsearch EQL search API"

patterns-established:
  - "EQL response normalization: map hit._source to flat row, reuse same entity extraction paths as ES|QL"
  - "SigV4 service parameterization: auth.service='es' for OpenSearch vs 'cloudtrail' for AWS adapter"

requirements-completed: [CONN-05, CONN-07]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 30 Plan 01: EQL & SigV4 Summary

**EQL sequence query surface routing to /_eql/search with hits.events normalization, and SigV4 auth for AWS-managed OpenSearch clusters via service='es'**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T07:48:03Z
- **Completed:** 2026-03-30T07:51:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Elastic adapter now supports both ES|QL and EQL query languages, with EQL routing to /_eql/search and normalizing hits.events response shape
- OpenSearch adapter supports SigV4 authentication for AWS-managed clusters, delegating to signAwsRequest with service='es'
- Both features have dedicated unit tests via startJsonServer fixtures confirming end-to-end request routing and response normalization
- Full connector test suite passes with zero regressions (20 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add EQL query surface to Elastic adapter**
   - `79ad69a` (test: failing EQL test - RED)
   - `f8bcc77` (feat: EQL implementation - GREEN)
2. **Task 2: Add SigV4 authentication to OpenSearch adapter**
   - `bd3c5d7` (test: failing SigV4 test - RED)
   - `8932081` (feat: SigV4 implementation - GREEN)

_TDD tasks each have RED and GREEN commits._

## Files Created/Modified
- `thrunt-god/bin/lib/runtime.cjs` - Added EQL branch in createElasticAdapter (prepareQuery + normalizeResponse) and SigV4 auth in createOpenSearchAdapter (executeRequest + preflight)
- `tests/connectors-siem.test.cjs` - Added 2 new tests: EQL sequence query normalization and OpenSearch SigV4 authentication

## Decisions Made
- EQL detection in normalizeResponse uses hits.events array presence rather than checking spec.query.language, keeping the normalizer robust against response shape variations
- SigV4 for OpenSearch reuses the existing signAwsRequest infrastructure with service='es', matching the established pattern from the AWS CloudTrail adapter (service='cloudtrail')
- EQL prepareQuery sends {query, filter, size} body shape per the Elasticsearch EQL search API specification
- Preflight validates region when auth_type is sigv4, but allows base_url as an alternative (matches AWS adapter pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EQL and SigV4 features are unit-tested; Phase 30 Plan 02 integration tests can validate against live Docker containers
- All connector features (CONN-01 through CONN-07) are now implemented and unit-tested
- OpenSearch /_plugins/_esql/query endpoint path for OpenSearch 3.x remains unverified (noted in STATE.md blockers)

---
*Phase: 30-elastic-opensearch-integration*
*Completed: 2026-03-30*
