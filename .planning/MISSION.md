# Mission: THRUNT GOD Platform Expansion

**Mode:** program
**Opened:** 2026-03-25
**Owner:** Backbay Labs
**Status:** Active

## Signal

THRUNT GOD has been successfully cut over from the old GSD identity, but the product is still strongest as an orchestration substrate. The next step is to turn it into an operator-grade threat hunting platform with a real execution runtime, reusable hunt packs, defensible evidence handling, detection promotion, and feedback-driven learning.

## Desired Outcome

Make THRUNT capable of taking a signal, selecting or generating a hunt pack, executing normalized queries across real telemetry backends, collecting defensible receipts, publishing findings, promoting durable detections, learning from hunt outcomes, shipping connectors as a community ecosystem, replaying hunts interactively, running continuous hunts as code in CI/CD, enabling team-scale collaborative investigations, proving program ROI through analytics, and auto-generating hunts from threat intelligence.

## Scope

- **Time window:** 2026-03-25 through eleven planned milestones (v1.0–v2.0)
- **Entities:** THRUNT runtime, connector SDK, pack registry, evidence model, detection promotion, scoring layer, connector ecosystem, hunt replay viewer, hunt-as-code pipeline, multi-analyst collaboration, program analytics, threat intel integration
- **Environment:** local-first multi-runtime install surface, repo codebase, npm package ecosystem, CI/CD pipelines, web-based viewers, STIX/TAXII/MISP feeds
- **Priority surfaces:** `/hunt:run`, `/hunt:new-case --pack`, receipts, findings publication, detection outputs, planning feedback loops, `@thrunt/connector-*` packages, `.thrunt` playbooks, hunt replay viewer, analytics dashboard, intel-driven case generation

## Operating Constraints

- **Access:** Design for local-first credentials and connector-specific auth, without forcing a single hosted control plane
- **Retention:** Assume telemetry retention differs by backend; the runtime and receipt model must preserve what was queried and what was unavailable
- **Legal / privacy:** Evidence handling must support minimization, provenance, and later integrity checks
- **Operational:** Preserve multi-runtime compatibility, deliver in milestone-sized increments, and avoid vendor-specific abstractions that break pack portability

## Working Theory

If THRUNT standardizes hunt execution as a shared artifact pipeline, then connectors, packs, receipts, findings, detections, and learning loops can compose cleanly. That makes the product opinionated and useful without turning it into a brittle wrapper around one SIEM or one cloud.

## Success Definition

THRUNT is successful when a hunter can move from signal intake to executable hunts, evidence-grade receipts, publishable findings, promotable detections, and data-backed hunt recommendations inside one consistent workflow surface — and when the platform supports community-driven connector ecosystems, interactive hunt replay for training and compliance, declarative hunt-as-code pipelines, team-scale collaborative investigations, quantitative program analytics, and intelligence-driven hunt generation.

## Key Decisions

| Decision | Reason | Date |
|----------|--------|------|
| Build the normalized query runtime before the pack system | Packs should target one execution contract, not many connector-specific behaviors | 2026-03-25 |
| Treat hunt packs as the first major acceleration layer after runtime foundations | Packs are the fastest way to encode analyst expertise once execution is real | 2026-03-25 |
| Make receipt integrity a core milestone, not a cleanup task | Findings and detections are only as trustworthy as their evidence chain | 2026-03-25 |
| Put detection promotion after receipts and packs | Promotion quality depends on repeatable hunts and defensible findings | 2026-03-25 |
| Use learning/scoring as a dedicated milestone, not incidental analytics | Adaptive planning needs explicit data models, scoring logic, and UX | 2026-03-25 |
| Ship connectors as standalone npm packages, not bundled in core | Independent packages lower adoption barrier and enable community contributions | 2026-03-27 |
| Build hunt replay as a static web viewer, not a hosted SaaS | Static sites can be hosted anywhere and don't require accounts — maximizes reach | 2026-03-27 |
| Define .thrunt as a declarative file format for hunt-as-code | Declarative playbooks enable CI/CD integration and continuous hunting — a new category | 2026-03-27 |
| Design multi-analyst on git branching, not a custom sync protocol | Git is the infra teams already have; layering on it avoids reinventing collaboration | 2026-03-27 |
| Build program analytics as a web dashboard with executive export | Security leaders need visual metrics and shareable reports to justify investment | 2026-03-27 |
| Integrate threat intel via STIX/TAXII and MISP, not proprietary feeds | Open standards maximize compatibility across the intel ecosystem | 2026-03-27 |

## Current State

**Shipped:** v1.0 through v1.4 (19 phases, Phases 1-22)
**Stack:** Node.js CJS modules, zero external dependencies, CLI-first
**Codebase:** ~5,000 LOC across runtime.cjs, evidence.cjs, manifest.cjs, bundle.cjs, review.cjs, detection.cjs, pack.cjs, telemetry.cjs, scoring.cjs, recommend.cjs + supporting modules

**Capabilities delivered:**
- Normalized query runtime with 8 built-in connectors
- Pack registry with technique, domain, and threat-family packs
- Evidence integrity with manifests, provenance, hashing, and export bundles
- Detection promotion pipeline with generation, backtesting, and three-gate workflow
- Hunt telemetry, outcome scoring, analyst feedback, and adaptive recommendations

**Next milestone:** v1.5 Live Connector Ecosystem (Phases 23-26) — extract connectors into standalone npm packages

---
*Last updated: 2026-03-27 after v1.4 Hunt Learning & Recommendation Engine milestone*
