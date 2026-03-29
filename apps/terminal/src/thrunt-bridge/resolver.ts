// thrunt-bridge/resolver.ts - Path resolution for thrunt-tools.cjs

import * as fs from "node:fs"
import * as path from "node:path"

export const THRUNT_TOOLS_ENV = "THRUNT_TOOLS_PATH"

/**
 * Resolve the path to thrunt-tools.cjs.
 *
 * Checks THRUNT_TOOLS_PATH env var first, then walks up from cwd
 * looking for thrunt-god/bin/thrunt-tools.cjs at each directory level.
 *
 * @throws Error if thrunt-tools.cjs cannot be found
 */
export function resolveThruntToolsPath(cwd?: string): string {
  const override = process.env[THRUNT_TOOLS_ENV]?.trim()
  if (override) return override

  let current = path.resolve(cwd ?? process.cwd())
  while (true) {
    const candidate = path.join(current, "thrunt-god", "bin", "thrunt-tools.cjs")
    if (fs.existsSync(candidate)) return candidate

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  throw new Error(
    "thrunt-tools.cjs not found. Set THRUNT_TOOLS_PATH or run from project root.",
  )
}
