/**
 * Security Screen - Stub (hushd security overview removed)
 */

import { fitString } from "../components/types"
import { renderSurfaceHeader } from "../components/surface-header"
import { THEME } from "../theme"
import type { Screen, ScreenContext } from "../types"

export const securityScreen: Screen = {
  render(ctx: ScreenContext): string {
    const { width, height } = ctx
    const lines: string[] = []

    lines.push(...renderSurfaceHeader("security", "Security Overview", width, THEME, "removed"))
    lines.push("")
    lines.push(fitString(`${THEME.muted}  This screen depended on hushd, which has been removed.${THEME.reset}`, width))
    lines.push(fitString(`${THEME.dim}  Press ESC to return to the main screen.${THEME.reset}`, width))

    while (lines.length < height - 1) {
      lines.push(" ".repeat(width))
    }
    lines.push(fitString(`${THEME.dim}ESC${THEME.reset}${THEME.muted} back${THEME.reset}`, width))
    return lines.join("\n")
  },

  handleInput(key: string, ctx: ScreenContext): boolean {
    if (key === "\x1b" || key === "\x1b\x1b" || key === "q") {
      ctx.app.setScreen("main")
      return true
    }
    return false
  },
}
