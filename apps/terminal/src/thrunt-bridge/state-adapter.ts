// thrunt-bridge/state-adapter.ts - Translates .planning/ subprocess output into typed ThruntHuntContext

import { runThruntCommand } from "./executor"
import type { ThruntCommandOptions, ThruntHuntContext } from "./types"
import {
  stateSnapshotSchema,
  progressJsonSchema,
  type StateSnapshot,
  type ProgressJson,
} from "./types"

/**
 * Default ThruntHuntContext with null/empty values and an optional error.
 */
function createDefaultContext(error: string | null): ThruntHuntContext {
  return {
    phase: { number: null, name: null, totalPhases: null },
    plan: { current: null, total: null },
    status: null,
    progressPercent: null,
    lastActivity: null,
    blockers: [],
    decisions: [],
    roadmap: null,
    config: null,
    error,
    lastRefreshedAt: new Date(),
  }
}

/**
 * Load the current thrunt state by calling state-snapshot and progress json
 * subprocesses in parallel, parsing results through Zod schemas, and returning
 * a fully-typed ThruntHuntContext.
 *
 * Error cases return a context with `error` field set and safe defaults.
 */
export async function loadThruntState(
  opts?: ThruntCommandOptions,
): Promise<ThruntHuntContext> {
  const [stateSettled, progressSettled] = await Promise.allSettled([
    runThruntCommand<StateSnapshot>(["state-snapshot"], opts),
    runThruntCommand<ProgressJson>(["progress", "json"], opts),
  ])

  // Extract results from allSettled
  const stateResult =
    stateSettled.status === "fulfilled" ? stateSettled.value : null
  const progressResult =
    progressSettled.status === "fulfilled" ? progressSettled.value : null

  // If state-snapshot failed entirely (promise rejected or command errored)
  if (!stateResult || !stateResult.ok) {
    const errorMsg =
      stateResult?.error ?? "state-snapshot failed"
    return createDefaultContext(errorMsg)
  }

  // Parse state-snapshot data through Zod schema
  const stateParse = stateSnapshotSchema.safeParse(stateResult.data)
  if (!stateParse.success) {
    return createDefaultContext(
      `state-snapshot parse error: ${stateParse.error.message}`,
    )
  }

  const snapshot = stateParse.data

  // Map state-snapshot fields to ThruntHuntContext
  const ctx: ThruntHuntContext = {
    phase: {
      number: snapshot.current_phase,
      name: snapshot.current_phase_name,
      totalPhases: snapshot.total_phases,
    },
    plan: {
      current: snapshot.current_plan,
      total: snapshot.total_plans_in_phase,
    },
    status: snapshot.status,
    progressPercent: snapshot.progress_percent,
    lastActivity: snapshot.last_activity,
    blockers: snapshot.blockers,
    decisions: snapshot.decisions,
    roadmap: null,
    config: null,
    error: null,
    lastRefreshedAt: new Date(),
  }

  // Map progress json if available (non-critical — roadmap stays null on failure)
  if (progressResult?.ok && progressResult.data) {
    const progressParse = progressJsonSchema.safeParse(progressResult.data)
    if (progressParse.success) {
      const progress = progressParse.data
      ctx.roadmap = {
        milestoneVersion: progress.milestone_version ?? null,
        phases: progress.phases,
        totalPlans: progress.total_plans,
        totalSummaries: progress.total_summaries,
        percent: progress.percent,
      }
    }
  }

  return ctx
}
