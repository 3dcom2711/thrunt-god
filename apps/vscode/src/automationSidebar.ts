import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Node types for dispatch in getChildren
// ---------------------------------------------------------------------------

export type AutomationNodeType = 'mcp' | 'command-deck' | 'runbooks' | 'recent-runs';

// ---------------------------------------------------------------------------
// AutomationTreeItem
// ---------------------------------------------------------------------------

export class AutomationTreeItem extends vscode.TreeItem {
  nodeType?: AutomationNodeType;
  dataId?: string;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options?: {
      description?: string;
      iconPath?: vscode.ThemeIcon;
      tooltip?: string;
      contextValue?: string;
      nodeType?: AutomationNodeType;
      dataId?: string;
    }
  ) {
    super(label, collapsibleState);

    if (options) {
      if (options.description !== undefined) this.description = options.description;
      if (options.iconPath) this.iconPath = options.iconPath;
      if (options.tooltip) this.tooltip = options.tooltip;
      if (options.nodeType) this.nodeType = options.nodeType;
      if (options.dataId) this.dataId = options.dataId;
    }

    this.contextValue = options?.contextValue ?? 'automationTreeItem';
  }
}

// ---------------------------------------------------------------------------
// AutomationTreeDataProvider
// ---------------------------------------------------------------------------

export class AutomationTreeDataProvider
  implements vscode.TreeDataProvider<AutomationTreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<AutomationTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<AutomationTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private runbookCount: number;

  constructor(options?: { runbookCount?: number }) {
    this.runbookCount = options?.runbookCount ?? 0;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setRunbookCount(count: number): void {
    this.runbookCount = count;
    this.refresh();
  }

  getTreeItem(element: AutomationTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AutomationTreeItem): AutomationTreeItem[] {
    if (!element) {
      return this.getRootNodes();
    }

    // Real children will be added in phases 59-62
    return [];
  }

  private getRootNodes(): AutomationTreeItem[] {
    const runbookDescription =
      this.runbookCount > 0 ? `${this.runbookCount} runbooks` : 'No runbooks found';

    return [
      new AutomationTreeItem('MCP', vscode.TreeItemCollapsibleState.Collapsed, {
        iconPath: new vscode.ThemeIcon('plug'),
        description: 'No MCP server configured',
        nodeType: 'mcp',
        contextValue: 'automationMcp',
      }),
      new AutomationTreeItem('Command Deck', vscode.TreeItemCollapsibleState.Collapsed, {
        iconPath: new vscode.ThemeIcon('terminal'),
        description: '0 commands',
        nodeType: 'command-deck',
        contextValue: 'automationCommandDeck',
      }),
      new AutomationTreeItem('Runbooks', vscode.TreeItemCollapsibleState.Collapsed, {
        iconPath: new vscode.ThemeIcon('notebook'),
        description: runbookDescription,
        nodeType: 'runbooks',
        contextValue: 'automationRunbooks',
      }),
      new AutomationTreeItem('Recent Runs', vscode.TreeItemCollapsibleState.Collapsed, {
        iconPath: new vscode.ThemeIcon('history'),
        description: 'No recent runs',
        nodeType: 'recent-runs',
        contextValue: 'automationRecentRuns',
      }),
    ];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
