// thrunt-bridge/types.ts - Core types for TUI <-> thrunt-tools.cjs subprocess communication

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
