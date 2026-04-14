/**
 * MCP Server Registry
 *
 * Central registry for all MCP servers. Agents call tools through this registry
 * rather than directly referencing individual servers.
 *
 * Responsibilities:
 * - Register and initialize MCP servers
 * - Provide a unified `callTool()` interface for agents
 * - Log all tool calls for audit trail
 * - Handle errors and timeouts uniformly
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MCPToolCallLog, MCPToolResult, MCPServerConfig } from './types';
import { v4 as uuidv4 } from 'crypto';

interface RegisteredServer {
  server: McpServer;
  client: Client;
  config: MCPServerConfig;
}

// Tool call listener type — used to pipe calls to audit system
type ToolCallListener = (log: MCPToolCallLog) => void;

class MCPRegistry {
  private servers: Map<string, RegisteredServer> = new Map();
  private toolCallListeners: ToolCallListener[] = [];
  private toolCallHistory: MCPToolCallLog[] = [];

  /**
   * Register an MCP server with the registry.
   */
  register(name: string, entry: RegisteredServer): void {
    if (this.servers.has(name)) {
      console.warn(`⚠️  MCP server "${name}" already registered, replacing.`);
    }
    this.servers.set(name, entry);
    console.log(`   📡 MCP registered: ${name} (${entry.config.description})`);
  }

  /**
   * Get a registered server by name.
   */
  getServer(name: string): RegisteredServer | undefined {
    return this.servers.get(name);
  }

  /**
   * List all registered server names.
   */
  listServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Get tool definitions from a specific server.
   */
  async listTools(serverName: string): Promise<{ name: string; description?: string }[]> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      throw new Error(`MCP server "${serverName}" not found`);
    }

    const result = await entry.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  /**
   * List tools from ALL registered servers.
   */
  async listAllTools(): Promise<{ server: string; name: string; description?: string }[]> {
    const allTools: { server: string; name: string; description?: string }[] = [];

    for (const [serverName, entry] of this.servers) {
      const result = await entry.client.listTools();
      for (const tool of result.tools) {
        allTools.push({
          server: serverName,
          name: tool.name,
          description: tool.description,
        });
      }
    }

    return allTools;
  }

  /**
   * Call a tool on a specific MCP server.
   * This is the main interface agents use.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    context?: { calledBy?: string; workflowId?: string }
  ): Promise<MCPToolResult> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      return {
        success: false,
        error: `MCP server "${serverName}" not found. Available: ${this.listServers().join(', ')}`,
      };
    }

    const startTime = Date.now();
    const callId = generateId();

    try {
      // Call the tool via the MCP client
      const result = await entry.client.callTool({
        name: toolName,
        arguments: args,
      });

      const durationMs = Date.now() - startTime;

      // Parse the result content
      let data: Record<string, unknown> = {};
      if (result.content && Array.isArray(result.content)) {
        for (const item of result.content) {
          if (item.type === 'text') {
            try {
              data = JSON.parse(item.text as string);
            } catch {
              data = { text: item.text };
            }
          }
        }
      }

      const toolResult: MCPToolResult = result.isError
        ? { success: false, error: data.error as string || 'Tool returned error' }
        : { success: true, data };

      // Log the call
      const log: MCPToolCallLog = {
        id: callId,
        server: serverName,
        tool: toolName,
        args,
        result: toolResult,
        durationMs,
        timestamp: new Date(),
        calledBy: context?.calledBy,
        workflowId: context?.workflowId,
      };

      this.toolCallHistory.push(log);
      this.notifyListeners(log);

      return toolResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      const toolResult: MCPToolResult = {
        success: false,
        error: `MCP call failed: ${serverName}.${toolName} — ${errorMsg}`,
      };

      // Log the failed call
      const log: MCPToolCallLog = {
        id: callId,
        server: serverName,
        tool: toolName,
        args,
        result: toolResult,
        durationMs,
        timestamp: new Date(),
        calledBy: context?.calledBy,
        workflowId: context?.workflowId,
      };

      this.toolCallHistory.push(log);
      this.notifyListeners(log);

      return toolResult;
    }
  }

  /**
   * Register a listener that gets called on every tool invocation.
   * Used to pipe tool calls into the audit system.
   */
  onToolCall(listener: ToolCallListener): void {
    this.toolCallListeners.push(listener);
  }

  /**
   * Get recent tool call history.
   */
  getHistory(limit = 50): MCPToolCallLog[] {
    return this.toolCallHistory.slice(-limit);
  }

  /**
   * Get tool call history for a specific workflow.
   */
  getWorkflowHistory(workflowId: string): MCPToolCallLog[] {
    return this.toolCallHistory.filter((log) => log.workflowId === workflowId);
  }

  private notifyListeners(log: MCPToolCallLog): void {
    for (const listener of this.toolCallListeners) {
      try {
        listener(log);
      } catch (err) {
        console.error('Error in MCP tool call listener:', err);
      }
    }
  }
}

// Simple ID generator (no external uuid dependency needed)
function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Singleton registry instance
export const mcpRegistry = new MCPRegistry();
