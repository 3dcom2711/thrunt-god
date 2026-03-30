---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Live Connector Integrations
status: phase_complete
stopped_at: Completed 27-02-PLAN.md -- OpenSearch and Defender XDR adapter stubs
last_updated: "2026-03-30T06:50:01Z"
last_activity: 2026-03-30 -- Completed phase 27 (all 2 plans)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Hunters can move from signal intake to executable hunts, evidence-grade receipts, publishable findings, promotable detections, and data-backed hunt recommendations inside one consistent workflow surface.
**Current focus:** v1.6 Phase 27 — SDK Contract Hardening & New Adapter Stubs

## Current Milestone: v1.6 Live Connector Integrations

**Goal:** Ship real, multi-surface connectors for Splunk, Elastic/OpenSearch, and Microsoft Sentinel/Defender XDR with Docker-based integration tests.

## Current Position

Phase: 27 of 30 (SDK Contract Hardening & New Adapter Stubs)
Plan: 2 of 2 (complete)
Status: Phase Complete
Last activity: 2026-03-30 -- Completed 27-02 OpenSearch and Defender XDR adapter stubs

Progress: [██████████] 100% (v1.6 phase 27)

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (v1.6)
- Average duration: 3min
- Total execution time: 0.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 27 | 2 | 6min | 3min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [27-02]: OpenSearch reuses normalizeElasticRows via adapter shim that maps {schema, datarows} to {columns, values}
- [27-02]: Defender XDR uses dedicated normalizeDefenderResults since Results are pre-formed objects (no column mapping needed)
- [27-02]: Defender XDR defaults to api.security.microsoft.com for both base URL and OAuth scope
- [27-01]: status_override uses first-non-null-wins semantics in accumulator for multi-page queries
- [27-01]: Sentinel PartialError warning includes error.message and error.details for downstream analysis
- [v1.0-v1.4]: Connector SDK exists with typed interfaces; connectors are stubs — v1.6 upgrades to real network-calling implementations
- [v1.5]: Shipped TUI Operator Console (phases 23-26) in main thrunt-god repo
- [v1.6 roadmap]: OpenSearch and Defender XDR built as separate adapters (not subclasses); OpenSearch reuses normalizeElasticRows(); Defender XDR has its own {Schema,Results} normalizer
- [v1.6 roadmap]: Sentinel/Defender XDR tested via startJsonServer() fixture only — no Docker image exists for SaaS services
- [v1.6 roadmap]: EQL surface (CONN-05) and SigV4 (CONN-07) grouped with Elastic/OpenSearch integration (Phase 30)
- [v1.6 roadmap]: Splunk async job fallback (CONN-06) grouped with Splunk integration (Phase 29)

### Pending Todos

None yet.

### Blockers/Concerns

- Splunk token creation bootstrap sequence in testcontainers context unverified — validate during Phase 29 planning
- OpenSearch /_plugins/_esql/query endpoint path in OpenSearch 3.x not confirmed — verify before Phase 30
- Retry-After header access in executeConnectorRequest retry loop may need targeted refactor

## Session Continuity

Last session: 2026-03-30
Stopped at: Completed 27-02-PLAN.md -- phase 27 complete (OpenSearch + Defender XDR adapters)
Resume file: None
