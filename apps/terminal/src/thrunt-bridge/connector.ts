// thrunt-bridge/connector.ts - Connector and runtime health domain bridge

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const connectorEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  auth_types: z.array(z.string()),
  supported_datasets: z.array(z.string()),
  supported_languages: z.array(z.string()),
  pagination_modes: z.array(z.string()),
})

export const runtimeDoctorResultSchema = z.object({
  summary: z.object({
    total: z.number(),
    healthy: z.number(),
    degraded: z.number(),
    unavailable: z.number(),
  }),
  connectors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      configured: z.boolean(),
      health: z.enum(["healthy", "degraded", "unavailable"]),
      score: z.number(),
      checks: z.array(
        z.object({
          name: z.string(),
          passed: z.boolean(),
          message: z.string(),
        }),
      ),
    }),
  ),
})

// =============================================================================
// TYPES
// =============================================================================

export type ConnectorEntry = z.infer<typeof connectorEntrySchema>
export type RuntimeDoctorResult = z.infer<typeof runtimeDoctorResultSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * List available connectors. Extracts connectors array from result envelope.
 * Returns Zod-validated items. Returns empty array on subprocess failure.
 */
export async function listConnectors(
  opts?: ThruntCommandOptions,
): Promise<ConnectorEntry[]> {
  const result = await runThruntCommand<{ connectors: ConnectorEntry[] }>(
    ["runtime", "list-connectors", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return []

  const connectors = result.data.connectors
  if (!Array.isArray(connectors)) return []

  return connectors
    .map((item) => connectorEntrySchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => r.data)
}

/**
 * Run runtime health check (doctor). Returns null on subprocess failure or parse error.
 */
export async function runtimeDoctor(
  opts?: ThruntCommandOptions,
): Promise<RuntimeDoctorResult | null> {
  const result = await runThruntCommand<RuntimeDoctorResult>(
    ["runtime", "doctor", "--raw"],
    opts,
  )

  if (!result.ok || !result.data) return null

  try {
    return runtimeDoctorResultSchema.parse(result.data)
  } catch {
    return null
  }
}
