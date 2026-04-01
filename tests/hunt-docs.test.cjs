const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf-8');
}

describe('hunt docs', () => {
  test('README describes hunt-native docs as the only active artifact set', () => {
    const readme = readRepoFile('README.md');

    assert.match(readme, /Every query, receipt, and finding is a file/);
    assert.doesNotMatch(readme, /Legacy mirrors/);
  });

  test('hunt bootstrap workflow writes hunt-native artifacts directly', () => {
    const workflow = readRepoFile('thrunt-god', 'workflows', 'hunt-bootstrap.md');

    assert.match(workflow, /Write or update:/);
    assert.doesNotMatch(workflow, /Legacy Mirrors/);
    assert.match(workflow, /Create `\.planning\/QUERIES\/` and `\.planning\/RECEIPTS\/` as empty directories only during bootstrap/);
    assert.match(workflow, /Do not invent sample query logs, sample receipts, or mark any phase\/plan complete during bootstrap/);
  });

  test('hunt:new-program uses program-specific environment-first templates', () => {
    const command = readRepoFile('commands', 'hunt', 'new-program.md');

    assert.match(command, /hunt-program-huntmap\.md/);
    assert.match(command, /Drive the conversation through `\.planning\/environment\/ENVIRONMENT\.md` and the operator toolchain/);
    assert.match(command, /Create `\.planning\/QUERIES\/` and `\.planning\/RECEIPTS\/` as empty directories only/);
  });

  test('program huntmap template starts with environment and tool validation phases', () => {
    const template = readRepoFile('thrunt-god', 'templates', 'hunt-program-huntmap.md');

    assert.match(template, /Phase 1: Environment Mapping/);
    assert.match(template, /Phase 2: Tool & Access Validation/);
    assert.match(template, /Do not write sample query logs or sample receipts during bootstrap/);
    assert.match(template, /\| 1\. Environment Mapping \| 0\/1 \| Not started \| - \|/);
  });

  test('environment map template captures tooling and access inventory', () => {
    const template = readRepoFile('thrunt-god', 'templates', 'environment-map.md');

    assert.match(template, /## Tooling And Access/);
    assert.match(template, /\| Workflow \| Tool \| Auth \/ Access Path \| Notes \|/);
  });

  test('hunt command docs center hunt artifacts only', () => {
    const planCommand = readRepoFile('commands', 'hunt', 'plan.md');
    const validateCommand = readRepoFile('commands', 'hunt', 'validate-findings.md');

    assert.match(planCommand, /`HUNTMAP\.md` remains the source of truth/);
    assert.match(validateCommand, /`FINDINGS\.md` and `EVIDENCE_REVIEW\.md` remain the source of truth/);
    assert.doesNotMatch(planCommand, /ROADMAP\.md/);
    assert.doesNotMatch(validateCommand, /VERIFICATION\.md/);
  });

  test('hunt workflows describe hunt artifacts as canonical surfaces', () => {
    const helpWorkflow = readRepoFile('thrunt-god', 'workflows', 'help.md');
    const shapeWorkflow = readRepoFile('thrunt-god', 'workflows', 'hunt-shape-hypothesis.md');
    const runWorkflow = readRepoFile('thrunt-god', 'workflows', 'hunt-run.md');

    assert.match(helpWorkflow, /THRUNT is a threat-hunting orchestration system\./);
    assert.match(shapeWorkflow, /Convert vague suspicion into explicit hunt hypotheses/);
    assert.doesNotMatch(runWorkflow, /legacy/);
  });
});
