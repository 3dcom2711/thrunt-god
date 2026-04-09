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
});
