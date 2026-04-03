# THRUNT God VS Code Extension -- Visualization Design Specification

**Status:** Draft  
**Author:** Visualization Specialist  
**Date:** 2026-04-02  
**Scope:** Drain Template Viewer, Multi-Source Timeline, Evidence Graph, Anomaly Sparklines

---

## Table of Contents

1. [Data Shape Reference](#1-data-shape-reference)
2. [Drain Template Viewer -- Primary Visualization](#2-drain-template-viewer----primary-visualization)
3. [Multi-Source Timeline](#3-multi-source-timeline)
4. [Evidence Graph Visualization](#4-evidence-graph-visualization)
5. [Anomaly Score Sparklines](#5-anomaly-score-sparklines)
6. [Technical Implementation](#6-technical-implementation)
7. [Color System](#7-color-system)
8. [ASCII Wireframes](#8-ascii-wireframes)

---

## 1. Data Shape Reference

These are the exact shapes produced by the THRUNT God runtime. Every visualization decision in this document traces back to these structures.

### 1.1 DrainParser.addMessage() Return

```typescript
{
  clusterId: string;         // 16 hex chars, sha256-based, content-addressed
  template: string;          // e.g. "Authentication failed for <EMAIL> from <IP> -- INVALID_CREDENTIALS"
  changeType: 'cluster_created' | 'cluster_template_changed' | 'none';
  clusterSize: number;       // running count of events in this cluster
}
```

### 1.2 reduceEvents() Output (metadata.templates on ResultEnvelope)

```typescript
{
  algorithm: 'drain';
  config: {
    depth: number;                    // default 4
    similarity_threshold: number;     // default 0.4
    max_clusters: number | null;
  };
  cluster_count: number;
  clusters: Array<{
    template_id: string;              // 16 hex char content-hash
    template: string;                 // human-readable template with <*>, <IP>, <EMAIL>, etc.
    count: number;                    // events in cluster
    sample_event_id: string | null;   // first event ID for preview
    event_ids: string[];              // capped at 100
  }>;
  reduced_at: string;                 // ISO timestamp
}
```

### 1.3 ResultEnvelope (abbreviated, relevant fields)

```typescript
{
  version: '1.0';
  query_id: string;
  connector: { id: string; profile: string; tenant: string | null; region: string | null };
  dataset: { kind: 'events' | 'alerts' | 'identity' | 'endpoint' | 'cloud' | 'email' | ... };
  status: 'ok' | 'partial' | 'error' | 'empty';
  time_window: { start: string; end: string; timezone: string };
  counts: { events: number; entities: number; relationships: number; evidence: number; warnings: number; errors: number };
  events: Array<{ id: string; title?: string; summary?: string; [key: string]: any }>;
  entities: Array<object>;
  metadata: {
    connector_id: string;
    templates?: /* reduceEvents output above */;
    [key: string]: any;
  };
}
```

### 1.4 Receipt Anomaly Framing (from Markdown receipts)

Deviation scores use a 1-6 integer scale:

| Score | Label | Meaning |
|-------|-------|---------|
| 1 | Minimal | Trivial deviation, likely noise |
| 2 | Low | Unusual but within operational variance |
| 3 | Medium | Matches known TTP, warrants investigation |
| 4 | High | Multiple reinforcing signals |
| 5 | High-Critical | Strong multi-factor evidence |
| 6 | Critical | Cumulative evidence chain, high confidence malicious |

Scores are composited from a base category (EXPECTED_BENIGN, UNEXPECTED, EXPECTED_MALICIOUS) plus modifiers (+1 for each reinforcing factor: multiple entities, no change ticket, prior anomaly, ATT&CK chain match).

### 1.5 Evidence Hierarchy

```
Hypothesis (HYP-xx)
  |-- Receipt (RCT-xxxxxxxx-xxx)
  |     |-- Query (QRY-xxxxxxxx-xxx)
  |     |-- Query (QRY-xxxxxxxx-xxx)
  |-- Receipt (RCT-xxxxxxxx-xxx)
        |-- Query (QRY-xxxxxxxx-xxx)
```

Receipt frontmatter fields: `receipt_id`, `claim_status` (supports | contradicts | context), `related_hypotheses[]`, `related_queries[]`, `result_status` (ok | partial | error | empty).

Hypothesis verdicts: Supported, Disproved, Inconclusive, Open.

---

## 2. Drain Template Viewer -- Primary Visualization

### 2.1 Visualization Option Analysis

#### Option A: Treemap (area = event count, color = template category)

| Criterion | Score (1-5) | Notes |
|-----------|-------------|-------|
| Information density | 5 | Area encodes count; color encodes category; text label shows template. Excellent space efficiency. |
| Interaction affordance | 4 | Hover for details, click to filter. Well-understood metaphor. |
| VS Code webview constraints | 3 | Treemap layout computation is CPU-intensive for 100+ clusters. Requires careful canvas sizing inside the webview panel. |
| Dark/light theme compat | 4 | Fill colors work well on both backgrounds. Text contrast needs per-theme calculation. |
| Comparison across queries | 2 | Hard to compare two treemaps side by side -- area perception is imprecise. |
| Scalability (1-200 clusters) | 3 | Below 5 clusters, treemap looks sparse. Above 50, labels become illegible. |

#### Option B: Sunburst (hierarchy: connector -> dataset -> template)

| Criterion | Score (1-5) | Notes |
|-----------|-------------|-------|
| Information density | 4 | Hierarchy is informative, but angular area is harder to read than rectangular area. |
| Interaction affordance | 3 | Click-to-zoom-in is powerful but adds navigation complexity. |
| VS Code webview constraints | 2 | Circular layout wastes significant panel space in a typically narrow side panel. |
| Dark/light theme compat | 4 | Same as treemap. |
| Comparison across queries | 1 | Comparing two sunbursts is nearly impossible. |
| Scalability (1-200 clusters) | 2 | Works well with 3 levels but becomes unreadable with many templates per dataset. |

#### Option C: Horizontal Stacked Bar (one bar per query, segments = templates)

| Criterion | Score (1-5) | Notes |
|-----------|-------------|-------|
| Information density | 4 | Length encodes count, color encodes template. Multiple queries stack vertically for comparison. |
| Interaction affordance | 5 | Hover for tooltip, click segment to filter. Extremely intuitive. |
| VS Code webview constraints | 5 | Horizontal bars fit naturally in VS Code panels (both side and bottom). Lightweight to render. |
| Dark/light theme compat | 5 | Simple fill rectangles; easy to ensure contrast. |
| Comparison across queries | 5 | This is the killer feature: stack bars vertically, same template = same color, and cross-query comparison is instant. |
| Scalability (1-200 clusters) | 4 | Works well up to ~15 visible templates per bar (tiny segments grouped as "Other"). |

#### Option D: Bubble Chart (size = count, cluster by similarity)

| Criterion | Score (1-5) | Notes |
|-----------|-------------|-------|
| Information density | 3 | Area encodes count, position is arbitrary (no meaningful axis). |
| Interaction affordance | 3 | Click/hover works but spatial arrangement is decorative, not informative. |
| VS Code webview constraints | 3 | Force layout requires animation frames; can be janky in webview. |
| Dark/light theme compat | 4 | Circles with fills work fine. |
| Comparison across queries | 1 | No meaningful comparison layout. |
| Scalability (1-200 clusters) | 3 | Overlapping bubbles at high counts; collision avoidance is expensive. |

### 2.2 Recommendation

**Primary: Horizontal Stacked Bar.** Justification:

1. **Cross-query comparison is the differentiating interaction.** A threat hunter runs a query, sees 3 templates. They run a second query with a different time window. The stacked bar lets them instantly see "Template T1 was 95% of Query A but only 8% of Query B." No other visualization makes this comparison as effortless.

2. **VS Code webview fit.** The side panel is typically 300-400px wide. A horizontal bar fills this width naturally. Vertical stacking of multiple queries is how VS Code panels scroll. Zero wasted space.

3. **Rendering performance.** A stacked bar is a sequence of `<rect>` elements. No layout algorithms, no force simulations, no treemap partitioning. First render under 50ms for 20 templates.

4. **Accessibility.** Bar segment length is the most accurately perceived visual encoding (per Cleveland & McGill). Hunters can compare 95.3% vs. 3.4% at a glance.

**Secondary: Treemap (drill-down mode).** When a hunter clicks a single query's bar, the bottom panel expands to a treemap showing that query's template distribution in full detail. The treemap rewards exploration: hover reveals template text, click reveals the sample event. This is the "zoom in" complement to the bar's "compare across" strength.

The treemap activates only on explicit user action (click a bar segment or the "Expand" button). It never competes with the bar for panel space.

### 2.3 Interaction Design

#### Hover Tooltip

Hovering a bar segment shows a tooltip anchored to the cursor:

```
+-----------------------------------------------+
| T1: Authentication failed for <EMAIL>          |
|     from <IP> -- INVALID_CREDENTIALS           |
|                                                |
|  Count: 1,189  (95.3%)                         |
|  Template ID: a7f3b2c1e9d04f68                 |
|                                                |
|  Sample event:                                 |
|  "Authentication failed for admin@meridian.io  |
|   from 198.51.100.42 -- INVALID_CREDENTIALS"   |
+-----------------------------------------------+
```

Fields shown:
- Template text (full, with mask placeholders highlighted in a distinct color)
- Event count and percentage of total query events
- Template ID (truncated to 16 chars; already the full ID)
- Sample event text (from `sample_event_id` lookup, first 200 chars)

The tooltip uses a monospace font for the template and sample event to preserve structural alignment. Mask placeholders (`<IP>`, `<EMAIL>`, `<TS>`, `<HASH>`, `<UUID>`, `<PATH>`, `<WINPATH>`, `<EPOCH>`, `<MAC>`, `<*>`) are rendered in the connector accent color.

#### Click: Filter and Focus

**Single click on a bar segment:**
- The event list (if visible in another panel) filters to show only events belonging to that template's `event_ids[]`.
- The timeline (if visible) highlights events belonging to that template, dimming all others.
- The clicked segment visually "pops out" with a 2px border and slight scale (transform: scaleY(1.1)).
- A "breadcrumb" appears above the bar: `QRY-20260329-001 > T1: Authentication failed for <EMAIL>...`

**Double-click on a bar segment:**
- Opens the treemap drill-down in the bottom panel for that query.
- The treemap highlights the double-clicked template.

**Click on empty space or the "X" on the breadcrumb:**
- Clears all filters, restores full event list and timeline.

#### Multi-Select: Cross-Query Template Comparison

**Ctrl+Click (Cmd+Click on macOS) on segments across different query bars:**
- Highlights the same template across all queries where it appears.
- A comparison panel appears below the bars:

```
Template Comparison: "Authentication failed for <EMAIL> from <IP> -- INVALID_CREDENTIALS"
+---------------------------------------------------------------------+
| Query               | Count | % of Query | Time Window              |
|---------------------|-------|------------|--------------------------|
| QRY-20260329-001    | 1,189 |    95.3%   | 14:00:00Z -- 14:15:00Z   |
| QRY-20260329-005    |    12 |     8.1%   | 16:00:00Z -- 18:00:00Z   |
+---------------------------------------------------------------------+
```

This answers the hunter's core question: "Did the spray activity stop, or did it move to a different time window?"

#### Template Pinning

**Right-click a template segment -> "Pin Template":**
- The template is added to a "Pinned Templates" section at the top of the panel.
- Pinned templates persist across phase transitions (stored in the `.hunt/STATE.md` or a `.hunt/.viz-state.json` file).
- Pinned templates show a sparkline of their count over time (if multiple queries exist for different time windows).
- Use case: pin the "Authentication failed" template at the start of phase 1, then watch its count evolve as you expand the time window in phase 2.

Pin state is serialized as:

```json
{
  "pinned_templates": [
    {
      "template_id": "a7f3b2c1e9d04f68",
      "template_text": "Authentication failed for <EMAIL> from <IP> -- INVALID_CREDENTIALS",
      "pinned_at": "2026-03-29T15:30:00Z",
      "source_query_id": "QRY-20260329-001"
    }
  ]
}
```

#### Search and Filter

A text input above the bars: `[Search templates...]`

- Searches template text using substring match (case-insensitive).
- Typing `failed` highlights all bar segments whose template contains "failed" and dims the rest.
- Typing `<IP>` finds all templates that have IP variability.
- Typing a template_id (hex string) jumps to that template.
- Empty search restores all segments.

#### Sort Controls

A dropdown/button group above the bars:

| Sort | Behavior |
|------|----------|
| By Count (default) | Largest template segment first (leftmost in bar) |
| By Recency | Templates with most recent events first |
| By Deviation | Templates associated with highest-scoring receipts first (requires cross-referencing receipt frontmatter) |
| By Novelty | Templates that appeared in later queries but not earlier ones are highlighted first |

### 2.4 Cross-Query Comparison

#### Template Presence Matrix

When 3+ queries are loaded, a toggle button reveals the **Template Presence Matrix**:

```
                    QRY-001   QRY-002   QRY-003
Auth failed <EMAIL>  1,189      12         0
Process created       43        89       201
MFA challenge         15         3         0
New template: --       0         0        47
```

Cells are heat-colored by count (white = 0, light blue = low, dark blue = high; see Color System). Zero cells are explicitly shown with a dash, not blank -- absence of evidence is itself evidence.

#### Template Diff

When two queries are selected for comparison, a diff view shows:

- **Shared templates:** templates present in both queries, with delta counts and percentage change.
- **Left-only templates:** templates in Query A but not Query B (potential stopped activity).
- **Right-only templates:** templates in Query B but not Query A (potential new activity).

Template structural similarity is computed by comparing tokenized templates position-by-position (reusing `getSeqDistance` from the Drain parser). Templates with similarity > 0.7 but different IDs are flagged as "structural variants" -- meaning the Drain parser diverged them, but they may represent the same underlying activity with a parameter shift.

#### Template Evolution

For queries that cover successive time windows against the same connector+dataset, a sparkline strip shows each template's count over time:

```
Auth failed <EMAIL>  [==========|==|........]  "Peaked at 14:08, dropped by 16:00"
Process created      [...|=====|============]  "Ramping up through afternoon"
```

This is the "campaign heartbeat" view. A hunter can see whether an attack is ongoing, concluded, or shifting tactics.

---

## 3. Multi-Source Timeline

### 3.1 Layout Design

#### Axes

- **X-axis: Time.** Auto-scaled from the union of all loaded query time windows. Tick marks at human-readable intervals (auto-selected: 1min, 5min, 15min, 1hr, 6hr, 1day based on total duration). The current zoom level is shown as a range label: `14:00:00 -- 14:15:00 UTC (15 min)`.

- **Y-axis: Swimlanes.** Configurable via a dropdown:
  - **By Connector** (default): One lane per connector_id (okta, m365, crowdstrike, etc.). Groups all events from each data source.
  - **By Entity**: One lane per unique entity (user, host, IP). Best for tracking an attacker's lateral movement.
  - **By Hypothesis**: One lane per HYP-xx. Events are placed in the lane of their associated hypothesis (via receipt -> query -> events mapping).
  - **By Dataset**: One lane per dataset.kind (identity, endpoint, cloud, email).

Each swimlane has a label column on the left (120px fixed width) and the timeline area on the right.

#### Event Markers

Each event is a marker on the timeline. The marker encoding:

| Visual Property | Encodes |
|----------------|---------|
| X position | Event timestamp |
| Y position | Swimlane assignment |
| Shape | Event type: circle = authentication, diamond = process, square = file operation, triangle = network, star = alert |
| Fill color | Connector (see Color System section 7) |
| Border | Template membership: events in the same Drain template share the same border style (solid, dashed, dotted -- cycling through 3 most common templates) |
| Size | Default uniform 6px; anomaly-scored events scale to 8px-12px by deviation score |

#### Template Overlay

When a template is selected in the Template Viewer, a horizontal band appears behind the event markers in the timeline:

- The band spans the time range of the earliest to latest event in that template.
- Band height fills 60% of the swimlane.
- Band fill color matches the template's color from the stacked bar, at 15% opacity.
- Band border (left and right edges) is the template color at full opacity.
- Multiple selected templates produce multiple overlapping bands (with increasing y-offset to avoid complete overlap).

This overlay answers: "When did this template's events actually occur?" without requiring the hunter to mentally map individual markers.

#### Anomaly Markers

Events that belong to receipts with deviation scores >= 3 receive an additional visual layer:

- A circular "heat ring" around the event marker.
- Ring color follows the deviation score gradient (green 1 -> yellow 3 -> orange 4 -> red 5-6; see Color System).
- Ring radius: `4px + (score * 2px)`, so a score-6 event has a 16px ring.
- On hover, the ring pulses once to draw attention.

#### Phase Boundaries

Vertical dashed lines mark phase transitions (sourced from `.hunt/HUNTMAP.md` phase dates). Each line is labeled at the top of the timeline: `Phase 1 | Phase 2`.

### 3.2 Interaction Design

#### Zoom

- **Scroll wheel on timeline area:** Zooms x-axis centered on cursor position. Zoom levels: 10s, 30s, 1m, 5m, 15m, 1h, 6h, 1d, 7d.
- **Pinch on trackpad:** Same as scroll wheel.
- **Zoom buttons:** `[+]` `[-]` `[Fit All]` in the toolbar. "Fit All" resets to show the full time range.
- **Y-axis does not zoom.** Swimlane height is fixed at 40px (configurable in settings).

#### Pan

- **Click-drag on timeline area:** Pans the x-axis. Cursor changes to grab hand.
- **Keyboard:** Left/Right arrow keys pan by one tick interval. Shift+Arrow pans by one screen width.

#### Brush Selection

- **Shift+click-drag:** Creates a blue highlight rectangle over a time range.
- Releasing the mouse filters all other views (Template Viewer, Event List, Evidence Graph) to the brushed time range.
- The brush range is shown as a label: `Selected: 14:05:00 -- 14:12:00 (7 min, 234 events)`.
- Clicking outside the brush clears it.

#### Entity Focus

- **Click a swimlane label** (when in "By Entity" mode): All events for that entity are highlighted (full opacity); all other events are dimmed to 20% opacity.
- **Ctrl+Click multiple labels:** Multi-entity focus. Useful for comparing two users' timelines.
- The focused entity's events are connected by a thin line (1px, dashed) showing the chronological sequence -- the "entity breadcrumb trail."

#### Hover: Event Detail Popup

Hovering an event marker shows:

```
+---------------------------------------------------+
| 14:10:33Z  Okta  identity                         |
|                                                    |
| Authentication succeeded                           |
| user: david.park@meridian.io                       |
| source_ip: 198.51.100.42                           |
| result: SUCCESS                                    |
|                                                    |
| Template: Auth <*> for <EMAIL> from <IP> -- <*>    |
| Cluster: a7f3b2c1e9d04f68 (43 events)             |
|                                                    |
| Anomaly: Score 6 (Critical)                        |
|   Receipt: RCT-20260329-002                        |
|   Hypothesis: HYP-02                               |
+---------------------------------------------------+
```

If the event has no anomaly score, the Anomaly section is omitted. The popup dismisses on mouseout or after 3 seconds of no movement.

### 3.3 Data Density Management

#### Problem

A typical hunt query returns 100-10,000 events. At 10,000 events in a 15-minute window on a 1200px-wide panel, that is 11+ events per pixel. Individual markers become a solid bar of overlapping circles.

#### Strategy: Level-of-Detail (LOD) Rendering

The timeline uses three LOD levels based on event density per pixel:

| Events/Pixel | LOD Level | Rendering |
|-------------|-----------|-----------|
| < 1 | Individual | Each event is a distinct marker with shape+color encoding |
| 1 -- 10 | Aggregate Markers | Events are binned into time buckets. Each bucket shows a single "stacked" marker with a count badge: `[23]`. Color shows the dominant connector. |
| > 10 | Heat Strip | The swimlane becomes a continuous heat strip where color intensity = event density. Template bands are still shown as overlays. Individual events are not visible until the user zooms in. |

LOD transitions are animated (200ms crossfade) as the user zooms. The current LOD level is shown in the toolbar: `View: Individual | Aggregate | Density`.

#### Progressive Disclosure

- **Zoomed out (Heat Strip):** The hunter sees the temporal shape of the data -- "there is a massive spike at 14:00-14:08 in the Okta lane."
- **Zoom in one level (Aggregate):** The spike resolves into buckets: "[189] [201] [214] [187] [198] [156] [44]" -- the attack ramp and drop-off.
- **Zoom in fully (Individual):** Individual markers appear. The hunter can hover each one.

At all LOD levels, the Template Overlay bands remain visible, providing structural context even when individual events are not rendered.

#### Virtualization

Only events within the visible x-axis range + 20% buffer on each side are rendered. Events outside this range are culled. Panning triggers incremental rendering, not full re-render.

---

## 4. Evidence Graph Visualization

### 4.1 Graph Layout

#### Node Hierarchy

The evidence graph is a directed acyclic graph (DAG) with three tiers:

```
Tier 0 (Top):     Hypothesis nodes (HYP-xx)
                       |
                       | "supported by" / "contradicted by"
                       v
Tier 1 (Middle):   Receipt nodes (RCT-xxxxxxxx-xxx)
                       |
                       | "sourced from"
                       v
Tier 2 (Bottom):   Query nodes (QRY-xxxxxxxx-xxx)
```

Edges flow downward (hypothesis -> receipt -> query). This matches the hunter's mental model: "I have a hypothesis. It is supported by this receipt. The receipt was built from these queries."

#### Layout Algorithm: Dagre (Hierarchical)

**Recommendation: Dagre** (part of the `dagre-d3` or `@dagrejs/dagre` package).

Justification:

1. The evidence graph is inherently hierarchical (3 tiers). Force-directed layouts would scramble the tier ordering, forcing the user to mentally reconstruct the hierarchy.
2. Dagre produces deterministic layouts -- the same graph always renders the same way. Force-directed layouts are non-deterministic and require stabilization time.
3. The graph is small (typically 2-6 hypotheses, 4-12 receipts, 6-20 queries). Dagre handles this in <5ms.
4. Dagre supports edge routing that avoids node overlap, producing clean connection lines.

Configuration:

```javascript
{
  rankdir: 'TB',        // top to bottom
  ranksep: 80,          // 80px between tiers
  nodesep: 40,          // 40px between nodes in same tier
  marginx: 20,
  marginy: 20,
  edgesep: 10,
}
```

#### Clustering

Receipts that share the same hypothesis are visually grouped with a light background rectangle (10% opacity of the hypothesis color). This creates implicit "evidence clusters" without requiring the user to follow edges.

### 4.2 Visual Encoding

#### Hypothesis Nodes

- **Shape:** Rounded rectangle, 180px wide x 60px tall.
- **Border:** 3px solid, color by verdict:
  - Supported: `#22c55e` (dark) / `#15803d` (light)
  - Disproved: `#ef4444` (dark) / `#dc2626` (light)
  - Inconclusive: `#eab308` (dark) / `#ca8a04` (light)
  - Open: `#94a3b8` (dark) / `#64748b` (light)
- **Fill:** 8% opacity of the border color.
- **Label:** `HYP-01` (bold) + first 40 chars of the hypothesis assertion on a second line.
- **Icon:** Small verdict icon in top-right corner (checkmark, X, question mark, circle).

#### Receipt Nodes

- **Shape:** Rectangle with slight corner radius (4px), variable width (140-200px) based on label length, 50px tall.
- **Border:** 2px solid. Color by `claim_status`:
  - supports: same green as Supported verdict
  - contradicts: same red as Disproved verdict
  - context: neutral gray `#94a3b8` (dark) / `#64748b` (light)
- **Fill:** White (dark theme: `#1e1e1e`) with left-side accent bar (4px wide) colored by deviation score.
- **Size modifier:** The node width scales by `1 + (deviation_score * 0.05)`, so a score-6 receipt is 30% wider than a score-1 receipt. This provides a pre-attentive cue: "the big nodes are the important ones."
- **Label:** `RCT-20260329-001` + abbreviated claim (first 30 chars).
- **Badge:** Deviation score in a small circle at top-right, colored by score gradient.

#### Query Nodes

- **Shape:** Small circle, 24px diameter.
- **Fill:** Connector color (see Color System).
- **Border:** 1px solid, slightly darker shade of the fill.
- **Label:** `QRY-001` (abbreviated) shown on hover only. At rest, the node shows the connector icon (a small glyph: shield for Okta, cloud for M365, terminal for CrowdStrike, etc.).
- **Grouping:** Query nodes from the same connector are placed adjacent and enclosed in a subtle background pill shape.

#### Edges

| Edge Type | Style | Color | Width |
|-----------|-------|-------|-------|
| Hypothesis -> Receipt (supports) | Solid | Green | 2px |
| Hypothesis -> Receipt (contradicts) | Dashed (4px dash, 4px gap) | Red | 2px |
| Hypothesis -> Receipt (context) | Dotted (2px dot, 4px gap) | Gray | 1px |
| Receipt -> Query (sourced from) | Solid | Gray (`#64748b`) | 1px |

Edge arrows point downward (from hypothesis to receipt, from receipt to query). Arrow heads are small (6px) and filled with the edge color.

**Edge thickness modifier:** For hypothesis -> receipt edges, the thickness scales with the receipt's deviation score: `1px + (score * 0.3px)`. A score-6 receipt's edge is 2.8px thick; a score-1 receipt's edge is 1.3px. This provides a visual "weight" to the evidence chain.

### 4.3 Interaction

#### Click Node -> Open Artifact

- Clicking a hypothesis node opens `.hunt/HYPOTHESES.md` in the VS Code editor, scrolled to the `### HYP-xx` heading.
- Clicking a receipt node opens `.hunt/RECEIPTS/RCT-xxxxxxxx-xxx.md` in the editor.
- Clicking a query node opens `.hunt/QUERIES/QRY-xxxxxxxx-xxx.md` in the editor.

All opens use `vscode.workspace.openTextDocument` + `vscode.window.showTextDocument` with `preserveFocus: false` so the editor takes focus.

#### Hover -> Tooltip

Hovering shows a tooltip with:

- **Hypothesis:** Full assertion text, verdict, confidence level.
- **Receipt:** Full claim text, deviation score with factor breakdown, event/template/entity counts.
- **Query:** Query statement (first 100 chars), time window, connector, event count.

#### Filter by Hypothesis

Clicking a hypothesis node's "Focus" button (small eye icon) dims all nodes and edges not connected to that hypothesis. The subgraph remains at full opacity. Other hypotheses fade to 15% opacity.

Clicking "Focus" again (or pressing Escape) restores full visibility.

#### Highlight Path (Evidence Chain)

Right-clicking a receipt and selecting "Trace Evidence Chain" highlights the full path from that receipt's queries up through the receipt to the connected hypothesis. All highlighted edges animate with a brief "flow" pulse (a moving dash pattern) to show directionality.

The status bar shows: `Evidence chain: QRY-20260329-001 -> RCT-20260329-001 -> HYP-01 (Supported, Score 4)`

---

## 5. Anomaly Score Sparklines

### 5.1 Sidebar Sparklines

In the sidebar tree view (the Hunt Explorer), each hypothesis entry shows an inline sparkline:

```
> HYP-01: Password spray [__/===\____]  Score: 4
> HYP-02: Account takeover [_____/=======]  Score: 6
> HYP-03: Data access [___/====\__]  Score: 5
v HYP-04: Other accounts [___________]  Disproved
```

The sparkline is 80px wide, 12px tall. Each receipt is a data point, placed chronologically. The y-axis is the deviation score (1-6). The line is colored using the score gradient at each point (green at 1, transitioning through yellow, orange, to red at 6).

The sparkline is rendered as an inline SVG element in the tree view item's description.

### 5.2 Editor Gutter Sparklines

When a receipt markdown file is open in the editor, the gutter (line number area) shows score indicators:

- The `## Anomaly Framing` heading line gets a colored circle in the gutter, colored by the deviation score.
- The `**Final score:**` line gets the same colored circle plus the numeric score.

These use VS Code's `DecorationRenderOptions` with `gutterIconPath` pointing to dynamically generated SVG data URIs.

### 5.3 Sparkline Interaction

- **Click a sparkline data point** in the sidebar: Opens the corresponding receipt file in the editor.
- **Hover over a sparkline** in the sidebar: Shows a tooltip listing all receipts with their scores:
  ```
  RCT-20260329-001: 4 (High)
  RCT-20260329-002: 6 (Critical)
  RCT-20260329-003: 5 (High)
  ```

---

## 6. Technical Implementation

### 6.1 Recommended Libraries

| Visualization | Library | Justification |
|--------------|---------|---------------|
| Template Viewer (stacked bars) | **Observable Plot** via inline SVG | Plot produces static SVG, no runtime dependency. Bundle size: ~30KB gzipped. SVG output works perfectly in webviews. No Canvas needed for <200 elements. Declarative API: `Plot.barX(data, {x: "count", fill: "template_id"})`. |
| Template Viewer (treemap drill-down) | **D3 d3-hierarchy + d3-treemap** | Only the treemap layout module is needed (~8KB). Combined with Observable Plot for rendering. D3's treemap is the gold standard. |
| Multi-Source Timeline | **Custom Canvas renderer with D3 scales** | At 10,000+ events, SVG is too slow. Canvas provides the 60fps pan/zoom budget. D3's `scaleTime` and `scaleLinear` handle axis computation. Custom hit-testing for hover/click interactions (spatial index via `d3-quadtree`). |
| Evidence Graph | **Dagre layout + custom SVG renderer** | Dagre (`@dagrejs/dagre`, ~15KB) computes node positions. Custom SVG renders nodes and edges. No need for a full graph library (Cytoscape is 200KB+, overkill for <50 nodes). |
| Sparklines | **Inline SVG (hand-crafted)** | Sparklines are 80x12px. A hand-written SVG path is 200 bytes. No library needed. |

#### Libraries Explicitly Not Recommended

| Library | Reason |
|---------|--------|
| ECharts | 800KB+ bundle. Overkill for this use case. Theme integration requires custom work. |
| Plotly | 3MB+ bundle. Designed for dashboards, not embedded panels. |
| Cytoscape.js | 200KB+. Full graph analysis engine when we only need layout. |
| vis.js | 300KB+. Network visualization with physics simulation we do not need. |
| Chart.js | Canvas-only rendering makes tooltip and interaction customization harder than SVG for the template viewer. Fine for the timeline but introduces a second charting paradigm. |

### 6.2 Architecture

```
VS Code Extension Host (Node.js)
  |
  |-- TemplateViewerProvider (WebviewViewProvider)
  |     |-- Sends: { type: 'update', queries: QueryResult[], pinned: PinnedTemplate[] }
  |     |-- Receives: { type: 'click', templateId, queryId } | { type: 'pin', templateId }
  |
  |-- TimelineProvider (WebviewViewProvider)
  |     |-- Sends: { type: 'update', events: Event[], timeRange: TimeRange, swimlaneMode: string }
  |     |-- Receives: { type: 'brush', start, end } | { type: 'focus', entityId }
  |
  |-- EvidenceGraphProvider (WebviewViewProvider)
  |     |-- Sends: { type: 'update', hypotheses: H[], receipts: R[], queries: Q[] }
  |     |-- Receives: { type: 'open', artifactPath } | { type: 'focusHypothesis', hypId }
  |
  Extension Host <--> Webview communication via postMessage/onDidReceiveMessage
```

Each visualization is a separate webview panel, communicating with the extension host via message passing. Panels share state through a `HuntStateManager` singleton in the extension host that maintains the current hunt's loaded queries, receipts, and hypotheses.

Cross-panel coordination (e.g., clicking a template in the Template Viewer highlights events in the Timeline) is routed through the `HuntStateManager`:

```
TemplateViewer click -> postMessage to host -> HuntStateManager.setActiveTemplate(id) ->
  -> TimelineProvider.highlightTemplate(id) -> postMessage to timeline webview
  -> EventListProvider.filterByTemplate(id) -> postMessage to event list webview
```

### 6.3 Performance Budget

| Metric | Target | Strategy |
|--------|--------|----------|
| Template Viewer first render | < 100ms | Observable Plot SVG generation is synchronous and fast. 20 templates = 20 rect elements. |
| Template Viewer with 200 templates | < 200ms | Group templates into "top 15 + Other" before rendering. Full list available via scroll in a detail panel. |
| Timeline first render (1,000 events) | < 150ms | Canvas batch rendering. All events drawn in a single `requestAnimationFrame`. |
| Timeline pan/zoom (10,000 events) | 60fps | Quadtree spatial index for visible-range culling. Only repaint changed regions (dirty rect optimization). |
| Timeline with 50,000 events | 30fps minimum | Heat strip LOD activates automatically. Individual event rendering disabled. |
| Evidence graph layout (50 nodes) | < 50ms | Dagre layout is O(V + E) for DAGs. 50 nodes compute in ~5ms. SVG render in ~20ms. |
| Evidence graph layout (200 nodes) | < 200ms | Unlikely in practice (would require 50+ hypotheses), but Dagre handles it. |
| Memory: largest expected hunt | < 50MB | Events are stored as typed arrays where possible. Template text is interned (shared string references). Timeline canvas reuses a single buffer. |
| Webview initial load | < 300ms | Single bundled JS file per webview (<100KB gzipped). No external CDN fetches (CSP blocks them anyway). |

### 6.4 Webview Constraints

#### Content Security Policy (CSP)

Every webview must include a strict CSP meta tag:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
    script-src 'nonce-${nonce}';
    style-src ${webview.cspSource} 'unsafe-inline';
    img-src ${webview.cspSource} data:;
    font-src ${webview.cspSource};">
```

Implications:
- No `eval()`, no inline scripts without nonce. Observable Plot and D3 do not use eval.
- No external resources (CDN links). All libraries must be bundled.
- `data:` URIs allowed for inline SVG icons and sparkline data URIs.
- `'unsafe-inline'` for styles is necessary because Observable Plot generates inline style attributes.

#### State Serialization

Webview state must survive panel hide/show cycles. Use `webview.getState()` / `webview.setState()`:

```typescript
interface TemplateViewerState {
  queries: Array<{
    queryId: string;
    templates: ReduceEventsOutput;
  }>;
  pinnedTemplateIds: string[];
  sortMode: 'count' | 'recency' | 'deviation' | 'novelty';
  searchFilter: string;
  selectedTemplateId: string | null;
}
```

State is serialized as JSON. Maximum practical size: ~500KB (VS Code does not enforce a hard limit, but large state slows panel restoration).

For the timeline, events are NOT stored in webview state (too large). Instead, the extension host re-sends events when the panel is restored. The webview state stores only view configuration:

```typescript
interface TimelineState {
  visibleTimeRange: { start: string; end: string };
  swimlaneMode: 'connector' | 'entity' | 'hypothesis' | 'dataset';
  zoomLevel: number;
  focusedEntities: string[];
  brushRange: { start: string; end: string } | null;
}
```

#### Message Passing Overhead

Webview postMessage serializes data as structured clone. For the timeline, sending 10,000 event objects in a single message takes ~15ms (measured). This is acceptable for initial load but not for real-time updates.

Mitigation: Use delta updates. After initial load, only send `{ type: 'addEvents', events: [...newEvents] }` or `{ type: 'removeEvents', eventIds: [...] }` rather than re-sending the full dataset.

#### No Direct DOM Access

The extension host cannot query or manipulate the webview DOM. All visual state is managed within the webview's JavaScript. The extension host sends data; the webview decides how to render it.

---

## 7. Color System

### 7.1 Design Principles

1. **Colorblind-safe:** All palettes tested against deuteranopia (red-green) and protanopia (red-green shifted). The system avoids relying solely on red vs. green to distinguish meaning. Shape, pattern, and position provide redundant encoding.

2. **Dark/light theme aware:** Each color has two variants. The webview detects `document.body.classList.contains('vscode-dark')` and applies the appropriate palette.

3. **Semantic consistency:** The same color always means the same thing. Okta is always blue. "Supported" is always green. Score 6 is always red.

### 7.2 Connector Colors

| Connector | Dark Theme | Light Theme | Rationale |
|-----------|-----------|-------------|-----------|
| Okta | `#60a5fa` (blue-400) | `#2563eb` (blue-600) | Okta brand is blue |
| M365 / Microsoft | `#f97316` (orange-500) | `#c2410c` (orange-700) | Microsoft orange, distinct from red |
| CrowdStrike | `#e11d48` (rose-600) | `#be123c` (rose-700) | CrowdStrike red/falcon brand |
| Elastic | `#a78bfa` (violet-400) | `#7c3aed` (violet-600) | Elastic purple |
| Splunk | `#34d399` (emerald-400) | `#059669` (emerald-600) | Splunk green |
| AWS | `#fbbf24` (amber-400) | `#d97706` (amber-600) | AWS orange-gold |
| GCP | `#38bdf8` (sky-400) | `#0284c7` (sky-600) | GCP blue (lighter than Okta) |
| Defender XDR | `#fb923c` (orange-400) | `#ea580c` (orange-600) | Defender orange variant |
| Generic/Other | `#94a3b8` (slate-400) | `#64748b` (slate-500) | Neutral gray |

These colors are chosen to be distinguishable under both normal vision and deuteranopia simulation. The blue-orange-purple-green primary set avoids the red-green axis entirely for the most common connectors.

### 7.3 Verdict Colors

| Verdict | Dark Theme | Light Theme | Colorblind Note |
|---------|-----------|-------------|-----------------|
| Supported | `#22c55e` (green-500) | `#15803d` (green-700) | Supplemented with checkmark icon |
| Disproved | `#ef4444` (red-500) | `#dc2626` (red-600) | Supplemented with X icon |
| Inconclusive | `#eab308` (yellow-500) | `#ca8a04` (yellow-600) | Supplemented with ? icon |
| Open | `#94a3b8` (slate-400) | `#64748b` (slate-500) | Supplemented with circle icon |

For colorblind safety, verdicts are NEVER distinguished by color alone. Every verdict-colored element also has a shape or icon:
- Supported: checkmark or upward-pointing triangle
- Disproved: X or downward-pointing triangle
- Inconclusive: question mark or diamond
- Open: hollow circle

### 7.4 Deviation Score Gradient

The score gradient uses a sequential single-hue ramp that avoids the red-green confusion axis by going from blue-green through yellow to red-orange:

| Score | Dark Theme | Light Theme | Label |
|-------|-----------|-------------|-------|
| 1 | `#4ade80` (green-400) | `#16a34a` (green-600) | Minimal |
| 2 | `#a3e635` (lime-400) | `#65a30d` (lime-600) | Low |
| 3 | `#facc15` (yellow-400) | `#ca8a04` (yellow-600) | Medium |
| 4 | `#fb923c` (orange-400) | `#ea580c` (orange-600) | High |
| 5 | `#f87171` (red-400) | `#dc2626` (red-600) | High-Critical |
| 6 | `#ef4444` (red-500) | `#b91c1c` (red-800) | Critical |

For colorblind users, scores are always accompanied by the numeric value. The sparkline shows the number at the peak. The heat ring around timeline markers includes the number on hover.

Interpolation for smooth gradients (used in heat strips and sparklines):

```javascript
const scoreColorScale = d3.scaleLinear()
  .domain([1, 2, 3, 4, 5, 6])
  .range(['#4ade80', '#a3e635', '#facc15', '#fb923c', '#f87171', '#ef4444'])
  .interpolate(d3.interpolateRgb);
```

### 7.5 Template Category Colors

Templates are assigned colors from a categorical palette. Since template_ids are content-hashed, the color is deterministic: `palette[hashToIndex(template_id) % palette.length]`.

The palette (12 colors, chosen for maximum perceptual distance):

| Index | Dark Theme | Light Theme |
|-------|-----------|-------------|
| 0 | `#60a5fa` (blue-400) | `#2563eb` (blue-600) |
| 1 | `#f97316` (orange-500) | `#c2410c` (orange-700) |
| 2 | `#a78bfa` (violet-400) | `#7c3aed` (violet-600) |
| 3 | `#34d399` (emerald-400) | `#059669` (emerald-600) |
| 4 | `#f472b6` (pink-400) | `#db2777` (pink-600) |
| 5 | `#38bdf8` (sky-400) | `#0284c7` (sky-600) |
| 6 | `#fbbf24` (amber-400) | `#d97706` (amber-600) |
| 7 | `#a3e635` (lime-400) | `#65a30d` (lime-600) |
| 8 | `#e879f9` (fuchsia-400) | `#c026d3` (fuchsia-600) |
| 9 | `#22d3ee` (cyan-400) | `#0891b2` (cyan-600) |
| 10 | `#fb7185` (rose-400) | `#e11d48` (rose-600) |
| 11 | `#818cf8` (indigo-400) | `#4f46e5` (indigo-600) |

When more than 12 templates exist, the palette cycles. To maintain distinguishability, templates beyond the 12th are shown with a hatched pattern overlay (diagonal lines at 45 degrees) in addition to the cycled color.

Color assignment function:

```javascript
function templateColor(templateId, theme) {
  const index = parseInt(templateId.slice(0, 4), 16) % 12;
  return theme === 'dark' ? DARK_PALETTE[index] : LIGHT_PALETTE[index];
}
```

---

## 8. ASCII Wireframes

### 8.1 Template Viewer Panel

Shows a hunt with 2 queries loaded. Query A found 1,247 events (3 templates). Query B found 148 events (4 templates).

```
+================================================================+
|  DRAIN TEMPLATES           [Sort: Count v] [Search templates...]|
|================================================================|
|                                                                 |
|  Pinned:                                                        |
|  [*] Auth failed <EMAIL> from <IP>           1,189 -> 12       |
|      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  (sparkline)      |
|                                                                 |
|  QRY-20260329-001  (1,247 events, 3 templates)                 |
|  14:00 -- 14:15 UTC  |  okta  |  identity                      |
|  +-----------------------------------------------------+       |
|  |########################################|##|#|        |       |
|  |  T1: Auth failed (95.3%, 1189)         |T2|3|        |       |
|  +-----------------------------------------------------+       |
|                                                                 |
|  QRY-20260329-005  (148 events, 4 templates)                   |
|  16:00 -- 18:00 UTC  |  okta  |  identity                      |
|  +-----------------------------------------------------+       |
|  |#############|############|########|####|              |       |
|  | T4 (34.5%)  | T2 (29.1%) | T1(8.1%) |T3|             |       |
|  +-----------------------------------------------------+       |
|                                                                 |
|-----------------------------------------------------------------|
|  Template Comparison (Ctrl+Click to compare)                    |
|                                                                 |
|  "Auth failed for <EMAIL> from <IP> -- INVALID_CREDENTIALS"    |
|  +-----------------------------------------------------------+ |
|  | Query             | Count | % of Query | Delta             | |
|  |-------------------|-------|------------|-------------------| |
|  | QRY-20260329-001  | 1,189 |    95.3%   |  baseline         | |
|  | QRY-20260329-005  |    12 |     8.1%   |  -99.0%           | |
|  +-----------------------------------------------------------+ |
|                                                                 |
+================================================================+
```

Legend:
- `########` = filled bar segments, each segment colored by template palette
- `T1`, `T2`, `T3`, `T4` = template labels (abbreviated in bar, full in tooltip)
- `[*]` = pin icon
- Sparkline under pinned template shows count trend across queries

### 8.2 Timeline View

Shows events from 3 connectors (Okta, M365, CrowdStrike) over a 2-hour window. Phase boundary at 14:45. Brush selection from 14:05 to 14:15.

```
+================================================================================+
| TIMELINE  [By Connector v] [+][-][Fit All]   View: Individual                  |
| Selected: 14:05 -- 14:15 (10 min, 1,201 events)                    [X Clear]   |
|================================================================================|
|           |  14:00    14:15    14:30    14:45    15:00    15:15    15:30    16:00|
|           |    |         |        |     :  |        |        |        |        ||
|           |    |  [BRUSH]========]|     :  |        |        |        |        ||
|           |    |  |      |  |    ||     :  |        |        |        |        ||
|  Okta     |....ooOOOOOOOO.o|..o.||.....:..|........|........|........|........||
|  identity |    |##########|     ||     :  |        |        |        |        ||
|           |    |  template|band ||     :  |        |        |        |        ||
|           |    |         |      ||     :  |        |        |        |        ||
|-----------|----|---------|------||-----:--|--------|--------|--------|--------||
|  M365     |....|.........|...o..||..ooo:OO|OOoooo..|..oo....|........|........||
|  email    |    |         |      ||     :  |========|========|        |        ||
|           |    |         |      ||     :  |template| band   |        |        ||
|           |    |         |      ||     :  |        |        |        |        ||
|-----------|----|---------|------||-----:--|--------|--------|--------|--------||
|  CrowdStr |....|.........|......||.....:o.|.oo.....|........|........|........||
|  endpoint |    |         |      ||     :  |        |        |        |        ||
|           |    |         |      ||     :  |        |        |        |        ||
|================|=========|======||=====:==|========|========|========|========||
|                                 ||Phase 1 : Phase 2                           ||
|                                  |     :                                       |
+================================================================================+

Legend:
  o = individual event marker (shape varies by type)
  O = event with anomaly score >= 3 (larger marker + heat ring)
  . = no events in this time slot
  # = template overlay band (15% opacity fill)
  = = template overlay band for a different template
  : = phase boundary (dashed vertical line)
  [BRUSH]====] = user brush selection highlight
```

### 8.3 Evidence Graph

Shows the brute-force-to-persistence example: 4 hypotheses, 4 receipts, 6 queries.

```
+================================================================================+
|  EVIDENCE GRAPH                     [Focus: All v] [Layout: Hierarchical]      |
|================================================================================|
|                                                                                 |
|    +---------------------------+       +---------------------------+            |
|    | HYP-01: Password spray    |       | HYP-02: david.park       |            |
|    | from residential proxies  |       | account compromised      |            |
|    | [Supported]  [checkmark]  |       | [Supported]  [checkmark]  |            |
|    +---------------------------+       +---------------------------+            |
|         |                                   |              |                    |
|         | (supports,                        | (supports,   | (supports,         |
|         |  solid green,                     |  solid green, |  solid green,      |
|         |  2.2px)                           |  2.8px)      |  1.6px)           |
|         v                                   v              v                    |
|    +-----------------------+     +-------------------------+                    |
|    | RCT-001               |     | RCT-002                 |                    |
|    | Password spray         |     | Account takeover         |                   |
|    | confirmed              |     | via MFA push             |                   |
|    | [Score: 4 (High)]     |     | [Score: 6 (Critical)]   |                    |
|    +-----------------------+     +-------------------------+                    |
|         |         |                   |         |                               |
|         v         v                   v         v                               |
|       (o)       (o)                 (o)       (o)                               |
|      QRY-001   QRY-002            QRY-001   QRY-002                             |
|      [okta]    [okta]             [okta]    [okta]                              |
|                                                                                 |
|                                                                                 |
|    +---------------------------+       +---------------------------+            |
|    | HYP-03: Attacker accessed |       | HYP-04: Other accounts   |            |
|    | financial data            |       | also compromised         |            |
|    | [Supported]  [checkmark]  |       | [Disproved]  [X]         |            |
|    +---------------------------+       +---------------------------+            |
|         |                                   |                                   |
|         | (supports,                        | (contradicts,                     |
|         |  solid green,                     |  dashed red,                      |
|         |  2.5px)                           |  2px)                             |
|         v                                   v                                   |
|    +-----------------------+     +-------------------------+                    |
|    | RCT-003               |     | RCT-004                 |                    |
|    | SharePoint file access |     | Other accounts NOT      |                    |
|    | confirmed              |     | compromised             |                    |
|    | [Score: 5 (High)]     |     | [No score]              |                    |
|    +-----------------------+     +-------------------------+                    |
|         |         |                   |         |                               |
|         v         v                   v         v                               |
|       (o)       (o)                 (o)       (o)                               |
|      QRY-002   QRY-003            QRY-001   QRY-003                             |
|      [okta]    [m365]             [okta]    [okta]                              |
|                                                                                 |
| Status: 4 hypotheses (3 supported, 1 disproved) | 4 receipts | 3 unique queries|
+================================================================================+

Legend:
  +-----+  = Hypothesis node (rounded rect, border = verdict color)
  +-----+  = Receipt node (rect, left accent bar = score color)
  (o)      = Query node (circle, fill = connector color)
  |        = Edge (style encodes claim_status)
  [checkmark] / [X] = Verdict icon
  2.8px    = Edge thickness (scaled by deviation score)
```

---

## Appendix A: Implementation Priority

| Phase | Visualization | Effort | Impact | Priority |
|-------|--------------|--------|--------|----------|
| 1 | Template Viewer (stacked bars) | Medium | Critical -- this is the differentiator | P0 |
| 1 | Template hover + click interactions | Medium | Critical -- useless without interaction | P0 |
| 2 | Multi-Source Timeline (individual + aggregate LOD) | High | High -- makes temporal patterns visible | P0 |
| 2 | Template overlay on timeline | Medium | High -- connects template viewer to timeline | P1 |
| 3 | Evidence Graph (dagre layout) | Medium | Medium -- visualizes what is already in markdown | P1 |
| 3 | Cross-query template comparison | Medium | High -- the "aha moment" feature | P1 |
| 4 | Anomaly sparklines (sidebar) | Low | Medium -- nice density but not essential | P2 |
| 4 | Template pinning + evolution | Medium | Medium -- power user feature | P2 |
| 5 | Timeline heat strip LOD | Medium | Medium -- only needed for very large hunts | P2 |
| 5 | Evidence graph interactions (trace chain, focus) | Low | Low -- enhances an already useful graph | P3 |
| 6 | Template presence matrix | Low | Medium -- useful for 3+ query hunts | P3 |
| 6 | Editor gutter decorations | Low | Low -- polish feature | P3 |

## Appendix B: Open Questions

1. **Template persistence across hunts:** Should pinned templates persist only within a single hunt case, or should there be a global "template library" that tracks known-bad templates across cases? The latter would enable "I saw this template in last month's spray -- it is back."

2. **Template naming:** Drain templates are identified by hex IDs and raw template text. Should the UI support user-assigned names? e.g., renaming `a7f3b2c1e9d04f68` to "Password spray template." This adds state management complexity but dramatically improves readability in the evidence graph.

3. **Real-time streaming:** The current design assumes queries are completed before visualization. If the runtime supports streaming results (events arriving during execution), should the timeline render incrementally? This would require a streaming message protocol between extension host and webview.

4. **Multi-tenant visualization:** The connector-sdk supports multi-tenant dispatches. Should the template viewer show per-tenant template distributions? This adds a third dimension (query x template x tenant) that may require a different visualization approach.

5. **Export:** Should the visualizations be exportable as PNG/SVG for inclusion in hunt reports and FINDINGS.md? Observable Plot's SVG output makes this trivial for the template viewer, but Canvas-based timeline would need `canvas.toDataURL()`.
