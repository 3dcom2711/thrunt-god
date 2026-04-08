---
phase: 53
slug: mcp-server-att-ck-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (built-in Node.js test runner) |
| **Config file** | none — existing test infrastructure |
| **Quick run command** | `node --test tests/intel-db.test.cjs` |
| **Full suite command** | `node --test tests/*.test.cjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/intel-db.test.cjs`
- **After every plan wave:** Run `node --test tests/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 53-01-01 | 01 | 1 | MCP-06 | unit | `node --test tests/intel-db.test.cjs` | -- W0 | pending |
| 53-01-02 | 01 | 1 | MCP-02 | unit | `node --test tests/intel-db.test.cjs` | -- W0 | pending |
| 53-01-03 | 01 | 1 | MCP-03 | unit | `node --test tests/intel-db.test.cjs` | -- W0 | pending |
| 53-02-01 | 02 | 2 | MCP-01 | integration | `node --test tests/mcp-intel.test.cjs` | -- W0 | pending |
| 53-02-02 | 02 | 2 | MCP-02, MCP-03 | integration | `node --test tests/mcp-intel.test.cjs` | -- W0 | pending |
| 53-02-03 | 02 | 2 | MCP-04 | unit | `node --test tests/intel-db.test.cjs` | -- W0 | pending |
| 53-02-04 | 02 | 2 | MCP-05 | unit | `node --test tests/intel-db.test.cjs` | -- W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/intel-db.test.cjs` — stubs for intel.cjs module (MCP-02, MCP-03, MCP-05, MCP-06)
- [ ] `tests/mcp-intel.test.cjs` — stubs for MCP server integration (MCP-01, MCP-04)

*Existing test infrastructure (node --test, c8 coverage) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx @thrunt/mcp-hunt-intel` starts server | MCP-01 | Requires npx resolution | Run `node mcp-hunt-intel/bin/server.cjs` and verify JSON-RPC handshake |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
