# Phase 54: Detection Rule Ingestion - Research

**Researched:** 2026-04-08
**Domain:** Multi-format detection rule parsing (Sigma YAML, Splunk ESCU YAML, Elastic TOML, KQL Markdown) + SQLite FTS5 indexing
**Confidence:** HIGH

## Summary

This phase builds a unified detection rule ingestion pipeline in `mcp-hunt-intel/lib/detections.cjs` that parses four distinct rule formats (Sigma YAML, Splunk ESCU YAML, Elastic TOML, KQL Markdown), normalizes them into a common schema, and stores them in a `detections` table with FTS5 search in the existing `~/.thrunt/intel.db`. The work follows established patterns from Phase 53's `intel.cjs` module: idempotent schema creation, lazy population with `BEGIN IMMEDIATE` transactions, and better-sqlite3 with WAL mode.

The four rule formats have been verified against their canonical source repositories. Sigma and ESCU rules are YAML (parseable with `js-yaml`), Elastic rules are TOML (parseable with `smol-toml`), and KQL rules are Markdown with embedded code blocks (parseable with regex). All formats contain MITRE ATT&CK technique mappings, though in different structures that require format-specific extraction logic. The SigmaHQ core release contains 1,378 rules (5.9MB unzipped) -- larger than the ~300 originally estimated, but still very reasonable for bundling.

**Primary recommendation:** Build four format-specific parse functions in `detections.cjs`, each returning a normalized row object. Add `js-yaml` and `smol-toml` as dependencies to `mcp-hunt-intel/package.json`. Extend `ensureIntelSchema()` to create the `detections` + `detections_fts` tables. Bundle the full SigmaHQ core ruleset in `mcp-hunt-intel/data/sigma-core/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single `mcp-hunt-intel/lib/detections.cjs` module with format-specific parse functions (parseSigmaRule, parseEscuRule, parseElasticRule, parseKqlRule)
- Lives in mcp-hunt-intel alongside intel.cjs -- same package, same DB access pattern
- Malformed rules: skip with warning to stderr, continue parsing remaining rules -- no hard failures for individual bad rules
- Normalize at parse time: uppercase technique IDs (T1059 not t1059), trim whitespace, deduplicate tags
- Unified table: `detections(id TEXT PK, title TEXT, source_format TEXT, technique_ids TEXT, tactics TEXT, severity TEXT, logsource TEXT, query TEXT, description TEXT, metadata TEXT, file_path TEXT)`
- id is composite key: `source_format + ':' + original_id` (e.g., `sigma:abc123`) -- allows same rule from different sources
- metadata column: JSON string for format-specific fields that don't fit unified columns (analytic_stories, data_models, false_positives, etc.)
- FTS5 over `title, description, query, technique_ids` -- searchable by rule name, content, technique, or query text
- Regular FTS5 (consistent with techniques_fts from Phase 53) -- data is write-once after ingestion
- Detections table goes in same `~/.thrunt/intel.db` as techniques/groups (per architecture decision)
- Bundle SigmaHQ `core` ruleset as YAML files in `mcp-hunt-intel/data/sigma-core/`
- Lazy indexing: populate detections table on first query (same pattern as ATT&CK population in intel.cjs)
- Env vars are additive: `SIGMA_PATHS`, `SPLUNK_PATHS`, `ELASTIC_PATHS` index custom directories in addition to bundled rules
- Raw YAML stored in package data directory, parsed at index time

### Claude's Discretion
- Internal helper function organization within detections.cjs
- Exact Sigma YAML field extraction beyond specified fields
- TOML parsing approach (built-in or lightweight dependency)
- KQL markdown parsing regex patterns
- Number of bundled Sigma rules (target ~300 core rules, exact count at Claude's discretion)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DET-01 | Sigma YAML parser extracts id, title, tags (MITRE technique IDs), level, logsource, detection logic, falsepositives | Sigma specification verified: fields are `id`, `title`, `tags` (array with `attack.tXXXX` entries), `level`, `logsource` (map with category/product/service), `detection` (map), `falsepositives` (list). js-yaml 4.1.1 parses all of these. |
| DET-02 | Splunk ESCU YAML parser extracts detection metadata, analytic stories, data models | ESCU format verified: top-level `name`, `id`, `type`, `description`, `search`, `data_source`; nested under `tags`: `analytic_story` (array), `mitre_attack_id` (array), `asset_type`, `security_domain`. `rba` section has risk scoring. js-yaml handles this. |
| DET-03 | Elastic TOML parser extracts rule metadata, query, MITRE mappings | Elastic TOML format verified: `[metadata]` section (creation_date, maturity), `[rule]` section (name, description, query, risk_score, severity, rule_id, tags), `[[rule.threat]]` array with `technique.id`, `technique.subtechnique`, `tactic.id`. smol-toml 1.6.1 parses this with CJS support. |
| DET-04 | KQL markdown parser extracts detection queries, Microsoft table references, MITRE tags | KQL markdown format verified from Bert-JanP/Hunting-Queries-Detection-Rules repo: markdown files with H1/H2 headings, KQL in fenced code blocks, MITRE technique IDs in text (T1046 etc.), Microsoft table names in KQL (DeviceEvents, IdentityDirectoryEvents, etc.). Regex extraction is appropriate. |
| DET-05 | Unified detections table with FTS5, searchable by technique/tactic/severity/source/process name | Schema design locked in CONTEXT.md. Regular FTS5 with porter unicode61 tokenizer (same as techniques_fts). FTS5 over title, description, query, technique_ids columns. |
| DET-06 | Bundled SigmaHQ core rules + configurable env vars for custom rule directories | SigmaHQ core release r2026-01-01 contains 1,378 rules (5.9MB unzipped, 1.4MB zipped). Bundling full core is feasible. Env vars SIGMA_PATHS, SPLUNK_PATHS, ELASTIC_PATHS are additive. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.0.0 | SQLite database access with FTS5 | Already a dependency in mcp-hunt-intel; used for intel.db in Phase 53 |
| js-yaml | 4.1.1 | Parse Sigma and ESCU YAML rule files | Most popular Node.js YAML parser (300M+ weekly downloads); pure CJS via `require('js-yaml')` |
| smol-toml | 1.6.1 | Parse Elastic TOML rule files | Most downloaded TOML parser on npm; exports CJS via `require('smol-toml')` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Read rule files from disk, recursive directory traversal | File I/O for reading YAML/TOML/MD files |
| node:path | built-in | File path manipulation and resolution | Resolving data directories and env var paths |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| smol-toml | @iarna/toml 2.2.5 | @iarna/toml is CJS-native and well-tested but older (last published 2020). smol-toml is actively maintained, faster, and also has CJS exports. |
| js-yaml | yaml 2.8.3 | `yaml` package is newer but ESM-first. js-yaml is proven, CJS-native, and simpler API for read-only parsing. |
| regex (KQL) | marked/remark | KQL markdown files have simple structure (headings + code blocks). A full markdown parser is overkill; regex for code fences and headings is sufficient and avoids a dependency. |

**Installation:**
```bash
cd mcp-hunt-intel && npm install js-yaml@^4.1.0 smol-toml@^1.6.0
```

**Version verification:** Confirmed 2026-04-08 via `npm view`:
- js-yaml: 4.1.1
- smol-toml: 1.6.1 (CJS available at `dist/index.cjs`)
- better-sqlite3: already in package.json at ^11.0.0

## Architecture Patterns

### Recommended Project Structure
```
mcp-hunt-intel/
  lib/
    intel.cjs          # (existing) DB open, schema, ATT&CK queries
    detections.cjs     # (NEW) parsers, schema extension, detection queries
    tools.cjs          # (existing) MCP tool handlers
    layers.cjs         # (existing) Navigator layer builder
  data/
    sigma-core/        # (NEW) bundled SigmaHQ core YAML rules
      rules/
        windows/...
        linux/...
        cloud/...
        ...
      version.txt
  bin/
    server.cjs         # (existing) MCP server entry
  package.json         # add js-yaml, smol-toml deps
```

### Pattern 1: Format-Specific Parsers with Unified Output
**What:** Each source format gets a dedicated parse function that returns a normalized `DetectionRow` object. All format differences are resolved at parse time.
**When to use:** Always -- this is the core pattern for this phase.
**Example:**
```javascript
// Source: Verified against SigmaHQ specification and Elastic TOML format
/**
 * @typedef {Object} DetectionRow
 * @property {string} id - Composite key: 'source_format:original_id'
 * @property {string} title
 * @property {string} source_format - 'sigma' | 'escu' | 'elastic' | 'kql'
 * @property {string} technique_ids - Comma-separated, uppercase (T1059,T1059.001)
 * @property {string} tactics - Comma-separated (Execution, Persistence)
 * @property {string} severity - Normalized: informational|low|medium|high|critical
 * @property {string} logsource - Format-specific source info
 * @property {string} query - Detection logic/query text
 * @property {string} description
 * @property {string} metadata - JSON string of format-specific extras
 * @property {string} file_path - Original file path
 */

function parseSigmaRule(yamlText, filePath) {
  const yaml = require('js-yaml');
  const doc = yaml.load(yamlText);
  if (!doc || !doc.title) return null; // malformed

  // Extract MITRE technique IDs from tags
  const tags = Array.isArray(doc.tags) ? doc.tags : [];
  const techniqueIds = tags
    .filter(t => /^attack\.t\d{4}/i.test(t))
    .map(t => t.replace(/^attack\./i, '').toUpperCase())
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  const tactics = tags
    .filter(t => /^attack\./.test(t) && !/^attack\.t\d{4}/i.test(t))
    .map(t => t.replace(/^attack\./, '').replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())) // Title Case
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    id: `sigma:${doc.id || ''}`,
    title: (doc.title || '').trim(),
    source_format: 'sigma',
    technique_ids: techniqueIds.join(','),
    tactics: tactics.join(','),
    severity: (doc.level || 'medium').toLowerCase().trim(),
    logsource: JSON.stringify(doc.logsource || {}),
    query: typeof doc.detection === 'object' ? JSON.stringify(doc.detection) : '',
    description: (doc.description || '').trim(),
    metadata: JSON.stringify({
      status: doc.status,
      author: doc.author,
      date: doc.date,
      modified: doc.modified,
      references: doc.references,
      falsepositives: doc.falsepositives,
      related: doc.related,
    }),
    file_path: filePath,
  };
}
```

### Pattern 2: Schema Extension via ensureIntelSchema
**What:** Extend the existing `ensureIntelSchema()` in `intel.cjs` to include `detections` and `detections_fts` tables, or call a `ensureDetectionsSchema()` from `detections.cjs` that follows the same idempotent pattern.
**When to use:** Database initialization.
**Example:**
```javascript
// Source: Pattern from intel.cjs ensureIntelSchema()
function ensureDetectionsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS detections (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_format TEXT NOT NULL,
      technique_ids TEXT,
      tactics TEXT,
      severity TEXT,
      logsource TEXT,
      query TEXT,
      description TEXT,
      metadata TEXT,
      file_path TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS detections_fts USING fts5(
      title, description, query, technique_ids,
      tokenize='porter unicode61'
    );

    CREATE INDEX IF NOT EXISTS idx_det_source ON detections(source_format);
    CREATE INDEX IF NOT EXISTS idx_det_severity ON detections(severity);
  `);
}
```

### Pattern 3: Lazy Population with Directory Scanning
**What:** Detect whether detections are populated by checking row count. If empty, scan bundled rules + env var directories. Wrap in `BEGIN IMMEDIATE` transaction.
**When to use:** On first query/access of detections data.
**Example:**
```javascript
// Source: Pattern from intel.cjs populateIfEmpty()
function populateDetectionsIfEmpty(db) {
  const doPopulate = db.transaction(() => {
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM detections').get().cnt;
    if (count > 0) return;

    // 1. Bundled Sigma core rules
    const bundledDir = path.join(__dirname, '..', 'data', 'sigma-core', 'rules');
    if (fs.existsSync(bundledDir)) {
      indexSigmaDirectory(db, bundledDir);
    }

    // 2. Custom rule directories from env vars
    indexEnvPaths(db, 'SIGMA_PATHS', indexSigmaDirectory);
    indexEnvPaths(db, 'SPLUNK_PATHS', indexEscuDirectory);
    indexEnvPaths(db, 'ELASTIC_PATHS', indexElasticDirectory);
  });

  doPopulate.immediate();
}
```

### Pattern 4: MITRE Technique ID Extraction per Format
**What:** Each format stores MITRE technique IDs differently. Extraction must be format-aware.
**Sigma:** Tags array with `attack.t1059.001` format -- filter by regex, strip prefix, uppercase
**ESCU:** `tags.mitre_attack_id` array with `T1059` format -- already uppercase
**Elastic:** `[[rule.threat]]` array, each with `technique.id` and `technique.subtechnique[].id` -- traverse nested TOML structure
**KQL:** Inline text references to `T1046` etc. -- regex scan of full document text

### Anti-Patterns to Avoid
- **Parsing YAML with regex:** YAML has complex multiline, quoting, and anchor semantics. Always use `js-yaml` for Sigma and ESCU files.
- **Strict validation that rejects rules:** Malformed individual rules should be skipped (logged to stderr), not cause batch failure. A Sigma file missing the `id` field should produce a warning, not crash indexing of 1,378 rules.
- **Storing detection logic as raw YAML text:** The `detection` section of Sigma rules should be `JSON.stringify()`-ed for storage. This makes it queryable and consistent across formats.
- **Using external content FTS5:** Regular FTS5 is correct here (same as Phase 53). Data is write-once after ingestion; external content adds complexity for zero benefit.
- **Blocking on missing env var paths:** If `SIGMA_PATHS=/nonexistent`, log a warning and continue. Don't fail the entire indexing process.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom YAML parser | js-yaml 4.1.1 | YAML spec is 200+ pages; anchors, aliases, multiline strings, type coercion are easy to get wrong |
| TOML parsing | Regex-based TOML extraction | smol-toml 1.6.1 | TOML has nested tables, arrays of tables, multiline strings; regex will break on real Elastic rules |
| Markdown code block extraction | Full markdown AST parser (remark/marked) | Regex: `` /```(?:kql|kusto)?\n([\s\S]*?)```/g `` | KQL markdown files have simple structure; a 3-line regex handles code fences correctly |
| Recursive directory walking | Custom recursive glob | `fs.readdirSync(dir, { recursive: true })` | Node 20+ supports `recursive: true` option natively. No need for glob or custom walkers. |
| FTS5 query sanitization | Custom escaping | Wrap user input in double quotes for phrase search, or use `*` suffix for prefix | FTS5 has specific syntax rules; simple quoting handles 95% of cases |

**Key insight:** The parsers themselves are straightforward once you use proper parsing libraries. The complexity is in normalization -- mapping four different MITRE tag formats to a single `technique_ids` column -- not in parsing.

## Common Pitfalls

### Pitfall 1: Sigma Tags Are Not Just MITRE Techniques
**What goes wrong:** Assuming all `tags` entries are MITRE technique IDs.
**Why it happens:** Tags contain both tactics (`attack.defense-evasion`) and techniques (`attack.t1059.001`) plus other tags (`cve.2021-44228`).
**How to avoid:** Filter tags by regex: `/^attack\.t\d{4}/i` for techniques, `/^attack\.[a-z-]+$/` (excluding technique pattern) for tactics.
**Warning signs:** Tactic names appearing in `technique_ids` column.

### Pitfall 2: Elastic TOML Nested Threat Arrays
**What goes wrong:** Only extracting the first `[[rule.threat]]` entry, missing additional technique mappings.
**Why it happens:** TOML arrays of tables (`[[rule.threat]]`) produce an array. Each entry can have multiple techniques and subtechniques.
**How to avoid:** Iterate `rule.threat` as an array, then iterate `threat.technique` as an array, then iterate `technique.subtechnique` if present.
**Warning signs:** Elastic rules only showing one technique when they map to multiple.

### Pitfall 3: KQL Markdown Has No Standard Schema
**What goes wrong:** Expecting KQL markdown files to have consistent field structure.
**Why it happens:** KQL hunting query repos (Bert-JanP, SlimKQL, etc.) are community-maintained with loose conventions.
**How to avoid:** Use defensive regex extraction: look for fenced code blocks (KQL queries), H1/H2 headings (title), technique patterns (T\d{4}), and Microsoft table names in query text. Fallback to filename for title if heading extraction fails.
**Warning signs:** Many null/empty fields in KQL-sourced detections.

### Pitfall 4: ESCU Search Field Contains Splunk SPL, Not Sigma Logic
**What goes wrong:** Treating the `search` field as detection logic equivalent to Sigma's `detection` block.
**Why it happens:** Both are "queries" but Sigma detection is abstract (field-value conditions) while ESCU search is concrete SPL.
**How to avoid:** Store ESCU's `search` field directly in the `query` column. Store Sigma's `detection` as `JSON.stringify(detection)`. Both are searchable via FTS5.
**Warning signs:** None -- this is a design awareness issue.

### Pitfall 5: Duplicate Rule IDs Across Formats
**What goes wrong:** Two rules from different sources having the same UUID in `id` field.
**Why it happens:** Sigma and Elastic both use UUIDs, and format authors may reference each other.
**How to avoid:** Composite key `source_format:original_id` (already decided in CONTEXT.md). This is the correct approach.
**Warning signs:** `INSERT OR IGNORE` silently dropping rules.

### Pitfall 6: Large Transaction for 1,378+ Rules
**What goes wrong:** Indexing bundled rules in individual INSERT statements takes 30+ seconds.
**Why it happens:** SQLite commits per statement without explicit transaction.
**How to avoid:** Wrap bulk inserts in `BEGIN IMMEDIATE` transaction (already the pattern). Use prepared statements. The intel.cjs pattern already does this correctly.
**Warning signs:** First-run latency over 5 seconds.

### Pitfall 7: FTS5 Row Mismatch
**What goes wrong:** FTS5 table has different row count than detections table after indexing.
**Why it happens:** Forgetting to insert into FTS5 for each detection row, or inserting into FTS5 without corresponding detection row.
**How to avoid:** Insert into both `detections` and `detections_fts` in the same loop iteration. Better yet, use a helper `insertDetection()` function that does both.
**Warning signs:** FTS5 search returns results that don't join back to detections table.

## Code Examples

### Sigma Rule Parsing (complete)
```javascript
// Source: Verified against SigmaHQ sigma-rules-specification + sample rules from r2026-01-01 core release
const yaml = require('js-yaml');

function parseSigmaRule(yamlText, filePath) {
  let doc;
  try {
    doc = yaml.load(yamlText);
  } catch (e) {
    process.stderr.write(`WARN: malformed Sigma YAML in ${filePath}: ${e.message}\n`);
    return null;
  }
  if (!doc || typeof doc !== 'object' || !doc.title) return null;

  const tags = Array.isArray(doc.tags) ? doc.tags : [];

  // Technique IDs: attack.t1059, attack.t1059.001 -> T1059, T1059.001
  const techniqueIds = tags
    .filter(t => /^attack\.t\d{4}/i.test(t))
    .map(t => t.replace(/^attack\./i, '').toUpperCase().trim())
    .filter((v, i, a) => a.indexOf(v) === i);

  // Tactics: attack.defense-evasion -> Defense Evasion
  const tactics = tags
    .filter(t => /^attack\.[a-z]/.test(t) && !/^attack\.t\d{4}/i.test(t))
    .map(t => t.replace(/^attack\./, '').split('-').map(
      w => w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' '))
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    id: `sigma:${doc.id || ''}`,
    title: (doc.title || '').trim(),
    source_format: 'sigma',
    technique_ids: techniqueIds.join(','),
    tactics: tactics.join(','),
    severity: (doc.level || '').toLowerCase().trim(),
    logsource: JSON.stringify(doc.logsource || {}),
    query: typeof doc.detection === 'object' ? JSON.stringify(doc.detection) : String(doc.detection || ''),
    description: (doc.description || '').trim(),
    metadata: JSON.stringify({
      status: doc.status || null,
      author: doc.author || null,
      date: doc.date || null,
      modified: doc.modified || null,
      references: doc.references || [],
      falsepositives: doc.falsepositives || [],
      related: doc.related || [],
    }),
    file_path: filePath || '',
  };
}
```

### Splunk ESCU Rule Parsing
```javascript
// Source: Verified against splunk/security_content develop branch YAML format
function parseEscuRule(yamlText, filePath) {
  let doc;
  try {
    doc = yaml.load(yamlText);
  } catch (e) {
    process.stderr.write(`WARN: malformed ESCU YAML in ${filePath}: ${e.message}\n`);
    return null;
  }
  if (!doc || typeof doc !== 'object' || !doc.name) return null;

  const tags = doc.tags || {};
  const mitreIds = Array.isArray(tags.mitre_attack_id) ? tags.mitre_attack_id : [];

  return {
    id: `escu:${doc.id || ''}`,
    title: (doc.name || '').trim(),
    source_format: 'escu',
    technique_ids: mitreIds.map(t => t.toUpperCase().trim())
      .filter((v, i, a) => a.indexOf(v) === i).join(','),
    tactics: '', // ESCU doesn't have tactic tags in same format; derive from technique IDs if needed
    severity: '', // ESCU uses risk_score in rba section, not level
    logsource: Array.isArray(doc.data_source) ? doc.data_source.join(', ') : '',
    query: (doc.search || '').trim(),
    description: (doc.description || '').trim(),
    metadata: JSON.stringify({
      type: doc.type || null,
      status: doc.status || null,
      author: doc.author || null,
      date: doc.date || null,
      analytic_story: tags.analytic_story || [],
      asset_type: tags.asset_type || null,
      security_domain: tags.security_domain || null,
      product: tags.product || [],
      data_models: tags.data_models || [],
      risk_score: doc.rba?.risk_objects?.[0]?.score || null,
      known_false_positives: doc.known_false_positives || null,
      references: doc.references || [],
      how_to_implement: doc.how_to_implement || null,
    }),
    file_path: filePath || '',
  };
}
```

### Elastic TOML Rule Parsing
```javascript
// Source: Verified against elastic/detection-rules main branch TOML format
const { parse: parseTOML } = require('smol-toml');

function parseElasticRule(tomlText, filePath) {
  let doc;
  try {
    doc = parseTOML(tomlText);
  } catch (e) {
    process.stderr.write(`WARN: malformed Elastic TOML in ${filePath}: ${e.message}\n`);
    return null;
  }
  const rule = doc.rule;
  if (!rule || !rule.name) return null;

  // Extract MITRE technique IDs and tactics from [[rule.threat]] array
  const threats = Array.isArray(rule.threat) ? rule.threat : [];
  const techniqueIds = [];
  const tactics = [];

  for (const threat of threats) {
    // Tactic
    if (threat.tactic && threat.tactic.name) {
      tactics.push(threat.tactic.name);
    }
    // Techniques
    const techniques = Array.isArray(threat.technique) ? threat.technique : [];
    for (const tech of techniques) {
      if (tech.id) techniqueIds.push(tech.id.toUpperCase().trim());
      // Sub-techniques
      const subs = Array.isArray(tech.subtechnique) ? tech.subtechnique : [];
      for (const sub of subs) {
        if (sub.id) techniqueIds.push(sub.id.toUpperCase().trim());
      }
    }
  }

  return {
    id: `elastic:${rule.rule_id || ''}`,
    title: (rule.name || '').trim(),
    source_format: 'elastic',
    technique_ids: [...new Set(techniqueIds)].join(','),
    tactics: [...new Set(tactics)].join(','),
    severity: (rule.severity || '').toLowerCase().trim(),
    logsource: Array.isArray(rule.index) ? rule.index.join(', ') : '',
    query: (rule.query || '').trim(),
    description: (rule.description || '').trim(),
    metadata: JSON.stringify({
      maturity: doc.metadata?.maturity || null,
      creation_date: doc.metadata?.creation_date || null,
      updated_date: doc.metadata?.updated_date || null,
      integration: doc.metadata?.integration || [],
      risk_score: rule.risk_score || null,
      rule_type: rule.type || null,
      language: rule.language || null,
      tags: rule.tags || [],
      references: rule.references || [],
      license: rule.license || null,
    }),
    file_path: filePath || '',
  };
}
```

### KQL Markdown Rule Parsing
```javascript
// Source: Verified against Bert-JanP/Hunting-Queries-Detection-Rules format
function parseKqlRule(mdText, filePath) {
  if (!mdText || typeof mdText !== 'string') return null;

  // Extract title from first H1 or H2 heading
  const titleMatch = mdText.match(/^#{1,2}\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');

  // Extract KQL code blocks
  const codeBlocks = [];
  const codeRe = /```(?:kql|kusto|csl)?\n([\s\S]*?)```/g;
  let m;
  while ((m = codeRe.exec(mdText)) !== null) {
    codeBlocks.push(m[1].trim());
  }
  // If no tagged code blocks, try generic code fences
  if (codeBlocks.length === 0) {
    const genericRe = /```\n([\s\S]*?)```/g;
    while ((m = genericRe.exec(mdText)) !== null) {
      const block = m[1].trim();
      // Heuristic: if it contains KQL table names or operators, treat as KQL
      if (/\b(where|project|summarize|extend|DeviceEvents|DeviceProcessEvents)\b/i.test(block)) {
        codeBlocks.push(block);
      }
    }
  }
  if (codeBlocks.length === 0) return null; // No detectable KQL query

  const query = codeBlocks.join('\n\n---\n\n');

  // Extract MITRE technique IDs from text
  const techMatches = mdText.match(/\bT\d{4}(?:\.\d{3})?\b/g) || [];
  const techniqueIds = [...new Set(techMatches.map(t => t.toUpperCase()))];

  // Extract Microsoft table references from KQL
  const tableNames = new Set();
  const tableRe = /\b(Device(?:Events|ProcessEvents|NetworkEvents|FileEvents|RegistryEvents|ImageLoadEvents|LogonEvents)|IdentityDirectoryEvents|IdentityLogonEvents|IdentityQueryEvents|EmailEvents|EmailAttachmentInfo|CloudAppEvents|AADSignInEventsBeta|AlertEvidence|AlertInfo|SecurityEvent|Syslog|SigninLogs|AuditLogs)\b/g;
  const fullText = query + '\n' + mdText;
  while ((m = tableRe.exec(fullText)) !== null) {
    tableNames.add(m[1]);
  }

  // Generate ID from filename if no UUID in text
  const idFromFile = path.basename(filePath, '.md').replace(/\s+/g, '_').toLowerCase();

  return {
    id: `kql:${idFromFile}`,
    title: title,
    source_format: 'kql',
    technique_ids: techniqueIds.join(','),
    tactics: '', // KQL markdown typically lacks structured tactic data
    severity: '', // Not standardized in community KQL repos
    logsource: [...tableNames].join(', '),
    query: query,
    description: mdText.slice(0, 500).replace(/```[\s\S]*?```/g, '').trim(),
    metadata: JSON.stringify({
      tables: [...tableNames],
      code_block_count: codeBlocks.length,
    }),
    file_path: filePath || '',
  };
}
```

### Directory Indexing Pattern
```javascript
// Source: Pattern from intel.cjs populateIfEmpty + Node 20 fs.readdirSync recursive
function indexSigmaDirectory(db, dirPath) {
  const insertDet = db.prepare(`INSERT OR IGNORE INTO detections
    (id, title, source_format, technique_ids, tactics, severity,
     logsource, query, description, metadata, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertFts = db.prepare(`INSERT INTO detections_fts
    (title, description, query, technique_ids)
    VALUES (?, ?, ?, ?)`);

  let files;
  try {
    files = fs.readdirSync(dirPath, { recursive: true });
  } catch (e) {
    process.stderr.write(`WARN: cannot read directory ${dirPath}: ${e.message}\n`);
    return 0;
  }

  let indexed = 0;
  for (const rel of files) {
    if (!rel.endsWith('.yml') && !rel.endsWith('.yaml')) continue;
    const fullPath = path.join(dirPath, rel);
    let text;
    try { text = fs.readFileSync(fullPath, 'utf8'); } catch { continue; }

    const row = parseSigmaRule(text, fullPath);
    if (!row || !row.id || row.id === 'sigma:') continue;

    const result = insertDet.run(
      row.id, row.title, row.source_format, row.technique_ids,
      row.tactics, row.severity, row.logsource, row.query,
      row.description, row.metadata, row.file_path
    );
    if (result.changes > 0) {
      insertFts.run(row.title, row.description, row.query, row.technique_ids);
      indexed++;
    }
  }
  return indexed;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sigma YAML field `falsepositives` as string | `falsepositives` is always a YAML list | Sigma spec v2 (2023) | Parse as array, join for display |
| ESCU `observables` key for risk attribution | Replaced by `rba` key in ESCU YAML | ESCU 5.0 (2024) | Use `rba.risk_objects[].score` not `observables` |
| Elastic rules in JSON format | Elastic standardized on TOML format | detection-rules repo inception (2020) | All current Elastic rules are TOML |
| SigmaHQ individual rule downloads | SigmaHQ release packages (core/core+/all) as ZIP | 2023 | Download ZIP from releases, not clone entire repo |

**Deprecated/outdated:**
- Sigma `status: unsupported` -- deprecated in favor of `deprecated` status
- ESCU `data_models` tag key -- still present in some old rules but data_source at top level is current
- Elastic rules with `language: lucene` -- most are now `eql` or `esql`

## Sigma Core Ruleset Details

**Release:** r2026-01-01 (latest as of research date)
**Download URL:** `https://github.com/SigmaHQ/sigma/releases/download/r2026-01-01/sigma_core.zip`
**File count:** 1,378 YAML rules + 1 version.txt = 1,379 files
**Unzipped size:** 5.9 MB
**Zipped size:** 1.4 MB
**Breakdown by platform:**
| Platform | Rules |
|----------|-------|
| windows | 1,138 |
| linux | 64 |
| cloud | 64 |
| application | 52 |
| web | 26 |
| network | 14 |
| macos | 9 |
| category | 6 |
| identity | 5 |

**Bundling decision:** The CONTEXT.md estimated ~300 rules. The actual core ruleset is 1,378 rules but only 5.9MB unzipped. This is entirely reasonable to bundle. The rules are high quality (status: test/stable, level: high/critical only). Recommend bundling the full core release rather than a subset -- subsetting would require arbitrary filtering and would be harder to update.

**Update strategy:** Ship the extracted YAML files in `mcp-hunt-intel/data/sigma-core/`. To update, download a new release ZIP and replace the directory contents. The `version.txt` file in the ZIP tracks the release version.

## Open Questions

1. **FTS5 Insert Synchronization**
   - What we know: When using regular FTS5 (not external content), each row in `detections_fts` must be inserted separately from `detections` and they are not linked by rowid automatically.
   - What's unclear: Should we use rowid-based correlation (INSERT into detections then use `last_insert_rowid()` for FTS) or store the detection `id` in FTS for direct join?
   - Recommendation: Store `id` as an additional column in FTS5 (same pattern as `techniques_fts` which includes `id` column), enabling direct JOIN without rowid tracking. This was decided and implemented in Phase 53.

2. **KQL Rule ID Generation**
   - What we know: KQL markdown files don't have standard UUID identifiers. Filename-based IDs work for deduplication.
   - What's unclear: If the user provides multiple KQL directories with same-named files, composite key `kql:filename` could collide.
   - Recommendation: Use full relative path from the root of the KQL directory (not just filename) as the ID component: `kql:defender-for-endpoint/discovery-databaseservices`.

3. **Env Var Path Separator**
   - What we know: `SIGMA_PATHS` needs to support multiple directories.
   - What's unclear: Use `:` (Unix) or `;` (Windows) or OS-specific `path.delimiter`?
   - Recommendation: Use `path.delimiter` (`:` on Unix, `;` on Windows) for cross-platform compatibility.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 20+) |
| Config file | scripts/run-tests.cjs (test runner) |
| Quick run command | `node --test tests/detections.test.cjs` |
| Full suite command | `node scripts/run-tests.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DET-01 | parseSigmaRule extracts id, title, tags, level, logsource, detection, falsepositives | unit | `node --test tests/detections.test.cjs` | No -- Wave 0 |
| DET-02 | parseEscuRule extracts name, id, search, analytic_story, mitre_attack_id, data_models | unit | `node --test tests/detections.test.cjs` | No -- Wave 0 |
| DET-03 | parseElasticRule extracts rule_id, name, query, severity, nested MITRE threat arrays | unit | `node --test tests/detections.test.cjs` | No -- Wave 0 |
| DET-04 | parseKqlRule extracts title, KQL code blocks, technique IDs, table references | unit | `node --test tests/detections.test.cjs` | No -- Wave 0 |
| DET-05 | detections + detections_fts tables created; FTS5 search by technique/tactic/severity/source/process | unit+integration | `node --test tests/detections.test.cjs` | No -- Wave 0 |
| DET-06 | Bundled SigmaHQ core rules indexed on first access; env vars add custom dirs | integration | `node --test tests/detections.test.cjs` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/detections.test.cjs`
- **Per wave merge:** `node scripts/run-tests.cjs`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/detections.test.cjs` -- covers DET-01 through DET-06
- [ ] `tests/fixtures/sigma-sample.yml` -- minimal valid Sigma rule for testing
- [ ] `tests/fixtures/escu-sample.yml` -- minimal valid ESCU rule for testing
- [ ] `tests/fixtures/elastic-sample.toml` -- minimal valid Elastic rule for testing
- [ ] `tests/fixtures/kql-sample.md` -- minimal valid KQL markdown for testing
- [ ] js-yaml and smol-toml installed: `cd mcp-hunt-intel && npm install js-yaml smol-toml`

## Sources

### Primary (HIGH confidence)
- [SigmaHQ sigma-specification](https://github.com/SigmaHQ/sigma-specification/blob/main/specification/sigma-rules-specification.md) - Rule field definitions, tag format, severity levels
- [SigmaHQ core release r2026-01-01](https://github.com/SigmaHQ/sigma/releases/tag/r2026-01-01) - 1,378 core rules verified by download and extraction
- [elastic/detection-rules](https://github.com/elastic/detection-rules) - TOML format verified from `rules/linux/defense_evasion_attempt_to_disable_syslog_service.toml` and `rules/windows/initial_access_suspicious_ms_exchange_worker_child_process.toml`
- [splunk/security_content](https://github.com/splunk/security_content) - ESCU YAML format verified from `detections/endpoint/remote_system_discovery_with_adsisearcher.yml` and `detections/endpoint/system_user_discovery_with_query.yml`
- [Bert-JanP/Hunting-Queries-Detection-Rules](https://github.com/Bert-JanP/Hunting-Queries-Detection-Rules) - KQL markdown format verified from multiple detection files
- npm registry: js-yaml 4.1.1, smol-toml 1.6.1 (versions verified 2026-04-08)
- Existing codebase: `mcp-hunt-intel/lib/intel.cjs` -- schema, population, FTS5 patterns

### Secondary (MEDIUM confidence)
- [sigmahq.io docs](https://sigmahq.io/docs/basics/rules.html) - Rule format overview
- [Elastic Security Labs](https://www.elastic.co/security-labs/elastic-security-opens-public-detection-rules-repo) - TOML format context

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - js-yaml and smol-toml verified for CJS compatibility, versions confirmed via npm
- Architecture: HIGH - Extends proven intel.cjs patterns; all four rule formats verified against canonical repos
- Pitfalls: HIGH - Based on actual rule file analysis (1,378 Sigma rules extracted, Elastic TOML parsed, ESCU YAML inspected)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain; rule formats rarely change)
