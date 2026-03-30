// thrunt-bridge/pack.ts - Pack registry domain bridge

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const packListEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  stability: z.string(),
  source: z.string(),
  required_connectors: z.array(z.string()),
  supported_datasets: z.array(z.string()),
})

export const packShowResultSchema = z.object({
  found: z.boolean(),
  pack_id: z.string(),
  pack: z
    .object({
      id: z.string(),
      kind: z.string(),
      title: z.string(),
      description: z.string(),
      stability: z.string(),
      parameters: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean(),
          description: z.string(),
          default: z.unknown().optional(),
        }),
      ),
      targets: z.array(
        z.object({
          connector: z.string(),
          dataset: z.string(),
          query_template: z.string(),
        }),
      ),
      attack: z.array(z.string()),
      metadata: z.record(z.unknown()),
    })
    .optional(),
})

// =============================================================================
// TYPES
// =============================================================================

export type PackListEntry = z.infer<typeof packListEntrySchema>
export type PackShowResult = z.infer<typeof packShowResultSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * List all available hunt packs. Extracts packs array from result envelope.
 * Returns Zod-validated items. Returns empty array on subprocess failure.
 */
export async function listPacks(
  opts?: ThruntCommandOptions,
): Promise<PackListEntry[]> {
  const result = await runThruntCommand<{ packs: PackListEntry[] }>(
    ["pack", "list", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return []

  const packs = result.data.packs
  if (!Array.isArray(packs)) return []

  return packs
    .map((item) => packListEntrySchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data)
}

/**
 * Show detailed pack info by ID. Returns null on subprocess failure or parse error.
 */
export async function showPack(
  packId: string,
  opts?: ThruntCommandOptions,
): Promise<PackShowResult | null> {
  const result = await runThruntCommand<PackShowResult>(
    ["pack", "show", packId, "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return null

  try {
    return packShowResultSchema.parse(result.data)
  } catch {
    return null
  }
}
