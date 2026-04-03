# Architecture Review: ARCHITECTURE.md vs DATA-MODELS.md

Reviewer: Senior Staff Engineer
Date: 2026-04-02
Status: **Blocking issues found -- do not start implementation until resolved**

---

## 1. Contradictions

### 1.1 The Hunt vs Mission Identity Crisis

ARCHITECTURE.md defines the top-level domain object as `Hunt`, which flattens Mission fields directly into it:

```typescript
// ARCHITECTURE.md line ~758
interface Hunt {
  title: string          // from MISSION.md H1
  mode: 'case' | 'program'
  opened: string
  owner: string
  status: string
  signal: string
  ...
}
```

DATA-MODELS.md defines `Hunt` as a container that *holds* a `Mission` as a nested object:

```typescript
// DATA-MODELS.md line ~38
interface Hunt {
  rootPath: string;
  mission: Mission;
  hypotheses: Hypothesis[];
  huntMap: HuntMap;
  ...
}
```

These are fundamentally different shapes. Every consumer of the Hunt type -- store, bridge, webview -- will break depending on which definition wins. The DATA-MODELS approach is correct (composition over flattening), but every ARCHITECTURE.md reference to `hunt.title` or `hunt.signal` is written against the flattened shape.

**Fix:** Delete the `Hunt` interface from ARCHITECTURE.md's Domain Model section entirely. Add a cross-reference: "See DATA-MODELS.md section 1.2 for the canonical Hunt interface." The architecture doc should describe *behavior*, not re-declare types.

### 1.2 Hypothesis Status Casing

ARCHITECTURE.md uses title-case statuses:

```typescript
status: 'Active' | 'Supported' | 'Disproved' | 'Parked' | 'Inconclusive'
```

DATA-MODELS.md uses lowercase:

```typescript
type HypothesisStatus = 'active' | 'supported' | 'disproved' | 'parked' | 'inconclusive';
```

Meanwhile the Zod schema in DATA-MODELS.md validates lowercase. But the actual HYPOTHESES.md artifact files (from the examples) use section headers like "## Supported Hypotheses" -- title case.

**Fix:** Canonicalize to lowercase in code (as DATA-MODELS.md does). The parser must lowercase on read. Add a note to the parser spec: "Status is derived from section header, lowercased."

### 1.3 Phase Status Casing (same problem)

ARCHITECTURE.md: `'Complete' | 'Active' | 'Pending'`
DATA-MODELS.md: `'pending' | 'in_progress' | 'complete'`

Worse, the *values* disagree: ARCHITECTURE uses `'Active'` while DATA-MODELS uses `'in_progress'`. These are semantically different concepts depending on whether you mean "someone is working on this right now" vs "this phase has started."

**Fix:** Use DATA-MODELS.md's `'pending' | 'in_progress' | 'complete'` as canonical. Update ARCHITECTURE.md's `HuntmapPhase.status` to match.

### 1.4 HuntmapPhase.dependsOn Type Mismatch

ARCHITECTURE.md: `dependsOn: number[]` (array of phase numbers)
DATA-MODELS.md: `dependsOn: string | null` (single string, nullable)

These are wildly different. The huntmap format uses `**Depends on:** Phase 1` as a single string field. An array of phase numbers is a parse-time derivation.

**Fix:** The raw parsed model should use `dependsOn: string | null` (what's in the file). If the architecture wants a derived numeric array for graph edges, add a separate `dependsOnPhases: number[]` computed field and document the parsing rule.

### 1.5 QueryLog vs Query Naming

ARCHITECTURE.md calls it `QueryLog` throughout (parser method `parseQuery` returns `QueryLog`, store holds `Map<string, QueryLog>`).
DATA-MODELS.md calls the same thing `Query`.

This will cause import confusion across every file that touches queries.

**Fix:** Pick one name. `Query` is simpler and what the artifact is called (`QRY-*`). Use `Query` everywhere. `QueryLog` is the *format* (it's a log of a query execution), but the domain object should be `Query`.

### 1.6 AnomalyFraming vs AnomalyFrame Naming

ARCHITECTURE.md: `AnomalyFraming` (with fields like `baseline` as a nested object with different subfields)
DATA-MODELS.md: `AnomalyFrame` (with `EntityBaseline`, `AnomalyPrediction`, `DeviationScore` as named subtypes)

The internal structure also disagrees:

- ARCHITECTURE.md `DeviationAssessment.baseScore`: 1-6 range
- DATA-MODELS.md Zod `DeviationScoreSchema.baseScore`: `z.number().int().min(0).max(5)` -- that's 0-5, not 1-6

The composite score range also disagrees:
- ARCHITECTURE.md: "1-6, clamped"
- DATA-MODELS.md Zod: `z.number().int().min(0).max(10)` -- 0-10

The receipt markdown examples show scores like "5" labeled "HIGH", which matches a 1-6 scale. The Zod schema is wrong.

**Fix:** Settle on 1-6 for both base and composite scores. Update the Zod schema: `baseScore: z.number().int().min(1).max(6)`, `compositeScore: z.number().int().min(1).max(6)`. Name the type `AnomalyFrame` consistently.

### 1.7 DeviationCategory Value Mismatch

ARCHITECTURE.md defines five categories:

```
'EXPECTED_BENIGN' | 'EXPECTED_MALICIOUS' | 'AMBIGUOUS'
| 'UNEXPECTED_BENIGN' | 'UNEXPECTED_MALICIOUS'
```

DATA-MODELS.md defines four categories:

```
'EXPECTED_BENIGN' | 'EXPECTED_MALICIOUS' | 'AMBIGUOUS' | 'NOVEL'
```

The Zod schema validates the four-value set. The architecture references `UNEXPECTED_BENIGN` and `UNEXPECTED_MALICIOUS` in the timeline anomaly marker color mapping (lines ~590-592). Those values will never exist if the data model is authoritative.

**Fix:** Check which values the CLI actually produces. If it uses the five-value set, update DATA-MODELS. If it uses four + `NOVEL`, update ARCHITECTURE's color mapping to handle `NOVEL` instead of `UNEXPECTED_*`.

### 1.8 ClaimStatus Values Disagree

ARCHITECTURE.md Receipt: `claimStatus: 'supports' | 'disproves' | 'inconclusive'` (3 values)
DATA-MODELS.md Receipt: `type ClaimStatus = 'supports' | 'context' | 'disproves' | 'inconclusive'` (4 values)

ARCHITECTURE.md is missing `'context'`. The evidence graph edge types in DATA-MODELS.md include `provides_context` as an edge kind, so `context` is real.

**Fix:** Add `'context'` to ARCHITECTURE.md's claim status. Update the evidence graph edge type description accordingly (already partially there at line ~542 with the "supports" and "disproves" edges, but `context` is missing).

### 1.9 Receipt Missing `title` Field

ARCHITECTURE.md's `Receipt` interface has no `title` field. DATA-MODELS.md's `Receipt` has `title: string`. The receipt markdown files have an H1 title. This is a simple omission.

**Fix:** Add `title: string` to ARCHITECTURE.md's Receipt interface.

### 1.10 QueryRuntimeMetadata Structure Disagrees

ARCHITECTURE.md flattens runtime metadata into typed numeric fields:
```typescript
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
```

DATA-MODELS.md keeps them as strings:
```typescript
interface QueryRuntimeMetadata {
  profile: string;
  pagination: string;
  executionHints: string;
  resultStatus: ResultStatus;
  warnings: string;
  errors: string;
}
```

These are fundamentally different designs. One pre-parses markdown body text into typed fields; the other preserves raw text.

**Fix:** The architecture version (typed numerics) is better for the UI -- the sidebar shows event counts, the graph sizes query nodes by event count. Use the typed version. But acknowledge in the parser spec that this requires parsing string values like `"cursor, limit=200, max_pages=10"` into structured types, and document the parsing rules.

### 1.11 EvidenceReview Sub-Interface Names Disagree

| ARCHITECTURE.md | DATA-MODELS.md |
|---|---|
| `QualityCheck` | `EvidenceQualityCheck` |
| `AntiPatternCheck` | `EvidenceAntiPattern` |
| `ClusteringIntegrityCheck` | `TemplateClusteringCheck` |

The field names inside also differ:
- ARCHITECTURE's `QualityCheck.name` vs DATA-MODELS' `EvidenceQualityCheck.check`
- ARCHITECTURE's `ClusteringIntegrityCheck.valid: boolean` vs DATA-MODELS' `TemplateClusteringCheck.clusteringValid: string`

**Fix:** Use the DATA-MODELS names (they're more explicit about belonging to the evidence review context). But keep `valid` as a `boolean` -- the parser should convert "Yes"/"No" strings from the markdown table to booleans.

### 1.12 Webview Message Protocol: Two Incompatible Definitions

ARCHITECTURE.md defines a generic, view-model-based protocol:

```
Host -> Webview:
  { type: 'init', payload: { viewModel: T, theme: ThemeColors } }
  { type: 'update', payload: { viewModel: Partial<T> } }
  { type: 'highlight', payload: { ids: string[] } }
  { type: 'theme-changed', payload: { theme: ThemeColors } }

Webview -> Host:
  { type: 'select', payload: { id: string, kind: ArtifactKind } }
  { type: 'navigate', payload: { uri: string } }
  { type: 'request-detail', payload: { id: string } }
  { type: 'export', payload: { format: 'png' | 'svg' | 'json' } }
```

DATA-MODELS.md defines a granular, domain-typed protocol with 30+ message types:

```
Host -> Webview:
  { type: 'hunt:sync'; hunt: Hunt }
  { type: 'query:update'; queryId: QueryId; query: Query }
  { type: 'graph:highlight'; nodeId: string }
  { type: 'templates:update'; queryId: QueryId; templates: DrainCluster[] }
  ...

Webview -> Host:
  { type: 'select:hypothesis'; hypothesisId: HypothesisId }
  { type: 'filter:hypothesis'; hypothesisId: HypothesisId | null }
  { type: 'graph:layout'; algorithm: 'force' | 'dagre' | 'radial' }
  ...
```

These cannot both be right. The ARCHITECTURE version is elegant but too generic -- you lose type safety on `Partial<T>` deltas. The DATA-MODELS version is comprehensive but has 30+ message types that each need handlers on both sides.

**Fix:** Use the DATA-MODELS protocol as the source of truth since it's more specific. But *aggressively cut it down* for v1 (see section 3). A v1 protocol should have roughly 10-12 message types, not 30+. Keep: `hunt:sync`, `query:update`, `receipt:update`, `graph:update`, `graph:highlight`, `templates:update`, `timeline:update`, `theme:update`, `select:*` (collapsed to a single `select` with discriminated payload), `navigate`, `webview:ready`. Cut everything else.

---

## 2. Missing Pieces

### 2.1 Store API Disagrees Between Docs

ARCHITECTURE.md defines `HuntStateStore` with:
- `readonly hunt: Hunt` (singular)
- `invalidate(kind, uri)` method
- `setSelection()` method (referenced in data flow but not in API surface)

DATA-MODELS.md defines `HuntStore` with:
- `hunts: Map<string, Hunt>` (plural, multi-hunt)
- `activeHuntPath: string | null`
- `selectedNode: string | null`
- `pinnedTemplates: Set<TemplateId>`
- `hypothesisFilter: HypothesisId | null`
- `timeRange: { start: string; end: string } | null`
- `expandedPhases: Set<number>`

DATA-MODELS.md's store mixes domain state (hunts, indexes) with UI state (selectedNode, pinnedTemplates, expandedPhases). This is a design smell. If the webview gets disposed and recreated, should `pinnedTemplates` survive? If two panels disagree about the selected node, who wins?

**Fix:** Split the store into two:
1. `HuntDataStore` -- parsed artifacts, indexes, cross-references. Survives panel lifecycle.
2. `HuntUIState` -- selection, filters, expanded states. Per-panel or shared, but explicitly scoped.

This also resolves the single-hunt vs multi-hunt question: `HuntDataStore` can hold multiple hunts for multi-root workspaces, while `HuntUIState` tracks which hunt is active.

### 2.2 No Error Model for Parsers in ARCHITECTURE.md

ARCHITECTURE.md's `ArtifactParser` returns `Promise<Mission>`, `Promise<Hypothesis[]>`, etc. -- bare domain objects with no error channel.

DATA-MODELS.md wraps everything in `ParseResult<T>` with `warnings`, `errors`, and a `complete` boolean.

The `ParseResult` wrapper is critical. A half-written MISSION.md (CLI mid-write, or user editing by hand) should not crash the extension. But ARCHITECTURE's data flow diagram has no error handling path -- it goes straight from parser to store to UI.

**Fix:** ARCHITECTURE.md must adopt `ParseResult<T>` for all parser signatures and document the error propagation path:
- Parser returns `ParseResult<T>`
- Store checks `result.errors` -- if fatal, marks artifact as `error` state (not missing, not stale, but *errored*)
- UI shows a warning badge on errored artifacts in the sidebar
- Diagnostics provider surfaces parse errors in the Problems panel

### 2.3 SUCCESS_CRITERIA.md Has No Parser in ARCHITECTURE.md

DATA-MODELS.md defines `SuccessCriteria` (section 1.6) and includes it in the `Hunt` container. The file watcher config maps `.hunt/SUCCESS_CRITERIA.md`. But ARCHITECTURE.md's `ArtifactParser` class has no `parseSuccessCriteria()` method, and the file structure lists parsers for mission, hypotheses, huntmap, state, query, receipt, evidence_review, and findings -- no success criteria.

**Fix:** Either add `parseSuccessCriteria()` to the parser facade, or mark `SuccessCriteria` as a v2 feature and remove it from the Hunt interface.

### 2.4 ENVIRONMENT.md Has No Parser in ARCHITECTURE.md

Same issue. DATA-MODELS.md defines `EnvironmentMap` (section 1.9) and the watcher watches for it, but no parser exists in the architecture. The environment kind `'environment'` appears in `ArtifactChangeEvent.kind` but there's no corresponding parser method.

**Fix:** Add `parseEnvironment()` or cut `EnvironmentMap` from v1.

### 2.5 Manifest, Metrics, Feedback, Detection Parsers Referenced Only in DATA-MODELS

DATA-MODELS.md section 5.1 maps these file patterns to parsers:
- `.hunt/MANIFESTS/MAN-*.json` -> ManifestParser -> `EvidenceManifest`
- `.hunt/METRICS/HE-*.json` -> TelemetryParser -> `HuntExecution`
- `.hunt/FEEDBACK/FB-*.json` -> FeedbackParser -> `FeedbackRecord`
- `.hunt/DETECTIONS/DET-*.json` -> DetectionParser -> `DetectionCandidate`

None of these exist in ARCHITECTURE.md's file tree or parser API. The `HuntExecution`, `FeedbackRecord`, and `DetectionCandidate` types are referenced in the watcher config but have no interface definitions at all.

**Fix:** These are scope creep. Cut them all from v1. A threat hunting investigation visualization tool does not need to parse execution telemetry, analyst feedback forms, or detection candidates. The manifest is borderline -- useful for integrity verification but not visible in any v1 UI panel.

### 2.6 Pack Parser: Architecture-Invisible

DATA-MODELS.md defines a comprehensive pack data model (sections 1.17-1.18) with pack definitions, progressions, parameters, telemetry requirements, and execution targets. The file watcher config includes `packs/**/*.json`. The graph model includes pack nodes and `extends_pack` / `tested_by` edges.

ARCHITECTURE.md mentions packs only in the context of `PackProgressionMatch` inside receipt anomaly framing. There's no pack parser, no pack panel, no pack tree node.

**Fix:** For v1, packs are consumed indirectly through receipts (via `pack_progression_match`). Do not add a full pack parser or pack browser panel. The architecture's approach (parse pack match info from receipts) is sufficient. Cut `PackDefinition`, `PackParameter`, `TelemetryRequirement`, `ExecutionTarget`, `PackExamples`, `PackPublish` from the v1 data model.

### 2.7 Receipt Lineage: Data Model Without Consumer

DATA-MODELS.md defines `ReceiptLineage` with `replayId`, `originalQueryIds`, `mutationsApplied`, etc. ARCHITECTURE.md does not reference lineage anywhere -- not in the sidebar, not in the evidence graph, not in any panel.

**Fix:** Cut from v1 unless replay queries are a common workflow. If they are, add a "Lineage" sub-tree under receipts in the sidebar.

### 2.8 EntityNode / EntityIndex: Not Defined

DATA-MODELS.md's `HuntStore` references `entityIndex: Map<string, EntityNode>` and the graph includes `'entity'` as a `NodeKind`. But `EntityNode` is never defined. What fields does it have? Just a name string? Attributes from the connector SDK's `Entity` type?

**Fix:** Define `EntityNode` explicitly. For v1, it's probably just `{ id: string; kind: string; displayName: string; firstSeen: string; lastSeen: string; queryIds: QueryId[] }`, derived from entity timeline data in queries.

### 2.9 `ThemeColors` Not Defined

ARCHITECTURE.md's message protocol references `ThemeColors` in the `init` message. DATA-MODELS.md uses `{ isDark: boolean }` for the `theme:update` message. Neither document defines what `ThemeColors` contains.

**Fix:** Define it. At minimum: `{ isDark: boolean; background: string; foreground: string; accentColor: string; errorColor: string; warningColor: string; successColor: string }`. Or just pass `isDark` and let the webview read CSS custom properties from `--vscode-*` variables (which is the standard VS Code webview approach and what `webview/shared/theme.ts` in the file tree suggests).

### 2.10 `StoreChangeEvent` vs `changedKeys` Subscription Model

ARCHITECTURE.md fires `StoreChangeEvent { kind: ArtifactKind, affectedIds: string[] }`.
DATA-MODELS.md uses `notify(changedKeys: Set<keyof HuntStore>)`.

These are different notification granularities. One tells you "a query changed, here are the IDs." The other tells you "the queryIndex key of the store changed." The first is better for targeted updates; the second is simpler but forces subscribers to diff the whole slice.

**Fix:** Use the ARCHITECTURE.md approach (kind + affectedIds). It enables the bridge to rebuild only the delta for the affected artifacts instead of re-serializing entire indexes.

---

## 3. Over-Engineering Alerts

### 3.1 30+ Message Types for Three Panels

DATA-MODELS.md section 4 defines a message protocol with distinct types for every artifact update, every selection target, every filter dimension, every graph interaction, and template pinning/comparison. This is a protocol for an enterprise application, not three read-only visualization panels.

For v1, the webview panels are dumb render surfaces (the architecture says so explicitly). They receive view models and render them. They don't need per-artifact-type update messages -- they need "here's your new view model" and "highlight these IDs."

**Cut for v1:**
- All `filter:*` messages (filtering can live entirely in the webview's React state)
- `pin:template`, `unpin:template`, `compare:templates` (nice-to-have, not core)
- `graph:layout` with multiple algorithms (ship with one layout, iterate later)
- `graph:expand`, `graph:collapse` (these imply a progressive disclosure model that's nowhere in the architecture)
- `progression:update`, `pack:update` (no pack panel in v1)
- `diagnostics:update` (diagnostics go to VS Code's native Problems panel, not the webview)

### 3.2 Multi-Hunt Support is Premature

DATA-MODELS.md's store holds `hunts: Map<string, Hunt>` and tracks `activeHuntPath`. The architecture's activation section says it activates on `workspaceContains:.planning/MISSION.md`.

A threat hunter works one hunt at a time. Multi-root workspace support with multiple simultaneous hunts is a v2 concern. Building it now adds complexity to every store operation (must scope by hunt path) and every UI component (must show which hunt is active).

**Fix:** v1 supports exactly one hunt. The store holds a single `Hunt` object. Multi-hunt support is documented as a future consideration (ARCHITECTURE.md already has this in its future section).

### 3.3 Branded String Types for Everything

DATA-MODELS.md defines 11 branded ID types (`QueryId`, `ReceiptId`, `ManifestId`, `RequestId`, `HypothesisId`, `TemplateId`, `PackId`, `DetectionId`, `HeatmapId`, `ExecutionId`, `FeedbackId`, `DispatchId`). Of these, only `QueryId`, `ReceiptId`, `HypothesisId`, and `TemplateId` are used by the extension's UI.

Branded types are useful when you have runtime confusion between ID types (passing a QueryId where a ReceiptId is expected). But `HeatmapId`, `ExecutionId`, `FeedbackId`, and `DispatchId` are never consumed by any UI component in either document.

**Fix:** Keep branded types for the four IDs the extension actually uses. Use plain `string` for everything else. Add branded types for other ID kinds if/when they get UI consumers.

### 3.4 Graph Node Types: 9 Kinds is Too Many

DATA-MODELS.md defines `NodeKind` with 9 values: `hypothesis`, `query`, `receipt`, `finding`, `entity`, `template`, `pack`, `detection`, `phase`.

ARCHITECTURE.md's evidence graph shows 5 node types with visual encodings: hypothesis (rounded rect), query (diamond), receipt (hexagon), template (circle), finding (star). No visual encoding for entity, pack, detection, or phase nodes.

A force-directed graph with 9 heterogeneous node types is unusable. Users will see a hairball of different shapes with no visual hierarchy.

**Fix:** v1 graph has 5 node types (the ones with visual encodings in the architecture). Entity nodes can be added later as a toggle. Pack, detection, and phase nodes are cut.

### 3.5 Zod Runtime Validation is Overkill for a Read-Only Extension

DATA-MODELS.md requires Zod schemas for every domain model. This adds a dependency (~14KB minified) and validation overhead on every parse. The extension is read-only -- it doesn't produce artifacts, so schema validation serves only to catch malformed CLI output.

**Fix:** Use Zod schemas in tests to validate fixture data against the CLI's actual output. In production parsing, use TypeScript types with simple null checks and fallback defaults. If a field is missing, the parser produces a `ParseWarning`, not a Zod validation error. This keeps the runtime lean and avoids hard failures on slightly-out-of-spec artifacts.

### 3.6 Virtual Scrolling via IntersectionObserver

ARCHITECTURE.md proposes `IntersectionObserver`-based virtual scrolling for the template table and timeline. This is solving a problem that doesn't exist yet. A hunt with 50 templates has 50 table rows -- a basic HTML table handles this fine. Even 500 templates would render in under a frame.

**Fix:** Ship v1 with a plain table. Add virtual scrolling if profiling shows render lag. Do not preemptively add complexity.

---

## 4. Under-Engineering Alerts

### 4.1 No Error Handling for Parser Failures

ARCHITECTURE.md's data flow diagram (lines ~660-691) shows a clean pipeline: file change -> watcher -> parser -> store -> UI. There is no error path. What happens when:

- A QRY-*.md file has corrupted YAML frontmatter?
- A receipt's JSON code block is malformed mid-write?
- HYPOTHESES.md has a hypothesis with an unparseable priority field?
- A file is being written by the CLI and the extension reads a partial file?

DATA-MODELS.md defines `ParseResult<T>` with error tracking, but the architecture never shows how errors propagate through the system.

**Fix:** Define an explicit error state for every artifact in the store:

```typescript
type ArtifactState<T> =
  | { status: 'loaded'; data: T; warnings: ParseWarning[] }
  | { status: 'error'; lastGoodData: T | null; errors: ParseError[] }
  | { status: 'loading' }  // parse in progress
  | { status: 'missing' }  // file deleted or not yet created
```

The sidebar shows error badges. The webview falls back to `lastGoodData` with a stale-data indicator. The diagnostics provider surfaces parse errors.

### 4.2 Partial File Reads (CLI/Extension Race Condition)

Both docs acknowledge that the CLI writes artifacts while the extension watches. ARCHITECTURE.md proposes a 300ms debounce. But a debounce doesn't solve the fundamental race: what if the extension reads a file that the CLI has written the frontmatter for but not the body?

Common scenario: `executeQuerySpec()` in the CLI writes `QRY-*.md` in stages -- frontmatter first, then body sections, then the JSON code block. A 300ms debounce might fire after the frontmatter is written but before the JSON block. The parser then sees a valid file with no template clustering data.

**Fix:** Two mitigations:

1. **Retry on incomplete parse.** If the parser succeeds on frontmatter but fails or gets null for an expected body section, set a 500ms retry timer. If the retry finds new content, re-parse. Limit to 2 retries.

2. **Content-length stability check.** Before parsing, read `fs.stat()` mtime and size. After the 300ms debounce fires, check mtime/size again. If it changed, reset the debounce. This catches ongoing writes.

### 4.3 `.planning/` vs `.hunt/` Ambiguity

ARCHITECTURE.md says the planning root directory is `.planning/` in some places and `.hunt/` in others. The activation events watch for both. The watcher globs are `**/.planning/**/*.md` and `**/.hunt/**/*.md`. DATA-MODELS.md uses `.hunt/` exclusively for the canonical directory structure.

Nowhere does either document specify: if both `.planning/` and `.hunt/` exist in the same workspace, which one wins? What if artifacts are split between them?

**Fix:** Define the resolution order:
1. If `.hunt/MISSION.md` exists, use `.hunt/` as the root.
2. Else if `.planning/MISSION.md` exists, use `.planning/`.
3. If both exist, show a quickpick asking the user to choose.
4. The chosen root is stored in workspace state and persisted across sessions.

Also, the configurable `thruntGod.planningDirectory` setting (ARCHITECTURE.md line ~1344) defaults to `.planning`. This creates a third option. Consolidate: the setting should default to `auto` (use the resolution order above) or a specific path.

### 4.4 Git Worktree and Symlink Support is Unaddressed

Neither document addresses:
- What if `.planning/` is a symlink to another directory (e.g., a shared hunt)?
- What if the workspace is a git worktree? The `.planning/` directory might be shared or worktree-specific.
- What if `.planning/` is on a network-mounted filesystem where `FSEvents`/`inotify` don't work?

**Fix:** For v1, document the assumption: "The extension assumes `.planning/` or `.hunt/` is a local directory on the same filesystem as the workspace. Symlinks are followed. Network mounts may have degraded file watching; users can trigger manual refresh via `THRUNT: Refresh Hunt State`."

The `thruntGod.refreshHunt` command in the manifest already exists -- make sure it does a full re-scan rather than just re-reading cached artifacts.

### 4.5 Concurrency: Parallel Store Updates

The data flow shows that when a file changes, the store calls `parser.parse*()` then updates its maps. But what if two files change nearly simultaneously (both pass the debounce window)? Two async parse operations will be in flight. When they resolve, they both call `store.update()`. If one of them triggers an index rebuild that depends on the other's data (e.g., a receipt references a query that's also being re-parsed), the index could be stale.

**Fix:** Serialize store updates. Use a simple queue:

```typescript
class HuntStore {
  private updateQueue = Promise.resolve();

  invalidate(kind: ArtifactKind, uri: vscode.Uri): void {
    this.updateQueue = this.updateQueue.then(() => this._processUpdate(kind, uri));
  }
}
```

This ensures index rebuilds always see the latest data from preceding updates.

### 4.6 No Specification for "What Counts as a Template Match"

The evidence graph shows `Query --clusters--> Template` edges. The timeline shows events colored by deviation score. But neither document specifies how a timeline event is matched to a Drain template.

Entity timeline tables in QRY-*.md have columns: #, Timestamp, Source, Event Type, Detail. Template clustering output has `event_ids: string[]`. The match presumably works by event ID. But entity timeline events have an `index` field, not an `id` field. Are these the same? Is `event_ids[i]` the same namespace as `entityTimeline.events[j].index`?

**Fix:** Define the join key explicitly. If `event_ids` contains normalized event IDs from the connector (`NormalizedEvent.id`), and entity timeline events reference the same IDs, document this. If they use different namespaces, the template-to-timeline linkage is broken and needs a different join strategy.

### 4.7 `resultSummary` Type Disagrees

ARCHITECTURE.md: `resultSummary: string` ("events=312, templates=4, entities=3")
DATA-MODELS.md: `resultSummary: QueryResultSummary` (structured object with `events`, `templates`, `entities` as numbers)

The architecture treats it as a raw string from the markdown. The data model treats it as a parsed structure.

**Fix:** The parser should parse the string into `QueryResultSummary`. The type in the domain model should be the structured form. Document the parsing rule: split on commas, split on equals, parseInt.

---

## 5. Performance Red Flags

### 5.1 Full EvidenceGraph Rebuild on Any Change

DATA-MODELS.md section 3.2 shows that after any artifact change, the pipeline runs through `DerivedIndexer -> GraphBuilder -> TimelineBuilder -> MessageBus`. Section 6.3 narrows this somewhat (only affected indexes), but `GraphBuilder` appears to rebuild the entire `EvidenceGraph` structure.

For a hunt with 50 queries and 100 receipts, the graph has ~160 nodes and ~300 edges (rough estimate). Rebuilding this on every single file change is wasteful. Worse, the rebuilt graph is serialized via `postMessage` to the webview, which must parse and re-render it.

**Fix:** Incremental graph updates. When a receipt changes, compute only the edge diff (added/removed/modified edges from that receipt). Send `{ type: 'graph:patch', addedNodes, removedNodes, addedEdges, removedEdges }` instead of the full graph. The webview applies the patch to its existing D3 simulation without restarting the force layout.

### 5.2 Parsing All Frontmatter for Evidence Graph

ARCHITECTURE.md says opening the Evidence Graph requires parsing "all QRY-*.md and RCT-*.md frontmatter" for link topology. For 50 queries and 100 receipts, that's 150 file reads + YAML parses on first graph open.

If the files are already in the store's frontmatter cache (from sidebar expansion), this is free. But if the user opens the Evidence Graph before expanding the sidebar, it's 150 cold parses.

**Fix:** This is probably acceptable (150 small file reads is <100ms on SSD). But add a loading state to the graph panel so the user sees "Building evidence graph..." instead of a blank panel for the initial render.

### 5.3 Event ID Arrays: Unbounded Memory

`DrainCluster.event_ids` is "capped at 100 per cluster." A hunt with 50 queries, 5 templates each = 250 clusters * 100 event IDs = 25,000 strings in memory. Each string is a UUID-like ID (~36 chars). That's roughly 1MB. This is within the 50MB budget.

But the cap is in the *CLI output*. What if a future CLI version raises the cap, or a custom connector produces more? The extension has no independent cap.

**Fix:** Add a client-side cap in the parser: `event_ids: cluster.event_ids.slice(0, 100)`. Document the cap. The extension never needs all event IDs -- it uses them for timeline linkage, where 100 samples per cluster is sufficient.

### 5.4 D3 Force Simulation for Evidence Graph

D3 force-directed layout with ~160 nodes will converge in ~300 iterations, which is fine. But every `graph:update` message restarts the simulation (new data, new positions). If the user is mid-drag-repositioning, their node positions are lost.

**Fix:** On incremental updates, merge new nodes into the existing simulation at default positions and let the simulation re-stabilize. Only restart the full layout on `hunt:sync` (initial load). Preserve user-repositioned nodes by pinning their `fx`/`fy` coordinates.

### 5.5 Memory Budget Double-Counting

ARCHITECTURE.md estimates 50MB for a 50-query, 100-receipt hunt. The breakdown:
- Parsed frontmatter: ~2MB
- Full body parse cache (10 recently viewed): ~5MB
- Template clustering data: ~1MB
- Cross-artifact indexes: ~500KB
- Webview view models (3 panels): ~3MB per panel

That's 2 + 5 + 1 + 0.5 + 9 = 17.5MB. The budget is 50MB. So there's 32.5MB of headroom. This is either generous or there are costs not accounted for:
- The LRU body parse cache can grow beyond 10 items if the user rapidly opens many artifacts
- The webview process has its own memory (Chromium renderer), which is not counted here
- D3 force simulation keeps node/link objects with physics state (velocity, etc.)

**Fix:** The budget is probably fine for v1. But add a runtime memory check: if `process.memoryUsage().heapUsed` exceeds 100MB, log a warning and aggressively evict body caches. Do not set up a poll loop -- check on each store update.

---

## 6. Specific Recommendations

### 6.1 Create a Single Source of Truth for Types

**Problem:** Both documents define TypeScript interfaces for the same domain objects, with different names, different field types, and different casing conventions.

**Fix:** Designate DATA-MODELS.md as the canonical type reference. Remove all `interface` blocks from ARCHITECTURE.md's "Domain Model" section. Replace them with a brief description of each type and a cross-reference: "See DATA-MODELS.md section X.Y." Architecture should describe *behavior and data flow*, not re-declare types.

### 6.2 Reconcile the `.hunt/` vs `.planning/` Question Now

**Problem:** Inconsistent directory naming across both docs.

**Fix:** Add a section to ARCHITECTURE.md called "Artifact Root Resolution" that specifies the precedence rules (see 4.3 above). Update DATA-MODELS.md's file system mapping to include both paths. Make the watcher config's root directory dynamic, not hardcoded.

### 6.3 Define v1 Scope Explicitly

**Problem:** Both docs describe a system that handles packs, progressions, manifests, metrics, feedback, detections, multi-hunt workspaces, virtual scrolling, pack library browsing, detection engineering bridging, collaborative hunt diffs, and live CLI integration. This is 3 years of work.

**Fix:** Add a "v1 Scope" section to ARCHITECTURE.md:

v1 ships:
- Sidebar tree with mission, hypotheses, phases, queries, receipts, evidence review
- Drain Template Viewer panel (treemap + table + detail)
- Evidence Graph panel (5 node types: hypothesis, query, receipt, template, finding)
- Multi-Source Timeline panel
- CodeLens on QRY-*.md and RCT-*.md
- Diagnostics for evidence review issues
- Status bar with hunt progress
- File watching with debounced re-parse

v1 does NOT ship:
- Pack browser or pack parsing (beyond receipt-embedded pack match data)
- Manifest integrity verification
- Metrics/feedback/detection parsing
- Multi-hunt workspace support
- Live CLI terminal integration
- Export to PNG/SVG/JSON
- Collaborative hunt diffs
- Detection rule generation

### 6.4 Consolidate the Store Design

**Problem:** Two incompatible store interfaces.

**Fix:** Use this hybrid:

```typescript
class HuntStore implements vscode.Disposable {
  // Single hunt (v1)
  readonly hunt: Hunt | null;

  // Typed artifact maps
  readonly queries: Map<QueryId, Query>;
  readonly receipts: Map<ReceiptId, Receipt>;
  readonly hypotheses: Map<HypothesisId, Hypothesis>;
  readonly templates: Map<TemplateId, DrainCluster & { queryId: QueryId }>;

  // Cross-artifact indexes (lazy, rebuilt on change)
  readonly evidenceGraph: EvidenceGraph;

  // Selection (shared across panels)
  readonly selection: { kind: ArtifactKind; id: string } | null;

  // Events
  readonly onDidChange: vscode.Event<StoreChangeEvent>;

  // Operations
  invalidate(kind: ArtifactKind, uri: vscode.Uri): Promise<void>;
  select(kind: ArtifactKind, id: string): void;
  clearSelection(): void;
  ensureFullParse(kind: ArtifactKind, id: string): Promise<void>;
  dispose(): void;
}
```

This is the architecture's store with the data model's typed IDs, minus multi-hunt and UI-state bloat.

### 6.5 Adopt a Consistent Naming Convention

**Problem:** camelCase vs snake_case inconsistency. YAML frontmatter uses snake_case (`query_id`, `related_hypotheses`). Some TypeScript interfaces mirror this (`query_id`); others convert to camelCase (`queryId`). The Zod schemas use snake_case field names.

**Fix:** Establish the rule: YAML/JSON uses snake_case (matching CLI output). TypeScript interfaces use camelCase. Parsers convert at the boundary. Zod schemas validate the raw snake_case input, then a transform step converts to camelCase domain objects. This is standard practice and avoids the current situation where some interfaces use snake_case field names in TypeScript.

### 6.6 Add a "Stale Data" Indicator to the Webview

**Problem:** Neither doc addresses what the user sees when data is being re-parsed after a file change.

**Fix:** When the store's `invalidate()` is called, immediately send a `{ type: 'stale', affectedIds: string[] }` message to all bridges. The webview dims affected elements (50% opacity). When the re-parse completes and the `update` message arrives, the elements return to full opacity. This gives visual feedback that the extension is working without blocking interaction.

### 6.7 Cut the WebviewPanelSerializer for v1

ARCHITECTURE.md describes panel serialization (user closes VS Code and reopens, panels are restored). This is nice but adds complexity to every panel. The serialized state is minimal (panel type + artifact ID), but the restore path requires the store to be fully initialized before deserialization.

**Fix:** For v1, do not register a `WebviewPanelSerializer`. If the user closes and reopens VS Code, they re-open panels manually. This eliminates a class of startup race conditions (panel restore before artifacts are parsed).

### 6.8 Define the Exact mdast-util Plugins Needed

ARCHITECTURE.md says "mdast-util-from-markdown" for AST parsing. But GFM tables are needed for evidence review parsing, and frontmatter extraction needs `mdast-util-frontmatter`. These are separate packages.

**Fix:** List the exact dependency set:
- `mdast-util-from-markdown` (core AST)
- `micromark-extension-gfm-table` + `mdast-util-gfm-table` (GFM tables)
- `micromark-extension-frontmatter` + `mdast-util-frontmatter` (YAML frontmatter)
- `yaml` (YAML parsing)

Skip `remark-parse` and `unified` -- the `mdast-util-*` layer is lighter and sufficient.

---

## Summary of Blocking Issues

| Issue | Severity | Section |
|---|---|---|
| Hunt interface shape contradicts between docs | **High** | 1.1 |
| Deviation score ranges contradict (0-5, 1-6, 0-10) | **High** | 1.6 |
| Deviation category values mismatch (5 vs 4 variants) | **High** | 1.7 |
| Webview message protocol incompatible between docs | **High** | 1.12 |
| No error handling in parser -> store -> UI pipeline | **High** | 4.1 |
| CLI/extension race condition on file reads | **Medium** | 4.2 |
| `.planning/` vs `.hunt/` resolution undefined | **Medium** | 4.3 |
| v1 scope not defined (scope is everything) | **High** | 6.3 |
| Store design disagrees (single vs multi-hunt, field names) | **Medium** | 2.1 |
| 7+ type name mismatches across docs | **Medium** | 1.5, 1.6, 1.11 |

Resolve the high-severity items before writing code. The medium items should be resolved before completing the first phase plan, but they won't block the initial file structure and parser implementations.
