# Threat Hunter Review: THRUNT God VS Code Extension

**Reviewer:** 10-year APT hunter, daily driver of Splunk/Sentinel/Elastic/CrowdStrike  
**Date:** 2026-04-02  
**Verdict:** This has real bones. But right now it is designed for someone presenting a hunt, not someone doing a hunt.

---

## 1. "Would I Actually Use This?" -- Feature Ratings

### Feature 1: Hunt Sidebar (Semantic Investigation Tree)

**NEED**

This is the anchor. Every tool I use has some version of "case structure on the left." What makes this one interesting is that it is not a file tree -- it is a semantic tree of hypotheses, phases, queries, and receipts. That distinction matters because when I am three hours into a hunt I do not remember which file has what; I remember "the receipt that supports HYP-01." The status badges (Supported/Disproved/Open) with color+icon encoding let me glance at the sidebar and know immediately where the investigation stands without opening anything.

The bidirectional sync with the editor is critical. I constantly click between sidebar items and editor content. If I open a QRY file from the file explorer and the sidebar does not highlight it, I will stop trusting the sidebar within a day.

One concern: the tree does not show time. I often think in "what happened chronologically" not "what phase is this in." A chronological sort option for queries/receipts would be essential.

### Feature 2: Drain Template Viewer

**NEED**

This is the actual differentiator. I have never seen template clustering as a first-class concept in any investigation tool. Today I do this manually: I eyeball raw log events, mentally group them, count occurrences, and try to spot the one weird entry in a sea of normal ones. The horizontal stacked bar visualization is the right choice -- the designers correctly identified that cross-query comparison is the killer use case, not single-query exploration.

The variable token drill-down (click a template, see the distinct values masked as `<IP>`, `<EMAIL>`, etc.) is where the actual hunting happens. In the OAuth example, seeing that one IP (185.220.101.42) appears exactly once in a 47-event cluster is the "aha" moment. This feature surfaces that.

Template pinning across phases is well-designed. Watching a template's count evolve over successive queries is something I currently do by keeping multiple Splunk tabs open and manually comparing. Having it automated and visual will save me 15-20 minutes per hunt.

The "Compare Templates" side-by-side view is the feature I would demo to other hunters. Seeing that the M365 "Token refresh" template has no Okta equivalent -- that is a finding, not just a visualization.

### Feature 3: Anomaly Frame Scorecard (CodeLens + Gutter)

**NICE**

The anomaly scoring system itself is excellent engineering. The prediction-before-observation discipline, the explicit factor breakdown, and the 1-6 composite score are all things I wish my SOC did consistently. But as a VS Code feature, the CodeLens overlay is nice-to-have rather than essential. I can already see the score by reading the receipt markdown. The CodeLens saves me scrolling -- maybe 5 seconds per receipt.

The gutter badges are useful for quickly scanning which lines matter in a long receipt, but the real value is in the scoring methodology, not the VS Code chrome around it.

The "Prediction vs Actual" hover card is actually more useful than the scorecard itself. Being able to see at a glance what I expected and what actually happened -- that is the core of anomaly reasoning. But a hover that dismisses on mouseout is the wrong interaction for something I want to stare at. It should be pinnable or openable as a sticky panel.

### Feature 4: Evidence Graph (DAG)

**NICE**

I will use this, but not daily. The evidence graph is most useful in two scenarios: (1) briefing a manager before escalation, and (2) reviewing someone else's hunt. For my own active hunts, I carry the hypothesis-receipt-query topology in my head because I built it. The graph becomes essential only when the hunt is large enough that I lose the mental model (more than 5-6 hypotheses and 15+ receipts).

The dagre hierarchical layout is the correct choice. Force-directed would be actively harmful -- I need the hypothesis-receipt-query tiers to be spatially stable.

The "Trace Evidence Chain" right-click action is underrated in the current design. During peer review, being able to click a receipt and instantly see the full path to the hypothesis, with edge weights showing deviation scores, is a 10x improvement over reading markdown files and mentally tracing references.

### Feature 5: Command Palette Integration

**NEED**

But not because of the commands themselves. It is because the command palette is the fastest way to do anything in VS Code when your hands are on the keyboard. The commands listed are mostly navigation shortcuts (`Go to Hypothesis`, `Go to Receipt`), which are useful but not transformative. The `Compare Templates` and `Focus Entity` commands are the ones I would bind to keyboard shortcuts.

`THRUNT: Run Phase` bridging to the CLI is essential. If I have to switch to a terminal to run phases, the extension becomes a viewer, not a workbench.

`THRUNT: Export Findings` is more important than its position in the priority list suggests. Every hunt ends with a report, and the friction of turning a FINDINGS.md into something a non-technical stakeholder can read is real.

### Feature 6: Evidence Integrity Warnings (Diagnostics)

**NEED**

This is the sleeper feature. The anti-pattern detection (post-hoc rationalization, missing baseline, score inflation, bare sequential claims) is enforcing investigation discipline that most SOCs preach but few practice. Having VS Code flag "your prediction section appears after your observation section" with a red squiggly is the kind of automated quality gate that prevents sloppy hunts from getting published.

The quick-fix actions are well-designed. "Add prediction section template" scaffolding the three required fields (expected benign, expected malicious, ambiguous) teaches good methodology while reducing friction. New hunters will learn the discipline just by using the tool.

The Problems panel integration means integrity issues are visible even when I am not looking at the specific file. That passive awareness is valuable.

### Feature 7: Multi-Source Timeline

**NEED**

Every investigation tool has a timeline. Most of them are terrible. This one gets several things right: swimlanes by connector (so I can see Okta vs M365 vs CrowdStrike on separate rows), the Level-of-Detail rendering (heat strip at zoom-out, individual markers at zoom-in), and the template overlay bands.

The brush selection propagating to other views (filtering the Template Viewer and Evidence Graph to the brushed time range) is how cross-view coordination should work. I have never seen this in any SIEM's investigation interface.

The entity focus mode (click a swimlane label to highlight all events for that entity across all connectors) is the interaction I use most in Elastic's Timeline -- having it here with the added template band context is strictly better.

---

## 2. What's Missing That I Actually Need

### During an Active Incident (3am, Paged, Adrenaline)

**IOC quick-entry and propagation.** When I am paged and a senior analyst hands me an IP address, domain, or hash, I need to throw it into the investigation immediately and see everywhere it appears. The extension has entity focus but no concept of "here is a new IOC, highlight it across all loaded queries." I want a command: `THRUNT: Add IOC` that takes a string, searches all loaded query events for it, and lights up every template/timeline/receipt that contains it.

**Copy-paste for war room chat.** During an active incident, I am constantly copying findings into Slack, Teams, or a ticketing system. The extension should have `THRUNT: Copy Finding Summary` that generates a terse, paste-ready summary: "HYP-01 Supported (High confidence). OAuth consent to malicious app from Tor exit. RCT-001, score 5. See sarah.chen timeline 08:42Z." One click, one paste.

**Countdown/SLA timer.** Many SOCs have response SLA requirements (e.g., P1 incidents must have initial triage within 30 minutes). A configurable timer in the status bar ("23 min remaining") would keep urgency visible without me checking a separate tool.

### During a Proactive Hunt (Multi-day, Methodical)

**Notebook/scratchpad.** Proactive hunts involve lots of dead ends, hypotheses I explore and abandon, and half-formed ideas. The design has no concept of hunter notes beyond the `## Notes` section of individual artifacts. I want a persistent scratchpad (maybe a `NOTES.md` or an extension-managed side panel) where I can jot "check if this IP appears in the CASB logs" or "ask john about the VPN exception for this user" without polluting the formal hunt artifacts.

**Saved views/bookmarks.** After a day of hunting, I have a specific timeline zoom level, template selection, and entity focus that represents "where I left off." The session continuity in STATE.md covers the CLI side, but the extension's visual state (which panels are open, what is zoomed, what is pinned) should be restorable. "Resume exactly where I was yesterday morning."

**Comparative hunt search.** "Have I seen this template in a previous hunt?" Template pinning within a hunt is good, but cross-hunt template matching would be transformative. If I could search across all `.hunt/` directories in the workspace for a template_id or template text pattern, I could connect campaigns.

### During Report Writing / Escalation

**Findings preview mode.** When writing FINDINGS.md, I want a live rendered preview (not raw markdown) that shows what the exported report will look like. The current design has `Export Findings` but no preview step. I will iterate on findings 5-10 times before publishing, and each round-trip through export is friction.

**Screenshot/annotation of visualizations.** I need to embed the evidence graph, timeline, or template viewer directly into reports. `Export as PNG/SVG` is mentioned in the design as a future consideration -- it should be a P0 feature. Every manager presentation and every legal escalation needs visual evidence.

**ATT&CK navigator integration.** The receipts reference MITRE techniques (T1078, T1566, T1098). The extension should be able to generate an ATT&CK Navigator layer file showing which techniques were observed. This is a standard deliverable in hunt reports.

### During Peer Review of Someone Else's Hunt

**Diff mode.** When reviewing a teammate's hunt, I want to see what changed between their last commit and now. The future considerations mention git diff overlay on the evidence graph -- this should be core, not future. "What did Alex add since I last looked?" is the first question in every peer review.

**Annotation/comments.** I need to leave feedback on specific receipts or queries without editing the artifact files. An overlay comment system (like VS Code's comment API used by GitHub PR extensions) would let me say "I think this baseline is incomplete -- check CASB logs" without touching the hunt files.

**Integrity summary view.** When reviewing, I want a single view that says: "3 receipts, all have baselines, all have predictions before observations, 0 anti-pattern violations, 2 quality checks passed." The Problems panel shows violations but not the affirmative "everything is clean" summary. I want the reviewer dashboard, not just the error list.

---

## 3. Workflow Friction Points -- Credential Stuffing Scenario

**Scenario: "I just got paged. Credential stuffing alert. Go."**

**Step 1: Open VS Code, navigate to hunt workspace.**

The extension activates on `.hunt/` detection. Good. But I do not have a `.hunt/` directory yet -- the alert just fired. I need to run `THRUNT: New Hunt Case` first. The design says this prompts for signal type and description. That is 2-3 interactions before I even start. During a P1 incident, I want to paste the alert JSON and have the mission scaffold auto-generated.

**Friction:** The "New Hunt Case" flow is designed for a human writing prose, not for an analyst pasting a SIEM alert. An "Import Alert" variant that accepts structured data (JSON, Splunk alert output, Sentinel incident URL) would save 2-3 minutes.

**Step 2: Shape hypotheses, map environment.**

I run `THRUNT: Shape Hypotheses`. The CLI generates hypotheses and a huntmap. The sidebar populates. This works well -- the extension shows the new artifacts immediately because of the file watcher.

No friction here. The reactive file watching is the right architecture.

**Step 3: Run Phase 1 (Signal Intake / Initial Queries).**

I run `THRUNT: Run Phase`. The CLI executes queries. The extension watches for new QRY-*.md files and updates the sidebar. New query nodes appear with template count badges.

**Friction:** The extension is passive during query execution. While the CLI is running, the sidebar shows the phase as "Running" (spinning icon) but I cannot see progress. How many queries have completed? How many events so far? The status bar shows phase status from STATE.md, but STATE.md is only updated when the CLI writes it. If a query takes 60 seconds, I am staring at a spinner for a full minute with no feedback. A progress indicator or live event count would eliminate the "is it stuck?" anxiety.

**Step 4: Review query results.**

Phase 1 completes. Three new QRY files appear. I click QRY-001. The CodeLens says "4 templates from 1,247 events -- Open Template Viewer." I click it. The stacked bar chart loads.

**This is where the extension shines.** I immediately see the dominant template (95.3% -- "Authentication failed for `<EMAIL>` from `<IP>`"). I click it, drill into the variable tokens, and see 79 unique IPs from residential proxy ASNs. I did not have to write a single query or pivot manually. The template clustering surfaced the pattern automatically.

No friction here. This is the core value proposition working exactly as designed.

**Step 5: Cross-query comparison.**

I click "Compare" and select QRY-002 (the post-spray activity query). The side-by-side view shows the spray template dropping from 95% to 8%, and a new "Authentication succeeded" template appearing. The visual delta is the story: the spray stopped, and a successful login happened.

No friction. This is the "aha moment" that would take me 10 minutes of manual log review in Splunk.

**Step 6: Timeline correlation.**

I open the Multi-Source Timeline. I see the spray as a dense heat strip on the Okta swimlane, then a single anomalous tick at 14:10:33. I zoom in and see the brush range.

**Friction:** The timeline gets events from entity timelines in QRY-*.md files. But those entity timelines are curated subsets -- 10 events for sarah.chen, not the full 1,189 spray events. For the brute-force example, the aggregate timeline works, but for a 10,000-event query, I might want to see all events on the timeline, not just the analyst-selected subset. The design acknowledges this with the LOD rendering, but the data pipeline only sends entity timeline events, not raw query events. There is a gap between the visualization capability and the data availability.

**Step 7: Receipt creation and anomaly scoring.**

The CLI generates receipts. I open RCT-001. The CodeLens shows "Score: 4 (HIGH)." The gutter shows colored markers on the deviation assessment lines.

**Friction:** I am reading the receipt in markdown, which is fine for text. But the anomaly framing section is dense -- baseline, prediction, actual, deviation. The CodeLens and gutter help, but what I really want is a structured side-by-side view: baseline on the left, actual on the right, with deviation factors as callouts in between. The "Prediction vs Actual" hover is close, but a hover is the wrong paradigm for something I want to compare carefully. A dedicated Anomaly Viewer panel (alongside the Template Viewer and Evidence Graph) would be more useful than CodeLens decorations on markdown.

**Step 8: Escalation.**

I am satisfied the spray led to a compromise. I need to escalate. I run `THRUNT: Export Findings`.

**Friction:** The design says it generates HTML or PDF. But my escalation workflow is: (1) copy the executive summary into a Jira ticket, (2) attach the full report as a PDF, (3) post a summary in the #incident-response Slack channel with a link to the ticket, and (4) tag the SOC lead. The export feature handles step 2 but not steps 1, 3, or 4. Integration with ticketing and chat tools is table stakes for a real SOC workflow. Even just `THRUNT: Copy Executive Summary` (plain text, paste-ready) would cover 80% of this.

---

## 4. Competitive Analysis

### vs. Splunk Investigation Workbench

Splunk's investigation workbench lets me run ad-hoc queries, view results in multiple visualizations, and build timelines. It is powerful but generic -- it knows nothing about threat hunting methodology, hypotheses, or evidence integrity.

**What THRUNT does that Splunk does not:**
- Hypothesis tracking with verdict status
- Evidence integrity validation (anti-pattern detection)
- Template clustering as a first-class concept
- Anomaly framing with prediction-before-observation discipline
- Cross-query template comparison

**What Splunk does that THRUNT should steal:**
- Ad-hoc query execution from the same interface (THRUNT forces me to use the CLI in a separate terminal)
- Saved searches and alert-to-investigation links
- Dashboard embedding (share a live view, not a static export)
- Field extraction and stats commands applied interactively to results

### vs. Microsoft Sentinel Incident View

Sentinel's incident view shows alerts, entities, bookmarks, and a timeline. It has entity mapping, automated playbooks, and notebook integration.

**What THRUNT does that Sentinel does not:**
- Drain template clustering (Sentinel has no concept of log template grouping)
- Anomaly scoring with explicit factor breakdown (Sentinel uses ML anomaly scores that are black boxes)
- Evidence graph with hypothesis-receipt-query DAG (Sentinel's entity graph shows relationships, not evidence chains)
- Evidence integrity anti-pattern detection

**What Sentinel does that THRUNT should steal:**
- Entity enrichment lookups (GeoIP, threat intel, user risk score) integrated into the entity timeline
- Playbook/SOAR integration for automated response actions
- Bookmark system for saving specific events during investigation (the template pinning is analogous but entity-level bookmarking is missing)
- Investigation graph that shows entity-to-entity relationships (the THRUNT evidence graph shows evidence chains, not entity relationships)

### vs. Elastic's Timeline View

Elastic's Timeline is the closest competitor to THRUNT's multi-source timeline. It has drag-and-drop event placement, pinned events, case integration, and a query bar.

**What THRUNT does that Elastic does not:**
- Template clustering overlay on the timeline (Drain template bands)
- Cross-query comparison with template diff
- Anomaly framing with structured prediction/observation methodology
- Evidence integrity validation

**What Elastic does that THRUNT should steal:**
- Interactive query refinement in the timeline itself (filter, add conditions, re-query)
- Pinned events that persist as investigation bookmarks
- Notes per event (not per artifact)
- Direct alert-to-timeline ingestion (an alert becomes a pinned timeline event automatically)

### vs. CrowdStrike Falcon Investigate

Falcon Investigate is the most polished single-vendor investigation tool. It has a process tree, network graph, user timeline, and automated threat assessment.

**What THRUNT does that Falcon does not:**
- Multi-vendor (Okta + M365 + CrowdStrike on the same timeline -- Falcon only shows CrowdStrike telemetry)
- Hypothesis-driven methodology enforcement
- Evidence integrity anti-pattern detection
- Template clustering (Falcon has behavioral pattern detection but not log template grouping)
- Transparent scoring (Falcon's severity scores are opaque; THRUNT's are auditable)

**What Falcon does that THRUNT should steal:**
- Real-time response actions from the investigation interface (network contain, process kill, file quarantine)
- AI-generated investigation summaries
- Automated IOC extraction and correlation with threat intel
- Incident-to-detection promotion workflow (Falcon can turn a finding into a custom IOA with a few clicks)

### What THRUNT Does That NONE of Them Do

1. **Template clustering as investigation primitive.** No SIEM or EDR product treats Drain-style log template clustering as a first-class concept in the investigation UI. THRUNT makes templates visual, comparable, and trackable.

2. **Evidence integrity validation.** No competing tool validates the investigator's methodology. They all assume good practice. THRUNT actively flags bad practice (post-hoc rationalization, missing baselines, score inflation) like a linter for investigations.

3. **Cross-query template diff.** The ability to see "this template was 95% of query A but only 8% of query B" in a single visual is genuinely novel. No tool I have used makes cross-source pattern evolution this visible.

4. **Prediction-before-observation discipline.** The anomaly framing system with explicit predictions, factors, and composite scores enforced by VS Code diagnostics is a methodological innovation, not just a UI feature.

---

## 5. The "Day 2" Problem

### What Makes Me Keep Using This

The **template viewer** is the sticky feature. Once I have seen template clustering visualized, I cannot go back to raw log eyeballing. The cross-query comparison in particular creates a habit: every time I run a new query, I immediately open the template viewer and compare it to the previous query. That comparison loop becomes the investigation rhythm.

The **evidence integrity warnings** are the second sticky feature, but for a different reason: they create social pressure. If my team adopts THRUNT and the Problems panel shows zero diagnostics on my hunts, I will maintain that standard. It is the same dynamic as "zero compiler warnings" in software engineering -- once the team expects it, nobody wants to be the one who ships warnings.

### What Will Frustrate Me After a Week

**The read-only constraint.** The extension is explicitly "read-only by default -- the CLI owns artifact production." After a week, I will want to edit things from the extension: add a note to a receipt, change a hypothesis status, update the phase progress. Having to switch to the CLI terminal for every mutation will feel like wearing a straitjacket. At minimum, the extension should support inline editing of `## Notes` sections and hypothesis status toggles.

**The webview panel lifecycle.** If I close the Template Viewer and reopen it, it should restore exactly where I was: same query, same selected template, same pinned templates, same zoom level. The architecture mentions serialization but caps it at ~500KB. For a large hunt with many pinned templates, this could be lossy. Losing state means losing trust.

**Performance on large hunts.** The performance budget targets 50 queries and 100 receipts. My proactive hunts regularly generate 100+ queries and 200+ receipts over multiple days. The lazy parsing strategy is correct, but I am worried about sidebar tree rendering performance when there are 300+ nodes. VS Code TreeView is not known for handling large trees gracefully.

**No search across artifacts.** If I remember "something about a Protonmail address" but not which receipt it is in, I have no way to search within the extension. I have to fall back to `Ctrl+Shift+F` (VS Code global search), which searches raw markdown, not semantic artifact content. A `THRUNT: Search Hunt` command that searches across all artifact text and returns results grouped by artifact type would be essential after the first week.

---

## 6. Killer Feature Ideas

### 1. Threat Intel Overlay

When I view a template with `<IP>` tokens, I want a single-click lookup against threat intel feeds (AbuseIPDB, VirusTotal, Shodan). The extension could use the VS Code `fetch` API (or shell out to `curl`) to enrich IPs, domains, and hashes inline. Show a small badge: green checkmark (clean), yellow warning (suspicious), red alert (known-malicious). This turns the template viewer from a passive display into an active investigation tool.

### 2. Detection Rule Generator

Every good hunt ends with detection rules. When I select a receipt with a high deviation score, I want a command: `THRUNT: Generate Detection Rule`. It reads the anomaly framing (entity type, data source, deviation conditions, ATT&CK technique) and generates a Sigma rule stub. From Sigma I can convert to Splunk SPL, Sentinel KQL, or Elastic EQL. This closes the loop from hunt to detection in a single workflow.

### 3. Entity Relationship Graph

The evidence graph shows the evidence chain (hypothesis -> receipt -> query). But investigations also need an entity relationship graph: which users emailed which users, which IPs authenticated to which accounts, which apps were granted to which users. The data is in the query events. Build a second graph view that shows entity-to-entity relationships, not evidence chains. Clicking an entity in this graph would focus the timeline and template viewer on that entity.

### 4. Hunt Playbook Templates

Before starting a hunt, I want to pick from a library of playbooks: "Credential Spray Investigation," "OAuth Phishing," "Insider Threat," "Ransomware Pre-cursor." Each playbook pre-populates the mission template, suggests hypotheses, and provides a phase structure. The THRUNT "packs" concept already has this data -- expose it as VS Code quick-start templates.

### 5. "What Am I Missing?" Automated Blind Spot Detection

Based on the telemetry surfaces listed in ENVIRONMENT.md and the queries already executed, show me which data sources I have NOT queried yet. If the environment says "CrowdStrike endpoint" is available but no QRY targets the endpoint dataset, highlight it as a blind spot in the sidebar. This is proactive completeness checking that no current tool does well.

### 6. Collaborative Hunt Mode

If two hunters are working the same case (one on identity telemetry, one on endpoint), support real-time state sync. Both hunters see the same sidebar, same evidence graph, same timeline. When one creates a receipt, the other's extension updates immediately. This could use a shared git branch with file watchers, or a lightweight sync protocol. Multi-analyst hunts are common for P1 incidents and currently involve a lot of "hey check Slack, I just found something."

### 7. Time-Travel Replay

Record the investigation state at each artifact creation timestamp. Then provide a "replay" slider that shows the hunt evolving over time: sidebar nodes appearing, evidence graph growing, timeline filling in. This is the ultimate briefing tool -- instead of a static report, walk someone through the investigation chronologically. "At 09:15 we had this. By 10:05 we found this. At 10:30 the picture became clear."

### 8. Voice/Dictation Notes

At 3am during an active incident, I do not want to type notes. A push-to-talk button that records a voice note and attaches it to the current artifact (using the VS Code audio API or system mic access) would capture thoughts I would otherwise lose. Transcription is optional -- the raw audio is the primary artifact. These get appended to `## Notes` sections.

---

## Final Assessment

**What this extension gets right:** It treats threat hunting as a structured methodology, not just a collection of queries. The template clustering visualization is genuinely novel. The evidence integrity validation is something the industry needs. The reactive file-watching architecture is elegant -- the extension never fights with the CLI.

**What it gets wrong:** It is too read-only. It is too passive. It watches the CLI work but does not let me work from the extension. The distance between "view the investigation" and "do the investigation" is the gap that determines whether this becomes a daily tool or a demo piece.

**What I would tell every hunter:** "Install it for the template viewer and the integrity warnings. Those two features justify the install. The rest is nice but you will still need your SIEM open in another window."

**What would make me switch my entire workflow:** Close the SIEM gap. Let me run ad-hoc queries from the extension (not just CLI-initiated phases). Let me enrich IOCs inline. Let me generate detection rules from findings. Give me entity relationship graphs, not just evidence chains. Make it an investigation workbench, not just an investigation viewer.

The bones are excellent. The architecture is sound. The visualization choices are well-reasoned. The methodology enforcement is innovative. Ship the template viewer and integrity warnings first. Everything else can follow -- but those two are the ones that will make hunters talk.
