'use strict';

const { z } = require('zod');
const {
  lookupTechnique,
  searchTechniques,
  lookupGroup,
  getGroupTechniques,
  getGroupSoftware,
  getTechniquesByTactic,
  getAllTactics,
} = require('./intel.cjs');
const { buildNavigatorLayer } = require('./layers.cjs');
const {
  compareDetections,
  suggestDetections,
  getThreatProfile,
  listThreatProfiles,
} = require('./coverage.cjs');
const {
  searchEntities,
  getRelations,
  logDecision,
  getDecisions,
  logLearning,
  getLearnings,
} = require('./knowledge.cjs');

const TIMEOUT_MS = parseInt(process.env.THRUNT_MCP_TIMEOUT, 10) || 30000;

function normalizeTechniqueId(value) {
  return String(value || '').trim().toUpperCase();
}

function addCoveredTechnique(set, techniqueId) {
  const normalized = normalizeTechniqueId(techniqueId);
  if (!normalized) return;

  set.add(normalized);

  const parentMatch = normalized.match(/^(T\d{4})\.\d{3}$/);
  if (parentMatch) {
    set.add(parentMatch[1]);
  }
}

function collectTechniqueIds(set, techniqueIds) {
  for (const token of String(techniqueIds || '').split(',')) {
    addCoveredTechnique(set, token);
  }
}

/**
 * Wrap a tool handler with a timeout guard.
 *
 * Limitation: the AbortController signal is passed to `fn`, but none of the
 * current tool handlers consume it because they perform synchronous SQLite
 * calls via better-sqlite3. The timeout therefore only protects against
 * genuinely async operations (e.g., network fetches added in the future).
 * For synchronous work the timeout fires after the sync call completes,
 * which still caps overall wall-clock time on the Promise.race path.
 * Refactoring synchronous SQLite calls to respect the signal is not
 * worthwhile given the current architecture.
 */
function withTimeout(fn) {
  return async (args) => {
    const controller = new AbortController();
    const result = fn(args, controller.signal);
    if (!result || typeof result.then !== 'function') return result;

    let timer;
    const clearTimer = () => clearTimeout(timer);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new DOMException(`Tool timed out after ${TIMEOUT_MS}ms`, 'AbortError'));
      }, TIMEOUT_MS);
      controller.signal.addEventListener('abort', clearTimer, { once: true });
    });

    try {
      return await Promise.race([result, timeout]);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return {
          content: [{ type: 'text', text: `Tool timed out after ${TIMEOUT_MS}ms` }],
          isError: true,
        };
      }
      throw err;
    } finally {
      clearTimer();
      controller.signal.removeEventListener('abort', clearTimer);
    }
  };
}

function handleLookupTechnique(db, args) {
  const { technique_id } = args;
  const row = lookupTechnique(db, technique_id);

  if (!row) {
    return {
      content: [{ type: 'text', text: `Technique ${technique_id} not found` }],
      isError: true,
    };
  }

  if (!technique_id.toUpperCase().includes('.')) {
    const parentId = technique_id.toUpperCase().trim();
    const subs = db.prepare(
      'SELECT id, name FROM techniques WHERE id LIKE ?'
    ).all(`${parentId}.%`);
    row.sub_techniques = subs;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(row, null, 2) }],
  };
}

function handleSearchTechniques(db, args) {
  const { query, tactic, platform, limit = 20 } = args;
  const results = searchTechniques(db, query, { tactic, platform, limit });
  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
}

function handleLookupGroup(db, args) {
  const { group_id } = args;
  if (typeof group_id !== 'string' || group_id.trim().length === 0) {
    return {
      content: [{ type: 'text', text: 'group_id required' }],
      isError: true,
    };
  }

  const group = resolveGroup(db, group_id);

  if (!group) {
    return {
      content: [{ type: 'text', text: `Group ${group_id} not found` }],
      isError: true,
    };
  }

  const techniques = getGroupTechniques(db, group.id);
  const software = getGroupSoftware(db, group.id);

  const result = { ...group, techniques, software };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

function resolveGroup(db, groupId) {
  if (typeof groupId !== 'string' || groupId.trim().length === 0) {
    return null;
  }

  const normalizedGroupId = groupId.trim();
  let group = lookupGroup(db, normalizedGroupId);

  if (!group && !/^G\d+$/i.test(normalizedGroupId)) {
    const escaped = normalizedGroupId.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const nameMatch = db.prepare(
      "SELECT * FROM groups WHERE name LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' LIMIT 1"
    ).get(`%${escaped}%`, `%${escaped}%`);
    if (nameMatch) group = nameMatch;
  }

  return group || null;
}

function handleGenerateLayer(db, args) {
  const { mode, name, technique_ids, group_id, description } = args;

  let techniqueEntries = [];
  let group = null;

  switch (mode) {
    case 'custom': {
      if (!technique_ids || technique_ids.length === 0) {
        return {
          content: [{ type: 'text', text: 'technique_ids required for custom mode' }],
          isError: true,
        };
      }
      techniqueEntries = technique_ids
        .map(id => normalizeTechniqueId(id))
        .filter(Boolean)
        .map(id => ({
        id,
        score: 100,
        color: '#0033cc',
      }));
      break;
    }

    case 'group': {
      if (!group_id) {
        return {
          content: [{ type: 'text', text: 'group_id required for group mode' }],
          isError: true,
        };
      }
      group = resolveGroup(db, group_id);
      if (!group) {
        return {
          content: [{ type: 'text', text: `Group ${group_id} not found` }],
          isError: true,
        };
      }
      const techIds = getGroupTechniques(db, group.id);
      techniqueEntries = techIds.map(id => ({
        id,
        score: 50,
        color: '#66b1ff',
      }));
      break;
    }

    case 'coverage': {
      const allTechs = db.prepare('SELECT id FROM techniques').all();

      const detectedSet = new Set();
      try {
        const rows = db.prepare('SELECT technique_ids FROM detections').all();
        for (const r of rows) {
          collectTechniqueIds(detectedSet, r.technique_ids);
        }
      } catch { /* no detections table */ }

      techniqueEntries = allTechs.map(t => ({
        id: t.id,
        score: detectedSet.has(normalizeTechniqueId(t.id)) ? 100 : 0,
        color: detectedSet.has(normalizeTechniqueId(t.id)) ? '#00cc00' : '#ff0000',
      }));
      break;
    }

    case 'gap': {
      if (!group_id) {
        return {
          content: [{ type: 'text', text: 'group_id required for gap mode' }],
          isError: true,
        };
      }
      group = resolveGroup(db, group_id);
      if (!group) {
        return {
          content: [{ type: 'text', text: `Group ${group_id} not found` }],
          isError: true,
        };
      }
      const techIds = getGroupTechniques(db, group.id)
        .map(id => normalizeTechniqueId(id))
        .filter(Boolean);

      const coveredSet = new Set();
      try {
        if (techIds.length > 0) {
          const rows = db.prepare('SELECT technique_ids FROM detections').all();
          const allDetected = new Set();
          for (const r of rows) {
            collectTechniqueIds(allDetected, r.technique_ids);
          }
          for (const id of techIds) {
            if (allDetected.has(id)) coveredSet.add(id);
          }
        }
      } catch { /* no detections table */ }

      techniqueEntries = techIds.map(id => ({
        id,
        score: coveredSet.has(id) ? 0 : 100,
        color: coveredSet.has(id) ? '#00cc00' : '#ff6666',
      }));
      break;
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown mode: ${mode}` }],
        isError: true,
      };
  }

  const layer = buildNavigatorLayer(name, techniqueEntries, { description });

  return {
    content: [{ type: 'text', text: JSON.stringify(layer, null, 2) }],
  };
}

function handleCompareDetections(db, args) {
  const { technique_id, query } = args;
  const input = technique_id || query;
  if (!input) {
    return {
      content: [{ type: 'text', text: 'Either technique_id or query required' }],
      isError: true,
    };
  }
  const result = compareDetections(db, input);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

function handleSuggestDetections(db, args) {
  const { technique_id } = args;
  const tech = lookupTechnique(db, technique_id);
  if (!tech) {
    return {
      content: [{ type: 'text', text: `Technique ${technique_id} not found` }],
      isError: true,
    };
  }
  const result = suggestDetections(db, technique_id);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

function handleAnalyzeCoverage(db, args) {
  const { group_id, profile, include_techniques = true } = args;

  let techIds;
  let resultMeta;

  if (group_id) {
    const group = resolveGroup(db, group_id);
    if (!group) {
      return {
        content: [{ type: 'text', text: `Group ${group_id} not found` }],
        isError: true,
      };
    }
    techIds = getGroupTechniques(db, group.id);
    resultMeta = { group_id: group.id, group_name: group.name };
  } else if (profile) {
    const profileTechIds = getThreatProfile(profile);
    if (!profileTechIds) {
      return {
        content: [{ type: 'text', text: `Unknown threat profile: ${profile}. Available: ${listThreatProfiles().join(', ')}` }],
        isError: true,
      };
    }
    techIds = profileTechIds;
    resultMeta = { profile_name: profile.toLowerCase() };
  } else {
    return {
      content: [{ type: 'text', text: `Either group_id or profile required. Available profiles: ${listThreatProfiles().join(', ')}` }],
      isError: true,
    };
  }

  techIds = [...new Set((techIds || []).map(id => normalizeTechniqueId(id)).filter(Boolean))];

  const detectedSet = new Set();
  try {
    if (techIds.length > 0) {
      const rows = db.prepare('SELECT technique_ids FROM detections').all();
      const allDetected = new Set();
      for (const r of rows) {
        collectTechniqueIds(allDetected, r.technique_ids);
      }
      for (const id of techIds) {
        if (allDetected.has(id)) detectedSet.add(id);
      }
    }
  } catch { /* no detections table */ }

  const tacticBreakdown = {};
  const tacticMap = new Map();
  if (techIds.length > 0) {
    const ph = techIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, tactics FROM techniques WHERE id IN (${ph})`).all(...techIds);
    for (const r of rows) tacticMap.set(r.id, r.tactics);
  }

  for (const tid of techIds) {
    const tactics_str = tacticMap.get(tid);
    const tactics = tactics_str
      ? tactics_str.split(',').map(s => s.trim()).filter(Boolean)
      : ['Unknown'];
    for (const tactic of tactics) {
      if (!tacticBreakdown[tactic]) {
        tacticBreakdown[tactic] = { total: 0, covered: 0, uncovered: 0, techniques: [] };
      }
      tacticBreakdown[tactic].total++;
      const isCovered = detectedSet.has(tid);
      if (isCovered) {
        tacticBreakdown[tactic].covered++;
      } else {
        tacticBreakdown[tactic].uncovered++;
      }
      if (include_techniques) {
        tacticBreakdown[tactic].techniques.push({ id: tid, covered: isCovered });
      }
    }
  }

  const totalTechniques = techIds.length;
  const covered = detectedSet.size;
  const uncovered = totalTechniques - covered;

  const result = {
    ...resultMeta,
    total_techniques: totalTechniques,
    covered,
    uncovered,
    gap_percent: totalTechniques > 0 ? Math.round((uncovered / totalTechniques) * 100) : 0,
    by_tactic: Object.entries(tacticBreakdown).map(([tactic, data]) => ({
      tactic,
      total: data.total,
      covered: data.covered,
      uncovered: data.uncovered,
      gap_percent: data.total > 0 ? Math.round((data.uncovered / data.total) * 100) : 0,
      ...(include_techniques ? { techniques: data.techniques } : {}),
    })),
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}

function handleQueryKnowledge(db, args) {
  const { query, type, limit = 10 } = args;
  const entities = searchEntities(db, query, { type, limit });

  if (entities.length === 0) {
    return {
      content: [{ type: 'text', text: 'No knowledge graph entities match query' }],
    };
  }

  const enriched = entities.map(entity => {
    const relations = getRelations(db, entity.id, { limit: 5 });
    return { ...entity, relations };
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
  };
}

function handleLogDecision(db, args) {
  const { case_slug, technique_id, decision, reasoning, context } = args;
  logDecision(db, { case_slug, technique_id, decision, reasoning, context });

  const related_decisions = getDecisions(db, { technique_id, limit: 5 });

  return {
    content: [{ type: 'text', text: JSON.stringify({ logged: true, technique_id, related_decisions }, null, 2) }],
  };
}

function handleLogLearning(db, args) {
  const { topic, pattern, detail, technique_ids, case_slug } = args;
  logLearning(db, { topic, pattern, detail, technique_ids, case_slug });

  const related_learnings = getLearnings(db, { topic, limit: 5 });

  return {
    content: [{ type: 'text', text: JSON.stringify({ logged: true, topic, related_learnings }, null, 2) }],
  };
}

const TOOL_REGISTRY = [
  {
    name: 'lookup_technique',
    description: 'Look up an ATT&CK technique by ID (e.g., T1059.001). Returns technique name, description, tactics, platforms, data sources, and MITRE URL.',
    inputSchema: { technique_id: 'string (ATT&CK technique ID, e.g. T1059.001)' },
    schema: {
      technique_id: z.string()
        .regex(/^T\d{4}(?:\.\d{3})?$/i)
        .describe('ATT&CK technique ID (e.g., T1059.001, T1078)'),
    },
    handler: handleLookupTechnique,
  },
  {
    name: 'search_techniques',
    description: 'Full-text search across ATT&CK technique names and descriptions. Supports filtering by tactic and platform.',
    inputSchema: { query: 'string', tactic: 'string?', platform: 'string?', limit: 'number (1-100, default 20)' },
    schema: {
      query: z.string().min(1).describe('Search query (keywords, technique name fragment, etc.)'),
      tactic: z.string().optional().describe('Filter by tactic name (e.g., "Initial Access", "Persistence")'),
      platform: z.string().optional().describe('Filter by platform (e.g., "Windows", "Linux", "Cloud")'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum results to return'),
    },
    handler: handleSearchTechniques,
  },
  {
    name: 'lookup_group',
    description: 'Look up an ATT&CK threat group by ID or name. Returns group details with associated techniques and software/malware.',
    inputSchema: { group_id: 'string (group ID e.g. G0007 or name)' },
    schema: {
      group_id: z.string().describe('ATT&CK group ID (e.g., G0007) or group name (e.g., "APT28")'),
    },
    handler: handleLookupGroup,
  },
  {
    name: 'generate_layer',
    description: 'Generate an ATT&CK Navigator v4.5 layer JSON. Supports custom technique sets, group-based layers, coverage snapshots, and gap analysis.',
    inputSchema: { mode: 'custom|group|coverage|gap', name: 'string', technique_ids: 'string[]?', group_id: 'string?', description: 'string?' },
    schema: {
      mode: z.enum(['custom', 'group', 'coverage', 'gap']).describe('Layer type: custom (specific techniques), group (all techniques for a group), coverage (detection coverage snapshot), gap (uncovered techniques for a group)'),
      name: z.string().describe('Layer name'),
      technique_ids: z.array(z.string()).optional().describe('Technique IDs for custom mode'),
      group_id: z.string().optional().describe('Group ID for group/gap mode (e.g., G0007)'),
      description: z.string().optional().describe('Layer description'),
    },
    handler: handleGenerateLayer,
  },
  {
    name: 'analyze_coverage',
    description: 'Analyze detection coverage for a threat group or named threat profile. Returns per-tactic breakdown showing which techniques have detections and which are gaps.',
    inputSchema: { group_id: 'string?', profile: 'string?', include_techniques: 'boolean (default true)' },
    schema: {
      group_id: z.string().optional().describe('ATT&CK group ID (e.g., G0007)'),
      profile: z.string().optional().describe('Named threat profile: ransomware, apt, initial-access, persistence, credential-access, defense-evasion'),
      include_techniques: z.boolean().default(true).describe('Include technique-level detail in each tactic'),
    },
    handler: handleAnalyzeCoverage,
  },
  {
    name: 'compare_detections',
    description: 'Compare detection coverage across sources (Sigma, ESCU, Elastic, KQL) for a technique or topic.',
    inputSchema: { technique_id: 'string?', query: 'string?' },
    schema: {
      technique_id: z.string().optional().describe('ATT&CK technique ID (e.g., T1059)'),
      query: z.string().optional().describe('Free-text search query'),
    },
    handler: handleCompareDetections,
  },
  {
    name: 'suggest_detections',
    description: 'Suggest detections for an uncovered technique based on rules from the same tactic family.',
    inputSchema: { technique_id: 'string (ATT&CK technique ID)' },
    schema: {
      technique_id: z.string().regex(/^T\d{4}(?:\.\d{3})?$/i).describe('ATT&CK technique ID'),
    },
    handler: handleSuggestDetections,
  },
  {
    name: 'query_knowledge',
    description: 'Search the hunt knowledge graph for entities (threat actors, techniques, tools, campaigns, vulnerabilities, data sources) and their relationships. Returns matching entities with related connections.',
    inputSchema: { query: 'string', type: 'threat_actor|technique|detection|campaign|tool|vulnerability|data_source?', limit: 'number (1-50, default 10)' },
    schema: {
      query: z.string().min(1),
      type: z.enum(['threat_actor', 'technique', 'detection', 'campaign', 'tool', 'vulnerability', 'data_source']).optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
    handler: handleQueryKnowledge,
  },
  {
    name: 'log_decision',
    description: 'Log a hunt decision with reasoning for future reference. Decisions are tagged by technique and case, enabling institutional memory across hunt sessions.',
    inputSchema: { case_slug: 'string', technique_id: 'string', decision: 'string', reasoning: 'string?', context: 'string?' },
    schema: {
      case_slug: z.string(),
      technique_id: z.string(),
      decision: z.string(),
      reasoning: z.string().optional(),
      context: z.string().optional(),
    },
    handler: handleLogDecision,
  },
  {
    name: 'log_learning',
    description: 'Log a hunt learning or pattern for future reference. Learnings are tagged by topic and technique, surfacing when future hunts touch the same areas.',
    inputSchema: { topic: 'string', pattern: 'string', detail: 'string?', technique_ids: 'string?', case_slug: 'string?' },
    schema: {
      topic: z.string(),
      pattern: z.string(),
      detail: z.string().optional(),
      technique_ids: z.string().optional().describe('Comma-separated ATT&CK technique IDs'),
      case_slug: z.string().optional(),
    },
    handler: handleLogLearning,
  },
];

function getToolDefinitions() {
  return TOOL_REGISTRY.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema: { ...inputSchema },
  }));
}

function registerTools(server, db) {
  for (const tool of TOOL_REGISTRY) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      withTimeout((args) => tool.handler(db, args))
    );
  }
}

module.exports = {
  getToolDefinitions,
  registerTools,
  handleLookupTechnique,
  handleSearchTechniques,
  handleLookupGroup,
  handleGenerateLayer,
  handleAnalyzeCoverage,
  handleCompareDetections,
  handleSuggestDetections,
  handleQueryKnowledge,
  handleLogDecision,
  handleLogLearning,
  withTimeout,
};
