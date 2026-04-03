# UX Specification: THRUNT God VS Code Extension

**Version:** 1.0
**Date:** 2026-04-02
**Status:** Draft

---

## 0. Design Principles

These four principles govern every decision in this spec. When in doubt, apply them in order.

1. **Hunt state at a glance.** A hunter glancing at VS Code for 2 seconds should know: which hunt is active, what phase they are in, how many hypotheses are open, and whether evidence integrity is clean.
2. **Artifacts over files.** The extension never presents `.hunt/` as a file tree. It presents a *semantic investigation tree*: hypotheses, receipts, queries, phases. The file system is an implementation detail.
3. **Progressive disclosure.** The sidebar shows status. The editor shows detail. The panel shows cross-cutting views (timeline, graph). No feature demands the hunter learn a new UI paradigm -- everything maps to existing VS Code concepts (tree views, webview panels, CodeLens, diagnostics).
4. **Dark-first, light-safe.** Hunters work long hours in dimly lit SOCs. The default palette is optimized for dark themes. Every color is tested against both dark and light, and every semantic meaning has a shape or icon fallback for colorblind accessibility.

---

## 1. Information Architecture

### 1.1 First Launch Experience

When VS Code opens a workspace containing a `.hunt/` or `.planning/` directory with THRUNT artifacts (detected by the presence of `MISSION.md` + `HUNTMAP.md`):

1. The **THRUNT God sidebar** activates automatically in the Primary Side Bar (left).
2. The **status bar** populates with hunt identity: `THRUNT: OAuth Phishing -- Phase 3/3 -- 2 Supported, 1 Disproved`.
3. If `STATE.md` indicates an in-progress hunt, a non-intrusive notification offers: *"Resume hunt? Phase 2 is in progress."*
4. No editor tabs open automatically. The hunter chooses where to start.

If no `.hunt/` directory exists but the THRUNT God extension is installed, the sidebar shows an empty state with a single action: **"Start a new hunt"** (runs `THRUNT: New Hunt Case`).

### 1.2 Visual Hierarchy (Most Important = Most Prominent)

```
+-----------------------------------------------------------------------+
|  PRIMARY SIDEBAR (left)         |  EDITOR GROUP (center)              |
|                                 |                                     |
|  [1] Hunt Sidebar               |  [2] Artifact Editor                |
|      - Mission summary          |      (MISSION, HYPOTHESES, QRY-*,  |
|      - Phase tree with status   |       RCT-*, FINDINGS, etc.)       |
|      - Hypothesis verdicts      |                                     |
|      - Receipt/Query lineage    |  [3] Drain Template Viewer          |
|                                 |      (webview beside QRY-* files)  |
|                                 |                                     |
|                                 |  [4] Evidence Graph                 |
|                                 |      (webview tab, full editor)    |
+---------------------------------+-------------------------------------+
|  PANEL (bottom)                                                       |
|                                                                       |
|  [6] Problems tab               |  [7] Multi-Source Timeline          |
|      (Evidence Integrity         |      (webview panel tab)           |
|       Warnings as diagnostics)  |                                     |
+-----------------------------------------------------------------------+
|  STATUS BAR                                                           |
|  [hunt-icon] OAuth Phishing | Phase 3/3 | 2S 1D 0O | integrity: OK   |
+-----------------------------------------------------------------------+
```

**Rank by prominence:**

| Rank | Feature | Location | Why |
|------|---------|----------|-----|
| 1 | Hunt Sidebar | Primary Side Bar | Always visible. The hunter's anchor point. |
| 2 | Anomaly Frame Scorecard | CodeLens + Gutter in editor | Inline in the artifact the hunter is reading. Zero navigation cost. |
| 3 | Evidence Integrity Warnings | Problems panel + Gutter | Uses VS Code's native diagnostic system. Familiar. Persistent. |
| 4 | Drain Template Viewer | Editor webview (side-by-side) | Opens contextually when a QRY-* file is active. |
| 5 | Evidence Graph | Editor webview (dedicated tab) | On-demand. Used for lineage review, not constant monitoring. |
| 6 | Command Palette | Command Palette (Ctrl/Cmd+Shift+P) | Always available. Context-sensitive. |
| 7 | Multi-Source Timeline | Panel webview tab | Used during correlation phases. Not always needed. |

### 1.3 VS Code UI Zone Mapping

| VS Code Zone | THRUNT Feature | Activation |
|-------------|----------------|------------|
| Primary Side Bar | Hunt Sidebar (tree view) | Automatic on `.hunt/` detection |
| Editor (markdown) | Artifact files with CodeLens overlays | Open any `.hunt/*.md` file |
| Editor (webview, split right) | Drain Template Viewer | Click template icon in QRY-* file, or CodeLens action |
| Editor (webview, tab) | Evidence Graph | Command palette or sidebar context menu |
| Panel (tab) | Multi-Source Timeline | Command palette or sidebar "Show Timeline" |
| Panel (tab) | Problems | Populated by Evidence Integrity diagnostics |
| Status Bar (left) | Hunt identity + phase + verdict summary | Always visible when hunt is active |
| Status Bar (right) | Integrity status indicator | Always visible when hunt is active |
| Gutter (editor) | Anomaly score badges, integrity warning icons | Automatic in RCT-* and EVIDENCE_REVIEW files |
| Notifications | Hunt phase transitions, new receipt, integrity failures | Event-driven |

---

## 2. Hunt Sidebar (Feature 1) -- Detailed Design

### 2.1 Tree Structure

The sidebar is a single VS Code TreeView with the contribution ID `thruntGod.huntTree`. It has four root sections, each collapsible. The tree is *semantic*, not file-based.

```
ROOT
 +-- Mission                              (singleton)
 +-- Hypotheses                           (list)
 |    +-- HYP-01: OAuth consent...        (leaf)
 |    +-- HYP-02: Email exfil...          (leaf)
 |    +-- HYP-03: Lateral movement...     (leaf)
 +-- Phases                               (list, ordered)
 |    +-- Phase 1: Signal Intake          (group)
 |    |    +-- Plan 01-01                 (group)
 |    |         +-- QRY-20260328-001      (leaf)
 |    |         +-- QRY-20260328-002      (leaf)
 |    |         +-- RCT-20260328-001      (leaf)
 |    +-- Phase 2: Telemetry Collection   (group)
 |    |    +-- ...
 |    +-- Phase 3: Evidence Correlation   (group)
 |         +-- ...
 +-- Evidence Review                      (singleton, or list if per-phase)
```

**Node types:**

| Node | Type | Clickable | Children |
|------|------|-----------|----------|
| Mission | Singleton | Opens MISSION.md | None |
| Hypotheses (header) | Section | Toggles collapse | HYP-* nodes |
| HYP-* | Leaf | Opens HYPOTHESES.md, scrolled to that hypothesis | None |
| Phases (header) | Section | Toggles collapse | Phase groups |
| Phase N | Group | Opens phase summary if it exists | Plan groups |
| Plan NN-MM | Group | Opens plan file | QRY-* and RCT-* leaves |
| QRY-* | Leaf | Opens query file in editor | None |
| RCT-* | Leaf | Opens receipt file in editor | None |
| Evidence Review | Singleton | Opens EVIDENCE_REVIEW.md | None |

### 2.2 Icons, Badges, and Colors

Every node gets an icon from the Codicon set (VS Code built-in) plus a color that maps to status.

**Hypothesis verdict icons:**

| Verdict | Icon | Color (dark) | Color (light) | Shape fallback |
|---------|------|-------------|---------------|----------------|
| Supported | `$(check)` | `#4EC9B0` (teal-green) | `#16825D` | Filled circle |
| Disproved | `$(close)` | `#CE9178` (muted-orange) | `#A31515` | X mark |
| Inconclusive | `$(question)` | `#DCDCAA` (muted-yellow) | `#795E26` | Question mark |
| Open | `$(circle-outline)` | `#569CD6` (blue) | `#0451A5` | Open circle |

**Phase status icons:**

| Status | Icon | Color (dark) | Color (light) |
|--------|------|-------------|---------------|
| Complete | `$(check-all)` | `#4EC9B0` | `#16825D` |
| Running | `$(sync~spin)` | `#569CD6` | `#0451A5` |
| Blocked | `$(lock)` | `#F44747` | `#CD3131` |
| Planned | `$(circle-outline)` | `#858585` | `#6A6A6A` |

**Query/Receipt leaf icons:**

| Artifact | Icon | Badge |
|----------|------|-------|
| QRY-* | `$(database)` | Template count: `4T` |
| RCT-* | `$(file-symlink-file)` | Score: `5` (colored by severity) |

**Badge severity colors for deviation scores:**

| Score | Severity | Badge color (dark) | Badge color (light) |
|-------|----------|-------------------|---------------------|
| 1-2 | Low | `#858585` (gray) | `#6A6A6A` |
| 3 | Medium | `#DCDCAA` (yellow) | `#795E26` |
| 4 | High | `#CE9178` (orange) | `#B5651D` |
| 5-6 | Critical | `#F44747` (red) | `#CD3131` |

### 2.3 Context Menu Actions

Right-click actions depend on node type:

**On Mission node:**
- Open Mission
- Show Evidence Graph
- Show Timeline

**On HYP-* node:**
- Open Hypothesis
- Show Linked Receipts
- Show Linked Queries
- Show in Evidence Graph
- Copy Hypothesis ID

**On Phase node:**
- Open Phase Summary
- Run Phase (if status = Planned)
- Show Phase Timeline

**On QRY-* node:**
- Open Query
- Open Drain Template Viewer
- Show Entity Timeline
- Compare Templates... (opens picker to select another QRY for comparison)
- Copy Query ID

**On RCT-* node:**
- Open Receipt
- Open Linked Query
- Show Anomaly Scorecard
- Show in Evidence Graph
- Copy Receipt ID

### 2.4 Empty States

**No hunt active (no `.hunt/` directory):**

```
+------------------------------------------+
|  THRUNT God                              |
|                                          |
|        [shield-icon]                     |
|                                          |
|     No active hunt detected.             |
|                                          |
|     Open a workspace with a .hunt/       |
|     directory, or start a new hunt.      |
|                                          |
|     [ Start New Hunt ]                   |
|     [ Open Example Hunt ]               |
|                                          |
+------------------------------------------+
```

**Hunt active, no receipts yet:**

```
+------------------------------------------+
|  THRUNT God                              |
|                                          |
|  > Mission: OAuth Phishing Campaign      |
|                                          |
|  v Hypotheses                            |
|    o HYP-01: OAuth consent...  [Open]    |
|    o HYP-02: Email exfil...   [Open]     |
|    o HYP-03: Lateral move...  [Open]     |
|                                          |
|  v Phases                                |
|    > Phase 1: Signal Intake   [Running]  |
|      > Plan 01-01                        |
|        (no queries or receipts yet)      |
|    o Phase 2: Telemetry       [Planned]  |
|    o Phase 3: Correlation     [Planned]  |
|                                          |
|  Evidence Review                         |
|    Not yet available.                    |
|                                          |
+------------------------------------------+
```

**Hunt complete:**

```
+------------------------------------------+
|  THRUNT God                       [done] |
|                                          |
|  > Mission: OAuth Phishing Campaign      |
|                                          |
|  v Hypotheses                            |
|    V HYP-01: OAuth consent...  [Supp.]   |
|    V HYP-02: Email exfil...   [Supp.]   |
|    X HYP-03: Lateral move...  [Disp.]   |
|                                          |
|  v Phases                                |
|    V Phase 1: Signal Intake   [Complete] |
|    V Phase 2: Telemetry       [Complete] |
|    V Phase 3: Correlation     [Complete] |
|      > Plan 03-01                        |
|        [db] QRY-20260328-001  [4T]       |
|        [db] QRY-20260328-002  [2T]       |
|        [db] QRY-20260328-003  [3T]       |
|        [rc] RCT-20260328-001  [5]        |
|        [rc] RCT-20260328-002  [5]        |
|        [rc] RCT-20260328-003  [3]        |
|                                          |
|  V Evidence Review: Ready to publish     |
|                                          |
+------------------------------------------+
```

### 2.5 Sidebar Behavior

- **Auto-refresh:** The tree watches `.hunt/` via `FileSystemWatcher`. When any artifact file changes, the tree re-parses and updates. No manual refresh needed.
- **Selection sync:** Clicking a sidebar node opens the corresponding file. Opening a `.hunt/` file in the editor highlights the corresponding sidebar node (bidirectional sync).
- **Collapse memory:** Collapse state persists across VS Code sessions via `workspaceState`.
- **Multi-hunt:** If the workspace contains multiple `.hunt/` directories (e.g., in `thrunt-god/examples/`), a top-level "Hunt Picker" dropdown appears above the tree. The selected hunt populates the tree.

---

## 3. Drain Template Viewer (Feature 2) -- Detailed Design

### 3.1 Activation

The Drain Template Viewer opens in three ways:

1. **Automatic:** When a `QRY-*.md` file is opened in the editor, a CodeLens appears above the `## Result Summary` heading: **"Open Template Viewer"**. Clicking it opens the viewer as a webview panel to the right of the markdown file (editor column 2).
2. **Context menu:** Right-click a QRY-* node in the sidebar and select "Open Drain Template Viewer."
3. **Command Palette:** `THRUNT: Open Template Viewer` (prompts to select a query if none is active).

The viewer is a VS Code webview panel with `viewType: 'thruntGod.drainViewer'`. It reads the JSON block inside the `### Template Clustering` section of the QRY-* file.

### 3.2 Visualization: Horizontal Stacked Bar + Detail Table

**Why not treemap or sunburst:** Drain templates are a flat list of clusters with counts. There is no hierarchy to visualize. A treemap would waste space on nested rectangles that carry no meaning. A sunburst implies parent-child relationships that do not exist. A stacked bar chart is the most honest representation: it shows relative proportions at a glance and ranks templates by dominance.

**Why not a pie chart:** Pie charts are terrible for comparing similar-sized segments. Drain templates often have one dominant cluster (like the 198-event sign-in template in the OAuth example) and several smaller ones. A horizontal bar makes the long tail immediately visible.

**Layout:**

```
+-----------------------------------------------------------------------+
|  Drain Template Viewer: QRY-20260328-001                    [pin][x]  |
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
|  | Template: OAuth consent granted to app <UUID> by <EMAIL> from    | |
|  |           <IP>                                                   | |
|  | ID:       c7a1e3b2f9d04856                                       | |
|  | Count:    47 events                                              | |
|  | Sample:   evt-m365-id-00147                                      | |
|  |                                                                  | |
|  | Variable tokens:                                                 | |
|  |   <UUID>  -> 3fa85f64-5717-4562-b3fc-2c963f66afa6 (malicious)   | |
|  |              e2a1b4c7-8d3f-4e5a-9b6c-1d0f2a3b4c5d (legitimate)  | |
|  |              ... (45 more)                                       | |
|  |   <EMAIL> -> sarah.chen@acme.corp (1)                           | |
|  |              james.wu@acme.corp (12)                             | |
|  |              maria.garcia@acme.corp (34)                         | |
|  |   <IP>    -> 185.220.101.42 (1) [!]                             | |
|  |              10.0.1.15 (46)                                      | |
|  |                                                                  | |
|  | [ Pin Template ] [ Show in Timeline ] [ Jump to Source ]         | |
|  +------------------------------------------------------------------+ |
|                                                                       |
|  PINNED TEMPLATES                                                     |
|  +------------------------------------------------------------------+ |
|  | [pin] c7a1e3b2f9d04856 - OAuth consent granted to app...  (47)  | |
|  | [pin] 5a0c8e3f7b2d1694 - Token refresh for app <UUID>...  (15)  | |
|  +------------------------------------------------------------------+ |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 3.3 Interactions

**Click a bar:** Selects that template. The detail pane below populates with template metadata, variable token breakdowns, and action buttons.

**Hover a bar:** Tooltip shows: template string, count, percentage, template_id.

**Variable token drill-down:** In the detail pane, each masked token (like `<UUID>`, `<EMAIL>`, `<IP>`) is expandable. Click to see the distinct values that were masked, with their frequency counts. Values that appear only once (unique/anomalous) get a `[!]` badge.

**Compare across queries:** The toolbar has a "Compare" button. Clicking it opens a split view with two template viewers side by side. The hunter picks a second QRY-* file. Templates with the same template_id (or high textual similarity) are linked with dashed connector lines. Templates unique to one query get an "Only in QRY-..." badge.

**Filter by entity:** A dropdown at the top of the viewer filters events by entity (from the `entities` field in the QRY-* frontmatter). The bar chart re-renders showing only events from that entity.

### 3.4 Template Pinning

Pinning is the primary workflow for tracking interesting templates across phases.

- Click "Pin Template" in the detail pane.
- The template is added to the `PINNED TEMPLATES` section at the bottom of the viewer.
- Pinned templates are persisted in `.hunt/.thrunt-god/pinned-templates.json` (extension-managed file, not a hunt artifact).
- When the hunter opens a different QRY-* file's template viewer, pinned templates from other queries appear as ghost rows in the bar chart (dashed outline, gray fill). If the same template_id appears in the new query, the ghost row is replaced with a solid bar and tagged `[also in QRY-20260328-001]`.
- Unpinning: right-click a pinned template and select "Unpin."

### 3.5 Template Viewer Sizing

- Default width: 50% of the editor group (split right).
- Minimum width: 400px.
- The viewer is responsive. Below 500px, the detail pane stacks below the bar chart instead of beside it.

---

## 4. Anomaly Frame Scorecard (Feature 3) -- Detailed Design

### 4.1 CodeLens Placement

CodeLens annotations appear in RCT-*.md files at three locations:

1. **Above `## Claim`:** Shows the verdict badge and hypothesis linkage.
   - Example: `Supports HYP-01 | Score: 5 (HIGH) | Show Scorecard`
2. **Above `### Prediction`:** Shows the prediction summary inline.
   - Example: `Expected benign: sign-in from SF | Expected malicious: OAuth consent from unknown IP | Ambiguous: new app access`
3. **Above `### Deviation Assessment`:** Shows the score breakdown.
   - Example: `Base: 3 (EXPECTED_MALICIOUS) + No change ticket (+1) + Tor exit node (+1) = 5 (HIGH)`

CodeLens text is terse. Clicking any CodeLens opens a hover card (VS Code Hover provider) with the full scorecard.

### 4.2 Gutter Badges

Every line within the `## Anomaly Framing` section of an RCT-* file gets a gutter decoration.

**Score-level gutter icons:**

| Score | Gutter Icon | Gutter Color | Meaning |
|-------|-------------|-------------|---------|
| 1-2 | Small filled circle | Gray `#858585` | Low deviation. Informational. |
| 3 | Medium filled circle | Yellow `#DCDCAA` | Medium. Known TTP match at base level. |
| 4 | Large filled circle | Orange `#CE9178` | High. TTP match with modifiers. |
| 5-6 | Filled diamond | Red `#F44747` | Critical. Strong composite score. |

The gutter icon appears on the line containing `**Composite score:**` (or `**Final score:**`).

Additionally, lighter gutter dots appear on each modifier line (`**Factor:...`) in the color of the modifier's contribution (orange for +1, red for +2).

### 4.3 Inline Prediction Diff View

The prediction section of each receipt has three sub-fields: `Expected benign next`, `Expected malicious next`, and `Ambiguous next`. The scorecard renders these as a three-column inline diff:

```
+-------------------------------------------------------+
|  PREDICTION vs ACTUAL (event #7)                      |
|                                                       |
|  BENIGN           MALICIOUS           ACTUAL          |
|  -------           ---------           ------          |
|  Sign-in from      OAuth consent       OAuth consent   |
|  known MacBook     from unknown IP     from Tor exit   |
|  in SF             MFA enrollment      node to app     |
|                                        "DocuSign       |
|                                         Secure View"   |
|                                                       |
|  [ ] Match         [X] MATCH           Category:      |
|                                        EXPECTED_       |
|                                        MALICIOUS       |
+-------------------------------------------------------+
```

This view appears as a VS Code Hover when the hunter hovers over the `### Prediction` CodeLens. It can also be expanded as a sticky panel via `THRUNT: Show Scorecard` command.

### 4.4 One-Click Navigation

Every receipt references queries and events by ID. The scorecard provides navigation links:

- **"Jump to Source Query"** -- Opens the linked QRY-* file (from `related_queries` frontmatter) and scrolls to the template cluster that contains the cited event.
- **"Jump to Event"** -- If the event ID appears in an entity timeline table in a QRY-* file, the editor scrolls to that row and briefly highlights it (500ms flash).
- **"Show in Timeline"** -- Opens the Multi-Source Timeline panel and centers on the event's timestamp with a highlight pulse.

---

## 5. Evidence Graph (Feature 4) -- Detailed Design

### 5.1 Node Types

The Evidence Graph is a directed graph rendered in a VS Code webview using a force-directed layout with hierarchical bias (top-to-bottom gravity).

| Node Type | Shape | Size | Color (dark) | Color (light) | Label |
|-----------|-------|------|-------------|---------------|-------|
| Hypothesis | Rounded rectangle | Large (120x50) | Fill depends on verdict (see below) | Same palette | `HYP-01: [truncated claim]` |
| Receipt | Rectangle | Medium (100x40) | `#264F78` (dark blue) | `#DCEAFF` (light blue) | `RCT-20260328-001` |
| Query | Cylinder (database) | Medium (80x40) | `#3C3C3C` (dark gray) | `#E8E8E8` (light gray) | `QRY-20260328-001` |
| Phase | Rounded pill | Small (90x30) | `#1E1E1E` border only | `#FFFFFF` border only | `Phase 2` |
| Entity | Hexagon | Small (70x35) | `#4EC9B0` (teal) | `#16825D` | `sarah.chen` |
| Connector | Diamond | Tiny (50x25) | `#858585` (gray) | `#6A6A6A` | `m365` or `okta` |

**Hypothesis fill colors by verdict:**

| Verdict | Fill (dark) | Fill (light) |
|---------|-----------|-------------|
| Supported | `#1B4332` (dark green) | `#D4EDDA` |
| Disproved | `#4A2020` (dark red-brown) | `#F8D7DA` |
| Inconclusive | `#4A4020` (dark amber) | `#FFF3CD` |
| Open | `#1E3A5F` (dark blue) | `#CCE5FF` |

### 5.2 Edge Types

| Edge | Source | Target | Style | Semantics |
|------|--------|--------|-------|-----------|
| Tests | Receipt | Hypothesis | Solid arrow, colored by verdict | "This receipt tests this hypothesis" |
| Sources | Receipt | Query | Dashed arrow, gray | "This receipt cites this query" |
| Contains | Phase | Query | Thin solid, gray | "This query was executed in this phase" |
| Contains | Phase | Receipt | Thin solid, gray | "This receipt was produced in this phase" |
| Mentions | Receipt | Entity | Dotted, teal | "This receipt concerns this entity" |
| Queried Via | Query | Connector | Dotted, gray | "This query used this connector" |

Edge arrows point from child to parent in the evidence chain: Receipt -> Hypothesis (tests), Receipt -> Query (sources).

### 5.3 Layout Algorithm

**Primary layout:** Hierarchical (Dagre/ELK) with levels:

```
Level 0 (top):      Hypotheses
Level 1:            Receipts
Level 2:            Queries
Level 3 (bottom):   Connectors, Entities
```

Phases are rendered as translucent bounding boxes around their children (queries and receipts). This makes phase boundaries visible without adding layout complexity.

**Fallback:** If the graph is small (under 8 nodes), a force-directed layout (d3-force) is used instead, because hierarchical layout looks sparse with few nodes.

### 5.4 Interactions

**Click a node:** Selects it. The sidebar highlights the corresponding tree node (bidirectional sync). A detail panel appears at the bottom of the graph showing the node's full metadata (frontmatter fields for receipts/queries, verdict+evidence for hypotheses).

**Double-click a node:** Opens the corresponding artifact file in the editor.

**Hover a node:** Tooltip shows key fields:
- Hypothesis: assertion text, verdict, confidence
- Receipt: claim text, score, claim_status
- Query: intent text, event count, template count
- Entity: entity ID, connector, assessment

**Filter by hypothesis:** A filter bar at the top of the graph lets the hunter select one or more hypotheses. Only nodes connected to the selected hypotheses remain visible. Others fade to 10% opacity (not hidden, so the hunter retains spatial memory).

**Filter by phase:** Similar to hypothesis filter. Select a phase to focus the graph on that phase's artifacts.

**Zoom:** Scroll wheel zooms. Double-click empty space fits the entire graph in view.

**Pan:** Click-drag on empty space pans the viewport.

### 5.5 Sidebar Sync

When the hunter selects a node in the sidebar, the graph pans and zooms to center that node, and briefly pulses it (200ms scale-up, 300ms ease-back). When the hunter selects a node in the graph, the sidebar scrolls to and highlights the corresponding tree item.

### 5.6 ASCII Wireframe

```
+-----------------------------------------------------------------------+
|  Evidence Graph: OAuth Phishing Campaign                   [fit][x]   |
|  Filter: [All Hypotheses v] [All Phases v]  [Show Entities] [Legend]  |
|                                                                       |
|  +-- Phase 1 --------+  +-- Phase 2 --------+  +-- Phase 3 --------+ |
|  |                    |  |                    |  |                    | |
|  |                    |  |                    |  |  +==============+  | |
|  |                    |  |                    |  |  | HYP-01:     |  | |
|  |                    |  |                    |  |  | OAuth cons. |  | |
|  |                    |  |                    |  |  | [Supported] |  | |
|  |                    |  |                    |  |  +======|=======+  | |
|  |                    |  |                    |  |         |          | |
|  |                    |  |                    |  |  +------v-------+  | |
|  |                    |  |  +-------------+  |  |  | RCT-001      |  | |
|  |                    |  |  | QRY-001     |  |  |  | score: 5     |  | |
|  |                    |  |  | 312 events  |<-------| [Supports]   |  | |
|  |                    |  |  | 4 templates |  |  |  +--------------+  | |
|  |                    |  |  +------+------+  |  |                    | |
|  |                    |  |         |         |  |                    | |
|  |                    |  |     [m365]        |  |                    | |
|  +--------------------+  +-------------------+  +--------------------+ |
|                                                                       |
|  DETAIL: RCT-20260328-001                                             |
|  Claim: OAuth consent to malicious app confirmed                      |
|  Score: 5 (HIGH) | Verdict: Supports HYP-01 | Confidence: High       |
+-----------------------------------------------------------------------+
```

---

## 6. Multi-Source Timeline (Feature 7) -- Detailed Design

### 6.1 Layout: Swimlane by Connector, Grouped by Entity

The timeline is a horizontal scrolling webview in the Panel area.

**Y-axis (vertical):** Swimlanes. One swimlane per connector-entity pair. Grouped by entity, then subdivided by connector. Example:

```
sarah.chen@acme.corp
  |-- m365 (identity)
  |-- m365 (email/alerts)
  |-- okta (identity)
james.wu@acme.corp
  |-- m365 (identity)
  |-- okta (identity)
```

**X-axis (horizontal):** Time. Left = earliest event in the hunt window. Right = latest.

### 6.2 Event Markers

Individual events are rendered as vertical tick marks on the swimlane. The tick height and color encode the event type or template membership:

| Event Category | Tick Style | Color (dark) |
|----------------|-----------|-------------|
| Normal (baseline) | Short thin tick | `#858585` (gray) |
| Anomalous (in receipt) | Tall thick tick | `#F44747` (red) |
| MFA event | Medium tick with shield icon | `#DCDCAA` (yellow) |
| Consent/permission | Medium tick with key icon | `#CE9178` (orange) |
| Rule creation | Medium tick with filter icon | `#F44747` (red) |

### 6.3 Drain Template Bands

When template clustering data is available (from QRY-* files), the timeline can overlay **template bands** -- translucent horizontal bands behind the event ticks that show which template each event belongs to. Each template gets a distinct fill color (auto-assigned from the palette). The band height fills the swimlane.

Template bands are toggled via a toolbar button: **"Show Template Bands"**. They are off by default to avoid visual clutter, and most useful when the hunter is examining a specific query's time window.

### 6.4 Zoom Levels

The timeline supports three semantic zoom levels plus continuous scroll-zoom:

| Level | Range | Tick Resolution | Use Case |
|-------|-------|----------------|----------|
| Full Hunt | Entire time window (e.g., 72h) | Events aggregated into 1-hour buckets | Overview: "when did things happen?" |
| Single Phase | Phase time window (parsed from HUNTMAP.md dates) | Events aggregated into 5-minute buckets | Phase review: "what happened in this phase?" |
| Minute | 10-minute window | Individual events | Correlation: "what happened between consent and rule creation?" |

**Zoom interaction:** Scroll wheel on the timeline zooms in/out. The zoom center follows the cursor. A minimap bar above the timeline shows the full hunt window with the current viewport highlighted.

### 6.5 Entity Highlighting

**Click an entity label** in the Y-axis: All events for that entity across all swimlanes glow (brief brightness pulse, then sustained 20% brightness boost). All other entities dim to 50% opacity.

**Click an event tick:** A tooltip shows: timestamp, event type, source, template_id (if clustered), and a "Jump to Query" link. If the event is cited in a receipt, the tooltip also shows the receipt ID and deviation score.

**Hover an event tick:** Lightweight tooltip with timestamp and event type only (no delay, instant).

### 6.6 Timeline-to-Receipt Link

When the hunter clicks an anomalous (red) event tick, the tooltip includes a **"Open Receipt"** button that opens the corresponding RCT-* file in the editor.

### 6.7 ASCII Wireframe

```
+-----------------------------------------------------------------------+
|  Multi-Source Timeline: OAuth Phishing Campaign           [zoom][fit] |
|  [Full Hunt] [Phase 2] [Phase 3]  |  [Show Template Bands]           |
|                                                                       |
|  MINIMAP  [======|===========|====]                                   |
|           Mar 25     Mar 27     Mar 28                                |
|                                                                       |
|  03/28 08:00     08:30      09:00      09:30      10:00               |
|  |_______________|__________|__________|__________|________           |
|                                                                       |
|  sarah.chen / m365-identity                                           |
|  |...|...|...|...|.||!|!..|...|                                      |
|                     ^^                                                |
|                     ||__ OAuth consent (08:42) [RCT-001, score: 5]    |
|                     |___ Token refresh (08:44)                        |
|                                                                       |
|  sarah.chen / m365-email                                              |
|  |..........|..!|!...|............|                                   |
|                 ^^                                                     |
|                 ||__ Defender alert (08:46:18) [RCT-002]              |
|                 |___ New-InboxRule (08:46:12) [RCT-002, score: 5]     |
|                                                                       |
|  sarah.chen / okta                                                    |
|  |...|...|...|...|...|...|...|...|                                   |
|  (all normal -- no anomalous events)                                  |
|                                                                       |
|  james.wu / m365-identity                                             |
|  |...|...|...|...|...|...|...|...|                                   |
|                                                                       |
|  james.wu / okta                                                      |
|  |...|...|...|...|...|...|...|...|                                   |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## 7. Command Palette Integration (Feature 5)

### 7.1 Full Command List

All commands are prefixed with `THRUNT:` and registered under the `thruntGod` extension context.

| Command | Description | Available When |
|---------|-------------|----------------|
| `THRUNT: New Hunt Case` | Initialize a new `.hunt/` directory from a signal | Always |
| `THRUNT: Open Hunt...` | Pick a hunt from the workspace to activate in sidebar | Multiple hunts detected |
| `THRUNT: Show Evidence Graph` | Open the Evidence Graph webview | Hunt active |
| `THRUNT: Show Timeline` | Open the Multi-Source Timeline panel | Hunt active, queries exist |
| `THRUNT: Open Template Viewer` | Open Drain Template Viewer for the current or selected query | QRY-* file open, or hunt active |
| `THRUNT: Compare Templates...` | Open side-by-side template comparison between two queries | 2+ queries exist |
| `THRUNT: Show Scorecard` | Open the Anomaly Frame Scorecard for the current receipt | RCT-* file open |
| `THRUNT: Validate Evidence` | Run the evidence integrity validator and populate Problems panel | Hunt active |
| `THRUNT: Go to Hypothesis...` | Pick a hypothesis to navigate to | Hypotheses exist |
| `THRUNT: Go to Receipt...` | Pick a receipt to navigate to | Receipts exist |
| `THRUNT: Go to Query...` | Pick a query to navigate to | Queries exist |
| `THRUNT: Go to Phase...` | Pick a phase to navigate to | Phases exist |
| `THRUNT: Pin Template` | Pin the selected template in the Drain Viewer | Template Viewer open, template selected |
| `THRUNT: Unpin Template` | Remove a pinned template | Pinned templates exist |
| `THRUNT: Export Findings` | Export FINDINGS.md as a formatted report (HTML or PDF) | FINDINGS.md exists |
| `THRUNT: Show Hunt Status` | Display a notification with current hunt status summary | Hunt active |
| `THRUNT: Focus Entity...` | Highlight a specific entity across all views (sidebar, timeline, graph) | Hunt active |
| `THRUNT: Clear Entity Focus` | Remove entity highlighting | Entity focus active |
| `THRUNT: Run Phase` | Execute the next planned phase via THRUNT CLI bridge | Planned phases exist |
| `THRUNT: Refresh Hunt Tree` | Force-refresh the sidebar tree (normally automatic) | Hunt active |

### 7.2 Smart Context

Commands use VS Code's `when` clause to appear only when relevant:

```json
{
  "command": "thruntGod.showScorecard",
  "when": "resourceFilename =~ /^RCT-.*\\.md$/"
},
{
  "command": "thruntGod.openTemplateViewer",
  "when": "resourceFilename =~ /^QRY-.*\\.md$/ || thruntGod.huntActive"
},
{
  "command": "thruntGod.runPhase",
  "when": "thruntGod.huntActive && thruntGod.hasPlannedPhases"
}
```

Commands that require a selection (like `Compare Templates...`) prompt with a QuickPick list of available artifacts.

---

## 8. Evidence Integrity Warnings (Feature 6)

### 8.1 Anti-Pattern to Diagnostic Mapping

The extension parses `EVIDENCE_REVIEW.md` and all RCT-* files, running the same anti-pattern checks that the CLI validator runs. Results are published as VS Code Diagnostics (appear in the Problems panel and as gutter squigglies).

| Anti-Pattern | Severity | Diagnostic Code | Target File | Range | Message Template |
|-------------|----------|-----------------|-------------|-------|-----------------|
| Post-hoc rationalization | Error | `thrunt.posthoc` | RCT-*.md | The `### Prediction` section | "Prediction section missing or appears after actual event description. Predictions must be documented before observations." |
| Missing baseline | Error | `thrunt.nobaseline` | RCT-*.md | The `### Baseline` or `**Baseline:**` section | "Anomaly framing lacks baseline documentation. Cannot assess deviation without established normal behavior." |
| Score inflation | Warning | `thrunt.inflation` | RCT-*.md | The `### Deviation Assessment` section | "Deviation score {score} has {n} unaccounted points. Each modifier must have an explicit named factor." |
| Bare sequential claim | Warning | `thrunt.baresequence` | RCT-*.md or FINDINGS.md | The line containing a temporal assertion | "Sequential claim '{claim}' lacks entity timeline reference. Cite the specific QRY-* entity timeline." |
| Single-source timeline | Info | `thrunt.singlesource` | RCT-*.md | The `## Evidence` section | "Entity timeline for {entity} uses only {source}. Consider cross-referencing with {other_sources}." |
| Temporal gap | Warning | `thrunt.temporalgap` | RCT-*.md | Between timeline events | "Gap of {duration} between events #{n} and #{n+1} with no documented explanation." |
| Causality without evidence | Error | `thrunt.causalclaim` | FINDINGS.md | Lines with causal language | "Causal claim '{phrase}' requires receipt-backed evidence. Link to a specific RCT-* with deviation scoring." |

### 8.2 Gutter Squiggly Rendering

- **Error-level** anti-patterns: Red wavy underline (standard VS Code error squiggly) under the offending text range.
- **Warning-level** anti-patterns: Yellow wavy underline.
- **Info-level** anti-patterns: Blue dot in gutter (no underline, to avoid visual noise for suggestions).

### 8.3 Quick-Fix Actions

Each diagnostic has one or more associated Code Actions (VS Code Quick Fixes, accessed via the lightbulb icon or `Ctrl+.`):

| Anti-Pattern | Quick Fix | Action |
|-------------|-----------|--------|
| Post-hoc rationalization | "Add prediction section template" | Inserts a prediction section scaffold above the current position with `Expected benign next:`, `Expected malicious next:`, `Ambiguous next:` fields |
| Missing baseline | "Add baseline section template" | Inserts a baseline scaffold with fields: Typical locations, Typical hours, Known devices, Normal apps, MFA method, Admin status |
| Score inflation | "Add missing score factor" | Inserts a `**Factor: [describe]:** +N` line in the deviation assessment |
| Bare sequential claim | "Link to entity timeline" | Opens a QuickPick of available QRY-* entity timelines and inserts a reference like `(see QRY-20260328-001, entity timeline event #7)` |
| Single-source timeline | "Show available connectors" | Opens a QuickPick showing other connectors in the environment that could provide corroborating data |
| Causality without evidence | "Link to receipt" | Opens a QuickPick of available RCT-* files and inserts a reference |

### 8.4 Diagnostic Lifecycle

- Diagnostics are computed on file open and on file save.
- The extension maintains a `DiagnosticCollection` named `thruntGod`.
- When `EVIDENCE_REVIEW.md` reports all checks as "Pass," a status bar item shows a green checkmark: `integrity: OK`.
- When any check fails, the status bar shows: `integrity: 2 errors, 1 warning` in yellow/red.

---

## 9. Color System and Theming

### 9.1 Semantic Color Tokens

The extension contributes the following color tokens to VS Code's theming system via `contributes.colors` in `package.json`. Theme authors can override these.

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
    { "id": "thruntGod.connectorM365",       "defaults": { "dark": "#569CD6", "light": "#0451A5" } },
    { "id": "thruntGod.connectorOkta",       "defaults": { "dark": "#C586C0", "light": "#AF00DB" } },
    { "id": "thruntGod.connectorSplunk",     "defaults": { "dark": "#4EC9B0", "light": "#16825D" } },
    { "id": "thruntGod.connectorElastic",    "defaults": { "dark": "#DCDCAA", "light": "#795E26" } },
    { "id": "thruntGod.connectorGeneric",    "defaults": { "dark": "#858585", "light": "#6A6A6A" } },
    { "id": "thruntGod.entityHighlight",     "defaults": { "dark": "#4EC9B0", "light": "#16825D" } },
    { "id": "thruntGod.anomalousTick",       "defaults": { "dark": "#F44747", "light": "#CD3131" } },
    { "id": "thruntGod.baselineTick",        "defaults": { "dark": "#858585", "light": "#6A6A6A" } },
    { "id": "thruntGod.phaseBorder",         "defaults": { "dark": "#3C3C3C", "light": "#D4D4D4" } },
    { "id": "thruntGod.templateBand1",       "defaults": { "dark": "#264F78", "light": "#DCEAFF" } },
    { "id": "thruntGod.templateBand2",       "defaults": { "dark": "#4A2020", "light": "#F8D7DA" } },
    { "id": "thruntGod.templateBand3",       "defaults": { "dark": "#4A4020", "light": "#FFF3CD" } },
    { "id": "thruntGod.templateBand4",       "defaults": { "dark": "#1B4332", "light": "#D4EDDA" } }
  ]
}
```

### 9.2 Colorblind-Safe Design

Every semantic meaning that uses color also has a redundant encoding:

| Meaning | Color | Redundant Encoding |
|---------|-------|--------------------|
| Supported verdict | Green | Checkmark icon + "Supported" text |
| Disproved verdict | Orange/red | X icon + "Disproved" text |
| Inconclusive verdict | Yellow | Question mark icon + "Inconclusive" text |
| Open verdict | Blue | Open circle icon + "Open" text |
| Low score (1-2) | Gray | Small circle + number badge "2" |
| Medium score (3) | Yellow | Medium circle + number badge "3" |
| High score (4) | Orange | Large circle + number badge "4" |
| Critical score (5-6) | Red | Diamond icon + number badge "5" |
| Connector: m365 | Blue | "m365" text label always visible |
| Connector: okta | Purple | "okta" text label always visible |

The palette was tested against the three most common forms of color vision deficiency:

- **Protanopia (red-blind):** Green and orange are distinguishable because the green is teal-shifted (#4EC9B0) and the orange is warm-shifted (#CE9178). Both retain distinct luminance values.
- **Deuteranopia (green-blind):** Same teal/orange separation works. The yellow (#DCDCAA) remains distinguishable from both.
- **Tritanopia (blue-blind):** Blue (#569CD6) and purple (#C586C0) may be harder to distinguish. For this reason, connector labels always include text, never relying on color alone.

### 9.3 High Contrast Theme Support

When VS Code is in High Contrast mode, the extension:
- Increases all border widths from 1px to 2px.
- Replaces translucent fills (phase bounding boxes, template bands) with solid fills at higher contrast.
- Ensures all text meets WCAG AAA (7:1 contrast ratio) against the background.

---

## 10. User Journeys

### Journey 1: Hunter Opens Existing Hunt, Reviews Morning Progress

**Scenario:** Alex, a Tier 2 SOC analyst, opens VS Code at 08:00. The OAuth phishing hunt was started yesterday. Phase 2 (Telemetry Collection) completed overnight via automated queries. Alex needs to review results and decide what to do next.

**Steps:**

1. Alex opens VS Code. The THRUNT God sidebar activates automatically.
   - **Status bar reads:** `THRUNT: OAuth Phishing -- Phase 2/3 complete -- 0 Supported, 0 Disproved, 3 Open`
   - **Sidebar shows:** Mission, 3 Open hypotheses, Phase 1 (Complete), Phase 2 (Complete, with 3 QRY-* nodes showing template badges: `4T`, `2T`, `3T`), Phase 3 (Planned).

2. Alex clicks `QRY-20260328-001` in the sidebar.
   - **Editor opens** the query markdown file.
   - **CodeLens** appears above `## Result Summary`: *"Open Template Viewer | 4 templates from 312 events"*.

3. Alex clicks the CodeLens. The Drain Template Viewer opens to the right.
   - Alex sees the stacked bar chart: Sign-in (198), Failed sign-in (52), OAuth consent (47), Token refresh (15).
   - Alex clicks the "OAuth consent" bar. The detail pane shows variable token breakdown.
   - Alex notices `<IP> -> 185.220.101.42 (1) [!]` -- a single unique IP in a 47-event cluster. That is anomalous.
   - Alex clicks **"Pin Template"** to track this template across future queries.

4. Alex opens `QRY-20260328-003` from the sidebar.
   - The template viewer updates to show Okta templates. The pinned OAuth consent template appears as a ghost row (dashed outline). It does not match any Okta template -- confirming the consent bypassed Okta.

5. Alex opens the Multi-Source Timeline via `THRUNT: Show Timeline`.
   - The timeline shows sarah.chen's m365-identity swimlane with a cluster of gray baseline ticks and two red anomalous ticks at 08:42 and 08:44.
   - Alex zooms to the minute level and sees the 4-minute gap between consent and rule creation.

6. Alex is satisfied the telemetry is complete. Alex runs `THRUNT: Run Phase` to start Phase 3 (Evidence Correlation).

**Total time:** 8 minutes from VS Code launch to phase advancement. Zero file-tree navigation. Zero terminal commands.

### Journey 2: New Signal Arrives, Hunter Kicks Off Investigation

**Scenario:** Maria, a threat hunter, receives a Slack alert about anomalous Okta activity. She wants to start a new hunt from VS Code.

**Steps:**

1. Maria opens VS Code. The sidebar shows the empty state: *"No active hunt detected."*

2. Maria runs `THRUNT: New Hunt Case` from the Command Palette.
   - A QuickPick prompts: *"Signal type?"* -- options: Detection Alert, Intel Lead, Anomaly, Suspicion.
   - Maria selects "Detection Alert."
   - A text input prompts: *"Describe the signal."* Maria types: "Okta brute force alert -- 1200+ failed auths in 8 minutes from residential proxy IPs targeting meridian.io."
   - The extension creates `.hunt/MISSION.md` with the signal pre-populated and opens it in the editor.

3. Maria edits the mission (scope, entities, constraints) in the editor. On save, the sidebar populates with the Mission node.

4. Maria runs `THRUNT: Shape Hypotheses` (bridges to `hunt:shape-hypothesis`).
   - The CLI generates `HYPOTHESES.md` and `HUNTMAP.md`.
   - The sidebar populates: 4 Open hypotheses, 4 Planned phases.

5. Maria reviews the HUNTMAP in the sidebar, clicks Phase 1 to read its plan, and runs `THRUNT: Run Phase` to begin.

**Total time:** 3 minutes from signal to first phase execution.

### Journey 3: Manager Reviews Evidence Graph Before Escalation

**Scenario:** David, the SOC lead, needs to review the OAuth phishing hunt before approving escalation to legal.

**Steps:**

1. David opens VS Code and the completed hunt loads.
   - **Status bar:** `THRUNT: OAuth Phishing -- Complete -- 2 Supported, 1 Disproved -- integrity: OK`

2. David runs `THRUNT: Show Evidence Graph`.
   - The graph opens as a full editor tab. Three hypothesis nodes at the top, three receipt nodes in the middle, three query nodes at the bottom. Phase bounding boxes show which phase produced which artifacts.
   - The two Supported hypotheses are green. The Disproved hypothesis is orange.
   - David clicks `RCT-20260328-001`. The detail panel shows the claim, score (5), and confidence (High).

3. David clicks "Filter: HYP-02 only." The graph fades everything except HYP-02, RCT-20260328-002, and QRY-20260328-002. He double-clicks the receipt node to open it in the editor.

4. David reads the receipt. The CodeLens shows: `Supports HYP-02 | Score: 5 (HIGH)`. The gutter shows a red diamond on the composite score line.

5. David checks the Problems panel. Zero diagnostics. The integrity status bar shows green.

6. David runs `THRUNT: Export Findings`. A formatted HTML report is generated and opened in the browser for forwarding to legal.

**Total time:** 5 minutes from opening VS Code to exporting the report.

### Journey 4: Hunter Compares Drain Templates Across Two Queries

**Scenario:** Alex wants to understand how event patterns differ between the Okta connector and the M365 connector for the same entities.

**Steps:**

1. Alex opens `QRY-20260328-001` (M365 identity) and clicks "Open Template Viewer."

2. In the template viewer toolbar, Alex clicks **"Compare..."**
   - A QuickPick lists available queries: `QRY-20260328-002 (M365 email)`, `QRY-20260328-003 (Okta identity)`.
   - Alex selects `QRY-20260328-003`.

3. The viewer splits into two columns:

```
+-----------------------------------+-----------------------------------+
| QRY-20260328-001 (M365 identity)  | QRY-20260328-003 (Okta identity)  |
| 4 templates, 312 events           | 3 templates, 847 events           |
|                                   |                                   |
| Sign-in to <*>...        198      | user.session.start...      612    |
| ===========================       | =============================     |
|                              ~~~~~|~~~~~ (linked: similar structure)  |
| Failed sign-in...          52     | user.auth.mfa...           189    |
| ========                          | =================                 |
|                                   |                                   |
| OAuth consent...           47     | app.oauth2.as.token...      46   |
| =======                          | =======                           |
|                     ~~~~~~~~~~~~~~|~~~~~~~~~~~~~ (linked: OAuth)      |
| Token refresh...           15     |                                   |
| ===                               | (no equivalent template)         |
+-----------------------------------+-----------------------------------+
```

4. Alex notices that the M365 "Token refresh" template (15 events) has no Okta equivalent -- this means the token refreshes happened outside Okta's view, confirming the consent bypass finding.

5. Alex clicks the "OAuth consent" template in the left column. The detail pane shows the malicious app UUID. Alex clicks the linked "app.oauth2.as.token" template in the right column. The detail pane shows only legitimate app UUIDs. The malicious app is absent from Okta -- visual confirmation of the cross-IdP gap.

**Total time:** 2 minutes to a visual confirmation that previously required manually cross-referencing two markdown files.

---

## Appendix A: File Watchers and Parsing

The extension watches these file patterns for changes:

| Glob | Purpose | Parser |
|------|---------|--------|
| `.hunt/MISSION.md` | Mission metadata | Frontmatter + heading extraction |
| `.hunt/HYPOTHESES.md` | Hypothesis list + verdicts | Heading + status parsing |
| `.hunt/HUNTMAP.md` | Phase tree + completion status | Checkbox + heading parsing |
| `.hunt/STATE.md` | Current position | Key-value parsing |
| `.hunt/QUERIES/QRY-*.md` | Query metadata + template JSON | YAML frontmatter + JSON code block extraction |
| `.hunt/RECEIPTS/RCT-*.md` | Receipt metadata + anomaly framing | YAML frontmatter + section parsing |
| `.hunt/EVIDENCE_REVIEW.md` | Integrity check results | Table parsing |
| `.hunt/FINDINGS.md` | Final verdicts | Heading + table parsing |

All parsing is done in the extension host (TypeScript). No external process is needed for read-only visualization. The `THRUNT: Run Phase` and `THRUNT: New Hunt Case` commands shell out to the THRUNT CLI.

## Appendix B: Extension Contribution Points

```jsonc
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "thruntGod",
        "title": "THRUNT God",
        "icon": "resources/thrunt-icon.svg"
      }]
    },
    "views": {
      "thruntGod": [{
        "id": "thruntGod.huntTree",
        "name": "Hunt",
        "type": "tree"
      }]
    },
    "commands": [
      // ... (see Section 7 for full list)
    ],
    "menus": {
      "view/item/context": [
        // ... (see Section 2.3 for context menus)
      ]
    },
    "colors": [
      // ... (see Section 9.1 for full list)
    ]
  }
}
```

## Appendix C: Data Flow Summary

```
.hunt/ files (on disk)
    |
    v
FileSystemWatcher (extension host)
    |
    v
Artifact Parsers (TypeScript)
    |
    +---> Hunt Tree Data Provider ---> Sidebar TreeView
    |
    +---> Diagnostic Provider -------> Problems Panel (integrity warnings)
    |
    +---> CodeLens Provider ---------> Editor CodeLens overlays
    |
    +---> Webview Message Bus -------> Drain Template Viewer (webview)
    |                               -> Evidence Graph (webview)
    |                               -> Multi-Source Timeline (webview)
    |
    v
Status Bar Item (hunt identity + integrity summary)
```

All webview panels communicate with the extension host via `postMessage`. The extension host is the single source of truth for parsed artifact data. Webviews never read files directly.

## Appendix D: Keyboard Shortcuts

| Shortcut | Command | Context |
|----------|---------|---------|
| `Ctrl+Shift+H` / `Cmd+Shift+H` | Focus Hunt Sidebar | Always |
| `Ctrl+Shift+T` / `Cmd+Shift+T` | Open Template Viewer | QRY-* file open |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Show Evidence Graph | Hunt active |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Show Timeline | Hunt active |
| `Ctrl+.` | Quick Fix (standard VS Code) | On integrity warning |
