/**
 * Gate registry - THRUNT verification gate exports
 */

export { EvidenceIntegrityGate } from "./evidence-integrity"
export { ReceiptCompletenessGate } from "./receipt-completeness"

import { EvidenceIntegrityGate } from "./evidence-integrity"
import { ReceiptCompletenessGate } from "./receipt-completeness"
import type { Gate } from "../index"

/**
 * Built-in gates registry (THRUNT gates only)
 */
export const gates: Record<string, Gate> = {
  "evidence-integrity": EvidenceIntegrityGate,
  "receipt-completeness": ReceiptCompletenessGate,
}

/**
 * Get gate by ID
 */
export function getGate(id: string): Gate | undefined {
  return gates[id]
}

/**
 * Get all gates
 */
export function getAllGates(): Gate[] {
  return Object.values(gates)
}

/**
 * Register a custom gate
 */
export function registerGate(gate: Gate): void {
  gates[gate.info.id] = gate
}
