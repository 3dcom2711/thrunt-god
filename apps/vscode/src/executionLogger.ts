import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ExecutionEntry } from '../shared/execution-history';
import type { RunbookRunRecord } from '../shared/runbook';

const HISTORY_FILENAME = '.run-history.json';
const HISTORY_DIR = '.planning';
const DEFAULT_MAX_ENTRIES = 100;

export class ExecutionLogger implements vscode.Disposable {
  private readonly historyPath: string;
  private readonly _onDidAppend = new vscode.EventEmitter<void>();
  readonly onDidAppend: vscode.Event<void> = this._onDidAppend.event;

  constructor(workspaceRoot: string) {
    this.historyPath = path.join(workspaceRoot, HISTORY_DIR, HISTORY_FILENAME);
  }

  /**
   * Append an entry to the history file, pruning to maxEntries.
   * Writes atomically via tmp file + rename.
   */
  append(entry: ExecutionEntry): void {
    const entries = this.readEntries();
    entries.unshift(entry);
    const max = this.getMaxEntries();
    if (entries.length > max) {
      entries.length = max;
    }
    this.writeEntries(entries);
    this._onDidAppend.fire();
  }

  /**
   * Return up to `limit` recent entries (newest first).
   * Returns empty array if file missing or corrupt.
   */
  getRecent(limit?: number): ExecutionEntry[] {
    const entries = this.readEntries();
    if (limit !== undefined && limit >= 0) {
      return entries.slice(0, limit);
    }
    return entries;
  }

  /**
   * Prune entries to maxEntries. No-op if already within limit.
   */
  prune(): void {
    const entries = this.readEntries();
    const max = this.getMaxEntries();
    if (entries.length > max) {
      entries.length = max;
      this.writeEntries(entries);
    }
  }

  /**
   * Read the configured max entries from VS Code settings.
   */
  getMaxEntries(): number {
    const config = vscode.workspace.getConfiguration('thruntGod');
    return config.get<number>('executionHistory.maxEntries', DEFAULT_MAX_ENTRIES);
  }

  /**
   * Delete the history file if it exists.
   */
  clear(): void {
    try {
      if (fs.existsSync(this.historyPath)) {
        fs.unlinkSync(this.historyPath);
      }
    } catch (err) {
      console.error(`[ExecutionLogger] Failed to clear history: ${err}`);
    }
  }

  dispose(): void {
    this._onDidAppend.dispose();
  }

  private readEntries(): ExecutionEntry[] {
    try {
      if (!fs.existsSync(this.historyPath)) {
        return [];
      }
      const raw = fs.readFileSync(this.historyPath, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeEntries(entries: ExecutionEntry[]): void {
    try {
      const dir = path.dirname(this.historyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = this.historyPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2));
      try { fs.unlinkSync(this.historyPath); } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && (e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      }
      fs.renameSync(tmpPath, this.historyPath);
    } catch (err) {
      console.error(`[ExecutionLogger] Failed to write history: ${err}`);
    }
  }
}

/**
 * Show a modal warning dialog for mutating actions.
 * Returns true if the user chose to proceed, false otherwise.
 */
export async function confirmMutatingAction(
  actionName: string,
  environment: string | null,
): Promise<boolean> {
  const envLabel = environment ? `Target: ${environment}` : 'Target: local workspace';
  const result = await vscode.window.showWarningMessage(
    `"${actionName}" is a mutating action that will change state.\n\n${envLabel}\n\nProceed?`,
    { modal: true },
    'Proceed',
  );
  return result === 'Proceed';
}

/**
 * Build an ExecutionEntry from command deck execution results.
 */
export function buildCommandEntry(
  name: string,
  args: string[],
  stdout: string,
  stderr: string,
  exitCode: number | null,
  startedAt: number,
  status: 'success' | 'failure',
  environment: string | null,
  mutating: boolean,
): ExecutionEntry {
  return {
    id: `EXE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'command',
    name,
    args,
    stdout,
    stderr,
    exitCode,
    startedAt,
    duration: Date.now() - startedAt,
    status,
    environment,
    mutating,
  };
}

/**
 * Build an ExecutionEntry from a RunbookRunRecord.
 */
export function buildRunbookEntry(
  record: RunbookRunRecord,
  environment: string | null,
): ExecutionEntry {
  const stdout = record.stepResults.map(r => r.output).join('\n');
  return {
    id: `EXE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'runbook',
    name: record.runbookName,
    args: Object.entries(record.inputs).map(([k, v]) => `${k}=${v}`),
    stdout,
    stderr: '',
    exitCode: record.status === 'success' ? 0 : 1,
    startedAt: record.startTime,
    duration: record.durationMs,
    status: record.status === 'success' ? 'success' : record.status === 'aborted' ? 'aborted' : 'failure',
    environment,
    mutating: true, // runbooks are always mutating (they execute steps)
  };
}
