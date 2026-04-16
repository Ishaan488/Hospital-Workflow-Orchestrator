import { Router } from 'express';
import { db } from '../db';
import { workflows, workflowTasks, auditLogs, users, incidents } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// GET /api/workflows — list all workflows
router.get('/', async (_req, res) => {
  try {
    const allWorkflows = await db
      .select({
        id: workflows.id,
        type: workflows.type,
        status: workflows.status,
        patientName: users.name,
        context: workflows.context,
        result: workflows.result,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
        completedAt: workflows.completedAt,
      })
      .from(workflows)
      .leftJoin(incidents, eq(workflows.incidentId, incidents.id))
      .leftJoin(users, eq(incidents.userId, users.id))
      .orderBy(desc(workflows.createdAt));

    res.json({
      count: allWorkflows.length,
      data: allWorkflows,
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// GET /api/workflows/:id — get a single workflow with tasks and audit trail
router.get('/:id', async (req, res) => {
  try {
    const workflowId = req.params.id;

    // Fetch the workflow
    const workflowResult = await db
      .select({
        id: workflows.id,
        type: workflows.type,
        status: workflows.status,
        patientName: users.name,
        context: workflows.context,
        result: workflows.result,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
        completedAt: workflows.completedAt,
      })
      .from(workflows)
      .leftJoin(incidents, eq(workflows.incidentId, incidents.id))
      .leftJoin(users, eq(incidents.userId, users.id))
      .where(eq(workflows.id, workflowId));

    if (workflowResult.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Fetch associated tasks
    const tasks = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(workflowTasks.createdAt);

    // Fetch audit trail
    const audit = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.workflowId, workflowId))
      .orderBy(auditLogs.timestamp);

    res.json({
      data: {
        ...workflowResult[0],
        tasks,
        auditTrail: audit,
      },
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// POST /api/workflows/:id/stop — mark a workflow as failed/stopped
router.post('/:id/stop', async (req, res) => {
  try {
    const workflowId = req.params.id;

    await db
      .update(workflows)
      .set({ 
        status: 'failed',
        updatedAt: new Date()
      })
      .where(eq(workflows.id, workflowId));

    // Log the termination action
    await db.insert(auditLogs).values({
      workflowId,
      agent: 'System',
      action: 'Workflow terminated by user',
      details: { reason: 'User requested stop', timestamp: new Date().toISOString() },
    });

    res.json({ success: true, message: 'Workflow stopped' });
  } catch (error) {
    console.error('Error stopping workflow:', error);
    res.status(500).json({ error: 'Failed to stop workflow' });
  }
});

// DELETE /api/workflows/:id — delete a workflow and all its data
router.delete('/:id', async (req, res) => {
  try {
    const workflowId = req.params.id;

    // Manual cascade delete (ensures cleanup even if FKs aren't cascading in SQL)
    await db.delete(auditLogs).where(eq(auditLogs.workflowId, workflowId));
    await db.delete(workflowTasks).where(eq(workflowTasks.workflowId, workflowId));
    await db.delete(workflows).where(eq(workflows.id, workflowId));

    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
