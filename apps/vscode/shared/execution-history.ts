// Shared types for execution history

export type ExecutionEntryType = 'command' | 'runbook';

export interface ExecutionEntry {
  id: string;              // EXE-{timestamp}-{random4}
  type: ExecutionEntryType;
  name: string;            // command label or runbook name
  args: string[];          // CLI args or runbook inputs as key=value pairs
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: number;       // Date.now()
  duration: number;        // ms
  status: 'success' | 'failure' | 'aborted';
  environment: string | null; // MCP profile name or null
  mutating: boolean;       // whether the action was classified as mutating
}
