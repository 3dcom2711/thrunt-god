// thrunt-bridge/runtime.ts - Runtime query execution domain bridge

import { spawnThruntStream } from "./stream"
import type { ThruntCommandOptions, ThruntStreamHandle } from "./types"
import { z } from "zod"

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const queryExecutionResultSchema = z.object({
  connector: z.string(),
  profile: z.string(),
  result: z.object({
    status: z.string(),
    counts: z
      .object({
        total: z.number(),
        returned: z.number(),
      })
      .optional(),
    timing: z
      .object({
        started_at: z.string(),
        completed_at: z.string(),
        duration_ms: z.number(),
      })
      .optional(),
  }),
  artifacts: z
    .object({
      query_log: z.string().optional(),
      receipt: z.string().optional(),
      manifest: z
        .object({
          id: z.string(),
          path: z.string(),
        })
        .optional(),
    })
    .optional(),
})

// =============================================================================
// TYPES
// =============================================================================

export type QueryExecutionResult = z.infer<typeof queryExecutionResultSchema>

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * Execute a query via the THRUNT runtime using streaming subprocess output.
 *
 * Spawns `thrunt-tools.cjs runtime execute --connector <id> --query <text> --raw`
 * and streams NDJSON lines to the onLine callback.
 *
 * Returns a ThruntStreamHandle with a kill() method to terminate the subprocess.
 */
export function executeQueryStream(
  connector: string,
  query: string,
  onLine: (data: unknown) => void,
  onError: (error: string) => void,
  opts?: ThruntCommandOptions & { profile?: string },
): ThruntStreamHandle {
  const args = [
    "runtime",
    "execute",
    "--connector",
    connector,
    "--query",
    query,
    "--raw",
  ]

  if (opts?.profile) {
    args.push("--profile", opts.profile)
  }

  return spawnThruntStream(args, onLine, onError, opts)
}
