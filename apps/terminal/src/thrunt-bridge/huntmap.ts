// thrunt-bridge/huntmap.ts - Huntmap analysis and phase navigation domain bridge

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const huntmapAnalysisSchema = z.object({
  milestones: z.array(
    z.object({
      heading: z.string(),
      version: z.string(),
    }),
  ),
  phases: z.array(
    z.object({
      number: z.string(),
      name: z.string(),
      goal: z.string().nullable(),
      depends_on: z.string().nullable(),
      plan_count: z.number(),
      summary_count: z.number(),
      has_context: z.boolean(),
      has_research: z.boolean(),
      disk_status: z.enum([
        "complete",
        "partial",
        "planned",
        "researched",
        "discussed",
        "empty",
        "no_directory",
      ]),
      roadmap_complete: z.boolean(),
    }),
  ),
  phase_count: z.number(),
  completed_phases: z.number(),
  total_plans: z.number(),
  total_summaries: z.number(),
  progress_percent: z.number(),
  current_phase: z.string().nullable(),
  next_phase: z.string().nullable(),
  missing_phase_details: z.array(z.string()).nullable(),
})

export const huntmapPhaseDetailSchema = z.object({
  found: z.boolean(),
  phase_number: z.string(),
  phase_name: z.string(),
  goal: z.string().nullable(),
  success_criteria: z.array(z.string()),
  section: z.string(),
})

// =============================================================================
// TYPES
// =============================================================================

export type HuntmapAnalysis = z.infer<typeof huntmapAnalysisSchema>
export type HuntmapPhaseDetail = z.infer<typeof huntmapPhaseDetailSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * Analyze the huntmap and return full phase/milestone overview.
 * Returns null on subprocess failure or parse error.
 */
export async function analyzeHuntmap(
  opts?: ThruntCommandOptions,
): Promise<HuntmapAnalysis | null> {
  const result = await runThruntCommand<HuntmapAnalysis>(
    ["huntmap", "analyze", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return null

  try {
    return huntmapAnalysisSchema.parse(result.data)
  } catch {
    return null
  }
}

/**
 * Get detailed info for a specific phase by number.
 * Returns null on subprocess failure or parse error.
 */
export async function getPhaseDetail(
  phaseNum: string,
  opts?: ThruntCommandOptions,
): Promise<HuntmapPhaseDetail | null> {
  const result = await runThruntCommand<HuntmapPhaseDetail>(
    ["huntmap", "get-phase", phaseNum, "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return null

  try {
    return huntmapPhaseDetailSchema.parse(result.data)
  } catch {
    return null
  }
}
