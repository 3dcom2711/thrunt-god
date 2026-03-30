/**
 * Receipt Completeness Gate - Verify query-to-receipt-to-evidence chain completeness
 *
 * Calls auditEvidence() to inspect manifests and checks that all items
 * have proper receipt linkage. Non-critical by default (warns, doesn't block).
 * Fail-open on errors.
 */

import type { Gate } from "../index"
import type { GateResult, WorkcellInfo, Diagnostic } from "../../types"
import { auditEvidence } from "../../thrunt-bridge/evidence"

/**
 * Receipt completeness gate implementation
 */
export const ReceiptCompletenessGate: Gate = {
  info: {
    id: "receipt-completeness",
    name: "Receipt Completeness",
    description: "Verify query-to-receipt-to-evidence chain completeness",
    critical: false,
  },

  async isAvailable(_workcell: WorkcellInfo): Promise<boolean> {
    // Filesystem-only check, always available
    return true
  },

  async run(_workcell: WorkcellInfo, _signal: AbortSignal): Promise<GateResult> {
    const startTime = Date.now()
    const diagnostics: Diagnostic[] = []

    try {
      const results = await auditEvidence()

      // Filter for manifests and check receipt chain completeness
      for (const r of results) {
        if (r.type !== "manifest") continue

        // Check each manifest item for receipt linkage gaps
        for (const item of r.items) {
          if (
            item.status &&
            (item.status.includes("missing") || item.status.includes("gap"))
          ) {
            diagnostics.push({
              severity: "warning",
              message: `Receipt chain gap: ${item.id ?? item.text ?? "unknown item"} (status: ${item.status})`,
              file: r.file_path,
              source: "receipt-completeness",
            })
          }
        }

        // Also check if artifacts are invalid (broken chain)
        if (r.integrity && !r.integrity.artifacts_valid) {
          diagnostics.push({
            severity: "warning",
            message: `Artifacts invalid in manifest: ${r.file} (${r.phase})`,
            file: r.file_path,
            source: "receipt-completeness",
          })
        }
      }

      return {
        gate: "receipt-completeness",
        passed: diagnostics.length === 0,
        critical: false,
        output:
          diagnostics.length === 0
            ? `Checked ${results.filter((r) => r.type === "manifest").length} manifests - chain complete`
            : `${diagnostics.length} completeness issue(s) found`,
        diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
        timing: { startedAt: startTime, completedAt: Date.now() },
      }
    } catch (err) {
      // Fail-open: return passed on error
      return {
        gate: "receipt-completeness",
        passed: true,
        critical: false,
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timing: { startedAt: startTime, completedAt: Date.now() },
      }
    }
  },
}
