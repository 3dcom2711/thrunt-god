// thrunt-bridge/detection.ts - Detection candidate domain bridge

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const detectionCandidateSchema = z.object({
  candidate_version: z.string(),
  candidate_id: z.string(),
  source_finding_id: z.string(),
  source_phase: z.string().nullable(),
  technique_ids: z.array(z.string()),
  detection_logic: z.object({
    title: z.string(),
    description: z.string(),
    logsource: z.object({ category: z.string() }),
    detection: z.object({
      selection: z.unknown(),
      condition: z.string(),
    }),
    false_positives: z.array(z.string()),
  }),
  target_format: z.string(),
  confidence: z.string(),
  promotion_readiness: z.number(),
  evidence_links: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        claim_status: z.string(),
      }),
    )
    .default([]),
  metadata: z.object({
    author: z.string(),
    created_at: z.string(),
    last_updated: z.string(),
    status: z.string(),
    notes: z.string(),
  }),
  content_hash: z.string(),
})

export const detectionStatusSchema = z
  .object({
    total: z.number(),
    by_status: z.record(z.number()),
    by_confidence: z.record(z.number()),
  })
  .passthrough()

// =============================================================================
// TYPES
// =============================================================================

export type DetectionCandidate = z.infer<typeof detectionCandidateSchema>
export type DetectionStatusResult = z.infer<typeof detectionStatusSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * List all detection candidates. Returns Zod-validated items.
 * Filters out items that fail validation (partial data resilience).
 * Returns empty array on subprocess failure.
 */
export async function listDetections(
  opts?: ThruntCommandOptions,
): Promise<DetectionCandidate[]> {
  const result = await runThruntCommand<DetectionCandidate[]>(
    ["detection", "list", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return []

  return result.data
    .map((item) => detectionCandidateSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data)
}

/**
 * Get aggregate detection status (totals by status and confidence).
 * Returns null on subprocess failure or parse error.
 */
export async function detectionStatus(
  opts?: ThruntCommandOptions,
): Promise<DetectionStatusResult | null> {
  const result = await runThruntCommand<DetectionStatusResult>(
    ["detection", "status", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return null

  try {
    return detectionStatusSchema.parse(result.data)
  } catch {
    return null
  }
}
