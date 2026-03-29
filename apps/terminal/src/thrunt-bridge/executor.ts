// thrunt-bridge/executor.ts - Subprocess executor with @file: protocol handling

import * as fs from "node:fs"
import { resolveThruntToolsPath } from "./resolver"
import type { ThruntCommandResult, ThruntCommandOptions } from "./types"

/**
 * Run a thrunt-tools.cjs command via subprocess and return typed JSON result.
 *
 * Spawns `node thrunt-tools.cjs <args>`, collects stdout/stderr,
 * parses JSON output (including @file: large-output protocol),
 * and returns a typed result envelope.
 *
 * The @file: protocol handles payloads >50KB: thrunt-tools.cjs writes
 * JSON to a temp file and outputs `@file:/path` to stdout. This function
 * detects the prefix, reads the file, parses JSON, and deletes the temp file.
 */
export async function runThruntCommand<T>(
  args: string[],
  opts?: ThruntCommandOptions,
): Promise<ThruntCommandResult<T>> {
  try {
    const toolsPath = resolveThruntToolsPath(opts?.cwd)

    const proc = Bun.spawn(["node", toolsPath, ...args], {
      cwd: opts?.cwd,
      env: opts?.env ? { ...process.env, ...opts.env } : undefined,
      stdout: "pipe",
      stderr: "pipe",
    })

    const timer = opts?.timeout
      ? setTimeout(() => proc.kill(), opts.timeout)
      : undefined

    const [stdoutText, stderrText, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    if (timer) clearTimeout(timer)

    if (exitCode !== 0) {
      return {
        ok: false,
        error: stderrText.trim() || `Exit ${exitCode}`,
        exitCode,
      }
    }

    const trimmed = stdoutText.trim()
    if (!trimmed) {
      return { ok: true, data: undefined, exitCode: 0 }
    }

    // Handle @file: large-output protocol
    let jsonText = trimmed
    if (trimmed.startsWith("@file:")) {
      const filePath = trimmed.slice(6)
      jsonText = await Bun.file(filePath).text()
      // Best-effort cleanup of temp file
      try {
        fs.unlinkSync(filePath)
      } catch {
        /* temp cleanup best-effort */
      }
    }

    try {
      return { ok: true, data: JSON.parse(jsonText) as T, exitCode: 0 }
    } catch {
      return {
        ok: false,
        error: `JSON parse failed: ${jsonText.slice(0, 200)}`,
        exitCode: 0,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message, exitCode: -1 }
  }
}
