/**
 * MCP Debug Routes
 *
 * Exposes MCP registry info for debugging and introspection.
 * Not intended for production use.
 */

import { Router } from 'express';
import { mcpRegistry } from '../mcp';
import { getMCPCapabilities } from '../mcp/init';

const router = Router();

// GET /api/mcp/servers — list all registered MCP servers
router.get('/servers', async (_req, res) => {
  try {
    const capabilities = await getMCPCapabilities();
    res.json(capabilities);
  } catch (error) {
    console.error('Error listing MCP servers:', error);
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

// GET /api/mcp/history — recent tool call history
router.get('/history', (req, res) => {
  const limit = parseInt(String(req.query?.limit || '50'), 10);
  const history = mcpRegistry.getHistory(limit);
  res.json({
    count: history.length,
    data: history,
  });
});

// POST /api/mcp/call — manually call an MCP tool (for debugging)
router.post('/call', async (req, res) => {
  const { server, tool, args } = req.body;

  if (!server || !tool) {
    return res.status(400).json({ error: 'server and tool are required' });
  }

  try {
    const result = await mcpRegistry.callTool(server, tool, args || {}, {
      calledBy: 'debug-console',
    });
    res.json(result);
  } catch (error) {
    console.error('Error calling MCP tool:', error);
    res.status(500).json({ error: 'Failed to call MCP tool' });
  }
});

export default router;
