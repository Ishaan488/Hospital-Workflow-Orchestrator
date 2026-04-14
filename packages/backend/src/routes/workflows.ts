import { Router } from 'express';
import { db } from '../db';
import { workflows, workflowTasks, auditLogs, patients, appointments } from '../db/schema';
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
        patientId: workflows.patientId,
        patientName: patients.name,
        appointmentId: workflows.appointmentId,
        context: workflows.context,
        result: workflows.result,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
        completedAt: workflows.completedAt,
      })
      .from(workflows)
      .leftJoin(patients, eq(workflows.patientId, patients.id))
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
        patientId: workflows.patientId,
        patientName: patients.name,
        appointmentId: workflows.appointmentId,
        appointmentSlot: appointments.slotTime,
        appointmentDepartment: appointments.department,
        context: workflows.context,
        result: workflows.result,
        createdAt: workflows.createdAt,
        updatedAt: workflows.updatedAt,
        completedAt: workflows.completedAt,
      })
      .from(workflows)
      .leftJoin(patients, eq(workflows.patientId, patients.id))
      .leftJoin(appointments, eq(workflows.appointmentId, appointments.id))
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

export default router;
