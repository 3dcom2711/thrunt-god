// Shared types for MCP Control Panel webview <-> host messages

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerStatus {
  connection: 'connected' | 'disconnected' | 'checking';
  profile: string | null;
  serverVersion: string | null;
  toolCount: number;
  dbSizeBytes: number;
  dbTableCount: number;
  uptimeMs: number;
  lastHealthCheck: string | null;  // ISO timestamp
  hasError: boolean;
  errorMessage: string | null;
}

export interface McpControlBootData {
  surfaceId: 'mcp-control';
}

export type HostToMcpControlMessage =
  | { type: 'init'; status: McpServerStatus; tools: McpToolInfo[]; isDark: boolean }
  | { type: 'status'; status: McpServerStatus }
  | { type: 'tools'; tools: McpToolInfo[] }
  | { type: 'toolResult'; toolName: string; result: string; isError: boolean }
  | { type: 'theme'; isDark: boolean };

export type McpControlToHostMessage =
  | { type: 'webview:ready' }
  | { type: 'refresh' }
  | { type: 'tool:test'; toolName: string; input: string }
  | { type: 'action:start' }
  | { type: 'action:restart' }
  | { type: 'action:healthCheck' }
  | { type: 'profile:switch'; profile: string };
