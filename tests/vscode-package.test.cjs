'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const pkg = require('../apps/vscode/package.json');

describe('VS Code package manifest', () => {
  it('activates on the Program Dashboard webview panel for serializer restore', () => {
    assert.ok(
      pkg.activationEvents.includes('onWebviewPanel:thruntGod.programDashboard'),
      'package.json should activate on thruntGod.programDashboard'
    );
  });

  it('contributes the close-case command for Command Deck and palette execution', () => {
    const commands = Array.isArray(pkg.contributes?.commands) ? pkg.contributes.commands : [];
    assert.ok(
      commands.some((command) => command.command === 'thrunt-god.closeCase'),
      'package.json should contribute thrunt-god.closeCase'
    );
    assert.ok(
      pkg.activationEvents.includes('onCommand:thrunt-god.closeCase'),
      'package.json should activate on thrunt-god.closeCase'
    );
  });
});
