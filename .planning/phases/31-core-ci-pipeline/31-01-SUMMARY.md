---
phase: 31-core-ci-pipeline
plan: 01
subsystem: ci
tags: [github-actions, node-matrix, c8, coverage, lcov]
dependency_graph:
  requires: []
  provides: [unit-test-ci-workflow, lcov-coverage-artifact]
  affects: [all-prs]
tech_stack:
  added: []
  patterns: [matrix-strategy, conditional-artifact-upload]
key_files:
  created: []
  modified:
    - .github/workflows/test.yml
decisions:
  - id: CI-INLINE-LCOV
    summary: "Inline c8 command in CI rather than modifying test:coverage npm script — lcov reporter is CI-only; local dev does not need lcov files on every run"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 1
---

# Phase 31 Plan 01: Core CI Pipeline Summary

**One-liner:** GitHub Actions matrix CI across Node 20/22/24 on Ubuntu plus Node 22 on macOS/Windows, with c8 text+lcov coverage and conditional artifact upload from the ubuntu/Node 22 job.

## What Was Built

Updated `.github/workflows/test.yml` to:

1. Expand the ubuntu-latest matrix from `[22, 24]` to `[20, 22, 24]` — adds Node 20 as the minimum supported version per `engines.node >= 20.0.0`, giving 5 total matrix jobs (3 Ubuntu + macOS + Windows)
2. Replace `npm run test:coverage` with an inline `npx c8` command that adds `--reporter lcov` alongside the existing `--reporter text`, producing `coverage/lcov.info` in CI
3. Add a conditional `actions/upload-artifact@v4` step that uploads `coverage/lcov.info` as the `coverage-report` artifact with 30-day retention, running only on `ubuntu-latest` + Node 22

`package.json` was intentionally left unchanged — the local `test:coverage` npm script retains only the text reporter.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update test.yml — add Node 20, lcov reporter, coverage upload | 85dabc9 | .github/workflows/test.yml |
| 2 | Validate workflow syntax and test execution | (validation only) | — |

## Verification Results

- 1,850 tests pass, 0 fail (locally confirmed)
- `coverage/lcov.info` generated at 326,285 bytes when running the inline c8 command
- All 9 plan verification checklist items pass
- Working tree clean after coverage/ directory removal

## Decisions Made

| ID | Decision |
|----|----------|
| CI-INLINE-LCOV | Inline c8 command in CI rather than modifying test:coverage npm script — lcov reporter is CI-only; local dev does not need lcov files on every run |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `.github/workflows/test.yml` exists and contains all required elements
- Commit 85dabc9 exists in git log
