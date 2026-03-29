import { afterEach, describe, expect, test } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

const THRUNT_TOOLS_ENV = "THRUNT_TOOLS_PATH"

async function writeExecutableScript(
  dir: string,
  name: string,
  contents: string,
): Promise<string> {
  const scriptPath = path.join(dir, name)
  await fs.writeFile(scriptPath, contents, { mode: 0o755 })
  await fs.chmod(scriptPath, 0o755)
  return scriptPath
}

afterEach(() => {
  delete process.env[THRUNT_TOOLS_ENV]
})

describe("spawnThruntStream", () => {
  test("calls onLine for each NDJSON line parsed from subprocess stdout", async () => {
    const { spawnThruntStream } = await import("../stream")
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thrunt-stream-"))
    const scriptPath = await writeExecutableScript(
      tempDir,
      "thrunt-tools.cjs",
      `#!/usr/bin/env node
const fs = require('fs');
fs.writeSync(1, JSON.stringify({ event: "start", id: 1 }) + "\\n");
fs.writeSync(1, JSON.stringify({ event: "progress", id: 2 }) + "\\n");
fs.writeSync(1, JSON.stringify({ event: "done", id: 3 }) + "\\n");
`,
    )

    process.env[THRUNT_TOOLS_ENV] = scriptPath

    const lines: unknown[] = []
    const errors: string[] = []

    await new Promise<void>((resolve) => {
      const handle = spawnThruntStream(
        ["stream-test"],
        (data) => {
          lines.push(data)
          if (lines.length === 3) resolve()
        },
        (error) => {
          errors.push(error)
          resolve()
        },
      )
      // Safety timeout
      setTimeout(() => resolve(), 5000)
    })

    expect(lines).toHaveLength(3)
    expect(lines[0]).toEqual({ event: "start", id: 1 })
    expect(lines[1]).toEqual({ event: "progress", id: 2 })
    expect(lines[2]).toEqual({ event: "done", id: 3 })
    expect(errors).toHaveLength(0)

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 10000)

  test("handles buffered partial lines (data arrives in chunks)", async () => {
    const { spawnThruntStream } = await import("../stream")
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thrunt-stream-"))
    // Script writes a JSON line split across two writes with a delay
    const scriptPath = await writeExecutableScript(
      tempDir,
      "thrunt-tools.cjs",
      `#!/usr/bin/env node
// Write partial line, then complete it after a delay
process.stdout.write('{"partial":');
setTimeout(() => {
  process.stdout.write('"complete"}\\n');
  setTimeout(() => process.exit(0), 50);
}, 100);
`,
    )

    process.env[THRUNT_TOOLS_ENV] = scriptPath

    const lines: unknown[] = []

    await new Promise<void>((resolve) => {
      spawnThruntStream(
        ["partial-test"],
        (data) => {
          lines.push(data)
          resolve()
        },
        () => resolve(),
      )
      setTimeout(() => resolve(), 5000)
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({ partial: "complete" })

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 10000)

  test("calls onError when subprocess exits non-zero", async () => {
    const { spawnThruntStream } = await import("../stream")
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thrunt-stream-"))
    const scriptPath = await writeExecutableScript(
      tempDir,
      "thrunt-tools.cjs",
      `#!/usr/bin/env node
const fs = require('fs');
fs.writeSync(2, 'Stream failed: connection error\\n');
process.exit(1);
`,
    )

    process.env[THRUNT_TOOLS_ENV] = scriptPath

    const errors: string[] = []

    await new Promise<void>((resolve) => {
      spawnThruntStream(
        ["error-test"],
        () => {},
        (error) => {
          errors.push(error)
          resolve()
        },
      )
      setTimeout(() => resolve(), 5000)
    })

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain("connection error")

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 10000)

  test("kill() terminates the subprocess", async () => {
    const { spawnThruntStream } = await import("../stream")
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thrunt-stream-"))
    // Script that runs indefinitely, writing lines every 100ms
    const scriptPath = await writeExecutableScript(
      tempDir,
      "thrunt-tools.cjs",
      `#!/usr/bin/env node
const fs = require('fs');
let i = 0;
const interval = setInterval(() => {
  fs.writeSync(1, JSON.stringify({ tick: i++ }) + "\\n");
}, 100);
// Keep running for 30 seconds (way longer than test timeout)
setTimeout(() => { clearInterval(interval); }, 30000);
`,
    )

    process.env[THRUNT_TOOLS_ENV] = scriptPath

    const lines: unknown[] = []
    let handle: { kill(): void }

    await new Promise<void>((resolve) => {
      handle = spawnThruntStream(
        ["forever-test"],
        (data) => {
          lines.push(data)
          // Kill after first line
          if (lines.length === 1) {
            handle.kill()
            // Give it a moment to clean up
            setTimeout(() => resolve(), 200)
          }
        },
        () => resolve(),
      )
      setTimeout(() => resolve(), 5000)
    })

    // Should have received at least 1 line before kill, but not all 300
    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines.length).toBeLessThan(20)

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 10000)

  test("skips non-JSON lines without crashing", async () => {
    const { spawnThruntStream } = await import("../stream")
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thrunt-stream-"))
    const scriptPath = await writeExecutableScript(
      tempDir,
      "thrunt-tools.cjs",
      `#!/usr/bin/env node
const fs = require('fs');
fs.writeSync(1, 'this is not json\\n');
fs.writeSync(1, 'also not json\\n');
fs.writeSync(1, JSON.stringify({ valid: true }) + "\\n");
`,
    )

    process.env[THRUNT_TOOLS_ENV] = scriptPath

    const lines: unknown[] = []
    const errors: string[] = []

    await new Promise<void>((resolve) => {
      spawnThruntStream(
        ["mixed-test"],
        (data) => {
          lines.push(data)
          resolve()
        },
        (error) => {
          errors.push(error)
        },
      )
      setTimeout(() => resolve(), 5000)
    })

    // Only the valid JSON line should be received
    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({ valid: true })

    await fs.rm(tempDir, { recursive: true, force: true })
  }, 10000)
})
