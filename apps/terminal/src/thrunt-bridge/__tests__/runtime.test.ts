/**
 * Runtime bridge module tests
 *
 * Tests for executeQueryStream and queryExecutionResultSchema.
 */

import { describe, expect, test, mock, beforeEach } from "bun:test"
import { z } from "zod"

// Mock spawnThruntStream before importing runtime module
const mockSpawnThruntStream = mock(() => ({ kill: () => {} }))

mock.module("../stream", () => ({
  spawnThruntStream: mockSpawnThruntStream,
}))

const { executeQueryStream, queryExecutionResultSchema } = await import("../runtime")

describe("runtime bridge", () => {
  beforeEach(() => {
    mockSpawnThruntStream.mockClear()
  })

  describe("executeQueryStream", () => {
    test("calls spawnThruntStream with runtime execute args", () => {
      const onLine = () => {}
      const onError = () => {}

      executeQueryStream("splunk", "index=main | head 10", onLine, onError)

      expect(mockSpawnThruntStream).toHaveBeenCalledTimes(1)
      const args = mockSpawnThruntStream.mock.calls[0]
      expect(args[0]).toEqual([
        "runtime",
        "execute",
        "--connector",
        "splunk",
        "--query",
        "index=main | head 10",
        "--raw",
      ])
      expect(args[1]).toBe(onLine)
      expect(args[2]).toBe(onError)
    })

    test("passes --profile flag when profile option provided", () => {
      const onLine = () => {}
      const onError = () => {}

      executeQueryStream("elastic", "search *", onLine, onError, {
        profile: "prod",
      })

      expect(mockSpawnThruntStream).toHaveBeenCalledTimes(1)
      const args = mockSpawnThruntStream.mock.calls[0]
      expect(args[0]).toContain("--profile")
      expect(args[0]).toContain("prod")
    })

    test("returns a ThruntStreamHandle with kill()", () => {
      const mockKill = mock(() => {})
      mockSpawnThruntStream.mockReturnValueOnce({ kill: mockKill })

      const handle = executeQueryStream("splunk", "q", () => {}, () => {})

      expect(handle).toBeDefined()
      expect(typeof handle.kill).toBe("function")
      handle.kill()
      expect(mockKill).toHaveBeenCalledTimes(1)
    })
  })

  describe("queryExecutionResultSchema", () => {
    test("validates a well-formed result object", () => {
      const validResult = {
        connector: "splunk",
        profile: "default",
        result: {
          status: "completed",
          counts: { total: 100, returned: 50 },
          timing: {
            started_at: "2026-03-29T00:00:00Z",
            completed_at: "2026-03-29T00:01:00Z",
            duration_ms: 60000,
          },
        },
        artifacts: {
          query_log: "/tmp/query.log",
          receipt: "/tmp/receipt.json",
          manifest: { id: "abc123", path: "/tmp/manifest.json" },
        },
      }

      const parsed = queryExecutionResultSchema.safeParse(validResult)
      expect(parsed.success).toBe(true)
    })

    test("rejects malformed input (missing connector field)", () => {
      const invalid = {
        profile: "default",
        result: {
          status: "completed",
        },
      }

      const parsed = queryExecutionResultSchema.safeParse(invalid)
      expect(parsed.success).toBe(false)
    })
  })
})
