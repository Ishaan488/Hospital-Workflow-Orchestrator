/**
 * MCP Server Initialization
 *
 * Bootstraps all MCP stub servers and registers them with the registry.
 * Called once on application startup.
 *
 * Each MCP server will be implemented in its own file (Segments 2.2–2.6).
 * This file wires them all together.
 */

import { mcpRegistry } from './registry';
import { initEHRMCP } from './ehr';
import { initInsuranceMCP } from './insurance';
import { initSchedulingMCP } from './scheduling';
import { initNotificationMCP } from './notifications';

/**
 * Initialize all MCP servers and register them.
 * Individual server init functions will be added in Segments 2.2–2.6.
 */
export async function initializeMCPServers(): Promise<void> {
  console.log('\n📡 Initializing MCP servers...');

  // Segment 2.2: EHR MCP
  await initEHRMCP();

  // Segment 2.3: Insurance MCP
  await initInsuranceMCP();

  // Segment 2.4: Scheduling MCP
  await initSchedulingMCP();

  // Segment 2.5: Notification MCP
  await initNotificationMCP();

  // Segment 2.6: Task/Audit MCP — will be added

  const servers = mcpRegistry.listServers();
  console.log(`✅ ${servers.length} MCP server(s) initialized\n`);
}

/**
 * Get a summary of all registered MCP servers and their tools.
 * Useful for the orchestrator agent to know what's available.
 */
export async function getMCPCapabilities(): Promise<{
  servers: string[];
  tools: { server: string; name: string; description?: string }[];
}> {
  const servers = mcpRegistry.listServers();
  const tools = await mcpRegistry.listAllTools();
  return { servers, tools };
}
