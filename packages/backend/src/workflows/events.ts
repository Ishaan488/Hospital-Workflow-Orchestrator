import { z } from 'zod';
import { workflowEngine } from './engine';
import { a2aBroker } from '../a2a/broker';
import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { Router } from 'express';

// Define the incoming event payload boundaries 
const EventSchema = z.object({
  eventType: z.enum(['appointment_booked', 'document_uploaded', 'preauth_status_changed']),
  patientId: z.string(),
  appointmentId: z.string().optional(),
  payload: z.record(z.any())
});

export type HospitalEvent = z.infer<typeof EventSchema>;

export class EventIngestion {
  /**
   * Main entry point for webhooks or external hospital systems.
   */
  public async ingestEvent(rawEvent: any): Promise<{ success: boolean; workflowId?: string; message?: string }> {
    try {
      // 1. Validate payload
      const event = EventSchema.parse(rawEvent);
      console.log(`[EventIngress] Validated event: ${event.eventType} for patient ${event.patientId}`);
      
      let targetWorkflowId: string | undefined;

      // 2. Dispatch based on Event Type
      switch (event.eventType) {
        case 'appointment_booked':
          targetWorkflowId = await this.triggerPreVisitIntake(event);
          break;
        case 'document_uploaded':
          targetWorkflowId = await this.handleDocumentUploaded(event);
          break;
        case 'preauth_status_changed':
          targetWorkflowId = await this.handlePreAuthChange(event);
          break;
      }

      // 3. Central Audit Logging
      await db.insert(auditLogs).values({
        workflowId: targetWorkflowId || null,
        agent: 'System_Ingress',
        action: `Ingested Event: ${event.eventType}`,
        details: { event }
      });

      return { success: true, workflowId: targetWorkflowId };
    } catch (err: any) {
      console.error(`[EventIngress] Failed to ingest event:`, err);
      return { success: false, message: err.message };
    }
  }

  /**
   * When a new appointment is booked, we spin up a brand new Workflow
   * and wake the Orchestrator with the 'plan_workflow' directive.
   */
  private async triggerPreVisitIntake(event: HospitalEvent): Promise<string> {
    // 1. Create a Workflow in the DB
    const workflowId = await workflowEngine.createWorkflow('pre_visit_intake', event.eventType, event.patientId);
    
    // 2. Create the bootstrap orchestration task targeting the Gemini Orchestrator
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
              trigger: event.eventType,
              patient_id: event.patientId,
              appointment_id: event.appointmentId,
              details: event.payload
            }
          }) 
        }],
        timestamp: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as any; 

    // 3. Fire it into the A2ABroker queue
    await a2aBroker.sendTask(initialTask);
    
    return workflowId;
  }

  /**
   * Helper routines for other hooks. 
   * (In a full app these would lookup existing workflows and wake the orchestrator with coordinate_step)
   */
  private async handleDocumentUploaded(event: HospitalEvent): Promise<string | undefined> {
    console.log(`[EventIngress] Document uploaded logic triggered`);
    // Placeholder: Look up active workflow for patient and notify orchestrator
    return undefined;
  }

  private async handlePreAuthChange(event: HospitalEvent): Promise<string | undefined> {
    console.log(`[EventIngress] Pre-Auth Status Change triggered`);
     // Placeholder: Resume paused workflows
    return undefined;
  }
}

export const eventIngestion = new EventIngestion();

/**
 * Express Router exposed for mounting on the main Server app
 */
export const eventRouter = Router();

eventRouter.post('/api/events', async (req, res) => {
  const result = await eventIngestion.ingestEvent(req.body);
  if (result.success) {
    res.status(202).json(result);
  } else {
    res.status(400).json(result);
  }
});
