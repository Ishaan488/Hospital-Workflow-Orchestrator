import { db } from '../db/connection';
import { approvalRequests, auditLogs } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { stateMachine } from '../workflows/state-machine';
import { a2aBroker } from '../a2a/broker';

export class ApprovalManager {
  /**
   * Called by an Agent (via MCP or Orchestrator) when it hits a policy wall
   * requiring human authorization (e.g. rescheduling a surgery).
   */
  public async requestApproval(
    workflowId: string,
    taskId: string,
    action: string,
    reason: string,
    details?: Record<string, any>
  ): Promise<string> {
    const approvalId = randomUUID();

    await db.insert(approvalRequests).values({
      id: approvalId,
      workflowId,
      taskId,
      action,
      reason,
      status: 'pending',
      createdAt: new Date()
    });

    // Pause the entire workflow waiting for human interaction
    await stateMachine.transition(workflowId, 'waiting_approval', `Approval requested for task: ${taskId}. Reason: ${reason}`);

    return approvalId;
  }

  /**
   * Retrieves all approvals sitting in the queue waiting for human eyes.
   */
  public async getPendingApprovals() {
    return db.select().from(approvalRequests).where(eq(approvalRequests.status, 'pending'));
  }

  /**
   * Triggered by a Hospital Admin clicking "Approve" on the frontend UI.
   */
  public async approve(approvalId: string, approvedBy: string): Promise<void> {
    const request = await this.getApprovalById(approvalId);
    if (!request || request.status !== 'pending') throw new Error('Invalid or already processed approval request.');

    await db.update(approvalRequests)
      .set({ status: 'approved', decidedBy: approvedBy, decidedAt: new Date() })
      .where(eq(approvalRequests.id, approvalId));

    await db.insert(auditLogs).values({
      workflowId: request.workflowId || null,
      taskId: request.taskId || null,
      agent: 'Human_Admin',
      action: 'Approval Granted',
      details: { approvalId, approvedBy, action: request.action }
    });

    // Unpause Workflow & notify Orchestrator to proceed
    if (request.workflowId && request.taskId) {
      await stateMachine.transition(request.workflowId, 'in_progress', `Human approval granted by ${approvedBy}`);
      
      await a2aBroker.sendTask({
        id: randomUUID(),
        workflowId: request.workflowId,
        fromAgent: 'System_ApprovalGate',
        toAgent: 'OrchestratorAgent',
        status: 'submitted',
        inputMessage: {
          id: randomUUID(),
          role: 'system',
          parts: [{ type: 'text', text: JSON.stringify({ action: 'coordinate_step', completedTaskId: request.taskId, output: { approved: true, approvedBy } }) }],
          timestamp: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Triggered by a Hospital Admin clicking "Reject" on the frontend UI.
   */
  public async reject(approvalId: string, rejectedBy: string, reason: string): Promise<void> {
    const request = await this.getApprovalById(approvalId);
    if (!request || request.status !== 'pending') throw new Error('Invalid or already processed approval request.');

    await db.update(approvalRequests)
      .set({ status: 'rejected', decidedBy: rejectedBy, decidedAt: new Date(), reason }) // Overwriting reason with the rejection context
      .where(eq(approvalRequests.id, approvalId));

    await db.insert(auditLogs).values({
      workflowId: request.workflowId || null,
      taskId: request.taskId || null,
      agent: 'Human_Admin',
      action: 'Approval Rejected',
      details: { approvalId, rejectedBy, action: request.action, reason }
    });

    if (request.workflowId && request.taskId) {
      // Return the rejection back to the Orchestrator for alternative path planning
      await stateMachine.transition(request.workflowId, 'in_progress', `Human approval rejected by ${rejectedBy}. Re-evaluating graph.`);
      
      await a2aBroker.sendTask({
        id: randomUUID(),
        workflowId: request.workflowId,
        fromAgent: 'System_ApprovalGate',
        toAgent: 'OrchestratorAgent',
        status: 'submitted',
        inputMessage: {
          id: randomUUID(),
          role: 'system',
          parts: [{ type: 'text', text: JSON.stringify({ action: 'coordinate_step', completedTaskId: request.taskId, output: { approved: false, rejectedBy, reason } }) }],
          timestamp: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  private async getApprovalById(id: string) {
    const rows = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id));
    return rows[0] || null;
  }
}

export const approvalManager = new ApprovalManager();

/**
 * Express REST Endpoints for the Frontend Next.js UI to call
 */
export const approvalRouter = Router();

approvalRouter.get('/api/approvals', async (req, res) => {
  try {
    const pending = await approvalManager.getPendingApprovals();
    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

approvalRouter.post('/api/approvals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;
    await approvalManager.approve(id, approvedBy || 'AdminUser');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

approvalRouter.post('/api/approvals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, reason } = req.body;
    await approvalManager.reject(id, rejectedBy || 'AdminUser', reason || 'Rejected by hospital policy');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
