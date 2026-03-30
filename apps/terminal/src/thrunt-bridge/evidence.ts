// thrunt-bridge/evidence.ts - Evidence audit domain bridge

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const evidenceAuditResultSchema = z.object({
  phase: z.string(),
  phase_dir: z.string(),
  file: z.string(),
  file_path: z.string(),
  type: z.enum(["evidence_review", "findings", "manifest"]),
  status: z.string(),
  items: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string().optional(),
      status: z.string().optional(),
    }),
  ),
  integrity: z
    .object({
      valid: z.boolean(),
      manifest_hash_valid: z.boolean(),
      artifacts_valid: z.boolean(),
      artifact_errors: z.array(z.string()),
    })
    .optional(),
})

// =============================================================================
// TYPES
// =============================================================================

export type EvidenceAuditResult = z.infer<typeof evidenceAuditResultSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * Audit evidence across all phases. Returns Zod-validated evidence items.
 * Returns empty array on subprocess failure.
 */
export async function auditEvidence(
  opts?: ThruntCommandOptions,
): Promise<EvidenceAuditResult[]> {
  const result = await runThruntCommand<EvidenceAuditResult[]>(
    ["audit-evidence", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return []

  return result.data
    .map((item) => evidenceAuditResultSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data)
}
