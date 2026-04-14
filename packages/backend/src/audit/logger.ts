import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { Router } from 'express';

/**
 * Service to manage and query the centralized Audit Trail.
 * Note: Insertion methods are largely omitted here because agents insert directly 
 * via `BaseAgent.logAudit()` to avoid circular dependency bloat.
 */
export class AuditLogger {
  
  /**
   * Retrieves the comprehensive, chronological audit trail for a specific workflow.
   * This is critical for Human-in-the-loop (HITL) review processes.
   */
  public async getTrail(workflowId: string) {
    const logs = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.workflowId, workflowId))
      .orderBy(desc(auditLogs.timestamp)); // Fetch newest to oldest
      
    return logs;
  }

  /**
   * Diagnostic: Fetch all global system logs not bound to a specific workflow graph.
   */
  public async getSystemLevelLogs(limit = 100) {
    // Queries logs where workflowId is strictly null (e.g., initial agent boots, global crashes)
    // For POC, we'll just query everything descending if you want a global firehose.
    const logs = await db.select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);

    return logs;
  }
}

export const auditLogger = new AuditLogger();

/**
 * Express REST Endpoint for Ops Console / Human extraction
 */
export const auditRouter = Router();

// Retrieve full audit trace for a specific patient workflow
auditRouter.get('/api/workflows/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Missing workflow ID parameter' });
      return;
    }

    const trail = await auditLogger.getTrail(id);
    res.json({ workflowId: id, totalLogs: trail.length, logs: trail });

  } catch (err: any) {
    console.error('[Audit API]', err);
    res.status(500).json({ error: 'Failed to retrieve audit trail' });
  }
});

// Diagnostic firehose
auditRouter.get('/api/audit/system', async (req, res) => {
  try {
    const trail = await auditLogger.getSystemLevelLogs(200);
    res.json(trail);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve system logs' });
  }
});
