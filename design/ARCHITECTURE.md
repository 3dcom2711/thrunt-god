# THRUNT God VS Code Extension -- Architecture

> Read-heavy visualization layer over `.planning/` hunt artifacts produced by
> the THRUNT God CLI. The CLI does execution; this extension is the hunter's lens.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Extension Structure](#extension-structure)
- [Core Subsystems](#core-subsystems)
- [UI Components](#ui-components)
- [Data Flow](#data-flow)
- [Domain Model](#domain-model)
- [Technology Choices](#technology-choices)
- [Performance Considerations](#performance-considerations)
- [Extension Manifest Sketch](#extension-manifest-sketch)
- [Testing Strategy](#testing-strategy)
- [Future Considerations](#future-considerations)

---

## Design Principles

1. **Read-only by default.** The extension never writes to `.planning/`. The CLI
   owns artifact production. The extension consumes, parses, and renders.

2. **Reactive to file changes.** Hunters run `/hunt:*` commands in a terminal.
   The extension watches `.planning/` and re-renders when artifacts change.
   There is no "refresh" button -- the UI is always current.

3. **Lazy everything.** Only parse artifacts that are visible or requested.
   A large hunt may have 50+ queries and 100+ receipts; do not parse them all
   at activation.

4. **Extension host is authoritative.** All parsing, state derivation, and
   cross-artifact linking happens in the extension host (Node.js process).
   Webviews are dumb render surfaces that receive pre-computed view models.

5. **Offline-first.** Zero network calls. All data comes from the local
   filesystem. No telemetry, no remote APIs, no license checks.

---

## Extension Structure

```
thrunt-god-vscode/
  package.json                 # Extension manifest (contributions, activation)
  tsconfig.json
  esbuild.config.mjs           # Bundles extension + webview separately
  src/
    extension.ts               # activate() / deactivate() entry point
    constants.ts               # PLANNING_DIR, artifact file patterns, command IDs
    subsystems/
      watcher.ts               # ArtifactWatcher (FileSystemWatcher wrapper)
      parser.ts                # ArtifactParser (Markdown + YAML frontmatter)
      store.ts                 # HuntStateStore (reactive state container)
      bridge.ts                # WebviewBridge (message passing protocol)
    providers/
      hunt-tree.ts             # TreeDataProvider for Activity Bar sidebar
      codelens.ts              # CodeLensProvider for receipt deviation scores
      diagnostics.ts           # DiagnosticCollection for evidence gaps
      status-bar.ts            # StatusBarItem for hunt progress
      hover.ts                 # HoverProvider for template/receipt inline details
    panels/
      drain-template-viewer.ts # WebviewPanel: Drain cluster treemap + table
      evidence-graph.ts        # WebviewPanel: hypothesis-receipt-query DAG
      timeline.ts              # WebviewPanel: multi-source entity timeline
      panel-base.ts            # Shared webview panel lifecycle management
    commands/
      index.ts                 # Command registration (THRUNT: prefixed)
      open-panel.ts            # Open specific webview panels
      navigate.ts              # Jump-to-artifact commands
      export.ts                # Export views as PNG/SVG/JSON
    models/
      types.ts                 # All domain model TypeScript interfaces
      parse-mission.ts         # MISSION.md parser
      parse-hypotheses.ts      # HYPOTHESES.md parser
      parse-huntmap.ts         # HUNTMAP.md parser
      parse-state.ts           # STATE.md parser
      parse-query.ts           # QRY-*.md parser (with template clustering)
      parse-receipt.ts         # RCT-*.md parser (with anomaly framing)
      parse-evidence-review.ts # EVIDENCE_REVIEW.md parser
      parse-findings.ts        # FINDINGS.md parser
  webview/
    drain-template-viewer/
      index.tsx                # React entry point
      TemplateTreemap.tsx       # D3 treemap of clusters by event count
      TemplateTable.tsx        # Sortable table: template, count, sample event
      ClusterDetail.tsx        # Selected cluster deep-dive
    evidence-graph/
      index.tsx
      EvidenceDAG.tsx          # D3 force-directed graph
      NodeDetail.tsx           # Selected node detail pane
    timeline/
      index.tsx
      TimelineCanvas.tsx       # D3 time-axis swim lanes per entity/source
      EventPopover.tsx         # Click-to-expand event detail
    shared/
      vscode-api.ts            # acquireVsCodeApi() singleton wrapper
      theme.ts                 # Read VS Code CSS variables for theming
      message-types.ts         # Shared message type definitions
  test/
    unit/
      parsers/                 # Unit tests for each artifact parser
      store.test.ts            # State derivation tests
    integration/
      watcher.test.ts          # FileSystemWatcher + parse pipeline
      bridge.test.ts           # Webview message round-trip tests
```

### Process Architecture

```
  ┌─────────────────────────────────────────────────────┐
  │                VS Code Extension Host                │
  │                  (Node.js process)                   │
  │                                                     │
  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
  │  │  Artifact   │  │  Artifact  │  │  HuntState   │  │
  │  │  Watcher    │─>│  Parser    │─>│  Store       │  │
  │  └────────────┘  └────────────┘  └──────┬───────┘  │
  │                                         │          │
  │  ┌────────────┐  ┌────────────┐         │          │
  │  │  TreeView   │  │  CodeLens  │<────────┤          │
  │  │  Provider   │  │  Provider  │         │          │
  │  └────────────┘  └────────────┘         │          │
  │                                         │          │
  │  ┌────────────┐                         │          │
  │  │  Webview    │<───────────────────────┘          │
  │  │  Bridge     │                                   │
  │  └─────┬──────┘                                    │
  └────────┼───────────────────────────────────────────┘
           │ postMessage / onDidReceiveMessage
  ┌────────▼───────────────────────────────────────────┐
  │              Webview (iframe sandbox)               │
  │                                                    │
  │  React + D3 render surfaces                        │
  │  - Drain Template Viewer                           │
  │  - Evidence Graph (DAG)                            │
  │  - Multi-Source Timeline                           │
  └────────────────────────────────────────────────────┘
```

### Activation

```jsonc
// package.json
"activationEvents": [
  "workspaceContains:.planning/MISSION.md",
  "workspaceContains:.planning/HUNTMAP.md",
  "workspaceContains:.hunt/MISSION.md",
  "onCommand:thruntGod.openDrainViewer",
  "onCommand:thruntGod.openEvidenceGraph",
  "onCommand:thruntGod.openTimeline"
]
```

The extension activates when a workspace contains `.planning/MISSION.md` or
`.hunt/MISSION.md` (the example hunts use `.hunt/`). Lazy activation means
zero overhead for non-hunt workspaces.

---

## Core Subsystems

### 1. Artifact Watcher (`subsystems/watcher.ts`)

Wraps `vscode.workspace.createFileSystemWatcher` with hunt-specific semantics.

```
API Surface:
  class ArtifactWatcher implements vscode.Disposable {
    constructor(planningRoot: vscode.Uri)
    onDidChange: vscode.Event<ArtifactChangeEvent>
    dispose(): void
  }

  interface ArtifactChangeEvent {
    uri: vscode.Uri
    kind: 'mission' | 'hypotheses' | 'huntmap' | 'state'
         | 'query' | 'receipt' | 'evidence_review' | 'findings'
         | 'environment' | 'unknown'
    changeType: 'created' | 'changed' | 'deleted'
  }
```

**Implementation details:**

- Single glob pattern: `**/.planning/**/*.md` and `**/.hunt/**/*.md`.
- The watcher classifies file URIs by matching against known filename patterns
  (e.g., `QRY-*.md` -> `'query'`, `RCT-*.md` -> `'receipt'`).
- Changes are **debounced at 300ms per-file** to coalesce rapid saves (e.g.,
  the CLI writing frontmatter then body in two passes).
- The watcher emits typed `ArtifactChangeEvent` objects, not raw URIs.
  Downstream consumers never need to classify files themselves.
- The debounce uses `Map<string, NodeJS.Timeout>` keyed by URI string to
  allow independent debounce windows per file.

### 2. Artifact Parser (`subsystems/parser.ts`)

Facade over per-artifact-type parsers. Each parser reads a file from disk,
extracts YAML frontmatter and Markdown body sections, and returns a typed
domain model object.

```
API Surface:
  class ArtifactParser {
    parseMission(uri: vscode.Uri): Promise<Mission>
    parseHypotheses(uri: vscode.Uri): Promise<Hypothesis[]>
    parseHuntmap(uri: vscode.Uri): Promise<Huntmap>
    parseState(uri: vscode.Uri): Promise<HuntState>
    parseQuery(uri: vscode.Uri): Promise<QueryLog>
    parseReceipt(uri: vscode.Uri): Promise<Receipt>
    parseEvidenceReview(uri: vscode.Uri): Promise<EvidenceReview>
    parseFindings(uri: vscode.Uri): Promise<Findings>
  }
```

**Parsing strategy:**

Frontmatter extraction uses the same approach as `frontmatter.cjs` in the CLI:
split on `---` boundaries, parse the YAML block with a lightweight parser. For
the extension we use the `yaml` package (3KB, no native deps) rather than
pulling in the full `js-yaml` library.

Markdown body sections are parsed with positional heading extraction -- walk
the Markdown AST (via `mdast-util-from-markdown`) looking for `## Heading`
boundaries, then extract content between headings as typed sections. This is
more robust than regex splitting.

**JSON block extraction (template clustering data):**

Query logs (`QRY-*.md`) contain embedded JSON code blocks with Drain
`reduceEvents` output. The parser extracts these by finding fenced code blocks
with the `json` language tag inside the `### Template Clustering` section,
then parses and validates against the expected shape:

```typescript
interface TemplateClustering {
  algorithm: 'drain'
  config: {
    depth: number
    similarity_threshold: number
    max_clusters: number | null
  }
  cluster_count: number
  clusters: TemplateCluster[]
  reduced_at: string  // ISO timestamp
}

interface TemplateCluster {
  template_id: string   // 16-char hex, e.g. "c7a1e3b2f9d04856"
  template: string      // e.g. "OAuth consent granted to app <UUID> by <EMAIL> from <IP>"
  count: number
  sample_event_id: string
  event_ids: string[]   // Capped at 100 per cluster
}
```

**Receipt anomaly framing extraction:**

Receipt files (`RCT-*.md`) contain structured anomaly framing sections. The
parser extracts:

```typescript
interface AnomalyFraming {
  entity: string
  baseline: BaselineProfile
  prediction: {
    expected_benign: string
    expected_malicious: string
    ambiguous: string
  }
  actual_event: string
  deviation: {
    category: 'EXPECTED_BENIGN' | 'EXPECTED_MALICIOUS' | 'AMBIGUOUS'
              | 'UNEXPECTED_BENIGN' | 'UNEXPECTED_MALICIOUS'
    base_score: number   // 1-6
    factors: Array<{ description: string; delta: number }>
    composite_score: number  // 1-6
  }
  pack_progression_match?: {
    step: string
    signal: string
  }
  what_would_change: string[]
}
```

### 3. State Store (`subsystems/store.ts`)

Reactive state container that derives hunt-level views from parsed artifacts.
This is the single source of truth for all UI components.

```
API Surface:
  class HuntStateStore implements vscode.Disposable {
    // Derived state
    readonly hunt: Hunt
    readonly hypotheses: Map<string, Hypothesis>
    readonly phases: Phase[]
    readonly queries: Map<string, QueryLog>
    readonly receipts: Map<string, Receipt>
    readonly templates: Map<string, TemplateCluster>
    readonly evidenceReview: EvidenceReview | null
    readonly findings: Findings | null

    // Cross-artifact indexes (built lazily)
    readonly hypothesisToReceipts: Map<string, string[]>
    readonly hypothesisToQueries: Map<string, string[]>
    readonly queryToReceipts: Map<string, string[]>
    readonly receiptToQueries: Map<string, string[]>
    readonly templateToQueries: Map<string, string[]>

    // Reactivity
    onDidChange: vscode.Event<StoreChangeEvent>

    // Operations
    invalidate(kind: ArtifactKind, uri: vscode.Uri): void
    getRelatedArtifacts(id: string): RelatedArtifacts
    dispose(): void
  }

  interface StoreChangeEvent {
    kind: ArtifactKind
    affectedIds: string[]
  }
```

**State derivation:**

The store subscribes to `ArtifactWatcher.onDidChange`. When an artifact
changes, it:

1. Calls `ArtifactParser.parse*()` for the changed file
2. Updates the relevant `Map` entry
3. Rebuilds affected cross-artifact indexes
4. Fires `onDidChange` with the affected artifact IDs

**Cross-artifact linking:**

The key insight of the THRUNT artifact model is that artifacts reference each
other by ID. Receipts declare `related_hypotheses` and `related_queries` in
their YAML frontmatter. Queries declare `related_hypotheses` and
`related_receipts`. The Evidence Review references queries and receipts.

The store builds bidirectional indexes from these references on first access
(lazy) and invalidates them when any artifact in the link set changes.

Example traversal: selecting HYP-01 in the sidebar should highlight:
- QRY-20260328-001 (references HYP-01 in frontmatter)
- RCT-20260328-001 (references HYP-01 in frontmatter)
- Template clusters from QRY-20260328-001 (transitively linked)

This traversal uses `hypothesisToReceipts` and `hypothesisToQueries` indexes.

### 4. Webview Bridge (`subsystems/bridge.ts`)

Type-safe message passing between the extension host and webview panels.

```
Message Protocol (extension host -> webview):

  { type: 'init', payload: { viewModel: T, theme: ThemeColors } }
  { type: 'update', payload: { viewModel: Partial<T> } }
  { type: 'highlight', payload: { ids: string[] } }
  { type: 'theme-changed', payload: { theme: ThemeColors } }

Message Protocol (webview -> extension host):

  { type: 'select', payload: { id: string, kind: ArtifactKind } }
  { type: 'navigate', payload: { uri: string } }
  { type: 'request-detail', payload: { id: string } }
  { type: 'export', payload: { format: 'png' | 'svg' | 'json' } }
```

**Implementation:**

```typescript
class WebviewBridge<TViewModel> implements vscode.Disposable {
  constructor(
    private panel: vscode.WebviewPanel,
    private store: HuntStateStore,
    private viewModelBuilder: (store: HuntStateStore) => TViewModel,
  )

  // Send full view model to webview
  sendInit(): void

  // Send partial update (delta)
  sendUpdate(delta: Partial<TViewModel>): void

  // Handle messages from webview
  private handleMessage(msg: WebviewMessage): void
}
```

The bridge subscribes to `HuntStateStore.onDidChange` and rebuilds the
relevant portion of the view model when state changes, then sends an `update`
message to the webview with only the delta. This avoids serializing the full
view model on every file change.

Cross-panel communication (e.g., selecting a hypothesis in the sidebar
highlights related nodes in the evidence graph) flows through the store:

```
  Sidebar TreeView
    -> vscode.commands.executeCommand('thruntGod.selectArtifact', id)
    -> store.setSelection(id)
    -> store fires onDidChange with kind: 'selection'
    -> all bridges rebuild their highlight set
    -> each webview receives { type: 'highlight', payload: { ids } }
```

---

## UI Components

### Activity Bar: Hunt Sidebar

A `TreeDataProvider<HuntTreeItem>` registered as a view in a dedicated
`thruntGod` viewContainer (Activity Bar icon).

```
  THRUNT God  (Activity Bar icon: shield + magnifying glass)
  ├── Mission: OAuth Phishing Campaign
  │   ├── Status: Ready to publish
  │   ├── Scope: 2026-03-25 -- 2026-03-28 (72h)
  │   └── Entities: 3
  ├── Hypotheses
  │   ├── HYP-01 [Supported]  (green check)
  │   ├── HYP-02 [Supported]  (green check)
  │   └── HYP-03 [Disproved]  (red X)
  ├── Phases
  │   ├── Phase 1: Signal Intake [Complete]   (1/1 plans)
  │   ├── Phase 2: Telemetry Collection [Complete]   (1/1 plans)
  │   └── Phase 3: Evidence Correlation [Complete]   (1/1 plans)
  ├── Queries
  │   ├── QRY-20260328-001  (312 events, 4 templates)
  │   ├── QRY-20260328-002  (23 events, 2 templates)
  │   └── QRY-20260328-003  (847 events, 3 templates)
  ├── Receipts
  │   ├── RCT-20260328-001  [score: 5 HIGH]  (deviation badge)
  │   ├── RCT-20260328-002  [score: 5 HIGH]
  │   └── RCT-20260328-003  [Disproves HYP-03]
  └── Evidence Review
      └── Publishability: Ready to publish
```

**Tree node types:**

- Section headers (Mission, Hypotheses, etc.) are non-clickable group nodes
- Artifact nodes are clickable: single-click reveals the `.md` file in editor;
  double-click opens the associated webview panel (e.g., double-clicking a
  query opens the Drain Template Viewer for that query)
- Deviation score badges use `TreeItem.iconPath` with inline SVG or theme
  icons colored by score (1-2: grey, 3-4: yellow, 5-6: red)

**Refresh strategy:**

The tree provider subscribes to `HuntStateStore.onDidChange` and calls
`TreeDataProvider.onDidChangeTreeData.fire()` for affected subtrees. This
gives VS Code's tree view the opportunity to diff and re-render only the
changed nodes.

### Webview Panel: Drain Template Viewer

Displays template clustering results from a single query's `reduceEvents` output.

**Layout:**

```
  ┌─────────────────────────────────────────────────────────────┐
  │  QRY-20260328-001 -- M365 Identity Sign-In and Consent      │
  │  312 events -> 4 templates (Drain, simTh=0.4)              │
  ├───────────────────────────┬─────────────────────────────────┤
  │                           │                                 │
  │   TREEMAP                 │   CLUSTER DETAIL                │
  │                           │                                 │
  │  ┌──────────────────────┐ │   Template:                     │
  │  │ Sign-in to <*> from  │ │   "OAuth consent granted to     │
  │  │ <IP> -- result: <*>  │ │    app <UUID> by <EMAIL>        │
  │  │        198            │ │    from <IP>"                   │
  │  ├─────────┬────────────┤ │                                 │
  │  │ Failed  │OAuth       │ │   Count: 47                     │
  │  │ sign-in │consent     │ │   Template ID: c7a1e3b2f9d04856│
  │  │ for     │granted to  │ │   Mask tokens: <UUID> <EMAIL>  │
  │  │ <EMAIL> │app <UUID>  │ │                <IP>             │
  │  │   52    │  47        │ │                                 │
  │  ├─────────┼────────────┤ │   Sample event:                │
  │  │ Token refresh for    │ │     evt-m365-id-00147           │
  │  │ app <UUID> from <IP> │ │                                 │
  │  │         15            │ │   Related receipts:            │
  │  └──────────────────────┘ │     RCT-20260328-001            │
  │                           │     RCT-20260328-003            │
  │                           │                                 │
  ├───────────────────────────┴─────────────────────────────────┤
  │  TEMPLATE TABLE (sortable by count, template text)         │
  │  ┌──────┬────────────────────────────────────┬───────┬───┐ │
  │  │  #   │ Template                           │ Count │ % │ │
  │  ├──────┼────────────────────────────────────┼───────┼───┤ │
  │  │  1   │ Sign-in to <*> from <IP> -- ...    │  198  │63%│ │
  │  │  2   │ Failed sign-in for <EMAIL> -- ...  │   52  │17%│ │
  │  │  3   │ OAuth consent granted to app ...   │   47  │15%│ │
  │  │  4   │ Token refresh for app <UUID> ...   │   15  │ 5%│ │
  │  └──────┴────────────────────────────────────┴───────┴───┘ │
  └─────────────────────────────────────────────────────────────┘
```

**Interactions:**

- Click a treemap cell or table row to select a cluster (populates detail pane)
- Mask tokens (`<IP>`, `<UUID>`, etc.) are rendered as colored pills
- Selecting a cluster fires `{ type: 'select', payload: { id: template_id } }`
  which propagates through the store to highlight related receipts/hypotheses
  in other panels

### Webview Panel: Evidence Graph

Directed acyclic graph showing the relationship topology between hypotheses,
queries, receipts, and findings.

**Node types and visual encoding:**

```
  Hypothesis nodes:   rounded rectangle, colored by verdict
                      Supported = green, Disproved = red, Inconclusive = yellow
  Query nodes:        diamond, labeled with query_id + event count
  Receipt nodes:      hexagon, border color by deviation score (1-6 scale)
  Template nodes:     small circle, labeled with template_id prefix (4 chars)
  Finding node:       star, single central node
```

**Edge types:**

```
  Hypothesis  --tests-->   Query          (from related_hypotheses in QRY frontmatter)
  Query       --produces-->  Receipt      (from related_queries in RCT frontmatter)
  Receipt     --supports-->  Hypothesis   (from related_hypotheses in RCT frontmatter)
  Receipt     --disproves--> Hypothesis   (claim_status = disproves, dashed line)
  Query       --clusters-->  Template     (from template clustering data)
  Finding     --cites-->     Receipt      (from hypothesis verdicts in FINDINGS.md)
```

**Layout algorithm:**

D3 `d3-force` with custom forces:
- Hypotheses pinned to left column
- Queries in center column
- Receipts in right column
- Templates as satellite nodes around their parent query
- Force collision to prevent overlap
- Finding node centered at top

**Interactions:**

- Click a node to select it (detail pane + cross-panel highlight)
- Hover shows tooltip with artifact summary
- Drag to reposition nodes (positions not persisted)
- Zoom/pan with scroll/drag
- Double-click opens the artifact's `.md` file in the editor

### Webview Panel: Multi-Source Timeline

Horizontal time-axis view showing entity timelines across multiple data sources,
as documented in the `### Entity Timeline` sections of query logs.

**Layout:**

```
  Time axis (horizontal)
  2026-03-25                    2026-03-27                    2026-03-28
  |                             |                             |
  sarah.chen (Entra ID)  ──●──●────────────●──●────────●──●──▲──▲──▲──●──
  sarah.chen (Okta)      ──●──●────────────●──●────────●─────────────────
  james.wu   (Entra ID)  ──●──●──●──●──●──●──●──●──●──●──●──●──●──●──●──
  james.wu   (Okta)      ──●──●──●──●──●──●──●──●──●──●──●──●──●──●──●──
  maria.garcia (Entra)   ──●──●──●──●──●──●──●──●──●──●──●──●──●──●──●──

  Legend:  ● = baseline event   ▲ = anomalous event (deviation score > 0)
```

**Anomaly markers:**

Events referenced by receipts with deviation scores are rendered as triangles
instead of circles, colored by composite score:
- Score 1-2: grey (EXPECTED_BENIGN / UNEXPECTED_BENIGN)
- Score 3-4: amber (AMBIGUOUS / low EXPECTED_MALICIOUS)
- Score 5-6: red (high EXPECTED_MALICIOUS / UNEXPECTED_MALICIOUS)

**Interactions:**

- Click an event marker to see the event detail popover
- Anomaly markers show the receipt's prediction vs. actual framing
- Zoom time axis with scroll wheel; pan with click-drag
- Brush selection to zoom into a time range

### Editor Decorations

**CodeLens on Receipts:**

The `CodeLensProvider` scans open `.md` files matching `RCT-*.md`. For each
receipt, it places a CodeLens above the `## Anomaly Framing` heading showing:

```
  Deviation: 5 (HIGH) | Category: EXPECTED_MALICIOUS | View in Graph
```

The "View in Graph" lens opens the Evidence Graph panel and selects this receipt.

**CodeLens on Queries:**

For `QRY-*.md` files, a CodeLens above `### Template Clustering` shows:

```
  4 templates from 312 events | Open Drain Viewer
```

**Gutter Badges:**

For open receipt files, gutter decorations mark lines in the `### Deviation
Assessment` section:
- Base score line: colored circle (score-based color)
- Factor lines: colored delta indicators (+1, -1)
- Composite score line: larger colored badge

**Diagnostic Warnings:**

A `DiagnosticCollection` named `thruntGod` surfaces evidence quality issues
discovered by parsing the Evidence Review:

- `Warning`: Check status `Fail` in Evidence Quality Checks table
- `Information`: Items listed under `Follow-Up Needed`
- `Error`: False completion (status `complete` with pending items)

These appear in the Problems panel and as squiggly underlines in the
EVIDENCE_REVIEW.md file.

### Status Bar

A `StatusBarItem` on the left side showing hunt progress:

```
  $(shield) THRUNT: Phase 3/3 -- Ready to publish
```

- Icon: `$(shield)` (VS Code codicon)
- Text: current phase and status from STATE.md
- Click: opens the Activity Bar sidebar
- Tooltip: hunt title from MISSION.md
- Color: green when complete, yellow when active, red when blocked

---

## Data Flow

### File Change to UI Re-render Pipeline

```
  .planning/QUERIES/QRY-20260328-001.md    (file saved by CLI)
      │
      ▼
  FileSystemWatcher.onDidChange
      │
      ▼
  ArtifactWatcher                          (debounce 300ms, classify)
      │  emits ArtifactChangeEvent { kind: 'query', uri }
      ▼
  HuntStateStore.invalidate('query', uri)
      │  1. Calls parser.parseQuery(uri)
      │  2. Updates queries Map
      │  3. Rebuilds queryToReceipts index
      │  4. Fires onDidChange { kind: 'query', affectedIds: ['QRY-20260328-001'] }
      ▼
  Subscribers react:
      ├── HuntTreeProvider.onDidChangeTreeData.fire()
      │     -> VS Code diffs tree, re-renders Queries subtree
      ├── DrainTemplateViewer bridge
      │     -> Rebuilds view model for this query
      │     -> Sends { type: 'update', payload: { clusters, stats } }
      │     -> React diffs and re-renders treemap
      ├── EvidenceGraph bridge
      │     -> Rebuilds graph model (query node may have new template children)
      │     -> Sends { type: 'update', payload: { nodes, edges } }
      ├── CodeLensProvider.onDidChangeCodeLenses.fire()
      │     -> VS Code refreshes CodeLens for open QRY-*.md editors
      └── StatusBar
            -> No change (status comes from STATE.md, not queries)
```

### Webview Panel Lifecycle

```
  Panel Creation:
    1. User invokes command (e.g., THRUNT: Open Drain Viewer)
    2. extension.ts creates WebviewPanel via vscode.window.createWebviewPanel()
    3. panel-base.ts sets webview HTML (bundled React app)
    4. WebviewBridge is created, subscribes to store
    5. Bridge sends { type: 'init', payload: { viewModel, theme } }
    6. React app renders initial state

  Panel Serialization (user closes and reopens VS Code):
    1. WebviewPanelSerializer.deserializeWebviewPanel() is called
    2. Restores panel from serialized state (panel type + artifact ID)
    3. Re-creates WebviewBridge
    4. Sends fresh { type: 'init' } from current store state

  Panel Disposal:
    1. User closes panel tab
    2. WebviewBridge.dispose() unsubscribes from store
    3. Panel resources are freed
    4. Store continues running (other panels may still need it)
```

### Cross-Panel Communication

All cross-panel coordination flows through the store's selection state:

```
  User clicks HYP-01 in TreeView sidebar
      │
      ▼
  TreeView.onDidChangeSelection
      │  calls store.setSelection({ kind: 'hypothesis', id: 'HYP-01' })
      ▼
  Store computes related artifact IDs:
      │  - Queries:  ['QRY-20260328-001', 'QRY-20260328-003']
      │  - Receipts: ['RCT-20260328-001', 'RCT-20260328-003']
      │  - Templates: ['c7a1e3b2f9d04856', '8f2d6a4e1b7c3950', ...]
      │
      ▼  fires onDidChange { kind: 'selection' }
      │
  All bridges receive the event:
      ├── DrainTemplateViewer
      │     -> sends { type: 'highlight', payload: { ids: [template IDs] } }
      │     -> React highlights related treemap cells
      ├── EvidenceGraph
      │     -> sends { type: 'highlight', payload: { ids: [all related] } }
      │     -> D3 highlights connected subgraph, dims unrelated nodes
      └── Timeline
            -> sends { type: 'highlight', payload: { ids: [event IDs from receipts] } }
            -> Highlighted events pulse on the timeline
```

---

## Domain Model

All domain types derived from the actual THRUNT artifact formats. These are
the TypeScript interfaces that parsers produce and the store manages.

```typescript
// ── Hunt-level artifacts ──

interface Hunt {
  title: string                    // from MISSION.md H1
  mode: 'case' | 'program'
  opened: string                   // ISO date
  owner: string
  status: string
  signal: string                   // "## Signal" section body
  desiredOutcome: string
  scope: HuntScope
  workingTheory: string
  keyDecisions: KeyDecision[]
}

interface HuntScope {
  timeWindow: { start: string; end: string }  // ISO timestamps
  entities: string[]
  environment: string
  prioritySurfaces: string[]
}

interface KeyDecision {
  decision: string
  reason: string
  date: string
}

interface Hypothesis {
  id: string                       // "HYP-01"
  title: string
  signal: string
  assertion: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  scope: string
  dataSources: string[]
  evidenceNeeded: string[]
  disproofCondition: string
  confidence: string
  status: 'Active' | 'Supported' | 'Disproved' | 'Parked' | 'Inconclusive'
  relatedReceipts: string[]        // populated by store cross-index
  relatedQueries: string[]         // populated by store cross-index
}

// ── Phase-level artifacts ──

interface Huntmap {
  title: string
  overview: string
  phases: HuntmapPhase[]
}

interface HuntmapPhase {
  number: number
  name: string
  goal: string
  dependsOn: number[]
  operations: string
  receiptsRequired: string
  successCriteria: string[]
  plans: HuntmapPlan[]
  status: 'Complete' | 'Active' | 'Pending'
}

interface HuntmapPlan {
  id: string                       // "01-01"
  description: string
  status: 'complete' | 'active' | 'pending'
}

interface HuntState {
  phaseNumber: number
  phaseName: string
  totalPhases: number
  planCurrent: number
  planTotal: number
  status: string
  lastActivity: string
  progressPercent: number
  blockers: string[]
  dataSources: string[]
  confidence: string
}

// ── Query artifacts ──

interface QueryLog {
  // From YAML frontmatter
  queryId: string                  // "QRY-20260328-001"
  querySpecVersion: string         // "1.0"
  source: string                   // "Identity"
  connectorId: string              // "m365"
  dataset: string                  // "identity"
  executedAt: string               // ISO timestamp
  author: string
  relatedHypotheses: string[]      // ["HYP-01", "HYP-03"]
  relatedReceipts: string[]        // ["RCT-20260328-001", ...]
  contentHash: string
  manifestId: string

  // From Markdown body
  intent: string
  queryText: string                // raw query/procedure text
  parameters: Record<string, string>
  runtimeMetadata: QueryRuntimeMetadata
  datasetDefaults: DatasetDefaults
  resultSummary: string            // "events=312, templates=4, entities=3"

  // Extracted from JSON code block
  templateClustering: TemplateClustering | null

  // Extracted from entity timeline tables
  entityTimelines: EntityTimeline[]
}

interface QueryRuntimeMetadata {
  profile: string
  paginationMode: string
  paginationLimit: number
  maxPages: number
  timeoutMs: number
  consistency: string
  resultStatus: string
  warningCount: number
  errorCount: number
}

interface DatasetDefaults {
  datasetKind: string              // 'identity' | 'endpoint' | 'alerts' | ...
  paginationLimit: number
  maxPages: number
  timeoutMs: number
}

// ── Template clustering (from Drain reduceEvents output) ──

interface TemplateClustering {
  algorithm: 'drain'
  config: DrainConfig
  clusterCount: number
  clusters: TemplateCluster[]
  reducedAt: string
}

interface DrainConfig {
  depth: number                    // default 4, min 3
  similarityThreshold: number      // default 0.4
  maxClusters: number | null       // null = unlimited
}

interface TemplateCluster {
  templateId: string               // 16 hex chars: content-hash of template text
  template: string                 // "Failed sign-in for <EMAIL> -- error: <*>"
  count: number
  sampleEventId: string
  eventIds: string[]               // capped at 100
  maskTokens: string[]             // extracted: ['<EMAIL>', '<*>']
  parentQueryId: string            // back-reference to containing query
}

// ── Receipt artifacts ──

interface Receipt {
  // From YAML frontmatter
  receiptId: string                // "RCT-20260328-001"
  querySpecVersion: string
  createdAt: string
  source: string
  connectorId: string
  dataset: string
  resultStatus: string
  claimStatus: 'supports' | 'disproves' | 'inconclusive'
  relatedHypotheses: string[]
  relatedQueries: string[]
  contentHash: string
  manifestId: string

  // From Markdown body
  claim: string                    // "## Claim" section
  evidence: string                 // "## Evidence" section (raw text)

  // Structured anomaly framing
  anomalyFraming: AnomalyFraming | null

  // Chain of custody
  chainOfCustody: ChainOfCustody
  confidence: string
  notes: string
}

interface AnomalyFraming {
  entity: string
  baseline: {
    typicalLocations: string[]
    typicalHours: string
    knownDevices: string[]
    normalApps: string[]
    mfaMethod: string
    admin: boolean
    priorHistory: string[]
  }
  prediction: {
    expectedBenign: string
    expectedMalicious: string
    ambiguous: string
  }
  actualEvent: string
  deviation: DeviationAssessment
  packMatch: PackProgressionMatch | null
  whatWouldChange: string[]
}

interface DeviationAssessment {
  category: 'EXPECTED_BENIGN' | 'EXPECTED_MALICIOUS' | 'AMBIGUOUS'
            | 'UNEXPECTED_BENIGN' | 'UNEXPECTED_MALICIOUS'
  baseScore: number                // 1-6
  factors: Array<{
    description: string
    delta: number                  // typically +1 or -1
  }>
  compositeScore: number           // 1-6, clamped
}

interface PackProgressionMatch {
  progressionName: string          // "phish-to-consent-to-takeover"
  step: number
  technique: string                // "T1078"
  signal: string                   // "oauth_app_grant"
}

interface ChainOfCustody {
  collectedBy: string
  collectionPath: string
  identifiers: Record<string, string>
  timeObserved: string
}

// ── Evidence Review ──

interface EvidenceReview {
  publishabilityVerdict: string
  qualityChecks: QualityCheck[]
  antiPatterns: AntiPatternCheck[]
  clusteringIntegrity: ClusteringIntegrityCheck[]
  packProgressionVerification: PackProgressionStep[]
  contradictoryEvidence: string
  blindSpots: string[]
  followUpNeeded: string[]
}

interface QualityCheck {
  name: string
  status: 'Pass' | 'Fail'
  notes: string
}

interface AntiPatternCheck {
  pattern: string                  // "Post-hoc rationalization"
  status: 'Pass' | 'Fail'
  details: string
}

interface ClusteringIntegrityCheck {
  queryId: string
  eventCount: number
  templateCount: number
  valid: boolean
  notes: string
}

interface PackProgressionStep {
  step: string
  technique: string
  expectedSignal: string
  actualSignal: string
  match: boolean
}

// ── Entity Timeline ──

interface EntityTimeline {
  entity: string                   // "sarah.chen@acme.corp"
  source: string                   // "Entra ID"
  events: TimelineEvent[]
}

interface TimelineEvent {
  index: number
  timestamp: string                // ISO
  source: string
  eventType: string
  detail: string
  isAnomalous: boolean             // true if referenced by a receipt
  receiptId: string | null         // receipt that references this event
  deviationScore: number | null    // from the receipt's composite score
}

// ── Findings ──

interface Findings {
  executiveSummary: string
  hypothesisVerdicts: HypothesisVerdict[]
  impactedScope: string
  whatWeKnow: string[]
  whatWeDoNotKnow: string[]
  recommendedActions: string[]
}

interface HypothesisVerdict {
  hypothesisId: string
  verdict: 'Supported' | 'Disproved' | 'Inconclusive'
  confidence: string
  evidence: string[]               // receipt/query IDs
}
```

---

## Technology Choices

### TypeScript + esbuild

The extension host code and webview code are both TypeScript. Two separate
esbuild entry points produce:

1. `dist/extension.js` -- CJS bundle for the extension host (Node.js)
2. `dist/webview-drain.js`, `dist/webview-graph.js`, `dist/webview-timeline.js`
   -- ESM bundles for each webview panel

esbuild is chosen over webpack for build speed (sub-second builds, critical
for extension development iteration). Tree-shaking eliminates unused code.

### Webview Framework: React

**Chosen: React (with Preact compatibility alias for bundle size)**

Rationale:
- The webview panels contain interactive data visualizations that benefit
  from a component model with state management. Vanilla JS would require
  reimplementing diffing, event delegation, and state propagation.
- Svelte produces smaller bundles but has weaker D3 integration ergonomics --
  D3 wants to own the DOM for SVG manipulation, which conflicts with Svelte's
  compiler-driven DOM updates.
- React's `useRef` + `useEffect` pattern is the established way to host D3
  visualizations inside a component tree. The React component owns the
  container; D3 owns the SVG inside it.
- Using Preact as a production alias (`{ 'react': 'preact/compat' }` in
  esbuild) keeps the framework overhead under 4KB gzipped while maintaining
  full React API compatibility.

### Visualization: D3

**Chosen: D3 (modular imports)**

Rationale:
- The three webview panels need: treemap layout (Drain viewer), force-directed
  graph (evidence DAG), and time-axis with swim lanes (timeline). D3 handles
  all three natively.
- ECharts and vis.js are higher-level charting libraries optimized for
  standard chart types (bar, line, pie). The evidence graph is a custom DAG
  with heterogeneous node types, which D3's primitives handle cleanly.
- vis.js/vis-network could handle the graph panel but cannot handle the
  treemap or timeline without a second library. D3 covers all three.
- Modular D3 imports (`d3-force`, `d3-scale`, `d3-selection`, `d3-hierarchy`,
  `d3-time`, `d3-zoom`) keep bundle size manageable (~40KB gzipped for the
  used modules).

### Markdown Parsing: mdast-util-from-markdown + yaml

**Chosen: `mdast-util-from-markdown` + `yaml`**

Rationale:
- The `remark` ecosystem (`remark-parse` -> `mdast`) is the standard for
  Markdown AST manipulation in the JS ecosystem. It handles GFM tables
  (needed for evidence quality check tables), fenced code blocks (needed
  for JSON extraction), and YAML frontmatter via `mdast-util-frontmatter`.
- The `yaml` package (successor to `js-yaml`) is 3KB and handles all YAML
  the CLI produces in frontmatter blocks.
- Alternatives: `marked` is simpler but produces HTML strings, not an AST.
  We need AST-level access to extract specific sections by heading and parse
  table structures into typed data.

---

## Performance Considerations

### Lazy Parsing

```
  Activation:
    Parse: MISSION.md, STATE.md, HUNTMAP.md, HYPOTHESES.md
    Skip: all queries, receipts, evidence review, findings

  Sidebar expand "Queries":
    Parse: QRY-*.md frontmatter only (for query_id, event count)
    Skip: QRY-*.md body (template clustering, entity timelines)

  Open Drain Viewer for QRY-20260328-001:
    Parse: full QRY-20260328-001.md body (template clustering JSON)
    Skip: other QRY-*.md bodies

  Open Evidence Graph:
    Parse: all QRY-*.md and RCT-*.md frontmatter (for link topology)
    Skip: body sections unless a node is selected
```

This is implemented via a two-level parse cache in the store:

```typescript
interface ParsedArtifact<T> {
  frontmatter: T['frontmatter']       // always parsed
  body: T['body'] | null               // null = not yet parsed
  fullParseRequested: boolean
  lastModified: number                 // fs.stat mtime
}
```

When a UI component needs body data, it calls `store.ensureFullParse(id)`,
which triggers the body parse if not already cached.

### Virtual Scrolling

The template table in the Drain Viewer and the event list in the Timeline
use windowed rendering. For hunts with 50+ templates or 1000+ timeline events,
only the visible rows are rendered. This uses a simple `IntersectionObserver`-
based virtual list rather than a heavy virtualization library.

### Webview Panel Disposal

When a webview panel is hidden (user switches to another tab), it remains
in memory. When disposed (user closes the tab), the WebviewBridge unsubscribes
from the store and all webview resources are freed. The panel can be
re-created from scratch via the command palette or sidebar interaction.

Serialization state is minimal: just the panel type and the artifact ID being
viewed (e.g., `{ type: 'drain-viewer', queryId: 'QRY-20260328-001' }`). On
restore, the full view model is rebuilt from the store.

### Memory Budget

Target: a hunt with 50 queries (avg 500 events each, 5 templates each) and
100 receipts should consume under 50MB of extension host memory.

Breakdown:
- Parsed frontmatter for 150 artifacts: ~2MB
- Full body parse cache (10 recently viewed artifacts): ~5MB
- Template clustering data (50 queries * 5 clusters): ~1MB
- Cross-artifact indexes: ~500KB
- Webview view models (3 panels): ~3MB per panel

If memory pressure is detected (via `process.memoryUsage()`), the store evicts
body parse caches using LRU ordering. Frontmatter caches are never evicted.

### File Watching Scalability

The `FileSystemWatcher` glob pattern watches the entire `.planning/` tree.
For hunts with hundreds of files, this is fine -- VS Code's watcher uses
OS-native mechanisms (FSEvents on macOS, inotify on Linux) that handle
thousands of watched paths efficiently.

The debounce-per-file strategy (300ms per URI, independent timers) prevents
thundering herd on bulk CLI writes (e.g., a hunt phase producing 10 queries
in rapid succession). Each query's parse is independent and fires its own
UI update.

---

## Extension Manifest Sketch

```jsonc
{
  "name": "thrunt-god",
  "displayName": "THRUNT God",
  "description": "Threat hunting investigation visualization layer",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Visualization", "Other"],

  "activationEvents": [
    "workspaceContains:.planning/MISSION.md",
    "workspaceContains:.planning/HUNTMAP.md",
    "workspaceContains:.hunt/MISSION.md",
    "workspaceContains:.hunt/HUNTMAP.md"
  ],

  "main": "./dist/extension.js",

  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "thruntGod",
          "title": "THRUNT God",
          "icon": "assets/shield-search.svg"
        }
      ]
    },

    "views": {
      "thruntGod": [
        {
          "id": "thruntGod.huntTree",
          "name": "Hunt",
          "type": "tree"
        }
      ]
    },

    "commands": [
      {
        "command": "thruntGod.openDrainViewer",
        "title": "THRUNT: Open Drain Template Viewer",
        "icon": "$(layers)"
      },
      {
        "command": "thruntGod.openEvidenceGraph",
        "title": "THRUNT: Open Evidence Graph",
        "icon": "$(type-hierarchy)"
      },
      {
        "command": "thruntGod.openTimeline",
        "title": "THRUNT: Open Multi-Source Timeline",
        "icon": "$(timeline-open)"
      },
      {
        "command": "thruntGod.selectArtifact",
        "title": "THRUNT: Select Artifact"
      },
      {
        "command": "thruntGod.openArtifactFile",
        "title": "THRUNT: Open Artifact File"
      },
      {
        "command": "thruntGod.refreshHunt",
        "title": "THRUNT: Refresh Hunt State",
        "icon": "$(refresh)"
      },
      {
        "command": "thruntGod.exportView",
        "title": "THRUNT: Export Current View"
      },
      {
        "command": "thruntGod.navigateToReceipt",
        "title": "THRUNT: Go to Receipt"
      },
      {
        "command": "thruntGod.navigateToQuery",
        "title": "THRUNT: Go to Query"
      }
    ],

    "menus": {
      "view/title": [
        {
          "command": "thruntGod.refreshHunt",
          "when": "view == thruntGod.huntTree",
          "group": "navigation"
        },
        {
          "command": "thruntGod.openEvidenceGraph",
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
          "group": "inline"
        }
      ],
      "commandPalette": [
        {
          "command": "thruntGod.selectArtifact",
          "when": "false"
        }
      ]
    },

    "configuration": {
      "title": "THRUNT God",
      "properties": {
        "thruntGod.planningDirectory": {
          "type": "string",
          "default": ".planning",
          "description": "Relative path to the hunt artifacts directory"
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
        },
        "thruntGod.timeline.maxEvents": {
          "type": "number",
          "default": 5000,
          "description": "Maximum events to render in timeline view"
        },
        "thruntGod.drainViewer.treemapEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Show treemap visualization in Drain Template Viewer"
        }
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Parsers** -- Each artifact parser gets a test suite with fixture files
(copied from `thrunt-god/examples/`). Tests verify:

- YAML frontmatter extraction (all fields typed correctly)
- Markdown section extraction (headings, tables, code blocks)
- JSON code block parsing (template clustering data)
- Edge cases: missing sections, malformed YAML, empty files
- Round-trip: parsed model can reconstruct key fields

**Store** -- State derivation and cross-artifact indexing:

- Adding a query updates `hypothesisToQueries` index
- Invalidating a receipt triggers re-index
- Selection propagation computes correct related artifact sets
- LRU cache eviction under memory pressure

**Domain model validation:**

- Receipt deviation scores are clamped to 1-6
- Template IDs match 16-hex-char pattern
- Hypothesis statuses are valid enum values

### Integration Tests

**Watcher + Parser + Store pipeline:**

Use VS Code's `vscode-test` runner to spin up an extension host with a
temporary workspace containing fixture artifacts. Verify:

- File creation triggers parse and store update
- File modification triggers re-parse with correct delta
- File deletion removes artifact from store and re-indexes
- Debounce coalesces rapid changes into single parse

**Webview Bridge messaging:**

Mock `WebviewPanel.webview.postMessage` and verify:

- `init` message contains complete view model
- `update` message contains correct delta after store change
- `highlight` message contains correct related IDs after selection
- Messages from webview (select, navigate) trigger correct store/command calls

### Webview Component Tests

**React components** tested with `@testing-library/react`:

- TemplateTreemap renders correct number of cells for cluster data
- TemplateTable sorts by count and template text
- EvidenceDAG renders correct node/edge counts
- TimelineCanvas positions events at correct x-coordinates
- Anomaly markers use correct color for deviation scores

### Snapshot Tests

Webview HTML output for known fixture data is snapshot-tested to catch
unintended visual regressions.

---

## Future Considerations

### Multi-Root Workspace Support

If the workspace has multiple folders, each may contain its own `.planning/`
directory. The store should support multiple hunt contexts, with the sidebar
showing a top-level workspace folder selector.

### Live CLI Integration

A future version could subscribe to the CLI's stdout via a terminal profile
contribution, parsing progress events in real-time during `/hunt:run`
execution. This would show live query execution status in the sidebar and
animate template clusters appearing as events stream in.

### Collaborative Hunts

If the `.planning/` directory is in a git repo, the extension could show a
"diff since last commit" overlay on the evidence graph, highlighting
newly-added artifacts. Combined with VS Code's built-in git support, this
enables reviewing a teammate's hunt additions.

### Detection Engineering Bridge

Receipts with high deviation scores and confirmed hypotheses are candidates
for production detection rules. A future panel could generate Sigma rule
stubs from receipt anomaly framing, pre-populated with the entity types,
data sources, and deviation conditions documented in the receipt.

### Pack Library Browser

A read-only browser for installed packs (`thrunt-god/packs/`), showing
expected progressions, scoring rubrics, and which hunts have used each pack.
This helps hunters select the right pack before starting a new hunt.
