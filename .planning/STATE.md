---
thrunt_state_version: 1.0
milestone: v1.2
milestone_name: Evidence Integrity & Provenance
current_phase: 16
current_phase_name: evidence review publish gates
current_plan: 16-01 (planned, not started)
status: validating
stopped_at: Completed 16-01-PLAN.md
last_updated: "2026-03-27T18:20:16.170Z"
last_activity: 2026-03-27
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
  percent: 80
---

# Hunt State

## Mission Reference

See: .planning/MISSION.md (updated 2026-03-25)

**Core value:** Turn THRUNT into an executable, evidence-grade threat hunting platform.
**Current focus:** Phase 16 — evidence review & publish gates

## Current Position

Phase: 16 (evidence review & publish gates) — PLANNED, READY TO EXECUTE
Plan: 0 of 1 complete
Current Phase: 16
Current Phase Name: evidence review publish gates
Total Phases: 35
Current Plan: 16-01 (planned, not started)
Total Plans in Phase: 1
Status: Phase complete — ready for validation
Last activity: 2026-03-27
Last Activity Description: Created 16-01-PLAN.md — review.cjs module with quality scoring, publish gates, contradiction/blind-spot detection, chain-of-custody, config registration, CLI wiring
Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: Baseline not established

| Phase 13 P01 | 3min | 2 tasks | 7 files |
| Phase 14 P01 | 4min | 2 tasks | 3 files |
| Phase 15 P01 | 5min | 2 tasks | 3 files |
| Phase 16 P01 | 6min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

- [Phase 1]: Runtime first, then packs, then evidence integrity, then detection promotion, then learning.
- [Phase 1]: Keep the roadmap vendor-neutral at the contract level while still naming the first target connectors explicitly.
- [Milestone v1.1]: Use the existing multi-milestone huntmap as the source of truth for the next active cycle rather than re-running milestone-definition questioning.
- [Milestone v1.1]: Archive shipped milestone detail into `.planning/milestones/` and keep the live huntmap focused on the next active milestone.
- [Phase 12]: Insert connector certification before evidence-manifest work so live backend trust is explicit before provenance features depend on it.
- [Phase 13]: Canonical EvidenceManifest in JSON with deterministic key ordering, SHA-256 content hashes, explicit null for missing fields, bidirectional artifact links, and manifest_version "1.0".
- [Phase 13]: Manifests co-located in .planning/MANIFESTS/ (flat directory matching QUERIES/ and RECEIPTS/ pattern) since writeRuntimeArtifacts does not know the active phase.
- [Phase 13]: manifest.cjs is a pure schema module with zero dependencies on evidence.cjs to avoid circular requires.
- [Phase 14]: Manifest-level hash (SHA-256) computed over canonical-serialized body excluding manifest_hash and signature fields. Mandatory on every manifest.
- [Phase 14]: Agent-based provenance identity model with signer_type/signer_id/signer_context + execution environment (OS, Node, THRUNT version, runtime agent).
- [Phase 14]: Signature hooks (beforeSign/afterSign) defined but not implemented — teams plug in their own crypto.
- [Phase 14]: verifyManifestIntegrity returns structured failures, never throws. On-demand only.
- [Phase 14]: MANIFEST_VERSION bumped from "1.0" to "1.1" for additive schema change.
- [Phase 14]: verifyManifestIntegrity in manifest.cjs with documented fs exception; MANIFEST_VERSION 1.0 -> 1.1; provenance before hash; signature null placeholder
- [Phase 15]: ZIP export bundles using zero-dependency manual ZIP construction (node:zlib deflateRawSync + crc32).
- [Phase 15]: bundle.json at archive root as self-describing index with bundle_version "1.0", artifacts, manifests, chain_of_custody, redactions, summary.
- [Phase 15]: bundle.cjs is an orchestration module importing from manifest.cjs and core.cjs; no new production dependencies.
- [Phase 15]: Zero-dependency ZIP construction using node:zlib deflateRawSync + crc32; bundle.json as self-describing index with deterministic serialization
- [Phase 16]: review.cjs as a pure consumer of manifest.cjs, evidence.cjs, and core.cjs (one-way dependency, no circular requires).
- [Phase 16]: Composite quality score from three positive dimensions (receipt coverage, integrity, provenance completeness) minus contradiction penalty (0.1 per contradiction).
- [Phase 16]: publish_quality_threshold configurable via config-set with default 0.7; gate blocks with explanation + --force override.
- [Phase 16]: Composite quality score from average of three positive dimensions minus contradiction penalty (0.1 per contradiction), floored at 0.0
- [Phase 16]: Division by zero returns 1.0 (vacuously true) for all dimensions when denominator is 0
- [Phase 16]: Added max validation to config.cjs number type rules for publish_quality_threshold 0-1 range

### Pending Todos

None yet.

### Blockers/Concerns

- Real connector auth and secret handling must stay local-first and runtime-compatible across Claude, Codex, and other supported installs.

## Session Continuity

Last session: 2026-03-27T18:20:16.167Z
Stopped at: Completed 16-01-PLAN.md
Resume file: None
