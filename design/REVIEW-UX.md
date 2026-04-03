# UX Design Review: THRUNT God VS Code Extension

**Reviewer:** Principal Product Designer
**Date:** 2026-04-02
**Documents Reviewed:**
- `UX-SPEC.md` v1.0 (Draft)
- `VISUALIZATION-SPEC.md` (Draft)
- `ARCHITECTURE.md` (for context)

**Verdict:** Strong foundation with several critical contradictions between the two specs that must be resolved before implementation begins. The core interaction model is sound, but the specs were clearly written by different authors without a reconciliation pass.

---

## 1. UX vs Viz Contradictions

### 1.1 Drain Template Viewer: Treemap vs Stacked Bar (CRITICAL)

This is the single largest contradiction in the specs and must be resolved before any implementation starts.

**UX-SPEC, Section 3.2** explicitly recommends a **Horizontal Stacked Bar + Detail Table** layout. It states: *"Why not treemap or sunburst: Drain templates are a flat list of clusters with counts. There is no hierarchy to visualize. A treemap would waste space on nested rectangles that carry no meaning."* The wireframe (Section 3.2) shows horizontal bars with percentage labels.

**VISUALIZATION-SPEC, Section 2.2** also recommends **Horizontal Stacked Bar** as the primary visualization. So far, consistent. But then it adds a **Treemap as a secondary drill-down** accessible via double-click on a bar segment (Section 2.3): *"Double-click on a bar segment: Opens the treemap drill-down in the bottom panel for that query."*

**ARCHITECTURE.md** contradicts both. Its Drain Template Viewer section (under "Webview Panel: Drain Template Viewer") shows a wireframe with the **treemap as the primary visualization**, occupying the left half of the panel, with a "CLUSTER DETAIL" pane on the right and a "TEMPLATE TABLE" below. There is no stacked bar in the architecture wireframe at all. The architecture file structure even names the component `TemplateTreemap.tsx`, not `TemplateBar.tsx`.

Additionally, the architecture's Evidence Graph section describes query nodes as **diamonds**, while the UX-SPEC (Section 5.1) describes them as **cylinders (database icon)** and the VISUALIZATION-SPEC (Section 4.2) describes them as **small circles (24px diameter)**. Three different shapes for the same node type across three documents.

**Fix:** Pick one. The VISUALIZATION-SPEC's analysis is the most rigorous (it scores four options across six criteria). The stacked bar wins for cross-query comparison, which is the differentiating interaction. The treemap-as-drill-down is a reasonable P2 addition. Update ARCHITECTURE.md's wireframe and file naming to match. For query nodes in the evidence graph, the VISUALIZATION-SPEC's small circle with connector icon is the most space-efficient and should be canonical.

### 1.2 Evidence Graph: Force-Directed vs Hierarchical Layout

**UX-SPEC, Section 5.1** calls for a *"force-directed layout with hierarchical bias (top-to-bottom gravity)"* and references d3-force.

**VISUALIZATION-SPEC, Section 4.1** explicitly recommends **Dagre (hierarchical)** layout and argues against force-directed: *"Force-directed layouts would scramble the tier ordering, forcing the user to mentally reconstruct the hierarchy."* It only falls back to force-directed for graphs under 8 nodes.

**ARCHITECTURE.md** (Evidence Graph section) describes *"D3 d3-force with custom forces: Hypotheses pinned to left column, Queries in center column, Receipts in right column."* This is a left-to-right force layout, contradicting both other specs which use top-to-bottom.

**Fix:** The VISUALIZATION-SPEC's recommendation of Dagre with `rankdir: 'TB'` is correct. Deterministic layout is essential for a tool used during incident review -- the graph should look the same every time you open it. A force-directed graph with custom forces is a less reliable way to approximate what Dagre does deterministically. Update UX-SPEC Section 5.3 and ARCHITECTURE.md to use Dagre with top-to-bottom layout.

### 1.3 Receipt Node Shape Conflict

**UX-SPEC, Section 5.1:** Receipt nodes are **rectangles** (100x40).

**VISUALIZATION-SPEC, Section 4.2:** Receipt nodes are **rectangles with slight corner radius** (4px), variable width 140-200px, 50px tall. Consistent in shape but different in sizing.

**ARCHITECTURE.md:** Receipt nodes are **hexagons**. Completely different.

**Fix:** Rectangles (per UX-SPEC and VIZ-SPEC) are the right call. Hexagons are visually distinctive but waste space and are harder to label. Update ARCHITECTURE.md.

### 1.4 Edge Direction Conflict

**UX-SPEC, Section 5.2:** Edges flow from **Receipt -> Hypothesis (tests)** and **Receipt -> Query (sources)**. Arrows point from child to parent.

**VISUALIZATION-SPEC, Section 4.2:** Edges flow from **Hypothesis -> Receipt (supports/contradicts/context)** and **Receipt -> Query (sourced from)**. Arrows point from parent to child.

**ARCHITECTURE.md:** Describes both directions in the same section. `Hypothesis --tests--> Query` and `Receipt --supports--> Hypothesis` coexist, creating a confusing bidirectional model.

This matters because arrow direction communicates the evidence chain's direction of reasoning. A hunter reasons top-down: "I have a hypothesis, what supports it?" But the evidence chain is built bottom-up: "This query produced this receipt, which tests this hypothesis."

**Fix:** Use the VISUALIZATION-SPEC's convention: arrows point downward from Hypothesis to Receipt to Query. This matches the visual hierarchy (hypotheses at top, queries at bottom) and the hunter's review flow. Label edges with their semantic meaning (supports, contradicts, sourced-from) rather than encoding directionality in the arrow.

### 1.5 Template Pinning Storage Location

**UX-SPEC, Section 3.4:** Pinned templates stored in `.hunt/.thrunt-god/pinned-templates.json`.

**VISUALIZATION-SPEC, Section 2.3:** Pinned templates stored in *"`.hunt/STATE.md` or a `.hunt/.viz-state.json` file."*

**ARCHITECTURE.md** (Design Principle 1): *"The extension never writes to `.planning/`."*

All three conflict. Writing to `.hunt/` would violate the architecture's read-only principle. STATE.md is a CLI-managed artifact and should not be modified by the extension.

**Fix:** Store pin state in VS Code's `workspaceState` (extension-managed key-value store that persists per workspace). This is where VS Code extensions are supposed to store view state. It requires zero filesystem writes. If cross-machine persistence is needed, use VS Code's `globalState` or sync-compatible settings. Do not write to `.hunt/`.

### 1.6 Color System Drift

The UX-SPEC (Section 9.1) defines semantic color tokens using one palette:
- Supported: `#4EC9B0` (dark), `#16825D` (light)
- Disproved: `#CE9178` (dark), `#A31515` (light)

The VISUALIZATION-SPEC (Section 7.3) defines verdict colors using a different palette:
- Supported: `#22c55e` (dark), `#15803d` (light)
- Disproved: `#ef4444` (dark), `#dc2626` (light)

The UX-SPEC uses VS Code's built-in token colors (teal-green, muted-orange). The VIZ-SPEC uses Tailwind CSS color names (green-500, red-500). These are visually different greens and different reds.

Similarly, deviation score colors differ. UX-SPEC Section 2.2 uses four buckets (gray/yellow/orange/red for 1-2/3/4/5-6). VIZ-SPEC Section 7.4 uses a six-step gradient (green-400 through red-500, one color per score level).

**Fix:** The UX-SPEC's approach of using VS Code token-adjacent colors is better for the sidebar and editor decorations because it blends with the native VS Code theme. The VIZ-SPEC's Tailwind-derived palette is better for webview visualizations where bolder colors are needed against D3-rendered backgrounds. Define both as named tokens in `contributes.colors` and document when each applies: sidebar/editor uses the muted token palette; webview canvases use the Tailwind-derived palette. The hex values in the VIZ-SPEC should be the canonical webview palette.

### 1.7 Click Behavior on Evidence Graph Nodes

**UX-SPEC, Section 5.4:** *"Click a node: Selects it"* with detail panel and sidebar sync. *"Double-click a node: Opens the corresponding artifact file."*

**VISUALIZATION-SPEC, Section 4.3:** *"Clicking a hypothesis node opens `.hunt/HYPOTHESES.md` in the VS Code editor"* with `preserveFocus: false`. Single click directly opens the file.

**ARCHITECTURE.md:** *"Single-click reveals the `.md` file in editor; double-click opens the associated webview panel."*

Three different single-click behaviors across three documents.

**Fix:** Adopt the UX-SPEC's pattern. Single-click selects (shows detail panel, syncs sidebar). Double-click opens the file. This matches VS Code's tree view conventions where single-click previews and double-click opens. Opening a file on single-click would be disruptive during graph exploration.

---

## 2. Cognitive Load Analysis

### 2.1 Time-to-Insight During Active Incident

The status bar design (UX-SPEC Section 1.1) is excellent for glance value. In under 2 seconds, a hunter sees: hunt name, phase progress, verdict counts, integrity status. This is the right information at the right prominence.

**Problem: The three most important pieces of information during an active incident are buried.**

During a live incident, the hunter's top-three questions are:
1. "What is the highest-scoring anomaly right now?" (Answer: requires opening a receipt or scrolling the sidebar)
2. "Which entity has the most suspicious activity?" (Answer: requires opening the timeline and scanning swimlanes)
3. "Did anything change since I last looked?" (Answer: requires comparing memory to current state)

None of these are answerable from the status bar. The status bar shows aggregate verdicts, which are lagging indicators (hypotheses are resolved after receipts are written).

**Fix:** Add a "critical alert" mode to the status bar. When any receipt has a deviation score of 5-6, the status bar item should pulse and show: `[!] RCT-001: Score 6 -- OAuth consent from Tor`. Clicking this opens the receipt directly. This takes the most important finding from "buried in the tree" to "one click from the status bar."

### 2.2 Information Overload in the Template Viewer

**UX-SPEC Section 3.2** wireframe shows four simultaneous information zones in the Template Viewer: (1) stacked bar chart, (2) detail pane with variable token breakdown, (3) pinned templates section, (4) action buttons. The **VISUALIZATION-SPEC Section 8.1** wireframe adds a fifth: the comparison table.

For a hunter examining a query with 4 templates, all of this is manageable. For a query with 15+ templates (the VIZ-SPEC says "top 15 + Other"), the bar chart becomes a stack of thin slivers, the detail pane requires scrolling, and the pinned templates compete for vertical space.

**Fix:** Collapse the pinned templates section by default. Show a badge count: "3 pinned" with a chevron to expand. The comparison table should only appear when Ctrl+Click is used, not as a persistent section. The detail pane should be a slide-over panel (like VS Code's peek view) rather than a permanent below-the-bar section. This reclaims vertical space for the bar chart, which is the primary value.

### 2.3 Evidence Graph at Scale

The UX-SPEC's wireframe (Section 5.6) shows 3 hypotheses, 3 receipts, 3 queries -- clean and readable. The VIZ-SPEC wireframe (Section 8.3) shows 4 hypotheses, 4 receipts, 6 queries -- still manageable.

But a real hunt can have 6 hypotheses, 15 receipts, and 20 queries. At that scale, a 50-node graph with ~40 edges becomes a hairball. The phase bounding boxes overlap. Edge routing becomes spaghetti.

Neither spec addresses this degradation path.

**Fix:** Add a "focus mode" that is the default for graphs above 20 nodes. In focus mode, only one hypothesis and its direct subgraph are shown at a time. A horizontal tab strip at the top lets the hunter switch between hypotheses: `[HYP-01] [HYP-02] [HYP-03] [All]`. The "All" tab shows the full graph for hunters who want the overview. This is progressive disclosure applied to the graph itself.

### 2.4 Multi-Source Timeline Swim Lane Explosion

UX-SPEC Section 6.1 shows swimlanes as connector-entity pairs. With 3 entities and 3 connectors each, that is 9 swimlanes at 40px each = 360px. Barely fits in a bottom panel.

With 10 entities and 4 connectors, that is 40 swimlanes = 1600px. The panel becomes a vertical scrolling nightmare. The hunter cannot see cross-entity correlation without scrolling.

**Fix:** Default swimlane grouping should be "By Entity" with connectors collapsed into a single lane per entity. Use marker shape and color to distinguish connectors within the lane (this is already specified in VIZ-SPEC Section 3.1 event markers). Add a "Split by Connector" toggle that expands the selected entity into per-connector sublanes. This keeps the default at N swimlanes (number of entities) rather than N*M (entities * connectors).

### 2.5 Glance Value Assessment

| View | Glance Value (what can be learned in <2 seconds) | Rating |
|------|--------------------------------------------------|--------|
| Status Bar | Hunt name, phase, verdict counts, integrity | Excellent |
| Sidebar (collapsed) | Hunt name, hypothesis verdicts (icons), phase status | Good |
| Sidebar (expanded) | Which queries/receipts exist, severity badges | Good |
| Template Viewer | Dominant template and its proportion | Good |
| Template Viewer (comparison) | Whether a template exists in both queries | Excellent |
| Evidence Graph | How many hypotheses are supported/disproved | Fair -- requires scanning node colors |
| Multi-Source Timeline (zoomed out) | Where the event density spikes are | Good |
| Multi-Source Timeline (zoomed in) | Which events are anomalous | Good |
| Anomaly Scorecard (CodeLens) | Deviation score and category | Excellent |
| Evidence Integrity (Problems panel) | Count of errors/warnings | Good (native VS Code pattern) |

The weakest glance value is the Evidence Graph. At a glance, all the hunter sees is a cluster of colored rectangles. The verdict information is encoded in border color, which is a weak visual channel for pre-attentive processing.

**Fix:** Add a summary strip above the graph: `3 Supported | 1 Disproved | 0 Inconclusive | Strongest chain: HYP-02 (Score 6)`. This gives the graph the same status-at-a-glance that the status bar provides for the hunt overall.

---

## 3. VS Code UX Conventions

### 3.1 Sidebar at Narrow Widths

The UX-SPEC defines the sidebar as a TreeView (Section 2.1), which is the correct VS Code pattern. However, the tree node labels include long text like `QRY-20260328-001 [4T]` and `RCT-20260328-001 [5]`. At VS Code's minimum sidebar width of 170px (user-configured, commonly 200-250px), these labels will truncate.

VS Code's own tree views handle this with `TreeItem.description`, which renders secondary text right-aligned in a dimmer color and truncates independently from the label.

**Fix:** Use `TreeItem.label` for the short ID (`QRY-001`) and `TreeItem.description` for the metadata (`4T, 312 events`). The VIZ-SPEC's sparklines in the sidebar (Section 5.1) are rendered as inline SVG in the description, which VS Code tree views do support via `TreeItem.iconPath` but NOT in the description field. Inline SVG descriptions are not a supported VS Code tree view feature. The sparklines should use `TreeItem.iconPath` with dynamically generated SVG data URIs, or be dropped entirely in favor of the numeric badge (which works reliably at all widths).

### 3.2 Sparklines in TreeView: Feasibility Concern

VIZ-SPEC Section 5.1 specifies 80x12px sparklines rendered as inline SVG in the tree view item's description. This is **not feasible** with the VS Code TreeView API. The `TreeItem.description` field accepts only a plain string. You cannot embed SVG or HTML in it.

The only way to get graphical elements into a tree view is through `TreeItem.iconPath` (one icon per node, left-aligned) or by using a `WebviewView` instead of a native `TreeView`.

Switching to a `WebviewView` for the sidebar would give full HTML/SVG control but would lose native VS Code tree behaviors: keyboard navigation, collapse memory, context menus via `contributes.menus`, selection sync, and accessibility (screen reader support for tree structures). This is a significant trade-off.

**Fix:** Drop sparklines from the sidebar. Use the numeric deviation score badge (which works via `TreeItem.iconPath` with a small SVG data URI showing a colored circle with a number). Sparklines can be shown in the Evidence Graph or as a separate webview panel, but they should not drive the sidebar away from native TreeView.

### 3.3 Keyboard Shortcut Conflicts

UX-SPEC Appendix D proposes:
- `Ctrl+Shift+H` -- Focus Hunt Sidebar
- `Ctrl+Shift+T` -- Open Template Viewer
- `Ctrl+Shift+G` -- Show Evidence Graph

`Ctrl+Shift+G` is already bound to VS Code's **Source Control** view (Git). This is a core VS Code shortcut and overriding it will confuse every user who uses Git.

`Ctrl+Shift+T` is already bound to **Reopen Closed Editor** in VS Code. Another very commonly used shortcut.

`Ctrl+Shift+H` is already bound to **Replace in Files**. Less commonly used but still standard.

**Fix:** Do not bind global shortcuts that conflict with VS Code defaults. Instead:
- Register commands without default keybindings.
- Document them in the extension's `keybindings` contribution as suggestions, with `"when"` clauses scoped to `thruntGod.huntActive`.
- Alternatively, use `Ctrl+K Ctrl+H` (chord) for hunt sidebar, `Ctrl+K Ctrl+T` for template viewer, etc. Chords are the VS Code convention for extension-specific shortcuts.

### 3.4 Status Bar Etiquette

The UX-SPEC places the hunt identity on the **left** side of the status bar (Section 1.3) and the integrity status on the **right** side.

VS Code convention: the left side of the status bar is reserved for editor state (branch name, encoding, EOL, language mode). Extensions should use the right side or the very far left (negative priority).

Two status bar items from one extension is acceptable but borderline. GitLens does it. But placing hunt identity on the left will push native items to the right and feel intrusive.

**Fix:** Consolidate to a single status bar item on the left with priority `-100` (far left, before git branch). Combine hunt identity and integrity into one item: `$(shield) OAuth Phishing | P3/3 | 2S 1D | OK`. Clicking opens a quick pick with detailed status and navigation options. This follows the pattern set by extensions like Docker and Remote-SSH.

### 3.5 Webview Panel Sizing

UX-SPEC Section 3.5 specifies the Template Viewer with a minimum width of 400px. VS Code webview panels do not support minimum width constraints. The panel will render at whatever width the user drags it to, including 200px.

**Fix:** Design for graceful degradation. At widths below 400px, stack the bar chart and detail pane vertically (already mentioned in UX-SPEC Section 3.5) but also reduce the bar chart to show only the top 3 templates with a "+N more" label. At widths below 300px, switch to a compact list view (template name + count, no bar chart). The VIZ-SPEC should specify these breakpoints.

---

## 4. Missing User Journeys

### 4.1 Error States

Neither spec addresses what happens when:

**Malformed artifact:** A QRY-*.md file has a corrupted JSON code block in the Template Clustering section. The parser throws. What does the user see?

**Fix:** Show a yellow warning banner at the top of the Template Viewer: "Could not parse template data for QRY-20260328-001. The Template Clustering JSON block may be malformed." Include a "Show Raw" button that opens the QRY file scrolled to the offending section. In the sidebar tree, show the query node with a warning icon (`$(warning)`) instead of the template count badge.

**Connector timeout / empty results:** A QRY-*.md file has `result_status: 'error'` or `result_status: 'empty'`. The Template Viewer would have nothing to show.

**Fix:** Show an empty state specific to the error type. For `error`: "Query execution failed. See the query log for details." with a link to the error section. For `empty`: "No events matched this query. Consider broadening the time window or adjusting filters." For `partial`: Show available templates with a banner: "Partial results -- 3 of 5 pages retrieved before timeout."

**Missing frontmatter fields:** A receipt is missing `related_hypotheses`. The evidence graph cannot draw edges.

**Fix:** Draw the receipt node as an orphan (unconnected) with a dashed border and a tooltip: "This receipt has no linked hypotheses. Add `related_hypotheses` to its frontmatter." Register this as an Info-level diagnostic.

### 4.2 First-Time User / Onboarding

The UX-SPEC Section 2.4 handles the "no hunt" empty state well (shield icon + "Start New Hunt" button). But it does not address:

**Extension installed, wrong workspace:** A developer installs the extension but opens a regular code project. The sidebar activates with the empty state and a "Start New Hunt" button. This is confusing for someone who installed it to try later.

**Fix:** Do not contribute the activity bar icon when no `.hunt/` or `.planning/` directory is detected. Use `"when": "thruntGod.huntDetected"` on the view container. The extension remains silent until relevant. This follows the "lazy everything" architecture principle.

**First hunt, no artifacts yet:** The hunter runs `THRUNT: New Hunt Case` and gets MISSION.md. But the sidebar tree requires MISSION.md + HUNTMAP.md for full activation. Between creating the mission and shaping hypotheses, the sidebar is partially populated.

**Fix:** Define progressive activation states:
1. Only MISSION.md exists: Show Mission node + "Shape hypotheses to continue" prompt.
2. MISSION.md + HYPOTHESES.md: Show Mission + Hypotheses + "Create a huntmap to plan phases" prompt.
3. Full artifact set: Normal operation.

Each state should feel intentional, not broken.

### 4.3 Reviewing Someone Else's Hunt

Journey 3 (UX-SPEC Section 10) covers a manager reviewing a completed hunt, which is good. But it does not address:

**Opening a `.planning/` directory from a different repository.** A senior analyst receives a tarball or git clone of a colleague's hunt. The file paths in frontmatter (`related_queries`, `related_receipts`) may use relative paths that work in the original workspace but not in the reviewer's.

**Fix:** All artifact references should be resolved by ID (e.g., `QRY-20260328-001`), not by file path. The store should resolve IDs to URIs by scanning the `.hunt/` directory. This is already implied by the architecture but should be explicitly stated as a design requirement.

**Read-only review mode.** When opening someone else's hunt, the "Run Phase" and "New Hunt Case" commands should not be prominent. The UI should detect whether the CLI is available and whether the workspace is the hunt owner's, and suppress write-oriented commands.

**Fix:** Add a `thruntGod.readOnlyMode` context variable. Set it to true when the workspace is detected as a read-only review (no CLI available, or user preference). Hide "Run Phase" and "New Hunt Case" in this mode.

### 4.4 Multi-Monitor / Panel Detachment

VS Code does not support detaching webview panels to separate windows. This is a VS Code platform limitation, not an extension limitation. The specs do not mention this.

For a SOC analyst with two monitors, the ideal setup is: code/artifacts on monitor 1, evidence graph and timeline on monitor 2.

**Fix:** Document this limitation explicitly. Suggest the workaround: use VS Code's "Duplicate Workspace in New Window" command, then open the Evidence Graph in the second window. Since the extension watches the filesystem, both windows will stay synchronized. This is not ideal but it works today. File a VS Code feature request for webview panel extraction.

---

## 5. Accessibility

### 5.1 Screen Reader Experience

The UX-SPEC's sidebar uses a native `TreeView`, which is good -- VS Code's tree views expose ARIA tree roles automatically. Screen readers will announce: "Hunt tree, Mission, expanded, 3 items. Hypotheses, collapsed. Phases, collapsed."

However, the tree node labels include visual-only information. A badge showing `[4T]` reads as "four T" to a screen reader, which is meaningless.

**Fix:** Set `TreeItem.accessibilityInformation` on every node. For QRY nodes: `{ label: "Query QRY-20260328-001, 4 templates, 312 events" }`. For RCT nodes: `{ label: "Receipt RCT-20260328-001, deviation score 5, high severity, supports hypothesis 1" }`. For hypothesis nodes: `{ label: "Hypothesis 1, OAuth consent phishing, verdict supported" }`.

### 5.2 Webview Accessibility

The three webview panels (Template Viewer, Evidence Graph, Timeline) are rendered as iframes. Screen readers cannot navigate into webview iframes using standard VS Code tree navigation. The webview content itself must be accessible.

**Neither spec addresses ARIA roles for D3-rendered SVG or Canvas elements.**

**Template Viewer (SVG stacked bar):** Each bar segment needs `role="img"` with `aria-label="Template: Authentication failed for email from IP, 1189 events, 95.3 percent"`. The bar chart as a whole needs `role="list"`.

**Evidence Graph (SVG DAG):** Each node needs `role="button"` with `aria-label`. Edges need `aria-describedby` linking source and target. The graph needs `role="application"` with keyboard navigation (Tab between nodes, Enter to select, Arrow keys to traverse edges).

**Timeline (Canvas):** Canvas elements are invisible to screen readers. This is a fundamental accessibility gap. The VIZ-SPEC should specify a parallel accessible representation -- a data table with the same information (timestamp, entity, event type, anomaly score) that is rendered as a `<table>` off-screen but available to screen readers via `aria-live` region.

**Fix:** Add an accessibility section to both specs that specifies ARIA roles for each interactive element in every webview. For the Canvas-based timeline, provide a screen-reader-accessible data table as an alternative view, toggleable via a button inside the webview.

### 5.3 Keyboard Navigation

The UX-SPEC's command palette integration (Section 7) is inherently keyboard-accessible. `Ctrl+Shift+P` followed by typing "THRUNT" surfaces all commands. This is good.

However, webview panels trap keyboard focus. Once focus is inside a webview, standard VS Code shortcuts (like `Ctrl+Shift+P`) do not work until the user presses `Escape` to return focus to VS Code. Neither spec mentions this.

**Fix:** Document the focus trap behavior. Inside each webview, implement a visible "Return to VS Code" button or respond to `Escape` by calling `vscode.postMessage({ type: 'blur' })` which the extension host handles by executing `workbench.action.focusActiveEditorGroup`. Also implement `Tab` cycling within the webview that wraps to a "focus trap escape" sentinel.

### 5.4 High Contrast Theme

UX-SPEC Section 9.3 mentions High Contrast support (border width increases, WCAG AAA compliance). The VISUALIZATION-SPEC does not mention High Contrast at all.

The VIZ-SPEC's deviation score gradient (Section 7.4) goes from green-400 to red-500. In VS Code's High Contrast Dark theme, the background is pure black (`#000000`). Green-400 (`#4ade80`) against black has a contrast ratio of 10.3:1 (passes AAA). But the mid-range yellow-400 (`#facc15`) against black has a contrast ratio of 14.8:1 (passes). However, against High Contrast Light (white background `#ffffff`), yellow-400 has a contrast ratio of only 1.8:1 (fails AA).

**Fix:** Define High Contrast variants for the deviation score gradient in the VIZ-SPEC. For High Contrast Light, shift yellow to amber-700 (`#b45309`, contrast ratio 4.9:1 against white). The VIZ-SPEC should reference VS Code's `window.activeColorTheme.kind` (which is `HighContrast` or `HighContrastLight`) and switch palettes accordingly.

---

## 6. Feature Prioritization

### 6.1 If You Ship Only Three Features

**1. Hunt Sidebar (TreeView) with status badges and file opening.**
Why: This is the anchor. Every other feature depends on the hunter having a semantic navigation point. Without the sidebar, the extension is useless. It uses native VS Code APIs (TreeView, TreeItem, context menus) which are the most stable and accessible surface. Implementation is medium effort with high reliability.

**2. Drain Template Viewer (stacked bar + detail pane).**
Why: This is the differentiator. No other tool shows Drain template clustering results visually. The stacked bar with cross-query comparison is the "aha moment" that justifies installing the extension. Observable Plot keeps the rendering lightweight. Skip the treemap drill-down, skip template pinning, skip the comparison matrix in v1. Just show the bars and the detail pane on click.

**3. Evidence Integrity Warnings (Diagnostics in Problems panel).**
Why: This uses VS Code's native diagnostic infrastructure (DiagnosticCollection, CodeActions, Problems panel). It is the highest-impact feature for hunt quality because it catches anti-patterns in real time as the hunter writes receipts. It requires no webview, no D3, no React. Pure extension host TypeScript. The quick-fix actions (insert prediction template, link to receipt) save more time than any visualization.

### 6.2 MVP Definition

The MVP proves: "A threat hunter can navigate a completed hunt, visually inspect template clustering, and catch evidence quality issues -- all without leaving VS Code."

Specifically:
- Sidebar tree with semantic structure (not file tree)
- Open artifact files from sidebar
- Template Viewer: stacked bar for one query at a time (no comparison, no pinning)
- CodeLens on receipts showing deviation score
- Diagnostics for the three Error-level anti-patterns (post-hoc rationalization, missing baseline, causality without evidence)
- Status bar with hunt identity

Not in MVP: Evidence Graph, Timeline, template comparison, sparklines, template pinning, entity focus, export.

### 6.3 The Trap Feature: Multi-Source Timeline

The Multi-Source Timeline is the most complex feature in the entire spec. It requires:
- Canvas rendering with quadtree hit-testing
- Three LOD levels with animated transitions
- Brush selection with cross-panel filtering
- Swimlane layout with multiple grouping modes
- Zoom with minimap
- Template band overlays

This is easily 3-4 weeks of implementation for a single developer. It will feel essential during design reviews because "timeline" sounds fundamental to threat hunting. But consider: the timeline data already exists in the QRY-*.md entity timeline tables. The hunter can read it as markdown today. The visualization adds convenience, not capability.

Meanwhile, the Template Viewer with cross-query comparison (which is estimated at medium effort in both specs) provides capability that does not exist in any form today. The evidence integrity diagnostics provide capability that currently requires running a CLI command and reading terminal output.

**The trap:** Building the timeline first because it looks impressive in demos, while the template viewer and diagnostics deliver more daily value to working hunters.

### 6.4 Recommended Phasing

| Phase | Features | Estimated Effort | Value |
|-------|----------|-----------------|-------|
| v0.1 (MVP) | Sidebar tree, artifact file opening, status bar, CodeLens on receipts | 1 week | Navigable hunt |
| v0.2 | Template Viewer (single query, stacked bar + detail) | 1 week | Template visibility |
| v0.3 | Evidence Integrity diagnostics + quick-fixes | 1 week | Quality enforcement |
| v0.4 | Template comparison (two queries side by side) | 1 week | Cross-query insight |
| v0.5 | Evidence Graph (Dagre layout, click-to-open) | 1-2 weeks | Evidence chain visibility |
| v0.6 | Multi-Source Timeline (LOD rendering) | 2-3 weeks | Temporal correlation |
| v0.7 | Template pinning, sparklines, entity focus | 1-2 weeks | Power user features |

---

## Summary of Required Actions

### Must-Fix Before Implementation

| # | Issue | Severity | Section |
|---|-------|----------|---------|
| 1 | Treemap vs stacked bar conflict between ARCH and UX/VIZ specs | Critical | 1.1 |
| 2 | Force-directed vs Dagre layout conflict | Critical | 1.2 |
| 3 | Evidence graph node shapes (3 different specs) | High | 1.3 |
| 4 | Edge direction conflict | High | 1.4 |
| 5 | Template pin storage violates read-only principle | High | 1.5 |
| 6 | Color palette drift between UX-SPEC and VIZ-SPEC | Medium | 1.6 |
| 7 | Single-click behavior conflict on graph nodes | Medium | 1.7 |
| 8 | Keyboard shortcut conflicts with VS Code defaults | High | 3.3 |
| 9 | Sparklines in TreeView not feasible with VS Code API | High | 3.2 |

### Should-Fix Before v1.0

| # | Issue | Section |
|---|-------|---------|
| 10 | No critical-alert status bar behavior | 2.1 |
| 11 | No error state designs (malformed artifacts, empty results) | 4.1 |
| 12 | No onboarding for partial activation states | 4.2 |
| 13 | Webview accessibility (ARIA roles, Canvas alternative) | 5.2 |
| 14 | Focus trap handling in webviews | 5.3 |
| 15 | High contrast palette for VIZ-SPEC deviation gradient | 5.4 |
| 16 | Evidence graph degradation at 20+ nodes | 2.3 |
| 17 | Timeline swimlane explosion with many entities | 2.4 |

### Nice-to-Have

| # | Issue | Section |
|---|-------|---------|
| 18 | Read-only review mode for shared hunts | 4.3 |
| 19 | Multi-monitor documentation and workaround | 4.4 |
| 20 | Screen reader labels for tree view nodes | 5.1 |
| 21 | Webview panel graceful degradation at narrow widths | 3.5 |
