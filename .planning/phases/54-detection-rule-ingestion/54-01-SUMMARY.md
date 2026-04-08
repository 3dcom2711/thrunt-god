---
phase: 54-detection-rule-ingestion
plan: 01
subsystem: database
tags: [sigma, escu, elastic, kql, fts5, sqlite, js-yaml, smol-toml, detection-rules, mitre-attack]

# Dependency graph
requires:
  - phase: 53-mcp-server-attack-tools
    provides: "openIntelDb, intel.db lifecycle, better-sqlite3 patterns, FTS5 schema conventions"
provides:
  - "Four format-specific detection rule parsers (Sigma, ESCU, Elastic, KQL)"
  - "detections + detections_fts schema in intel.db"
  - "Recursive directory indexers for all four formats"
  - "FTS5 search with source_format/severity/technique_id filters"
  - "populateDetectionsIfEmpty lazy population with env var paths"
affects: [54-02-detection-mcp-tools, 55-coverage-analysis, detection-search]

# Tech tracking
tech-stack:
  added: [js-yaml@4.1.1, smol-toml@1.6.1]
  patterns: [format-specific-parser-with-unified-output, directory-indexer-pattern, fts5-bm25-search-with-filters]

key-files:
  created:
    - mcp-hunt-intel/lib/detections.cjs
    - tests/detections.test.cjs
    - tests/fixtures/sigma-sample.yml
    - tests/fixtures/escu-sample.yml
    - tests/fixtures/elastic-sample.toml
    - tests/fixtures/kql-sample.md
  modified:
    - mcp-hunt-intel/package.json
    - mcp-hunt-intel/package-lock.json

key-decisions:
  - "Regular FTS5 (not external content) for detections_fts -- consistent with techniques_fts pattern from Phase 53"
  - "FTS search joins on rowid between detections and detections_fts for full-row retrieval with BM25 ranking"
  - "KQL parser uses regex heuristic for generic code blocks (where|project|summarize|extend|DeviceEvents)"
  - "Elastic TOML parser iterates all [[rule.threat]] entries including nested subtechniques for complete technique extraction"
  - "Directory indexers skip empty IDs (e.g., sigma: with no actual id) to prevent bad data"

patterns-established:
  - "Format-specific parser pattern: parse*Rule(text, filePath) -> DetectionRow | null"
  - "Directory indexer pattern: index*Directory(db, dirPath) -> count of rules indexed"
  - "Env var path indexing: SIGMA_PATHS/SPLUNK_PATHS/ELASTIC_PATHS as path.delimiter-separated directories"
  - "Test fixture pattern: minimal valid rule files in tests/fixtures/ for each format"

requirements-completed: [DET-01, DET-02, DET-03, DET-04, DET-05]

# Metrics
duration: 11min
completed: 2026-04-08
---

# Phase 54 Plan 01: Detection Rule Ingestion Summary

**Four format-specific detection rule parsers (Sigma YAML, ESCU YAML, Elastic TOML, KQL Markdown) with FTS5-indexed detections table, recursive directory indexers, and BM25-ranked search**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-08T18:15:23Z
- **Completed:** 2026-04-08T18:26:28Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 8

## Accomplishments
- Built four format-specific parsers producing normalized DetectionRow objects from Sigma YAML, Splunk ESCU YAML, Elastic TOML, and KQL Markdown
- Created idempotent detections + detections_fts schema with porter unicode61 tokenizer and source/severity indexes
- Implemented recursive directory indexers for all four formats with malformed-file resilience
- Built FTS5 search with BM25 ranking and optional source_format/severity/technique_id filters
- Added populateDetectionsIfEmpty with bundled sigma-core support and env var path indexing
- 38 new tests covering all parsers, schema, indexers, and search -- full suite (1842 tests) green

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Failing tests** - `fdf5670` (test)
2. **Task 1 GREEN: Implementation** - `6007795` (feat)

## Files Created/Modified
- `mcp-hunt-intel/lib/detections.cjs` - Four parsers, schema, indexers, search, populate -- 12 exports
- `tests/detections.test.cjs` - 38 tests covering all parsers, schema, indexers, and search
- `tests/fixtures/sigma-sample.yml` - Minimal valid Sigma rule fixture
- `tests/fixtures/escu-sample.yml` - Minimal valid ESCU rule fixture
- `tests/fixtures/elastic-sample.toml` - Minimal valid Elastic TOML rule fixture
- `tests/fixtures/kql-sample.md` - Minimal valid KQL markdown fixture
- `mcp-hunt-intel/package.json` - Added js-yaml, smol-toml deps; updated files array to include data
- `mcp-hunt-intel/package-lock.json` - Lock file updated with new dependencies

## Decisions Made
- Regular FTS5 (not external content) for detections_fts -- consistent with techniques_fts pattern from Phase 53 (data is write-once after ingestion)
- FTS search joins on rowid between detections and detections_fts for full-row retrieval with BM25 ranking
- KQL parser uses regex heuristic for generic code blocks to catch unlabeled KQL
- Elastic TOML parser iterates all [[rule.threat]] entries including nested subtechniques for complete MITRE technique extraction
- Directory indexers skip entries with empty IDs (format prefix only, no actual rule ID) to prevent bad data insertion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- detections.cjs is ready for Plan 02 (MCP tools + CLI integration for detection search)
- All 12 exports available for downstream consumers
- detections table and FTS5 search ready for coverage analysis (Phase 55)
- bundled sigma-core directory (mcp-hunt-intel/data/sigma-core/) not yet populated -- will be added when rules are bundled

## Self-Check: PASSED

- All 6 created files exist on disk
- Both commits (fdf5670, 6007795) exist in git history
- All 12 exports confirmed from detections.cjs
- 38/38 tests pass, 1842/1842 full suite tests pass

---
*Phase: 54-detection-rule-ingestion*
*Completed: 2026-04-08*
