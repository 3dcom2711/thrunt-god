'use strict';

/**
 * Build an ATT&CK Navigator v4.5 layer JSON object.
 * @param {string} name - Layer name
 * @param {Array<{id: string, tactic?: string, score?: number, color?: string, comment?: string}>} techniques
 * @param {object} [options]
 * @param {string} [options.description]
 * @param {string[]} [options.platforms]
 * @param {Array<{label: string, color: string}>} [options.legendItems]
 * @param {object} [options.gradient]
 * @returns {object} Navigator v4.5 layer JSON
 */
function buildNavigatorLayer(name, techniques, options = {}) {
  return {
    name,
    versions: { navigator: '4.9.0', layer: '4.5' },
    domain: 'enterprise-attack',
    description: options.description || '',
    filters: {
      platforms: options.platforms || ['Windows', 'Linux', 'macOS', 'Cloud'],
    },
    gradient: options.gradient || {
      colors: ['#ffffff', '#66b1ff', '#0033cc'],
      minValue: 0,
      maxValue: 100,
    },
    techniques: techniques.map(t => ({
      techniqueID: t.id,
      tactic: t.tactic || undefined,
      score: t.score ?? 0,
      color: t.color || '',
      comment: t.comment || '',
      enabled: true,
    })),
    legendItems: options.legendItems || [],
    metadata: options.metadata || [],
  };
}

module.exports = { buildNavigatorLayer };
