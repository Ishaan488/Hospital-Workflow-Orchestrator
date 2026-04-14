/**
 * MCP Base Types
 *
 * Shared types used across all MCP servers and the registry.
 */

// Result of calling an MCP tool
export interface MCPToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Configuration for creating an MCP server
export interface MCPServerConfig {
  name: string;
  description: string;
  version: string;
  simulatedLatencyMs?: number; // artificial delay to simulate real system calls
}

// A registered tool definition (for introspection/logging)
export interface MCPToolDefinition {
  name: string;
  description: string;
  server: string;
  parameters: Record<string, unknown>;
}

// Log entry for every MCP tool call (fed into audit trail)
export interface MCPToolCallLog {
  id: string;
  server: string;
  tool: string;
  args: Record<string, unknown>;
  result: MCPToolResult;
  durationMs: number;
  timestamp: Date;
  calledBy?: string; // agent name
  workflowId?: string;
}
