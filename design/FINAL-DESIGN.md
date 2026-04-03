# THRUNT God VS Code Extension -- Final Design Specification

**Version:** 1.0 (canonical)
**Date:** 2026-04-02
**Status:** Ship-ready
**Supersedes:** ARCHITECTURE.md, UX-SPEC.md, DATA-MODELS.md, VISUALIZATION-SPEC.md

All contradictions between the four original specs and three reviews have been resolved.
See `DECISIONS.md` for the full resolution log (68 entries).

---

## Part 1: Product Vision & MVP Scope

### What This Extension IS

A read-heavy visualization layer over `.hunt/` (or `.planning/`) artifacts produced by the THRUNT God CLI. The extension consumes, parses, and renders hunt artifacts. The CLI owns artifact production. The extension is the hunter's lens.

### What This Extension IS NOT

- Not a SIEM replacement. The extension does not execute queries against data sources.
- Not a CLI wrapper. v1 does not bridge CLI commands (except navigation shortcuts).
- Not a collaborative editing tool. It reads one hunter's artifacts from the local filesystem.
- Not a reporting engine. v1 does not export to PDF/HTML/PNG.

### v1 MVP Scope

The MVP proves: "A threat hunter can navigate a completed hunt, visually inspect template clustering, and catch evidence quality issues -- all without leaving VS Code."

**Ship these four features:**

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1 | **Hunt Sidebar** (TreeView with semantic structure) | The anchor. Every other feature depends on semantic navigation. Uses stable VS Code APIs. | 1 week |
| 2 | **Drain Template Viewer** (stacked bar + detail pane, single query) | The differentiator. No other tool visualizes Drain template clustering. The hunter's "aha moment." | 1 week |
| 3 | **Evidence Integrity Diagnostics** (Problems panel + quick-fixes) | The quality enforcer. Catches anti-patterns in real time. No webview, no D3, pure VS Code APIs. Highest impact per line of code. | 1 week |
| 4 | **Status Bar + CodeLens** | Glance-value layer. Hunt identity, phase progress, deviation scores inline in receipts. | 3 days |

**Also in v1 but lower priority:**
- Template comparison (two queries side by side)
- Context menu actions on sidebar nodes
- Basic empty states and error states

### v2 Roadmap (ships after v1 is stable)

| Feature | Description | Why Deferred |
|---------|-------------|--------------|
| Evidence Graph (Dagre DAG) | Hypothesis-receipt-query topology visualization | Medium complexity, NICE rating from hunter (useful for briefings, not daily use) |
| Multi-Source Timeline | Horizontal swimlane timeline with LOD rendering | Highest complexity (3-4 weeks). Hunter can read entity timelines in markdown today. |
| Template pinning | Track templates across phases via `workspaceState` | Nice-to-have; requires comparison mode first |
| Entity focus mode | Highlight entity across all views | Requires cross-panel coordination |
| Notes editing | Inline editing of `## Notes` sections in receipts | First write operation; breaks read-only constraint |
| Search across artifacts | `THRUNT: Search Hunt` command | Workaround: `Ctrl+Shift+F` global search |
| Export (PNG/SVG/JSON) | Visualization export for reports | Hunter rates this high, but requires Canvas/SVG serialization |
| CLI bridge | `THRUNT: Run Phase` executes CLI commands | Requires IPC design |
| Treemap drill-down | Click a stacked bar segment to see treemap detail | VIZ-SPEC secondary visualization |
| IOC quick-entry | `THRUNT: Add IOC` highlights across loaded queries | Hunter request for active incidents |
| Copy finding summary | Paste-ready text for Slack/Teams/Jira | Hunter request for escalation workflow |
| Detection rule generator | Generate Sigma rule stubs from receipts | Killer feature idea from hunter review |
| Threat intel overlay | One-click IP/domain/hash lookup in template viewer | Killer feature idea from hunter review |
| Entity relationship graph | Entity-to-entity graph (separate from evidence chain) | Killer feature idea from hunter review |
| Time-travel replay | Replay investigation state chronologically for briefings | Killer feature idea from hunter review |
| Collaborative hunt mode | Real-time state sync between two hunters | Killer feature idea from hunter review |

### Explicit Non-Goals (v1)

- Multi-hunt workspace support (one hunt at a time)
- Pack browser or pack parsing (beyond receipt-embedded pack match data)
- Manifest integrity verification
- Metrics, feedback, detection parsing (MAN-*, HE-*, FB-*, DET-*)
- Multi-monitor panel detachment (VS Code platform limitation)
- Live CLI terminal integration
- WebviewPanelSerializer (panel state restoration on restart)
- Virtual scrolling (premature optimization)
- Ad-hoc query execution from the extension

---

## Part 2: Architecture (Reconciled)

### Extension Structure

```
thrunt-god-vscode/
  package.json                 # Extension manifest
  tsconfig.json
  esbuild.config.mjs           # Two bundles: extension host + webview
  src/
    extension.ts               # activate() / deactivate()
    constants.ts               # Artifact patterns, command IDs
    subsystems/
      watcher.ts               # ArtifactWatcher
      parser.ts                # ArtifactParser facade
      store.ts                 # HuntDataStore
      bridge.ts                # WebviewBridge
    providers/
      hunt-tree.ts             # TreeDataProvider for sidebar
      codelens.ts              # CodeLensProvider for receipts + queries
      diagnostics.ts           # DiagnosticCollection for evidence integrity
      status-bar.ts            # StatusBarItem
    panels/
      drain-template-viewer.ts # WebviewPanel: stacked bar + detail
      panel-base.ts            # Shared webview panel lifecycle
    commands/
      index.ts                 # Command registration
      open-panel.ts            # Panel open commands
      navigate.ts              # Jump-to-artifact commands
    models/
      types.ts                 # All canonical TypeScript interfaces
      parse-result.ts          # ParseResult<T> wrapper
      parse-mission.ts         # MISSION.md parser
      parse-hypotheses.ts      # HYPOTHESES.md parser
      parse-huntmap.ts         # HUNTMAP.md parser
      parse-state.ts           # STATE.md parser
      parse-query.ts           # QRY-*.md parser
      parse-receipt.ts         # RCT-*.md parser
      parse-evidence-review.ts # EVIDENCE_REVIEW.md parser
      parse-findings.ts        # FINDINGS.md parser
  webview/
    drain-template-viewer/
      index.tsx                # Preact entry point
      TemplateBar.tsx          # Observable Plot stacked bar
      TemplateDetail.tsx       # Selected template detail pane
      TemplateComparison.tsx   # Side-by-side comparison (v1.1)
    shared/
      vscode-api.ts            # acquireVsCodeApi() singleton
      theme.ts                 # Read --vscode-* CSS variables
      message-types.ts         # Shared message type definitions
  test/
    unit/
      parsers/                 # Per-artifact parser tests
      store.test.ts            # State derivation tests
    fixtures/                  # Example artifacts from thrunt-god/examples/
```

### Process Architecture

```
  +--------------------------------------------------------------+
  |                VS Code Extension Host (Node.js)               |
  |                                                               |
  |  +---------------+  +---------------+  +------------------+  |
  |  | Artifact      |  | Artifact      |  | HuntData         |  |
  |  | Watcher       |->| Parser        |->| Store            |  |
  |  | (debounce     |  | (ParseResult) |  | (single hunt,    |  |
  |  |  300ms/file)  |  |               |  |  serialized      |  |
  |  +---------------+  +---------------+  |  updates)         |  |
  |                                        +--------+---------+  |
  |                                                 |             |
  |  +---------------+  +---------------+           |             |
  |  | TreeView      |  | CodeLens      |<----------+             |
  |  | Provider      |  | Provider      |           |             |
  |  +---------------+  +---------------+           |             |
  |                                                 |             |
  |  +---------------+  +---------------+           |             |
  |  | Diagnostics   |  | StatusBar     |<----------+             |
  |  | Provider      |  | Item          |           |             |
  |  +---------------+  +---------------+           |             |
  |                                                 |             |
  |  +---------------+                              |             |
  |  | Webview       |<-----------------------------+             |
  |  | Bridge        |                                            |
  |  +-------+-------+                                            |
  +----------|----------------------------------------------------|
             | postMessage / onDidReceiveMessage
  +----------v----------------------------------------------------+
  |              Webview (iframe sandbox)                          |
  |  Preact + Observable Plot / D3                                |
  |  - Drain Template Viewer (v1)                                 |
  |  - Evidence Graph (v2)                                        |
  |  - Multi-Source Timeline (v2)                                 |
  +---------------------------------------------------------------+
```

### Subsystem Design

#### 1. Artifact Watcher (`subsystems/watcher.ts`)

Wraps `vscode.workspace.createFileSystemWatcher` with hunt-specific semantics.

```typescript
class ArtifactWatcher implements vscode.Disposable {
  constructor(huntRoot: vscode.Uri)
  onDidChange: vscode.Event<ArtifactChangeEvent>
  dispose(): void
}

interface ArtifactChangeEvent {
  uri: vscode.Uri
  kind: ArtifactKind
  changeType: 'created' | 'changed' | 'deleted'
}

type ArtifactKind =
  | 'mission' | 'hypotheses' | 'huntmap' | 'state'
  | 'query' | 'receipt' | 'evidence_review' | 'findings'
  | 'unknown'
```

**Behavior:**
- Single glob pattern: `**/{.hunt,.planning}/**/*.md`
- Classifies URIs by filename pattern (`QRY-*.md` -> `'query'`, etc.)
- Debounce: 300ms per-file via `Map<string, NodeJS.Timeout>`
- Content-length stability check: after debounce fires, compare `fs.stat()` mtime/size. If changed, reset debounce (catches CLI multi-pass writes).
- Emits typed `ArtifactChangeEvent` objects. Downstream consumers never classify files.

#### 2. Artifact Parser (`subsystems/parser.ts`)

Facade over per-artifact-type parsers. Every parser returns `ParseResult<T>`.

```typescript
class ArtifactParser {
  parseMission(uri: vscode.Uri): Promise<ParseResult<Mission>>
  parseHypotheses(uri: vscode.Uri): Promise<ParseResult<Hypothesis[]>>
  parseHuntmap(uri: vscode.Uri): Promise<ParseResult<HuntMap>>
  parseState(uri: vscode.Uri): Promise<ParseResult<HuntState>>
  parseQuery(uri: vscode.Uri): Promise<ParseResult<Query>>
  parseReceipt(uri: vscode.Uri): Promise<ParseResult<Receipt>>
  parseEvidenceReview(uri: vscode.Uri): Promise<ParseResult<EvidenceReview>>
  parseFindings(uri: vscode.Uri): Promise<ParseResult<Findings>>
}

interface ParseResult<T> {
  status: 'ok' | 'partial' | 'error'
  data: T | null
  warnings: ParseWarning[]
  errors: ParseError[]
}

interface ParseWarning {
  field: string
  message: string
  fallback: unknown
}

interface ParseError {
  message: string
  line?: number
  fatal: boolean
}
```

**Parsing strategy:**
- Frontmatter: `yaml` package (3KB). Split on `---` boundaries.
- Markdown body: `mdast-util-from-markdown` + `micromark-extension-gfm-table` + `mdast-util-gfm-table` + `micromark-extension-frontmatter` + `mdast-util-frontmatter`. Walk AST for heading boundaries and table structures.
- JSON code blocks: find fenced code blocks with `json` language tag inside `### Template Clustering` section.
- Naming convention: YAML/JSON uses snake_case. TypeScript interfaces use camelCase. Parsers convert at the boundary.

**Retry on incomplete parse:**
If parser succeeds on frontmatter but gets null for an expected body section, set a 500ms retry timer. Limit to 2 retries. This handles CLI multi-pass writes.

**Two-level parse cache:**
```typescript
interface ParsedArtifact<T> {
  frontmatter: T            // always parsed
  body: T | null             // null = not yet parsed
  lastModified: number       // fs.stat mtime
}
```

When a UI component needs body data, it calls `store.ensureFullParse(id)`.

#### 3. State Store (`subsystems/store.ts`)

Single source of truth for all UI components. Holds one hunt.

```typescript
class HuntDataStore implements vscode.Disposable {
  // Domain state
  readonly hunt: Hunt | null
  readonly queries: Map<QueryId, ArtifactState<Query>>
  readonly receipts: Map<ReceiptId, ArtifactState<Receipt>>
  readonly hypotheses: Map<HypothesisId, Hypothesis>
  readonly templates: Map<TemplateId, DrainCluster & { queryId: QueryId }>

  // Cross-artifact indexes (built lazily, invalidated on change)
  readonly hypothesisToReceipts: Map<HypothesisId, ReceiptId[]>
  readonly hypothesisToQueries: Map<HypothesisId, QueryId[]>
  readonly queryToReceipts: Map<QueryId, ReceiptId[]>
  readonly receiptToQueries: Map<ReceiptId, QueryId[]>
  readonly templateToQueries: Map<TemplateId, QueryId[]>

  // Selection (shared across all panels)
  readonly selection: { kind: ArtifactKind; id: string } | null

  // Reactivity
  readonly onDidChange: vscode.Event<StoreChangeEvent>

  // Operations
  invalidate(kind: ArtifactKind, uri: vscode.Uri): Promise<void>
  select(kind: ArtifactKind, id: string): void
  clearSelection(): void
  ensureFullParse(kind: ArtifactKind, id: string): Promise<void>
  getRelatedArtifacts(id: string): RelatedArtifacts
  dispose(): void
}

type ArtifactState<T> =
  | { status: 'loaded'; data: T; warnings: ParseWarning[] }
  | { status: 'error'; lastGoodData: T | null; errors: ParseError[] }
  | { status: 'loading' }
  | { status: 'missing' }

interface StoreChangeEvent {
  kind: ArtifactKind | 'selection'
  affectedIds: string[]
}
```

**Serialized updates:** Store operations are serialized via a promise queue to prevent stale indexes from concurrent parses:

```typescript
private updateQueue = Promise.resolve();

invalidate(kind: ArtifactKind, uri: vscode.Uri): Promise<void> {
  return this.updateQueue = this.updateQueue.then(
    () => this._processUpdate(kind, uri)
  );
}
```

**Cross-panel selection flow:**
```
Sidebar TreeView click -> store.select('hypothesis', 'HYP-01')
  -> store computes related IDs
  -> fires onDidChange { kind: 'selection', affectedIds }
  -> all bridges send { type: 'highlight', ids } to their webviews
```

#### 4. Webview Bridge (`subsystems/bridge.ts`)

Type-safe message passing between extension host and webview panels.

```typescript
class WebviewBridge<TViewModel> implements vscode.Disposable {
  constructor(
    panel: vscode.WebviewPanel,
    store: HuntDataStore,
    viewModelBuilder: (store: HuntDataStore) => TViewModel,
  )

  sendInit(): void          // Full view model + theme
  sendUpdate(delta: Partial<TViewModel>): void
  sendHighlight(ids: string[]): void
  sendStale(affectedIds: string[]): void
  private handleMessage(msg: WebviewMessage): void
  dispose(): void
}
```

### Data Flow Pipeline

```
.hunt/QUERIES/QRY-20260328-001.md    (file saved by CLI)
    |
    v
FileSystemWatcher.onDidChange
    |
    v
ArtifactWatcher                      (debounce 300ms, classify)
    |  content-stability check (mtime/size)
    |  emits ArtifactChangeEvent { kind: 'query', uri }
    v
HuntDataStore.invalidate('query', uri)
    |  1. Sets artifact state to 'loading'
    |  2. Sends { type: 'stale', affectedIds } to bridges
    |  3. Calls parser.parseQuery(uri)
    |  4. If ParseResult.status == 'ok': updates Map, state = 'loaded'
    |     If 'partial': updates Map with partial data + warnings
    |     If 'error': sets state = 'error', retries 1x at 500ms
    |  5. Rebuilds affected cross-artifact indexes
    |  6. Fires onDidChange { kind: 'query', affectedIds }
    v
Subscribers react:
    +-- HuntTreeProvider -> fire onDidChangeTreeData (scoped subtree)
    +-- DrainTemplateViewer bridge -> rebuild view model, send update
    +-- CodeLensProvider -> fire onDidChangeCodeLenses
    +-- StatusBar -> check if STATE.md changed, update text
    +-- DiagnosticsProvider -> re-validate affected receipts
```

### Artifact Root Resolution

```
1. If `.hunt/MISSION.md` exists -> use `.hunt/` as root
2. Else if `.planning/MISSION.md` exists -> use `.planning/`
3. If both exist -> QuickPick prompt, choice persisted in workspaceState
4. Setting `thruntGod.planningDirectory`:
   - Default: "auto" (use resolution order above)
   - Custom path: use that path directly
```

### Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Language | TypeScript | Extension host + webview |
| Bundler | esbuild | Sub-second builds. Two entry points: `dist/extension.js` (CJS) + `dist/webview-drain.js` (ESM) |
| Webview framework | Preact (React compat alias) | <4KB gzipped. React API compatibility. `useRef` + `useEffect` for D3 hosting. |
| Template Viewer viz | Observable Plot | Declarative SVG. ~30KB gzipped. 3 lines for a stacked bar chart. |
| Evidence Graph viz (v2) | Dagre + custom SVG | Dagre (~15KB) for layout. Custom SVG for rendering. No Cytoscape (200KB+). |
| Timeline viz (v2) | Custom Canvas + D3 scales | Canvas for 60fps at 10k+ events. D3 `scaleTime` for axes. `d3-quadtree` for hit-testing. |
| Markdown parsing | `mdast-util-from-markdown` + `yaml` | AST-level access to headings, tables, code blocks. `yaml` package 3KB. |
| mdast extensions | `micromark-extension-gfm-table`, `mdast-util-gfm-table`, `micromark-extension-frontmatter`, `mdast-util-frontmatter` | GFM tables for evidence review parsing. Frontmatter for YAML extraction. |
| Validation (tests only) | Zod | Validate test fixtures against CLI output schemas. Not used in production parsing. |

**Explicitly not used:**
- ECharts (800KB+), Plotly (3MB+), Cytoscape (200KB+), vis.js (300KB+), Chart.js
- `remark-parse` + `unified` (heavier than `mdast-util-*` layer)
- `js-yaml` (replaced by lighter `yaml` package)

---

## Part 3: Data Models (Canonical)

All TypeScript interfaces for the THRUNT God extension. This is the single source of truth. ARCHITECTURE.md's Domain Model section is superseded.

### 3.1 Identifiers

```typescript
/** Branded types for the four IDs consumed by UI components. */
type QueryId      = string & { __brand: 'QueryId' };
type ReceiptId    = string & { __brand: 'ReceiptId' };
type HypothesisId = string & { __brand: 'HypothesisId' };
type TemplateId   = string & { __brand: 'TemplateId' };

/** All other IDs use plain strings. */
type ManifestId = string;
type RequestId  = string;
type PackId     = string;
```

### 3.2 Hunt Container

```typescript
interface Hunt {
  rootPath: string;
  mission: Mission;
  hypotheses: Hypothesis[];
  huntMap: HuntMap;
  state: HuntState;
  findings: Findings | null;
  evidenceReview: EvidenceReview | null;
  queries: Query[];
  receipts: Receipt[];
}
```

Note: `SuccessCriteria`, `EnvironmentMap`, `EvidenceGraph`, and `Timeline` are removed from v1.

### 3.3 Mission

```typescript
interface Mission {
  title: string;
  mode: 'case' | 'program';
  opened: string;
  owner: string;
  status: string;
  signal: string;
  desiredOutcome: string;
  scope: MissionScope;
  operatingConstraints: string;
  workingTheory: string;
  successDefinition: string;
  keyDecisions: KeyDecision[];
}

interface MissionScope {
  timeWindow: { start: string; end: string };
  entities: string[];
  environment: string;
  prioritySurfaces: string[];
}

interface KeyDecision {
  decision: string;
  reason: string;
  date: string;
}
```

### 3.4 Hypothesis

```typescript
type HypothesisStatus = 'active' | 'supported' | 'disproved' | 'parked' | 'inconclusive';
type HypothesisPriority = 'Critical' | 'High' | 'Medium' | 'Low';

interface Hypothesis {
  id: HypothesisId;
  title: string;
  signal: string;
  assertion: string;
  priority: HypothesisPriority;
  scope: string;
  dataSources: string[];
  evidenceNeeded: string;
  disproofCondition: string;
  confidence: string;
  status: HypothesisStatus;
  supportingReceipts: ReceiptId[];
  disproofEvidence: string | null;
}
```

### 3.5 Hunt Map / Phase

```typescript
interface HuntMap {
  title: string;
  overview: string;
  phases: Phase[];
  progress: PhaseProgress[];
}

interface Phase {
  number: number;
  name: string;
  goal: string;
  dependsOn: string | null;          // raw string from markdown
  operations: string;
  receiptsRequired: string;
  successCriteria: string[];
  plans: PhasePlan[];
  status: 'pending' | 'in_progress' | 'complete';
  completed: string | null;
}

interface PhasePlan {
  id: string;                          // e.g. "01-01"
  description: string;
  complete: boolean;
}

interface PhaseProgress {
  phaseName: string;
  plansComplete: string;               // e.g. "1/1"
  status: string;
  completed: string;
}
```

### 3.6 Hunt State

```typescript
interface HuntState {
  missionRef: string;
  activeSignal: string;
  currentFocus: string;
  currentPosition: {
    phase: number;
    totalPhases: number;
    phaseName: string;
    plan: number;
    totalPlansInPhase: number;
    status: string;
    lastActivity: string;
    progressPercent: number;
  };
  huntContext: {
    currentScope: string[];
    dataSourcesInPlay: string[];
    confidence: string;
    blockers: string[];
  };
  sessionContinuity: {
    lastSession: string;
    stoppedAt: string;
    resumeFile: string | null;
  };
}
```

### 3.7 Query

```typescript
type DatasetKind = 'events' | 'alerts' | 'entities' | 'identity'
  | 'endpoint' | 'cloud' | 'email' | 'other';
type ResultStatus = 'ok' | 'partial' | 'error' | 'empty';

interface Query {
  // Frontmatter
  queryId: QueryId;
  querySpecVersion: string;
  source: string;
  connectorId: string;
  dataset: DatasetKind;
  executedAt: string;
  author: string;
  relatedHypotheses: HypothesisId[];
  relatedReceipts: ReceiptId[];
  contentHash: string;
  manifestId: string;

  // Parsed body
  title: string;
  intent: string;
  queryStatement: string;
  parameters: QueryParameters;
  runtimeMetadata: QueryRuntimeMetadata;
  resultSummary: QueryResultSummary;
  templateClustering: ReduceEventsOutput | null;
  templateAnalysis: TemplateAnalysisRow[];
  entityTimelines: EntityTimeline[];
  notes: string;
}

interface QueryParameters {
  timeWindow: { start: string; end: string };
  entities: string[];
  filters: string;
}

interface QueryRuntimeMetadata {
  profile: string;
  paginationMode: string;
  paginationLimit: number;
  maxPages: number;
  timeoutMs: number;
  consistency: string;
  resultStatus: ResultStatus;
  warningCount: number;
  errorCount: number;
}

interface QueryResultSummary {
  events: number;
  templates: number;
  entities: number;
}

interface TemplateAnalysisRow {
  index: number;
  template: string;
  count: number;
  interpretation: string;
}

interface EntityTimeline {
  entityId: string;
  events: EntityTimelineEvent[];
}

interface EntityTimelineEvent {
  index: number;
  timestamp: string;
  source: string;
  eventType: string;
  detail: string;
}
```

### 3.8 Template Clustering (Drain Output)

```typescript
interface ReduceEventsOutput {
  algorithm: 'drain';
  config: DrainConfig;
  clusterCount: number;
  clusters: DrainCluster[];
  reducedAt: string;
}

interface DrainConfig {
  depth: number;
  similarityThreshold: number;
  maxClusters: number | null;
}

interface DrainCluster {
  templateId: TemplateId;
  template: string;
  count: number;
  sampleEventId: string | null;
  eventIds: string[];               // parser caps at 100
}
```

### 3.9 Receipt

```typescript
type ClaimStatus = 'supports' | 'context' | 'disproves' | 'inconclusive';

interface Receipt {
  // Frontmatter
  receiptId: ReceiptId;
  querySpecVersion: string;
  createdAt: string;
  source: string;
  connectorId: string;
  dataset: DatasetKind;
  resultStatus: ResultStatus;
  claimStatus: ClaimStatus;
  relatedHypotheses: HypothesisId[];
  relatedQueries: QueryId[];
  contentHash: string;
  manifestId: string;

  // Parsed body
  title: string;
  claim: string;
  evidence: string;
  anomalyFraming: AnomalyFrame | null;
  chainOfCustody: ChainOfCustody;
  confidence: string;
  notes: string;
}

interface AnomalyFrame {
  entity: string;
  baseline: EntityBaseline;
  eventReference: string;
  prediction: AnomalyPrediction;
  actualEvent: string;
  deviation: DeviationScore;
  whatWouldChange: string[];
}

interface EntityBaseline {
  typicalLocations: string[];
  typicalHours: string;
  knownDevices: string[];
  normalApps: string[];
  mfaMethod: string;
  admin: boolean;
  priorHistory: string[];
}

interface AnomalyPrediction {
  expectedBenignNext: string;
  expectedMaliciousNext: string;
  ambiguousNext: string;
}

type DeviationCategory =
  | 'EXPECTED_BENIGN'
  | 'EXPECTED_MALICIOUS'
  | 'AMBIGUOUS'
  | 'NOVEL';

interface DeviationScore {
  category: DeviationCategory;
  baseScore: number;                // 0-6 (0 = clear/no deviation)
  factors: DeviationFactor[];
  compositeScore: number;           // 0-6 (clamped)
  severity: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  packProgressionMatch: PackProgressionMatch | null;
}

interface DeviationFactor {
  description: string;
  adjustment: number;               // e.g. +1, -1
}

interface PackProgressionMatch {
  progressionName: string;
  stepNumber: number;
  stepName: string;
  signalMatched: string;
}

interface ChainOfCustody {
  collectedBy: string;
  collectionPath: string;
  identifiers: string;
  timeObserved: string;
}
```

**Deviation score mapping:**

| Score | Severity | Label | Meaning |
|-------|----------|-------|---------|
| 0 | CLEAR | Clear | No deviation. Expected benign result. |
| 1 | LOW | Minimal | Trivial deviation, likely noise |
| 2 | LOW | Low | Unusual but within operational variance |
| 3 | MEDIUM | Medium | Matches known TTP, warrants investigation |
| 4 | HIGH | High | Multiple reinforcing signals |
| 5 | CRITICAL | High-Critical | Strong multi-factor evidence |
| 6 | CRITICAL | Critical | Cumulative evidence chain, high confidence malicious |

### 3.10 Evidence Review

```typescript
type CheckStatus = 'Pass' | 'Fail';

interface EvidenceReview {
  publishabilityVerdict: string;
  qualityChecks: EvidenceQualityCheck[];
  antiPatterns: EvidenceAntiPattern[];
  templateClusteringIntegrity: TemplateClusteringCheck[];
  packProgressionVerification: PackProgressionStep[];
  contradictoryEvidence: string;
  blindSpots: string[];
  followUpNeeded: string[];
}

interface EvidenceQualityCheck {
  check: string;
  status: CheckStatus;
  notes: string;
}

interface EvidenceAntiPattern {
  antiPattern: string;
  status: CheckStatus;
  details: string;
}

interface TemplateClusteringCheck {
  queryId: QueryId;
  events: number;
  templates: number;
  clusteringValid: boolean;          // parser converts "Yes"/"No" to boolean
}

interface PackProgressionStep {
  stepName: string;
  technique: string;
  expectedSignal: string;
  actualSignal: string;
  match: boolean;
}
```

### 3.11 Findings

```typescript
type HypothesisVerdict = 'Supported' | 'Disproved' | 'Inconclusive';

interface Findings {
  title: string;
  executiveSummary: string;
  hypothesisVerdicts: HypothesisVerdictRow[];
  impactedScope: FindingsScope;
  whatWeKnow: string[];
  whatWeDoNotKnow: string[];
  recommendedActions: string[];
  status: string;
}

interface HypothesisVerdictRow {
  hypothesisId: HypothesisId;
  hypothesis: string;
  verdict: HypothesisVerdict;
  confidence: string;
  evidence: string;
}

interface FindingsScope {
  users: string[];
  mailboxes: string[];
  apps: string[];
  tenants: string[];
}
```

---

## Part 4: Webview Message Protocol (Unified)

12 message types for v1. Discriminated by `type` field. Each panel uses the subset it needs.

### Host -> Webview

```typescript
/** Sent once when panel is created or restored. */
interface InitMessage<T> {
  type: 'init';
  viewModel: T;
  isDark: boolean;
}

/** Sent when store changes affect this panel's view model. */
interface UpdateMessage<T> {
  type: 'update';
  viewModel: Partial<T>;
}

/** Sent when selection changes in another panel. */
interface HighlightMessage {
  type: 'highlight';
  ids: string[];
}

/** Sent immediately when store.invalidate() is called. */
interface StaleMessage {
  type: 'stale';
  affectedIds: string[];
}

/** Sent when VS Code theme changes. */
interface ThemeMessage {
  type: 'theme';
  isDark: boolean;
}
```

### Webview -> Host

```typescript
/** User selects an artifact in a panel. */
interface SelectMessage {
  type: 'select';
  kind: ArtifactKind;
  id: string;
}

/** User wants to open a file in the editor. */
interface NavigateMessage {
  type: 'navigate';
  artifactId: string;
}

/** User requests detailed data not in the initial view model. */
interface RequestDetailMessage {
  type: 'request-detail';
  kind: ArtifactKind;
  id: string;
}

/** Webview has finished initializing and is ready for data. */
interface ReadyMessage {
  type: 'ready';
}

/** Webview wants to return focus to VS Code. */
interface BlurMessage {
  type: 'blur';
}
```

### Drain Template Viewer View Model

```typescript
interface DrainViewerViewModel {
  query: {
    queryId: QueryId;
    title: string;
    connectorId: string;
    dataset: DatasetKind;
    eventCount: number;
    entityCount: number;
    timeWindow: { start: string; end: string };
  };
  clusters: Array<{
    templateId: TemplateId;
    template: string;
    count: number;
    percentage: number;
    sampleEventId: string | null;
  }>;
  totalEvents: number;
  drainConfig: DrainConfig;
}
```

### Future: Evidence Graph View Model (v2)

```typescript
interface EvidenceGraphViewModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    supported: number;
    disproved: number;
    inconclusive: number;
    open: number;
    strongestChain: { hypothesisId: HypothesisId; score: number } | null;
  };
}

interface GraphNode {
  id: string;
  kind: 'hypothesis' | 'receipt' | 'query' | 'template' | 'finding';
  label: string;
  // Per-kind metadata
  verdict?: HypothesisStatus;
  score?: number;
  claimStatus?: ClaimStatus;
  connectorId?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  kind: 'supports' | 'contradicts' | 'provides_context' | 'sourced_from' | 'clusters';
  weight?: number;
}
```

---

## Part 5: Feature Specifications (Reconciled)

### Feature 1: Hunt Sidebar

**Contribution ID:** `thruntGod.huntTree`
**Type:** Native VS Code TreeView (NOT a WebviewView)
**Location:** Primary Side Bar, dedicated Activity Bar icon

#### Tree Structure

```
ROOT
 +-- Mission                              (singleton, always present)
 +-- Hypotheses                           (section header)
 |    +-- HYP-01: OAuth consent...        (leaf)
 |    +-- HYP-02: Email exfil...          (leaf)
 |    +-- HYP-03: Lateral movement...     (leaf)
 +-- Phases                               (section header)
 |    +-- Phase 1: Signal Intake          (group)
 |    |    +-- Plan 01-01                 (group)
 |    |         +-- QRY-20260328-001      (leaf)
 |    |         +-- RCT-20260328-001      (leaf)
 |    +-- Phase 2: Telemetry Collection   (group)
 |    |    +-- ...
 |    +-- Phase 3: Evidence Correlation   (group)
 +-- Evidence Review                      (singleton)
```

Queries and receipts are nested under their phase/plan. This is the UX-SPEC structure, which is semantic rather than flat.

#### Node Configuration

| Node | TreeItem.label | TreeItem.description | TreeItem.iconPath | Click Action |
|------|---------------|---------------------|-------------------|-------------|
| Mission | Hunt title | Status | `$(shield)` | Opens MISSION.md |
| Hypotheses | "Hypotheses" | Count badge | `$(list-unordered)` | Toggles collapse |
| HYP-* | `HYP-01: [short claim]` | Verdict | Verdict icon (colored) | Opens HYPOTHESES.md, scrolls to heading |
| Phases | "Phases" | Progress | `$(milestone)` | Toggles collapse |
| Phase N | `Phase N: [name]` | Status | Phase status icon | Toggles collapse |
| Plan NN-MM | `Plan NN-MM` | Complete/pending | `$(tasklist)` | Toggles collapse |
| QRY-* | `QRY-001` | `4T, 312 events` | `$(database)` colored by connector | Opens QRY file |
| RCT-* | `RCT-001` | `Score: 5` | Score badge SVG (colored) | Opens RCT file |
| Evidence Review | "Evidence Review" | Verdict | `$(checklist)` | Opens EVIDENCE_REVIEW.md |

Labels use abbreviated IDs (`QRY-001` not `QRY-20260328-001`) to prevent truncation at narrow sidebar widths. Full ID is in tooltip.

#### Hypothesis Verdict Icons

| Verdict | Icon | Color (dark) | Color (light) |
|---------|------|-------------|---------------|
| Supported | `$(check)` | `#4EC9B0` | `#16825D` |
| Disproved | `$(close)` | `#CE9178` | `#A31515` |
| Inconclusive | `$(question)` | `#DCDCAA` | `#795E26` |
| Open | `$(circle-outline)` | `#569CD6` | `#0451A5` |

#### Phase Status Icons

| Status | Icon | Color (dark) | Color (light) |
|--------|------|-------------|---------------|
| Complete | `$(check-all)` | `#4EC9B0` | `#16825D` |
| In Progress | `$(sync~spin)` | `#569CD6` | `#0451A5` |
| Pending | `$(circle-outline)` | `#858585` | `#6A6A6A` |

#### Receipt Score Badges

Deviation score rendered as SVG data URI in `TreeItem.iconPath`:

| Score | Badge Color (dark) | Badge Color (light) | Severity |
|-------|-------------------|---------------------|----------|
| 0 | No badge | No badge | Clear |
| 1-2 | `#858585` (gray) | `#6A6A6A` | Low |
| 3 | `#DCDCAA` (yellow) | `#795E26` | Medium |
| 4 | `#CE9178` (orange) | `#B5651D` | High |
| 5-6 | `#F44747` (red) | `#CD3131` | Critical |

#### Context Menu Actions

**On QRY-* node:**
- Open Query
- Open Drain Template Viewer
- Compare Templates...
- Copy Query ID

**On RCT-* node:**
- Open Receipt
- Open Linked Query
- Copy Receipt ID

**On HYP-* node:**
- Open Hypothesis
- Show Linked Receipts
- Copy Hypothesis ID

#### Empty States

**No hunt detected:** Activity bar icon hidden. Extension silent.

**Hunt detected, minimal artifacts:** Progressive activation:
1. Only MISSION.md: Show Mission node + "Shape hypotheses to continue" prompt
2. MISSION.md + HYPOTHESES.md: Show Mission + Hypotheses + "Create a huntmap" prompt
3. Full artifact set: Normal tree

**Hunt complete:** All phases show `$(check-all)`. Evidence Review node shows verdict badge.

#### Behavior

- **Auto-refresh:** TreeView subscribes to `HuntDataStore.onDidChange`. Only affected subtrees re-render.
- **Bidirectional sync:** Clicking sidebar opens file. Opening a `.hunt/*.md` file highlights the sidebar node.
- **Collapse memory:** Persisted via `workspaceState`.
- **Error artifacts:** Nodes with parse errors show `$(warning)` icon. Tooltip shows parse error message.
- **Accessibility:** Every node has `TreeItem.accessibilityInformation` with descriptive label (e.g., "Receipt RCT-001, deviation score 5, high severity, supports hypothesis 1").

### Feature 2: Drain Template Viewer

**Panel type:** WebviewPanel
**View type:** `thruntGod.drainViewer`
**Location:** Editor column 2 (split right of QRY-* file)

#### Activation

1. **CodeLens:** Above `## Result Summary` in QRY-*.md: `"4 templates from 312 events -- Open Template Viewer"`. Click opens viewer.
2. **Context menu:** Right-click QRY-* node in sidebar -> "Open Drain Template Viewer"
3. **Command palette:** `THRUNT: Open Template Viewer`

#### Primary Visualization: Horizontal Stacked Bar

One horizontal bar per query. Each segment represents a template. Segment width encodes event count (proportional). Color encodes template identity (deterministic from template_id).

```
+-----------------------------------------------------------------------+
|  Drain Template Viewer: QRY-20260328-001                    [x]       |
|                                                                       |
|  4 templates from 312 events  |  M365 Identity  |  3 entities        |
|                                                                       |
|  TEMPLATE DISTRIBUTION                                                |
|  +------------------------------------------------------------------+ |
|  | Sign-in to <*> from <IP> -- result: <*>              198  63.5%  | |
|  |========================================================          | |
|  | Failed sign-in for <EMAIL> -- error: <*>              52  16.7%  | |
|  |================                                                  | |
|  | OAuth consent granted to app <UUID> by <EMAIL>...     47  15.1%  | |
|  |===============                                                   | |
|  | Token refresh for app <UUID> from <IP>                15   4.8%  | |
|  |====                                                              | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  TEMPLATE DETAIL  (click a bar to select)                             |
|  +------------------------------------------------------------------+ |
|  | Template: OAuth consent granted to app <UUID> by <EMAIL>         | |
|  |           from <IP>                                              | |
|  | ID:       c7a1e3b2f9d04856                                       | |
|  | Count:    47 events (15.1%)                                      | |
|  | Sample:   evt-m365-id-00147                                      | |
|  |                                                                  | |
|  | Variable tokens:                                                 | |
|  |   <UUID>  -> 3fa85f64-... (malicious) | e2a1b4c7-... (legit)    | |
|  |   <EMAIL> -> sarah.chen@acme.corp (1) | maria.garcia@... (34)   | |
|  |   <IP>    -> 185.220.101.42 (1) [!] | 10.0.1.15 (46)           | |
|  |                                                                  | |
|  | [ Show in Timeline (v2) ] [ Jump to Source ]                     | |
|  +------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

#### Interactions

**Click a bar segment:** Selects template. Detail pane populates. Segment visually pops (2px border, scaleY 1.1). Breadcrumb appears: `QRY-001 > T1: Auth failed...`

**Hover a bar segment:** Tooltip with: template text (full), count and percentage, template_id, sample event text (first 200 chars). Mask placeholders highlighted in accent color.

**Variable token drill-down:** Each masked token (`<UUID>`, `<EMAIL>`, `<IP>`) is expandable in the detail pane. Shows distinct values with frequency counts. Values appearing only once get `[!]` badge (anomaly indicator).

**Template comparison (v1.1):** "Compare" button in toolbar. QuickPick to select second query. Split view: two bars side by side. Templates with same template_id are linked with dashed connector lines. Templates unique to one query get "Only in QRY-..." badge.

**Search:** Text input above bars. Substring match (case-insensitive) on template text. Typing `failed` highlights matching segments, dims others. Typing a template_id hex string jumps to that template.

**Sort controls:** Dropdown: By Count (default), By Recency, By Deviation (cross-references receipt scores), By Novelty.

#### Template Pinning (v2)

Stored in VS Code `workspaceState` (NOT `.hunt/` filesystem). Pinned section collapsed by default, badge count: "3 pinned" with chevron.

#### Performance Budget

- First render: <100ms (Observable Plot SVG, 20 templates = 20 `<rect>` elements)
- 200 templates: <200ms (top 15 + "Other" grouping before rendering)
- Webview initial load: <300ms (single bundled JS <100KB gzipped)

#### Responsive Sizing

- Default: 50% of editor group (split right)
- Below 400px: detail pane stacks below bar chart
- Below 300px: compact list view (template name + count, no bar chart)

#### Error States

- **Malformed JSON block:** Yellow warning banner: "Could not parse template data for QRY-001." + "Show Raw" button. Sidebar shows `$(warning)` icon.
- **Empty results (`result_status: 'empty'`):** "No events matched this query. Consider broadening the time window."
- **Partial results:** Show available templates with banner: "Partial results -- N of M pages retrieved."
- **Error results:** "Query execution failed. See the query log for details." with link.

### Feature 3: Evidence Integrity Diagnostics

**Type:** VS Code DiagnosticCollection + CodeActionProvider
**Location:** Problems panel + gutter squigglies in editor

#### Anti-Pattern to Diagnostic Mapping

| Anti-Pattern | Severity | Code | Target File | Message |
|-------------|----------|------|-------------|---------|
| Post-hoc rationalization | Error | `thrunt.posthoc` | RCT-*.md | "Prediction section missing or appears after actual event description." |
| Missing baseline | Error | `thrunt.nobaseline` | RCT-*.md | "Anomaly framing lacks baseline documentation." |
| Score inflation | Warning | `thrunt.inflation` | RCT-*.md | "Deviation score {score} has {n} unaccounted points." |
| Bare sequential claim | Warning | `thrunt.baresequence` | RCT-*.md, FINDINGS.md | "Sequential claim lacks entity timeline reference." |
| Single-source timeline | Info | `thrunt.singlesource` | RCT-*.md | "Entity timeline uses only {source}." |
| Temporal gap | Warning | `thrunt.temporalgap` | RCT-*.md | "Gap of {duration} between events with no explanation." |
| Causality without evidence | Error | `thrunt.causalclaim` | FINDINGS.md | "Causal claim requires receipt-backed evidence." |

#### Quick-Fix Actions (CodeActions)

| Anti-Pattern | Quick Fix | Action |
|-------------|-----------|--------|
| Post-hoc rationalization | "Add prediction section template" | Inserts scaffold with `Expected benign next:`, `Expected malicious next:`, `Ambiguous next:` |
| Missing baseline | "Add baseline section template" | Inserts scaffold: Typical locations, Typical hours, Known devices, Normal apps, MFA method, Admin status |
| Score inflation | "Add missing score factor" | Inserts `**Factor: [describe]:** +N` line |
| Bare sequential claim | "Link to entity timeline" | QuickPick of QRY-* entity timelines, inserts reference |
| Causality without evidence | "Link to receipt" | QuickPick of RCT-* files, inserts reference |

#### Diagnostic Lifecycle

- Computed on file open and file save
- DiagnosticCollection named `thruntGod`
- When all checks pass: status bar shows green checkmark `integrity: OK`
- When checks fail: status bar shows `integrity: 2 errors, 1 warning` in yellow/red

#### Gutter Rendering

- **Error-level:** Red wavy underline (standard VS Code error squiggly)
- **Warning-level:** Yellow wavy underline
- **Info-level:** Blue gutter dot (no underline, avoids visual noise)

### Feature 4: Status Bar + CodeLens

#### Status Bar

Single item, left side, priority -100 (far left, before git branch).

Format: `$(shield) OAuth Phishing | P3/3 | 2S 1D | OK`

- `$(shield)` = THRUNT God icon
- Hunt title (truncated at 20 chars)
- Phase progress
- Verdict summary (S=Supported, D=Disproved)
- Integrity status

**Click:** Opens QuickPick with detailed status and navigation options.

**Critical alert mode:** When any receipt has deviation score 5-6, the item pulses and shows: `[!] RCT-001: Score 6 -- OAuth consent from Tor`. Click opens the receipt.

**Color:** Green when hunt complete. Yellow when active. Red when blocked or integrity failures.

#### CodeLens on Receipts (RCT-*.md)

Above `## Claim`:
```
Supports HYP-01 | Score: 5 (HIGH) | Show Scorecard
```

Above `### Deviation Assessment`:
```
Base: 3 (EXPECTED_MALICIOUS) + No change ticket (+1) + Tor exit node (+1) = 5 (HIGH)
```

#### CodeLens on Queries (QRY-*.md)

Above `## Result Summary`:
```
4 templates from 312 events | Open Template Viewer
```

#### Gutter Decorations on Receipts

- Composite score line: colored badge (score-based color from table above)
- Factor lines: colored delta indicators (+1, -1)
- Prediction section: colored left-border indicating prediction-observation order

### Feature 5: Command Palette

All commands prefixed with `THRUNT:`. No default keyboard shortcuts -- use chords.

| Command | ID | Available When |
|---------|-----|----------------|
| Open Template Viewer | `thruntGod.openDrainViewer` | QRY-* file open, or hunt active |
| Compare Templates... | `thruntGod.compareTemplates` | 2+ queries exist |
| Show Scorecard | `thruntGod.showScorecard` | RCT-* file open |
| Validate Evidence | `thruntGod.validateEvidence` | Hunt active |
| Go to Hypothesis... | `thruntGod.goToHypothesis` | Hypotheses exist |
| Go to Receipt... | `thruntGod.goToReceipt` | Receipts exist |
| Go to Query... | `thruntGod.goToQuery` | Queries exist |
| Go to Phase... | `thruntGod.goToPhase` | Phases exist |
| Show Hunt Status | `thruntGod.showHuntStatus` | Hunt active |
| Focus Entity... | `thruntGod.focusEntity` | Hunt active |
| Clear Entity Focus | `thruntGod.clearEntityFocus` | Entity focus active |
| Refresh Hunt Tree | `thruntGod.refreshHunt` | Hunt active |

**Suggested chord bindings (not defaults):**
- `Ctrl+K Ctrl+H` -- Focus Hunt Sidebar
- `Ctrl+K Ctrl+T` -- Open Template Viewer
- `Ctrl+K Ctrl+E` -- Validate Evidence

**Smart context:** Commands use `when` clauses to appear only when relevant:
```json
{
  "command": "thruntGod.showScorecard",
  "when": "resourceFilename =~ /^RCT-.*\\.md$/"
}
```

### Features Deferred to v2

**Evidence Graph (Dagre DAG):** Rated NICE by hunter. "Used for briefing a manager or reviewing someone else's hunt. For my own active hunts, I carry the topology in my head." Dagre layout with TB direction. 5 node types (hypothesis, receipt, query, template, finding). Focus mode for graphs above 20 nodes (tab strip per hypothesis). Summary strip above graph.

**Multi-Source Timeline:** The most complex feature. Canvas rendering, 3 LOD levels, brush selection, 4 swimlane grouping modes, zoom with minimap. Easily 3-4 weeks. Default grouping: By Entity with connectors collapsed. Timeline data already exists in QRY-* entity timeline tables (readable as markdown today).

**Export Findings:** Hunter rates this important for escalation workflow. Requires HTML/PDF generation. v2 also adds `THRUNT: Copy Finding Summary` for paste-ready text.

**Template Pinning + Sparklines:** Pinning stored in `workspaceState`. Sparklines show count trend across queries. Sparklines live in webview panels (not sidebar -- infeasible with TreeView API).

**THRUNT: Run Phase:** CLI bridge. Requires designing IPC between extension and CLI process.

---

## Part 6: Color System & Theming

### Design Principles

1. **Dark-first, light-safe.** Default palette optimized for dark themes.
2. **Two scopes:** Sidebar/editor uses VS Code token-adjacent muted palette. Webview canvases use bolder Tailwind-derived palette.
3. **Colorblind-safe.** Every semantic meaning has color + shape/icon + text redundancy.
4. **High Contrast aware.** Switch palettes for HC Dark and HC Light via `window.activeColorTheme.kind`.

### Sidebar/Editor Color Tokens (contributes.colors)

```jsonc
{
  "colors": [
    { "id": "thruntGod.verdictSupported",    "defaults": { "dark": "#4EC9B0", "light": "#16825D" } },
    { "id": "thruntGod.verdictDisproved",    "defaults": { "dark": "#CE9178", "light": "#A31515" } },
    { "id": "thruntGod.verdictInconclusive", "defaults": { "dark": "#DCDCAA", "light": "#795E26" } },
    { "id": "thruntGod.verdictOpen",         "defaults": { "dark": "#569CD6", "light": "#0451A5" } },
    { "id": "thruntGod.scoreLow",            "defaults": { "dark": "#858585", "light": "#6A6A6A" } },
    { "id": "thruntGod.scoreMedium",         "defaults": { "dark": "#DCDCAA", "light": "#795E26" } },
    { "id": "thruntGod.scoreHigh",           "defaults": { "dark": "#CE9178", "light": "#B5651D" } },
    { "id": "thruntGod.scoreCritical",       "defaults": { "dark": "#F44747", "light": "#CD3131" } },
    { "id": "thruntGod.phaseBorder",         "defaults": { "dark": "#3C3C3C", "light": "#D4D4D4" } }
  ]
}
```

### Webview Canvas Palette (Verdicts)

| Verdict | Dark | Light | Colorblind Redundancy |
|---------|------|-------|-----------------------|
| Supported | `#22c55e` | `#15803d` | Checkmark icon + "Supported" text |
| Disproved | `#ef4444` | `#dc2626` | X icon + "Disproved" text |
| Inconclusive | `#eab308` | `#ca8a04` | Question mark icon + "Inconclusive" text |
| Open | `#94a3b8` | `#64748b` | Open circle + "Open" text |

### Webview Deviation Score Gradient

| Score | Dark | Light | Label |
|-------|------|-------|-------|
| 0 | (no color) | (no color) | Clear |
| 1 | `#4ade80` | `#16a34a` | Minimal |
| 2 | `#a3e635` | `#65a30d` | Low |
| 3 | `#facc15` | `#ca8a04` | Medium |
| 4 | `#fb923c` | `#ea580c` | High |
| 5 | `#f87171` | `#dc2626` | High-Critical |
| 6 | `#ef4444` | `#b91c1c` | Critical |

### Webview Connector Colors

| Connector | Dark | Light |
|-----------|------|-------|
| Okta | `#60a5fa` | `#2563eb` |
| M365 | `#f97316` | `#c2410c` |
| CrowdStrike | `#e11d48` | `#be123c` |
| Elastic | `#a78bfa` | `#7c3aed` |
| Splunk | `#34d399` | `#059669` |
| AWS | `#fbbf24` | `#d97706` |
| Generic | `#94a3b8` | `#64748b` |

### Template Category Colors (12-color palette)

Templates assigned colors deterministically: `palette[parseInt(templateId.slice(0, 4), 16) % 12]`.

| Idx | Dark | Light |
|-----|------|-------|
| 0 | `#60a5fa` | `#2563eb` |
| 1 | `#f97316` | `#c2410c` |
| 2 | `#a78bfa` | `#7c3aed` |
| 3 | `#34d399` | `#059669` |
| 4 | `#f472b6` | `#db2777` |
| 5 | `#38bdf8` | `#0284c7` |
| 6 | `#fbbf24` | `#d97706` |
| 7 | `#a3e635` | `#65a30d` |
| 8 | `#e879f9` | `#c026d3` |
| 9 | `#22d3ee` | `#0891b2` |
| 10 | `#fb7185` | `#e11d48` |
| 11 | `#818cf8` | `#4f46e5` |

Beyond 12 templates: palette cycles with hatched pattern overlay (diagonal lines at 45 degrees).

### High Contrast Adjustments

When `window.activeColorTheme.kind` is `HighContrast` or `HighContrastLight`:
- All borders increase from 1px to 2px
- Translucent fills replaced with solid fills
- Yellow-400 replaced with amber-700 (`#b45309`) for HC Light (contrast ratio 4.9:1 vs white)
- All text meets WCAG AAA (7:1 contrast ratio)

### Colorblind Validation

Tested against protanopia, deuteranopia, and tritanopia:
- Green (`#4EC9B0`) and orange (`#CE9178`) are distinguishable: teal-shifted green, warm-shifted orange, distinct luminance
- Blue (`#569CD6`) and purple (`#C586C0`) may be hard for tritanopia: connector labels always include text
- Every verdict, score, and status has shape/icon + text fallback -- never color alone

---

## Part 7: Performance & Error Handling

### Lazy Parsing Strategy

```
Activation:
  Parse: MISSION.md, STATE.md, HUNTMAP.md, HYPOTHESES.md
  Skip: all queries, receipts, evidence review, findings

Sidebar expand "Queries":
  Parse: QRY-*.md frontmatter only (for ID, event count)
  Skip: QRY-*.md body (template clustering, entity timelines)

Open Drain Viewer for QRY-001:
  Parse: full QRY-001.md body (template clustering JSON)
  Skip: other QRY-*.md bodies

Evidence Integrity Validation:
  Parse: all RCT-*.md frontmatter + anomaly framing sections
  Skip: body sections not relevant to anti-pattern checks
```

### Memory Budget

Target: 50-query, 100-receipt hunt consumes under 50MB of extension host memory.

| Component | Estimate |
|-----------|----------|
| Parsed frontmatter (150 artifacts) | ~2MB |
| Full body parse cache (10 LRU) | ~5MB |
| Template clustering data (50 queries x 5 clusters) | ~1MB |
| Cross-artifact indexes | ~500KB |
| Webview view models (1 panel for v1) | ~3MB |
| **Total** | **~11.5MB** |

Webview process (Chromium renderer) has separate memory not counted here.

**Eviction:** If `process.memoryUsage().heapUsed` exceeds 100MB on a store update, aggressively evict body caches via LRU. Frontmatter caches never evicted.

**Event ID cap:** Parser caps `DrainCluster.event_ids` at 100 entries regardless of CLI output.

### File Watching Debounce Strategy

```
File changed (FSEvents/inotify)
  |
  v
Check: existing debounce timer for this URI?
  |-- Yes: reset timer to 300ms
  |-- No: create timer at 300ms
  |
  v  (300ms elapsed)
Check: mtime/size changed since timer start?
  |-- Yes: reset timer (CLI still writing)
  |-- No: emit ArtifactChangeEvent
```

Independent debounce windows per file via `Map<string, NodeJS.Timeout>`.

### Partial / Malformed Artifact Handling

Every artifact in the store has one of four states:

| State | Sidebar | Webview | Diagnostics |
|-------|---------|---------|-------------|
| `loaded` | Normal icon + badge | Full render | Artifact-level checks run |
| `loading` | Spinner icon | Dimmed at 50% opacity ("stale" message sent) | Skipped |
| `error` | `$(warning)` icon, tooltip shows error | Falls back to `lastGoodData` with stale indicator. If no prior data, shows error banner. | Parse error surfaced as Info diagnostic |
| `missing` | Node removed from tree | Panel shows "Artifact not found" | N/A |

**Retry:** On incomplete parse (frontmatter OK but expected body section null), retry at 500ms, limit 2 retries.

### Loading States

**Cold start (VS Code opens workspace):**
1. Extension activates on `workspaceContains` match
2. Parse MISSION.md + STATE.md + HUNTMAP.md + HYPOTHESES.md (~4 files, <50ms)
3. Sidebar populates with skeleton tree (phases collapsed)
4. Status bar shows hunt identity
5. Remaining artifacts parsed on demand (sidebar expand, panel open)

**Template Viewer cold open:**
1. Panel shows "Loading template data..." with spinner
2. Store triggers full parse of QRY-*.md body
3. ParseResult arrives, view model built, `init` message sent
4. Observable Plot renders stacked bar (<100ms)

**Graph panel cold open (v2):**
1. Panel shows "Building evidence graph..."
2. Store parses all QRY-*.md + RCT-*.md frontmatter for link topology
3. For 150 files on SSD: <100ms
4. Dagre layout: <5ms for 50 nodes
5. SVG render: <20ms

---

## Part 8: Extension Manifest

Complete `package.json` contributions for v1 MVP.

```jsonc
{
  "name": "thrunt-god",
  "displayName": "THRUNT God",
  "description": "Threat hunting investigation visualization for THRUNT God artifacts",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Visualization", "Other"],

  "activationEvents": [
    "workspaceContains:.hunt/MISSION.md",
    "workspaceContains:.planning/MISSION.md"
  ],

  "main": "./dist/extension.js",

  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "thruntGod",
        "title": "THRUNT God",
        "icon": "assets/shield-search.svg",
        "when": "thruntGod.huntDetected"
      }]
    },

    "views": {
      "thruntGod": [{
        "id": "thruntGod.huntTree",
        "name": "Hunt",
        "type": "tree",
        "when": "thruntGod.huntDetected"
      }]
    },

    "commands": [
      {
        "command": "thruntGod.openDrainViewer",
        "title": "THRUNT: Open Template Viewer",
        "icon": "$(layers)"
      },
      {
        "command": "thruntGod.compareTemplates",
        "title": "THRUNT: Compare Templates..."
      },
      {
        "command": "thruntGod.showScorecard",
        "title": "THRUNT: Show Scorecard"
      },
      {
        "command": "thruntGod.validateEvidence",
        "title": "THRUNT: Validate Evidence"
      },
      {
        "command": "thruntGod.goToHypothesis",
        "title": "THRUNT: Go to Hypothesis..."
      },
      {
        "command": "thruntGod.goToReceipt",
        "title": "THRUNT: Go to Receipt..."
      },
      {
        "command": "thruntGod.goToQuery",
        "title": "THRUNT: Go to Query..."
      },
      {
        "command": "thruntGod.goToPhase",
        "title": "THRUNT: Go to Phase..."
      },
      {
        "command": "thruntGod.showHuntStatus",
        "title": "THRUNT: Show Hunt Status"
      },
      {
        "command": "thruntGod.focusEntity",
        "title": "THRUNT: Focus Entity..."
      },
      {
        "command": "thruntGod.clearEntityFocus",
        "title": "THRUNT: Clear Entity Focus"
      },
      {
        "command": "thruntGod.refreshHunt",
        "title": "THRUNT: Refresh Hunt State",
        "icon": "$(refresh)"
      },
      {
        "command": "thruntGod.selectArtifact",
        "title": "THRUNT: Select Artifact"
      },
      {
        "command": "thruntGod.openArtifactFile",
        "title": "THRUNT: Open Artifact File"
      }
    ],

    "menus": {
      "view/title": [
        {
          "command": "thruntGod.refreshHunt",
          "when": "view == thruntGod.huntTree",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "thruntGod.openDrainViewer",
          "when": "view == thruntGod.huntTree && viewItem == query",
          "group": "inline"
        },
        {
          "command": "thruntGod.openArtifactFile",
          "when": "view == thruntGod.huntTree && viewItem =~ /^(query|receipt|hypothesis)$/",
          "group": "1_open"
        },
        {
          "command": "thruntGod.compareTemplates",
          "when": "view == thruntGod.huntTree && viewItem == query",
          "group": "2_actions"
        }
      ],
      "commandPalette": [
        {
          "command": "thruntGod.selectArtifact",
          "when": "false"
        },
        {
          "command": "thruntGod.openDrainViewer",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.compareTemplates",
          "when": "thruntGod.huntActive && thruntGod.queryCount > 1"
        },
        {
          "command": "thruntGod.showScorecard",
          "when": "resourceFilename =~ /^RCT-.*\\.md$/"
        },
        {
          "command": "thruntGod.validateEvidence",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.goToHypothesis",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.goToReceipt",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.goToQuery",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.showHuntStatus",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.focusEntity",
          "when": "thruntGod.huntActive"
        },
        {
          "command": "thruntGod.clearEntityFocus",
          "when": "thruntGod.entityFocusActive"
        }
      ]
    },

    "keybindings": [
      {
        "command": "thruntGod.openDrainViewer",
        "key": "ctrl+k ctrl+t",
        "mac": "cmd+k cmd+t",
        "when": "thruntGod.huntActive"
      },
      {
        "command": "thruntGod.validateEvidence",
        "key": "ctrl+k ctrl+e",
        "mac": "cmd+k cmd+e",
        "when": "thruntGod.huntActive"
      }
    ],

    "colors": [
      { "id": "thruntGod.verdictSupported",    "defaults": { "dark": "#4EC9B0", "light": "#16825D" } },
      { "id": "thruntGod.verdictDisproved",    "defaults": { "dark": "#CE9178", "light": "#A31515" } },
      { "id": "thruntGod.verdictInconclusive", "defaults": { "dark": "#DCDCAA", "light": "#795E26" } },
      { "id": "thruntGod.verdictOpen",         "defaults": { "dark": "#569CD6", "light": "#0451A5" } },
      { "id": "thruntGod.scoreLow",            "defaults": { "dark": "#858585", "light": "#6A6A6A" } },
      { "id": "thruntGod.scoreMedium",         "defaults": { "dark": "#DCDCAA", "light": "#795E26" } },
      { "id": "thruntGod.scoreHigh",           "defaults": { "dark": "#CE9178", "light": "#B5651D" } },
      { "id": "thruntGod.scoreCritical",       "defaults": { "dark": "#F44747", "light": "#CD3131" } },
      { "id": "thruntGod.phaseBorder",         "defaults": { "dark": "#3C3C3C", "light": "#D4D4D4" } }
    ],

    "configuration": {
      "title": "THRUNT God",
      "properties": {
        "thruntGod.planningDirectory": {
          "type": "string",
          "default": "auto",
          "description": "Hunt artifacts directory. 'auto' detects .hunt/ or .planning/. Or specify a relative path."
        },
        "thruntGod.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh views when artifacts change"
        },
        "thruntGod.debounceMs": {
          "type": "number",
          "default": 300,
          "minimum": 100,
          "maximum": 2000,
          "description": "Debounce delay for file change events (ms)"
        }
      }
    }
  }
}
```

### Context Variables

Set by the extension at runtime:

| Variable | Type | Set When |
|----------|------|----------|
| `thruntGod.huntDetected` | boolean | `.hunt/` or `.planning/` directory with MISSION.md found |
| `thruntGod.huntActive` | boolean | Hunt parsed and store populated |
| `thruntGod.queryCount` | number | Number of QRY-* files parsed |
| `thruntGod.entityFocusActive` | boolean | Entity focus mode is on |

---

## Appendix: File Watcher Patterns

| Glob | Purpose | Parser Method |
|------|---------|---------------|
| `.hunt/MISSION.md` or `.planning/MISSION.md` | Mission metadata | `parseMission` |
| `.hunt/HYPOTHESES.md` | Hypothesis list + verdicts | `parseHypotheses` |
| `.hunt/HUNTMAP.md` | Phase tree + completion | `parseHuntmap` |
| `.hunt/STATE.md` | Current position | `parseState` |
| `.hunt/QUERIES/QRY-*.md` | Query metadata + templates | `parseQuery` |
| `.hunt/RECEIPTS/RCT-*.md` | Receipt metadata + anomaly framing | `parseReceipt` |
| `.hunt/EVIDENCE_REVIEW.md` | Integrity checks | `parseEvidenceReview` |
| `.hunt/FINDINGS.md` | Final verdicts | `parseFindings` |

All parsing is TypeScript in the extension host. No external process needed for read-only visualization.
