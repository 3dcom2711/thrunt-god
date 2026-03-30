---
phase: 35-pack-authoring-interactive-cli
plan: 01
subsystem: cli
tags: [mitre-attack, att&ck, technique-picker, json-bundle, search]

# Dependency graph
requires: []
provides:
  - "Bundled MITRE ATT&CK Enterprise technique database (160 techniques, 397 sub-techniques)"
  - "mitre-data.cjs module with search by ID, name, tactic, and platform"
  - "Multi-select parsing for technique picker input handling"
affects: [35-02 (pack authoring wizard), 35-03 (pack authoring tests)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy singleton data loading (readFileSync + JSON.parse cached in module scope)"
    - "Case-insensitive technique matching with normalised uppercase comparison"
    - "Sub-technique resolution: merged object with parent context (parent_id, parent_name, tactic, platforms)"

key-files:
  created:
    - thrunt-god/data/mitre-attack-enterprise.json
    - thrunt-god/bin/lib/mitre-data.cjs
    - tests/mitre-data.test.cjs
  modified: []

key-decisions:
  - "BUNDLED-JSON: Ship 160-technique bundled JSON extract rather than runtime STIX fetch -- zero network dependency for CLI"
  - "DUPLICATE-DEDUP: Removed duplicate T1548 entry during data bundle creation -- kept the version with sub-techniques"

patterns-established:
  - "ATT&CK data path: path.join(__dirname, '..', '..', 'data', 'mitre-attack-enterprise.json')"
  - "Sub-technique resolution returns merged object: {id, name, parent_id, parent_name, tactic, platforms, data_sources}"

requirements-completed: [PACK-01]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 35 Plan 01: MITRE ATT&CK Data Bundle Summary

**Bundled 160 ATT&CK Enterprise techniques with search-by-ID/name/tactic/platform module powering the technique picker**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T20:07:13Z
- **Completed:** 2026-03-30T20:16:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created mitre-attack-enterprise.json with 160 techniques and 397 sub-techniques covering all 14 ATT&CK Enterprise tactics
- Built mitre-data.cjs module exporting 7 functions: loadAttackData, getTechniqueById, searchTechniques, filterByTactic, filterByPlatform, parseMultiSelect, getAllTactics
- Comprehensive test suite with 34 test cases across 7 suites, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests for MITRE data module** - `74b8683` (test)
2. **Task 1 (TDD GREEN): MITRE data bundle + mitre-data.cjs** - `27a7c36` (feat)
3. **Task 2: Expanded test suite to 34 cases** - `48c31d0` (test)

_Note: Task 1 was TDD with RED -> GREEN commits_

## Files Created/Modified
- `thrunt-god/data/mitre-attack-enterprise.json` - Bundled ATT&CK Enterprise database (160 techniques, 397 sub-techniques, all 14 tactics)
- `thrunt-god/bin/lib/mitre-data.cjs` - Data loading, search, filtering, and multi-select parsing module (~230 LOC)
- `tests/mitre-data.test.cjs` - Test suite with 34 test cases across 7 suites (~313 LOC)

## Decisions Made
- **BUNDLED-JSON:** Shipped 160-technique bundled JSON extract rather than runtime STIX fetch -- zero network dependency for the CLI tool, consistent with spec Section 6.1 Option A recommendation
- **DUPLICATE-DEDUP:** Data bundle initially had a duplicate T1548 entry (one with sub-techniques, one without); kept the complete version with 4 sub-techniques

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate T1548 technique entry**
- **Found during:** Task 1 (data bundle creation)
- **Issue:** mitre-attack-enterprise.json contained two T1548 entries -- one with sub-techniques and one empty
- **Fix:** Removed the duplicate entry without sub-techniques
- **Files modified:** thrunt-god/data/mitre-attack-enterprise.json
- **Verification:** node -e check confirms 160 unique IDs, no duplicates
- **Committed in:** 27a7c36 (part of Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial data correctness fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- mitre-data.cjs module ready for import by pack authoring wizard (Plan 35-02)
- Data bundle path established at thrunt-god/data/mitre-attack-enterprise.json
- All 7 exported functions verified and tested

---
*Phase: 35-pack-authoring-interactive-cli*
*Completed: 2026-03-30*

## Self-Check: PASSED
