import * as vscode from 'vscode';

export type SelectableArtifactType =
  | 'mission'
  | 'hypothesis'
  | 'query'
  | 'receipt';

export interface ArtifactSelection {
  artifactId: string;
  artifactType: SelectableArtifactType;
  source:
    | 'sidebar'
    | 'hunt-overview'
    | 'evidence-board'
    | 'query-analysis'
    | 'drain-viewer'
    | 'command';
}

export function inferSelectableArtifactType(
  artifactId: string
): SelectableArtifactType | null {
  const key = artifactId.split('/').pop() ?? artifactId;
  if (key === 'MISSION') {
    return 'mission';
  }
  if (key.startsWith('HYP-')) {
    return 'hypothesis';
  }
  if (key.startsWith('QRY-')) {
    return 'query';
  }
  if (key.startsWith('RCT-')) {
    return 'receipt';
  }
  return null;
}

export class ArtifactSelectionCoordinator implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<ArtifactSelection>();
  readonly onDidChange = this.emitter.event;

  private currentSelection: ArtifactSelection | null = null;

  select(selection: ArtifactSelection): void {
    this.currentSelection = selection;
    this.emitter.fire(selection);
  }

  getCurrentSelection(): ArtifactSelection | null {
    return this.currentSelection;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
