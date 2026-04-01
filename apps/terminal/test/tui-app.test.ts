import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { TUIApp } from "../src/tui/app"

let tempDir: string | null = null
let originalCwd = process.cwd()

afterEach(async () => {
  process.chdir(originalCwd)
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
  }
})

async function writeFakeThruntTools(root: string): Promise<void> {
  const toolsPath = join(root, "thrunt-god", "bin", "thrunt-tools.cjs")
  await mkdir(join(root, "thrunt-god", "bin"), { recursive: true })
  await Bun.write(
    toolsPath,
    `#!/usr/bin/env node
const args = process.argv.slice(2)
if (args[0] === "runtime" && args[1] === "list-connectors") {
  console.log(JSON.stringify({ connectors: [{ id: "elastic", name: "Elastic", auth_types: ["api_key"], supported_datasets: ["events"], supported_languages: ["esql"], pagination_modes: ["cursor"] }] }))
  process.exit(0)
}
if (args[0] === "pack" && args[1] === "list") {
  console.log(JSON.stringify({ packs: [{ id: "pack.oauth", kind: "domain", title: "OAuth Hunt", stability: "stable", source: "builtin", required_connectors: ["elastic"], supported_datasets: ["events"] }] }))
  process.exit(0)
}
if (args[0] === "huntmap" && args[1] === "analyze") {
  console.log(JSON.stringify({
    milestones: [],
    phases: [{ number: "1", name: "Environment Mapping", goal: "Map telemetry", depends_on: null, plan_count: 1, summary_count: 0, has_context: false, has_research: false, disk_status: "planned", roadmap_complete: false }],
    phase_count: 1,
    completed_phases: 0,
    total_plans: 1,
    total_summaries: 0,
    progress_percent: 0,
    current_phase: "1",
    next_phase: "2",
    missing_phase_details: null
  }))
  process.exit(0)
}
console.error("unexpected args", args.join(" "))
process.exit(1)
`,
  )
}

describe("TUIApp", () => {
  test("refreshHomeData resolves thrunt-tools from the app cwd", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "thrunt-god-tui-app-"))
    await writeFakeThruntTools(tempDir)

    const otherDir = await mkdtemp(join(tmpdir(), "thrunt-god-tui-other-"))
    const app = new TUIApp(tempDir) as any

    process.chdir(otherDir)
    await app.refreshHomeData(true)

    expect(app.state.thruntConnectors.connectors).toHaveLength(1)
    expect(app.state.thruntConnectors.connectors[0]?.id).toBe("elastic")
    expect(app.state.thruntPacks.packs[0]?.id).toBe("pack.oauth")
    expect(app.state.thruntPhases.analysis?.phases[0]?.name).toBe("Environment Mapping")

    await rm(otherDir, { recursive: true, force: true })
  })

  test("render does not recompute home search results on every frame", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "thrunt-god-tui-app-"))
    await writeFakeThruntTools(tempDir)

    const app = new TUIApp(tempDir) as any
    let recomputeCount = 0
    app.recomputeHomeSearchResults = () => {
      recomputeCount += 1
    }

    const originalWrite = process.stdout.write
    process.stdout.write = (() => true) as typeof process.stdout.write
    try {
      app.render()
    } finally {
      process.stdout.write = originalWrite
    }

    expect(recomputeCount).toBe(0)
  })
})
