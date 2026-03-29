// thrunt-bridge/index.ts - Public barrel re-export

export { runThruntCommand } from "./executor"
export { spawnThruntStream } from "./stream"
export { resolveThruntToolsPath } from "./resolver"
export { loadThruntState } from "./state-adapter"
export { ThruntPlanningWatcher } from "./watcher"
export type {
  ThruntCommandResult,
  ThruntCommandOptions,
  ThruntStreamHandle,
  ThruntHuntContext,
} from "./types"

// Domain bridge modules
export { auditEvidence, type EvidenceAuditResult } from "./evidence"
export { listDetections, detectionStatus, type DetectionCandidate } from "./detection"
export { listPacks, showPack, type PackListEntry, type PackShowResult } from "./pack"
export { listConnectors, runtimeDoctor, type ConnectorEntry, type RuntimeDoctorResult } from "./connector"
export { analyzeHuntmap, getPhaseDetail, type HuntmapAnalysis, type HuntmapPhaseDetail } from "./huntmap"
