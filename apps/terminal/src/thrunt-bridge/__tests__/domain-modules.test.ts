import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

// Mock the executor module before importing domain modules
const mockRunThruntCommand = mock(() => Promise.resolve({ ok: false, exitCode: 1 }))

mock.module("../executor", () => ({
  runThruntCommand: mockRunThruntCommand,
}))

// Import domain modules after mocking
import { auditEvidence } from "../evidence"
import { listDetections, detectionStatus } from "../detection"
import { listPacks, showPack } from "../pack"
import { listConnectors, runtimeDoctor } from "../connector"
import { analyzeHuntmap, getPhaseDetail } from "../huntmap"

beforeEach(() => {
  mockRunThruntCommand.mockClear()
})

// =============================================================================
// EVIDENCE
// =============================================================================

describe("auditEvidence", () => {
  test("calls runThruntCommand with ['audit-evidence', '--raw'] and returns EvidenceAuditResult[]", async () => {
    const mockData = [
      {
        phase: "23",
        phase_dir: ".planning/phases/23-bridge-foundation",
        file: "evidence-review.yaml",
        file_path: ".planning/phases/23-bridge-foundation/evidence-review.yaml",
        type: "evidence_review",
        status: "complete",
        items: [{ id: "EV-001", text: "Bridge executor tested", status: "verified" }],
      },
    ]

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await auditEvidence()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["audit-evidence", "--raw"], undefined)
    expect(result).toHaveLength(1)
    expect(result[0].phase).toBe("23")
    expect(result[0].type).toBe("evidence_review")
    expect(result[0].items[0].id).toBe("EV-001")
  })

  test("returns empty array when subprocess fails (ok: false)", async () => {
    mockRunThruntCommand.mockResolvedValueOnce({ ok: false, error: "not found", exitCode: 1 })

    const result = await auditEvidence()
    expect(result).toEqual([])
  })
})

// =============================================================================
// DETECTION
// =============================================================================

describe("listDetections", () => {
  test("calls runThruntCommand with ['detection', 'list', '--raw'] and returns DetectionCandidate[]", async () => {
    const mockData = [
      {
        candidate_version: "1.0",
        candidate_id: "DET-20260329123456-ABCD1234",
        source_finding_id: "F-001",
        source_phase: "23",
        technique_ids: ["T1059", "T1059.001"],
        detection_logic: {
          title: "Test detection",
          description: "A test",
          logsource: { category: "process_creation" },
          detection: { selection: {}, condition: "selection" },
          false_positives: [],
        },
        target_format: "sigma",
        confidence: "high",
        promotion_readiness: 0.85,
        evidence_links: [{ type: "finding", id: "F-001", claim_status: "verified" }],
        metadata: {
          author: "test",
          created_at: "2026-03-29",
          last_updated: "2026-03-29",
          status: "candidate",
          notes: "",
        },
        content_hash: "sha256:abc123",
      },
    ]

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await listDetections()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["detection", "list", "--raw"], undefined)
    expect(result).toHaveLength(1)
    expect(result[0].candidate_id).toBe("DET-20260329123456-ABCD1234")
    expect(result[0].technique_ids).toEqual(["T1059", "T1059.001"])
    expect(result[0].promotion_readiness).toBe(0.85)
  })

  test("filters out items that fail Zod validation (partial data resilience)", async () => {
    const mockData = [
      {
        candidate_version: "1.0",
        candidate_id: "DET-VALID",
        source_finding_id: "F-001",
        source_phase: null,
        technique_ids: ["T1059"],
        detection_logic: {
          title: "Valid",
          description: "Valid detection",
          logsource: { category: "test" },
          detection: { selection: {}, condition: "selection" },
          false_positives: [],
        },
        target_format: "sigma",
        confidence: "medium",
        promotion_readiness: 0.5,
        evidence_links: [],
        metadata: { author: "a", created_at: "x", last_updated: "x", status: "draft", notes: "" },
        content_hash: "sha256:valid",
      },
      // Invalid: missing required fields
      { candidate_id: "DET-INVALID", bad_field: true },
    ]

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await listDetections()
    expect(result).toHaveLength(1)
    expect(result[0].candidate_id).toBe("DET-VALID")
  })
})

describe("detectionStatus", () => {
  test("calls runThruntCommand with ['detection', 'status', '--raw'] and returns DetectionStatusResult", async () => {
    const mockData = {
      total: 5,
      by_status: { draft: 2, candidate: 2, approved: 1 },
      by_confidence: { high: 2, medium: 2, low: 1 },
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await detectionStatus()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["detection", "status", "--raw"], undefined)
    expect(result).not.toBeNull()
    expect(result!.total).toBe(5)
    expect(result!.by_status).toEqual({ draft: 2, candidate: 2, approved: 1 })
  })
})

// =============================================================================
// PACK
// =============================================================================

describe("listPacks", () => {
  test("calls runThruntCommand with ['pack', 'list', '--raw'] and returns PackListEntry[]", async () => {
    const mockData = {
      packs: [
        {
          id: "lateral-movement-smb",
          kind: "technique",
          title: "SMB Lateral Movement",
          stability: "stable",
          source: "built-in",
          required_connectors: ["crowdstrike"],
          supported_datasets: ["process_creation"],
        },
      ],
      overrides: {},
      paths: ["/packs"],
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await listPacks()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["pack", "list", "--raw"], undefined)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("lateral-movement-smb")
    expect(result[0].required_connectors).toEqual(["crowdstrike"])
  })
})

describe("showPack", () => {
  test("calls runThruntCommand with ['pack', 'show', packId, '--raw'] and returns PackShowResult", async () => {
    const mockData = {
      found: true,
      pack_id: "lateral-movement-smb",
      pack: {
        id: "lateral-movement-smb",
        kind: "technique",
        title: "SMB Lateral Movement",
        description: "Detects lateral movement via SMB",
        stability: "stable",
        parameters: [
          { name: "lookback_days", type: "integer", required: false, description: "Days to look back", default: 7 },
        ],
        targets: [{ connector: "crowdstrike", dataset: "process_creation", query_template: "SELECT * ..." }],
        attack: ["T1021.002"],
        metadata: {},
      },
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await showPack("lateral-movement-smb")
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["pack", "show", "lateral-movement-smb", "--raw"], undefined)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(true)
    expect(result!.pack!.parameters).toHaveLength(1)
  })

  test("returns null when subprocess fails", async () => {
    mockRunThruntCommand.mockResolvedValueOnce({ ok: false, error: "not found", exitCode: 1 })

    const result = await showPack("nonexistent")
    expect(result).toBeNull()
  })
})

// =============================================================================
// CONNECTOR
// =============================================================================

describe("listConnectors", () => {
  test("calls runThruntCommand with ['runtime', 'list-connectors', '--raw'] and returns ConnectorEntry[]", async () => {
    const mockData = {
      connectors: [
        {
          id: "crowdstrike",
          name: "CrowdStrike Falcon",
          auth_types: ["api_key"],
          supported_datasets: ["process_creation", "network_connection"],
          supported_languages: ["kql"],
          pagination_modes: ["offset"],
        },
      ],
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await listConnectors()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["runtime", "list-connectors", "--raw"], undefined)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("crowdstrike")
    expect(result[0].auth_types).toEqual(["api_key"])
  })
})

describe("runtimeDoctor", () => {
  test("calls runThruntCommand with ['runtime', 'doctor', '--raw'] and returns RuntimeDoctorResult", async () => {
    const mockData = {
      summary: { total: 3, healthy: 2, degraded: 1, unavailable: 0 },
      connectors: [
        {
          id: "crowdstrike",
          name: "CrowdStrike Falcon",
          configured: true,
          health: "healthy",
          score: 95,
          checks: [{ name: "auth", passed: true, message: "API key valid" }],
        },
      ],
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await runtimeDoctor()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["runtime", "doctor", "--raw"], undefined)
    expect(result).not.toBeNull()
    expect(result!.summary.healthy).toBe(2)
    expect(result!.connectors[0].health).toBe("healthy")
  })
})

// =============================================================================
// HUNTMAP
// =============================================================================

describe("analyzeHuntmap", () => {
  test("calls runThruntCommand with ['huntmap', 'analyze', '--raw'] and returns HuntmapAnalysis", async () => {
    const mockData = {
      milestones: [{ heading: "v1.5 TUI", version: "v1.5" }],
      phases: [
        {
          number: "23",
          name: "bridge-foundation",
          goal: "Build TUI bridge",
          depends_on: null,
          plan_count: 2,
          summary_count: 2,
          has_context: true,
          has_research: true,
          disk_status: "complete",
          roadmap_complete: true,
        },
      ],
      phase_count: 4,
      completed_phases: 1,
      total_plans: 8,
      total_summaries: 2,
      progress_percent: 25,
      current_phase: "24",
      next_phase: "25",
      missing_phase_details: null,
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await analyzeHuntmap()
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["huntmap", "analyze", "--raw"], undefined)
    expect(result).not.toBeNull()
    expect(result!.phase_count).toBe(4)
    expect(result!.phases[0].number).toBe("23")
    expect(result!.progress_percent).toBe(25)
  })
})

describe("getPhaseDetail", () => {
  test("calls runThruntCommand with ['huntmap', 'get-phase', phaseNum, '--raw'] and returns HuntmapPhaseDetail", async () => {
    const mockData = {
      found: true,
      phase_number: "23",
      phase_name: "bridge-foundation",
      goal: "Build TUI bridge to thrunt-tools.cjs",
      success_criteria: ["Executor works", "Streaming works"],
      section: "## Phase 23: Bridge Foundation\n...",
    }

    mockRunThruntCommand.mockResolvedValueOnce({ ok: true, data: mockData, exitCode: 0 })

    const result = await getPhaseDetail("23")
    expect(mockRunThruntCommand).toHaveBeenCalledWith(["huntmap", "get-phase", "23", "--raw"], undefined)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(true)
    expect(result!.phase_name).toBe("bridge-foundation")
    expect(result!.success_criteria).toHaveLength(2)
  })

  test("returns null when subprocess fails", async () => {
    mockRunThruntCommand.mockResolvedValueOnce({ ok: false, error: "not found", exitCode: 1 })

    const result = await getPhaseDetail("99")
    expect(result).toBeNull()
  })
})
