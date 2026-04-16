/**
 * Task/Audit MCP Server
 *
 * Stub MCP server for managing workflow states, tasks, and audit logs.
 * Writes directly to PostgreSQL using Drizzle ORM.
 *
 * Tools:
 *   - create_audit_entry(workflow_id, task_id, agent, action, details)
 *   - update_task_status(task_id, status, output)
 *   - create_approval_request(workflow_id, task_id, action, reason, details)
 */

import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';
import { db } from '../db/connection';
import { auditLogs, workflowTasks } from '../db/schema';
import { eq } from 'drizzle-orm';

const SERVER_NAME = 'workflow_management';
const LATENCY_MS = 50;

export async function initTaskAuditMCP(): Promise<void> {
  // Phase 1: Create server
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Workflow management system — task tracking, auditing, and approvals',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });

  // ─── Tool: create_audit_entry ─────────────────────────
  const createAuditSchema = {
    workflow_id: z.string().describe('UUID of the active workflow'),
    task_id: z.string().optional().describe('UUID of the specific task (if any)'),
    agent: z.string().describe('Name of the agent performing the action'),
    action: z.string().describe('Description of the action (e.g., "Verification complete")'),
    details: z.record(z.any()).optional().describe('Additional structured data'),
  };

  async function createAuditHandler(args: { 
    workflow_id: string; 
    task_id?: string; 
    agent: string; 
    action: string; 
    details?: Record<string, any> 
  }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { workflow_id, task_id, agent, action, details } = args;
    await simulateLatency(LATENCY_MS);

    const log = await db.insert(auditLogs).values({
      workflowId: workflow_id,
      taskId: task_id || null,
      agent,
      action,
      details: details || {},
    }).returning();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          auditId: log[0].id,
          timestamp: log[0].timestamp,
        }),
      }],
    };
  }
  server.tool('create_audit_entry', 'Record an action in the workflow audit trail', createAuditSchema as any, createAuditHandler as any);

  // ─── Tool: update_task_status ─────────────────────────
  const updateTaskSchema = {
    task_id: z.string().describe('UUID of the task to update'),
    status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped']).describe('New task status'),
    output: z.record(z.any()).optional().describe('Final output/results of the task'),
  };

  async function updateTaskHandler(args: { 
    task_id: string; 
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'skipped';
    output?: Record<string, any> 
  }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { task_id, status, output } = args;
    await simulateLatency(LATENCY_MS);

    const updated = await db
      .update(workflowTasks)
      .set({ 
        status, 
        output: output || undefined,
        completedAt: ['completed', 'failed', 'skipped'].includes(status) ? new Date() : undefined,
        updatedAt: new Date()
      })
      .where(eq(workflowTasks.id, task_id))
      .returning();

    if (updated.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Task not found', task_id }) }],
        isError: true,
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          taskId: task_id,
          newStatus: status,
          updatedAt: updated[0].updatedAt,
        }),
      }],
    };
  }
  server.tool('update_task_status', 'Update the status and result of a workflow task', updateTaskSchema as any, updateTaskHandler as any);

  // Removed create_approval_request tool to match schema.

  // Phase 2: Connect transport
  const { client } = await connectMCPServer(server, config);

  // Register with global registry
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}
