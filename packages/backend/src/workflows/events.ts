import { z } from 'zod';
import { workflowEngine } from './engine';
import { a2aBroker } from '../a2a/broker';
import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { Router } from 'express';

/**
 * Emergency Incident Event Schema.
 * Consumed by the /api/events HTTP ingress route.
 * Replaces the old hospital appointment webhook model.
 */
const EventSchema = z.object({
  eventType: z.enum(['emergency_incident', 'mesh_relay_triggered', 'condition_worsened']),
  incidentId: z.string().uuid(),
  payload: z.record(z.any()),
});

export type EmergencyEvent = z.infer<typeof EventSchema>;

export class EventIngestion {
  /**
   * Main entry point for emergency dispatch system webhooks.
   */
  public async ingestEvent(rawEvent: any): Promise<{ success: boolean; workflowId?: string; message?: string }> {
    try {
      const event = EventSchema.parse(rawEvent);
      console.log(`[EventIngress] Validated emergency event: ${event.eventType} for incident ${event.incidentId}`);

      let targetWorkflowId: string | undefined;

      switch (event.eventType) {
        case 'emergency_incident':
        case 'mesh_relay_triggered':
          targetWorkflowId = await this.triggerEmergencyWorkflow(event);
          break;
        case 'condition_worsened':
          targetWorkflowId = await this.triggerReplanning(event);
          break;
      }

      await db.insert(auditLogs).values({
        workflowId: targetWorkflowId || null,
        agent: 'System_Ingress',
        action: `Ingested Event: ${event.eventType}`,
        details: { event },
      });

      return { success: true, workflowId: targetWorkflowId };
    } catch (err: any) {
      console.error(`[EventIngress] Failed to ingest event:`, err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Spins up a brand-new emergency orchestration workflow.
   */
  private async triggerEmergencyWorkflow(event: EmergencyEvent): Promise<string> {
    const workflowId = await workflowEngine.createWorkflow(
      event.eventType,
      { type: event.eventType, incident_id: event.incidentId, ...event.payload },
      event.incidentId,
    );

    const initialTask = {
      id: randomUUID(),
      workflowId,
      fromAgent: 'System_Ingress',
      toAgent: 'OrchestratorAgent',
      status: 'submitted',
      inputMessage: {
        id: randomUUID(),
        role: 'system',
        parts: [{
          type: 'text',
          text: JSON.stringify({
            action: 'plan_workflow',
            context: {
              type: event.eventType,
              incident_id: event.incidentId,
              details: event.payload,
            },
          }),
        }],
        timestamp: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    await a2aBroker.sendTask(initialTask);
    return workflowId;
  }

  /**
   * Triggers a re-planning task when conditions worsen mid-incident.
   */
  private async triggerReplanning(event: EmergencyEvent): Promise<string | undefined> {
    console.log(`[EventIngress] Condition-worsened replanning triggered for incident ${event.incidentId}`);
    // In a full system, look up the active workflow for this incident and send coordinate_step
    return undefined;
  }
}

export const eventIngestion = new EventIngestion();

export const eventRouter = Router();

eventRouter.post('/api/events', async (req, res) => {
  const result = await eventIngestion.ingestEvent(req.body);
  if (result.success) {
    res.status(202).json(result);
  } else {
    res.status(400).json(result);
  }
});
