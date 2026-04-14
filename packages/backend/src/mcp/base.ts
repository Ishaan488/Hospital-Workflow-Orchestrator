/**
 * MCP Base Server Factory
 *
 * Creates MCP servers using the official TypeScript SDK with in-memory transport.
 * Each server is a self-contained unit that registers tools and can be connected
 * to via an MCP client within the same process.
 *
 * For POC, all servers run in-process. In production, each would be a separate
 * service with HTTP/SSE transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { MCPServerConfig } from './types';

/**
 * Creates an MCP server instance with the given config.
 * Returns both the server (for registering tools) and a connected client (for calling tools).
 */
export async function createMCPServer(config: MCPServerConfig): Promise<{
  server: McpServer;
  client: Client;
  config: MCPServerConfig;
}> {
  // Create the MCP server
  const server = new McpServer({
    name: config.name,
    version: config.version,
  });

  // Create an in-memory transport pair (client <-> server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  // Create an MCP client to connect to this server
  const client = new Client({
    name: `${config.name}-client`,
    version: config.version,
  });

  // Connect server-side transport
  await server.server.connect(serverTransport);

  // Connect client-side transport
  await client.connect(clientTransport);

  return { server, client, config };
}

/**
 * Helper to add simulated latency to MCP tool handlers.
 * Used to simulate real hospital system response times.
 */
export function simulateLatency(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
