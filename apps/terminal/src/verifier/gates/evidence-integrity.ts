/**
 * Evidence Integrity Gate - Verify manifest SHA-256 hashes match disk artifacts
 *
 * Calls auditEvidence() to inspect manifests and checks integrity validity.
 * Non-critical by default (warns, doesn't block). Fail-open on errors.
 */

import type { Gate } from "../index"
import type { GateResult, WorkcellInfo, Diagnostic } from "../../types"
import { auditEvidence } from "../../thrunt-bridge/evidence"

/**
 * Evidence integrity gate implementation
 */
export const EvidenceIntegrityGate: Gate = {
  info: {
    id: "evidence-integrity",
    name: "Evidence Integrity",
    description: "Verify manifest SHA-256 hashes match disk artifacts",
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

      // Filter for manifests with integrity issues
      for (const r of results) {
        if (r.type === "manifest" && r.integrity && !r.integrity.valid) {
          // Check manifest hash validity
          if (!r.integrity.manifest_hash_valid) {
            diagnostics.push({
              severity: "warning",
              message: `Manifest hash invalid: ${r.file} (${r.phase})`,
              file: r.file_path,
              source: "evidence-integrity",
            })
          }

          // Report individual artifact errors
          for (const err of r.integrity.artifact_errors) {
            diagnostics.push({
              severity: "warning",
              message: `Artifact error: ${err}`,
              file: r.file_path,
              source: "evidence-integrity",
            })
          }
        }
      }

      return {
        gate: "evidence-integrity",
        passed: diagnostics.length === 0,
        critical: false,
        output:
          diagnostics.length === 0
            ? `Checked ${results.filter((r) => r.type === "manifest").length} manifests - all valid`
            : `${diagnostics.length} integrity issue(s) found`,
        diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
        timing: { startedAt: startTime, completedAt: Date.now() },
      }
    } catch (err) {
      // Fail-open: return passed on error
      return {
        gate: "evidence-integrity",
        passed: true,
        critical: false,
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timing: { startedAt: startTime, completedAt: Date.now() },
      }
    }
  },
}
