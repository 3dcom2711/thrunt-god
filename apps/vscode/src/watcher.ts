import * as vscode from 'vscode';
import { HUNT_DIRS } from './constants';
import type { ArtifactType } from './types';

function toArtifactRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');

  for (const huntDir of HUNT_DIRS) {
    const marker = `/${huntDir}/`;
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex >= 0) {
      return normalized.slice(markerIndex + marker.length);
    }

    if (normalized === huntDir || normalized.startsWith(`${huntDir}/`)) {
      return normalized.slice(huntDir.length).replace(/^\/+/, '');
    }
  }

  const fallback = normalized.replace(/^\/+/, '');
  const parts = fallback.split('/').filter(Boolean);
  const filename = parts[parts.length - 1] ?? '';
  const directContainer = parts[parts.length - 2] ?? '';

  for (let i = 0; i < parts.length - 2; i += 1) {
    if (parts[i] === 'cases' || parts[i] === 'workstreams') {
      return parts.slice(i).join('/');
    }
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (
    filename === 'MISSION.md' ||
    filename === 'HYPOTHESES.md' ||
    filename === 'HUNTMAP.md' ||
    filename === 'STATE.md' ||
    filename === 'EVIDENCE_REVIEW.md' ||
    filename === 'FINDINGS.md'
  ) {
    return filename;
  }

  if (directContainer === 'QUERIES' || directContainer === 'RECEIPTS' || directContainer === 'published') {
    return `${directContainer}/${filename}`;
  }

  return fallback;
}

function splitArtifactNamespace(relativePath: string): { namespace: string | null; scopedPath: string } {
  const childMatch = /^(cases|workstreams)\/([^/]+)\/(.+)$/.exec(relativePath);
  if (!childMatch) {
    return { namespace: null, scopedPath: relativePath };
  }
  return {
    namespace: `${childMatch[1]}/${childMatch[2]}`,
    scopedPath: childMatch[3],
  };
}

function scopedArtifactId(namespace: string | null, artifactId: string): string {
  return namespace ? `${namespace}/${artifactId}` : artifactId;
}

/**
 * Resolve a file path (relative to hunt root) to an artifact type and ID.
 * Returns null for unrecognized files.
 */
export function resolveArtifactType(filePath: string): { type: ArtifactType; id: string } | null {
  const normalized = toArtifactRelativePath(filePath);
  const { namespace, scopedPath } = splitArtifactNamespace(normalized);
  const basename = scopedPath.split('/').pop() ?? '';
  const nameNoExt = basename.replace(/\.md$/i, '');

  // Top-level singleton artifacts
  switch (scopedPath) {
    case 'MISSION.md':
      return { type: 'mission', id: scopedArtifactId(namespace, 'MISSION') };
    case 'HYPOTHESES.md':
      return { type: 'hypotheses', id: scopedArtifactId(namespace, 'HYPOTHESES') };
    case 'HUNTMAP.md':
      return { type: 'huntmap', id: scopedArtifactId(namespace, 'HUNTMAP') };
    case 'STATE.md':
      return { type: 'state', id: scopedArtifactId(namespace, 'STATE') };
    case 'EVIDENCE_REVIEW.md':
      return { type: 'evidenceReview', id: scopedArtifactId(namespace, 'EVIDENCE_REVIEW') };
    case 'FINDINGS.md':
    case 'published/FINDINGS.md':
      return { type: 'phaseSummary', id: scopedArtifactId(namespace, 'FINDINGS') };
  }

  // Directory-based artifacts: QUERIES/QRY-*.md and RECEIPTS/RCT-*.md
  if (/^QUERIES\/QRY-[^/]+\.md$/i.test(scopedPath)) {
    return { type: 'query', id: scopedArtifactId(namespace, nameNoExt) };
  }
  if (/^RECEIPTS\/RCT-[^/]+\.md$/i.test(scopedPath)) {
    return { type: 'receipt', id: scopedArtifactId(namespace, nameNoExt) };
  }

  // Unrecognized artifact (e.g. SUCCESS_CRITERIA.md, environment/ENVIRONMENT.md)
  return null;
}

/** Tracked file state for stability checking */
interface FileState {
  mtime: number;
  size: number;
}

/**
 * ArtifactWatcher monitors a hunt directory for .md file changes.
 *
 * Uses VS Code's FileSystemWatcher with per-file 300ms debounce
 * and mtime/size stability checks to avoid acting on half-written files.
 * Emits arrays of changed file paths via onDidChange.
 */
export class ArtifactWatcher implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<string[]>();
  readonly onDidChange: vscode.Event<string[]> = this._onDidChange.event;

  private readonly watcher: vscode.FileSystemWatcher;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastStats = new Map<string, FileState>();

  private static readonly DEBOUNCE_MS = 300;

  constructor(huntRoot: vscode.Uri) {
    const pattern = new vscode.RelativePattern(huntRoot, '**/*.md');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

    this.watcher.onDidCreate((uri) => this.scheduleFile(uri));
    this.watcher.onDidChange((uri) => this.scheduleFile(uri));
    this.watcher.onDidDelete((uri) => this.handleDelete(uri));
  }

  /**
   * Schedule a file for emission after debounce + stability check.
   */
  private scheduleFile(uri: vscode.Uri): void {
    const filePath = uri.fsPath;

    // Clear existing timer for this path (restart debounce)
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.checkStabilityAndEmit(uri);
    }, ArtifactWatcher.DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Stat the file and verify mtime/size stability before emitting.
   * If the file changed since the debounce started, re-schedule.
   */
  private async checkStabilityAndEmit(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      const current: FileState = {
        mtime: stat.mtime,
        size: stat.size,
      };

      const previous = this.lastStats.get(filePath);

      if (previous && (previous.mtime !== current.mtime || previous.size !== current.size)) {
        // File changed during the debounce window -- restart
        this.lastStats.set(filePath, current);
        this.scheduleFile(uri);
        return;
      }

      // Stable -- update tracked state and emit
      this.lastStats.set(filePath, current);
      this._onDidChange.fire([filePath]);
    } catch {
      // File may have been deleted between change event and stat -- emit anyway
      // so the store can handle removal
      this._onDidChange.fire([filePath]);
    }
  }

  /**
   * Handle file deletion -- emit immediately (no debounce needed).
   */
  private handleDelete(uri: vscode.Uri): void {
    const filePath = uri.fsPath;

    // Clear any pending debounce timer
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.debounceTimers.delete(filePath);
    }

    // Clean up tracked state
    this.lastStats.delete(filePath);

    this._onDidChange.fire([filePath]);
  }

  dispose(): void {
    // Clear all pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.lastStats.clear();

    this.watcher.dispose();
    this._onDidChange.dispose();
  }
}
