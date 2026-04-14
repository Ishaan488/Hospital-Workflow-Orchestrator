import { Router } from 'express';
import { db } from '../db';
import { approvalRequests, workflows, patients } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Validation schemas
const approveSchema = z.object({
  decidedBy: z.string().min(1, 'decidedBy is required'),
});

const rejectSchema = z.object({
  decidedBy: z.string().min(1, 'decidedBy is required'),
  reason: z.string().optional(),
});

// GET /api/approvals — list all approval requests (defaults to pending)
router.get('/', async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;

    let query = db
      .select({
        id: approvalRequests.id,
        workflowId: approvalRequests.workflowId,
        workflowType: workflows.type,
        patientName: patients.name,
        taskId: approvalRequests.taskId,
        action: approvalRequests.action,
        reason: approvalRequests.reason,
        details: approvalRequests.details,
        status: approvalRequests.status,
        decidedBy: approvalRequests.decidedBy,
        decidedAt: approvalRequests.decidedAt,
        createdAt: approvalRequests.createdAt,
      })
      .from(approvalRequests)
      .leftJoin(workflows, eq(approvalRequests.workflowId, workflows.id))
      .leftJoin(patients, eq(workflows.patientId, patients.id))
      .orderBy(desc(approvalRequests.createdAt));

    const allApprovals = await query;

    // Filter by status if provided
    const filtered = statusFilter
      ? allApprovals.filter((a) => a.status === statusFilter)
      : allApprovals;

    res.json({
      count: filtered.length,
      data: filtered,
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

// POST /api/approvals/:id/approve — approve an action
router.post('/:id/approve', async (req, res) => {
  try {
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const approvalId = req.params.id;

    // Check the approval exists and is pending
    const existing = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalId));

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (existing[0].status !== 'pending') {
      return res.status(400).json({ error: `Approval already ${existing[0].status}` });
    }

    // Update approval
    const updated = await db
      .update(approvalRequests)
      .set({
        status: 'approved',
        decidedBy: parsed.data.decidedBy,
        decidedAt: new Date(),
      })
      .where(eq(approvalRequests.id, approvalId))
      .returning();

    res.json({
      message: 'Approval granted',
      data: updated[0],
    });
  } catch (error) {
    console.error('Error approving:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// POST /api/approvals/:id/reject — reject an action
router.post('/:id/reject', async (req, res) => {
  try {
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const approvalId = req.params.id;

    // Check the approval exists and is pending
    const existing = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, approvalId));

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (existing[0].status !== 'pending') {
      return res.status(400).json({ error: `Approval already ${existing[0].status}` });
    }

    // Update approval
    const updated = await db
      .update(approvalRequests)
      .set({
        status: 'rejected',
        decidedBy: parsed.data.decidedBy,
        decidedAt: new Date(),
      })
      .where(eq(approvalRequests.id, approvalId))
      .returning();

    res.json({
      message: 'Approval rejected',
      data: updated[0],
    });
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

export default router;
