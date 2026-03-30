// thrunt-bridge/types.ts - Core types for TUI <-> thrunt-tools.cjs subprocess communication

import { z } from "zod"

export interface ThruntCommandResult<T> {
  ok: boolean
  data?: T
  error?: string
  exitCode: number
}

export interface ThruntCommandOptions {
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

export interface ThruntStreamHandle {
  kill(): void
}

// =============================================================================
// THRUNT HUNT CONTEXT — live state from .planning/ files
// =============================================================================

export interface ThruntHuntContext {
  phase: { number: string | null; name: string | null; totalPhases: number | null }
  plan: { current: number | null; total: number | null }
  status: string | null
  progressPercent: number | null
  lastActivity: string | null
  blockers: string[]
  decisions: Array<{ phase: string; summary: string; rationale: string }>
  roadmap: {
    milestoneVersion: string | null
    phases: Array<{ number: string; name: string; plans: number; summaries: number; status: string }>
    totalPlans: number
    totalSummaries: number
    percent: number
  } | null
  config: Record<string, unknown> | null
  error: string | null
  lastRefreshedAt: Date
}

// =============================================================================
// ZOD SCHEMAS — runtime validation for subprocess output
// =============================================================================

export const stateSnapshotSchema = z.object({
  current_phase: z.string().nullable(),
  current_phase_name: z.string().nullable(),
  total_phases: z.number().nullable(),
  current_plan: z.number().nullable(),
  total_plans_in_phase: z.number().nullable(),
  status: z.string().nullable(),
  progress_percent: z.number().nullable(),
  last_activity: z.string().nullable(),
  last_activity_desc: z.string().nullable().optional(),
  decisions: z.array(z.object({
    phase: z.string().default(""),
    summary: z.string().default(""),
    rationale: z.string().default(""),
  })).default([]),
  blockers: z.array(z.string()).default([]),
  paused_at: z.string().nullable().optional(),
  session: z.object({
    last_date: z.string().nullable().optional(),
    stopped_at: z.string().nullable().optional(),
    resume_file: z.string().nullable().optional(),
  }).optional(),
})

export const progressJsonSchema = z.object({
  milestone_version: z.string().nullable().optional(),
  milestone_name: z.string().nullable().optional(),
  phases: z.array(z.object({
    number: z.string(),
    name: z.string(),
    plans: z.number(),
    summaries: z.number(),
    status: z.string(),
  })).default([]),
  total_plans: z.number().default(0),
  total_summaries: z.number().default(0),
  percent: z.number().default(0),
})

export type StateSnapshot = z.infer<typeof stateSnapshotSchema>
export type ProgressJson = z.infer<typeof progressJsonSchema>
