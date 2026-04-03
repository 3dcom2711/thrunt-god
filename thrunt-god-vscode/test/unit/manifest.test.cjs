'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(__dirname, '..', '..', 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function findCommand(commandId) {
  return manifest.contributes.commands.find((entry) => entry.command === commandId);
}

function findMenuEntry(menuId, commandId) {
  return (manifest.contributes.menus[menuId] || []).find((entry) => entry.command === commandId);
}

describe('extension manifest', () => {
  it('contributes curated THRUNT commands with icons', () => {
    const stateCommand = findCommand('thrunt-god.showStateJson');
    const progressCommand = findCommand('thrunt-god.showProgressReport');
    const huntmapCommand = findCommand('thrunt-god.analyzeHuntmap');
    const cliCommand = findCommand('thrunt-god.runThruntCli');
    const runtimeDoctorCommand = findCommand('thrunt-god.showRuntimeDoctor');

    assert.ok(stateCommand, 'showStateJson command should be contributed');
    assert.ok(progressCommand, 'showProgressReport command should be contributed');
    assert.ok(huntmapCommand, 'analyzeHuntmap command should be contributed');
    assert.ok(cliCommand, 'runThruntCli command should be contributed');
    assert.ok(runtimeDoctorCommand, 'showRuntimeDoctor command should be contributed');

    assert.equal(stateCommand.icon, '$(output)');
    assert.equal(progressCommand.icon, '$(graph)');
    assert.equal(huntmapCommand.icon, '$(graph)');
    assert.equal(cliCommand.icon, '$(terminal)');
    assert.equal(runtimeDoctorCommand.icon, '$(tools)');
  });

  it('surfaces THRUNT actions in the sidebar title and relevant item menus', () => {
    const titleState = findMenuEntry('view/title', 'thrunt-god.showStateJson');
    const titleHuntmap = findMenuEntry('view/title', 'thrunt-god.analyzeHuntmap');
    const titleCli = findMenuEntry('view/title', 'thrunt-god.runThruntCli');
    const missionState = findMenuEntry('view/item/context', 'thrunt-god.showStateJson');
    const phasesHuntmap = findMenuEntry('view/item/context', 'thrunt-god.analyzeHuntmap');

    assert.ok(titleState, 'showStateJson should appear in the sidebar title');
    assert.ok(titleHuntmap, 'analyzeHuntmap should appear in the sidebar title');
    assert.ok(titleCli, 'runThruntCli should appear in the sidebar title');
    assert.ok(missionState, 'showStateJson should appear on the mission node');
    assert.ok(phasesHuntmap, 'analyzeHuntmap should appear on the phases group node');

    assert.match(titleState.when, /view == thruntGod\.huntTree/);
    assert.match(titleHuntmap.when, /view == thruntGod\.huntTree/);
    assert.match(titleCli.when, /view == thruntGod\.huntTree/);
    assert.match(missionState.when, /viewItem == mission/);
    assert.match(phasesHuntmap.when, /viewItem == phases-group/);
  });
});
