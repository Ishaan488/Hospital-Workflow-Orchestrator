import { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
  workflowId: string | 'global';
}

/**
 * SSEManager — singleton that manages all frontend SSE connections.
 * Allows broadcasting real-time A2A events, agent reasoning, and MCP tool calls
 * directly to the browser as they happen.
 */
class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  /**
   * Register a new SSE client connection.
   * @param clientId — unique connection ID (use UUID)
   * @param workflowId — workflow ID to subscribe to, or 'global' for dashboard feed
   * @param res — Express response object to write SSE events to
   */
  public addClient(clientId: string, workflowId: string | 'global', res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection confirmation event
    this.writeEvent(res, 'connected', { clientId, workflowId, timestamp: new Date().toISOString() });

    const client: SSEClient = { id: clientId, res, workflowId };
    this.clients.set(clientId, client);

    console.log(`[SSE] Client connected: ${clientId} → watching workflow: ${workflowId}. Total: ${this.clients.size}`);

    // Clean up on client disconnect
    res.on('close', () => {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId}. Total: ${this.clients.size}`);
    });
  }

  /**
   * Broadcast an event to all clients watching a specific workflow.
   */
  public broadcast(workflowId: string, eventType: SSEEventType, data: Record<string, any>): void {
    const payload = { ...data, workflowId, timestamp: new Date().toISOString() };
    let count = 0;

    for (const client of this.clients.values()) {
      if (client.workflowId === workflowId || client.workflowId === 'global') {
        this.writeEvent(client.res, eventType, payload);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[SSE] Broadcast '${eventType}' to ${count} client(s) for workflow ${workflowId}`);
    }
  }

  /**
   * Broadcast an event to ALL connected clients (for dashboard-level updates).
   */
  public broadcastGlobal(eventType: SSEEventType, data: Record<string, any>): void {
    const payload = { ...data, timestamp: new Date().toISOString() };

    for (const client of this.clients.values()) {
      this.writeEvent(client.res, eventType, payload);
    }
  }

  /**
   * Write a properly formatted SSE event to a response stream.
   */
  private writeEvent(res: Response, eventType: string, data: Record<string, any>): void {
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      // Client disconnected mid-write — ignore silently
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();

// ─── SSE Event Types ─────────────────────────────────────────────────────────
export type SSEEventType =
  | 'connected'
  | 'a2a_message'          // Agent-to-Agent message dispatched
  | 'task_status_update'   // A2A task status changed
  | 'agent_reasoning'      // Agent logged its LLM thought process
  | 'mcp_tool_call'        // Agent called an MCP tool
  | 'workflow_state_change'// Workflow state machine transition
  | 'approval_requested'   // Human approval gate triggered
  | 'audit_log'            // Generic audit log entry
  | 'agent_escalation';    // Agent hit max retries and escalated
