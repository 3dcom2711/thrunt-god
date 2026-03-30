/**
 * thrunt-god - Agentic Threat Hunting Operator Console
 *
 * An orchestration engine that dispatches coding tasks to native AI CLIs
 * (Codex, Claude Code, OpenCode) while preserving subscription authentication.
 *
 * Features:
 * - Intelligent task routing based on risk, size, and task characteristics
 * - Speculate+Vote: parallel multi-agent execution for high-stakes tasks
 * - Quality gates with fail-fast semantics
 * - Git worktree isolation for safe concurrent execution
 *
 * @module thrunt-god
 */

// Core types
export * from "./types"

// Namespace modules
export { Router, type RouterConfig, type RoutingRule } from "./router"
export {
  Dispatcher,
  type ExecutionRequest,
  type Adapter,
  type AdapterResult,
} from "./dispatcher"
export {
  Workcell,
  PoolConfig,
  type PoolStatus,
  type GCResult,
} from "./workcell"
export { Verifier, type Gate, type GateConfig, type VerifyOptions } from "./verifier"
export {
  PatchLifecycle,
  type CaptureOptions,
  type MergeOptions,
  type MergeResult,
} from "./patch"
export { Telemetry, type TelemetryConfig, type AnalyticsEvent } from "./telemetry"
export { TUI } from "./tui"
export { Health, type HealthStatus, type HealthSummary, type HealthCheckOptions } from "./health"
export { MCP } from "./mcp"
export { Config, type ProjectConfig, type DetectionResult } from "./config"

// Tools
export {
  tools,
  getTool,
  registerTools,
  executeTool,
  dispatchTool,
  gateTool,
  type ToolDefinition,
  type ToolContext,
  type DispatchParams,
  type DispatchResult,
  type GateParams,
  type GateToolResult,
} from "./tools"

/**
 * thrunt-god version
 */
export const VERSION = "0.1.0"

/**
 * thrunt-god initialization options
 */
export interface InitOptions {
  telemetryDir?: string
  telemetryEnabled?: boolean
  poolConfig?: Partial<import("./workcell").PoolConfig>
}

// Module state
let initialized = false

/**
 * Initialize thrunt-god with configuration
 */
export async function init(options: InitOptions = {}): Promise<void> {
  if (initialized) {
    return
  }

  const {
    telemetryDir = ".thrunt-god/runs",
    telemetryEnabled = true,
  } = options

  // Initialize Telemetry
  const { Telemetry } = await import("./telemetry")
  Telemetry.init({
    outputDir: telemetryDir,
    enabled: telemetryEnabled,
  })

  initialized = true
}

/**
 * Shutdown thrunt-god cleanly
 */
export async function shutdown(): Promise<void> {
  if (!initialized) {
    return
  }

  // Stop MCP server
  const { MCP } = await import("./mcp")
  await MCP.stop()

  // Reset Telemetry
  const { Telemetry } = await import("./telemetry")
  Telemetry.reset()

  // Destroy all workcells
  const { Workcell } = await import("./workcell")
  await Workcell.destroyAll()

  // Clear health cache
  const { Health } = await import("./health")
  Health.clearCache()

  initialized = false
}

/**
 * Check if thrunt-god is initialized
 */
export function isInitialized(): boolean {
  return initialized
}
