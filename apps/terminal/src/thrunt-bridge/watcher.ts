// thrunt-bridge/watcher.ts - File watcher for .planning/ with debounce and poll fallback

import * as fs from "node:fs"
import { loadThruntState } from "./state-adapter"
import type { ThruntHuntContext, ThruntCommandOptions } from "./types"

/**
 * Watches the .planning/ directory for changes and calls onUpdate with a
 * fresh ThruntHuntContext whenever relevant files are modified.
 *
 * Uses fs.watch (recursive) as the primary mechanism with a 200ms debounce
 * to batch rapid multi-file writes. A 5-second periodic poll serves as
 * fallback for macOS fs.watch edge cases where events can be missed.
 */
export class ThruntPlanningWatcher {
  private watcher: fs.FSWatcher | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private lastSnapshotHash: string = ""
  private stopped: boolean = false

  constructor(
    private planningDir: string,
    private onUpdate: (ctx: ThruntHuntContext) => void,
    private opts?: ThruntCommandOptions,
    private debounceMs: number = 200,
    private pollMs: number = 5000,
  ) {}

  start(): void {
    this.stopped = false

    // Primary: fs.watch on .planning/ directory with recursive
    try {
      this.watcher = fs.watch(
        this.planningDir,
        { recursive: true },
        (_eventType, filename) => {
          if (this.shouldRefresh(filename ?? "")) {
            this.scheduleRefresh()
          }
        },
      )
    } catch {
      // fs.watch may fail on some systems; poll will handle it
    }

    // Fallback: periodic poll every pollMs
    this.pollTimer = setInterval(() => void this.refresh(), this.pollMs)

    // Initial snapshot
    void this.refresh()
  }

  stop(): void {
    this.stopped = true
    this.watcher?.close()
    this.watcher = null
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  forceRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    void this.refresh()
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(
      () => void this.refresh(),
      this.debounceMs,
    )
  }

  private shouldRefresh(filename: string): boolean {
    // Filter to the 5 specified paths per CONTEXT.md decisions:
    // STATE.md, ROADMAP.md, REQUIREMENTS.md, config.json, phases/
    const watchPaths = [
      "STATE.md",
      "ROADMAP.md",
      "REQUIREMENTS.md",
      "config.json",
      "phases",
    ]
    if (!filename) return true // Unknown filename, refresh to be safe
    return watchPaths.some(
      (p) => filename.startsWith(p) || filename.includes(p),
    )
  }

  private async refresh(): Promise<void> {
    if (this.stopped) return
    try {
      const ctx = await loadThruntState(this.opts)
      // Simple content-hash check: stringify key fields, compare to last
      const hash = JSON.stringify({
        p: ctx.phase,
        pl: ctx.plan,
        s: ctx.status,
        pp: ctx.progressPercent,
        b: ctx.blockers,
      })
      // Always call onUpdate on first load or if content changed
      if (hash !== this.lastSnapshotHash) {
        this.lastSnapshotHash = hash
        if (!this.stopped) this.onUpdate(ctx)
      }
    } catch {
      // Best-effort: don't crash on refresh failure
    }
  }
}
