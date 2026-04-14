import { db } from '../db/connection';
import { workflows, auditLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Standardized vocabulary of state across the orchestration pipeline
export type WorkflowState = 
  | 'created' 
  | 'planning' 
  | 'in_progress' 
  | 'waiting_approval' 
  | 'waiting_patient' 
  | 'waiting_external' 
  | 'completed' 
  | 'failed' 
  | 'escalated';

const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  created: ['planning'],
  planning: ['in_progress', 'failed'],
  in_progress: ['completed', 'waiting_approval', 'waiting_patient', 'waiting_external', 'failed', 'escalated'],
  waiting_approval: ['in_progress', 'escalated'],
  waiting_patient: ['in_progress', 'escalated'],
  waiting_external: ['in_progress', 'escalated'],
  completed: [], // Terminal
  failed: [],    // Terminal
  escalated: ['in_progress', 'completed'] // Post-human intervention
};

export class WorkflowStateMachine {
  
  /**
   * Attempts to move a workflow from one state to another.
   * Enforces rules and persists to the PostgreSQL database.
   */
  public async transition(workflowId: string, newState: WorkflowState, reason: string): Promise<boolean> {
    const current = await this.getCurrentState(workflowId);
    
    if (!current) {
      throw new Error(`Workflow ${workflowId} not found.`);
    }

    const currentState = current.status as WorkflowState;

    // Validate if the transition is logically allowed
    const allowed = VALID_TRANSITIONS[currentState]?.includes(newState);
    if (!allowed && currentState !== newState) {
      console.warn(`[StateMachine] Invalid transition attempted: ${currentState} -> ${newState}`);
      return false;
    }

    // Persist new state
    await db.update(workflows)
      .set({ status: newState, updatedAt: new Date() })
      .where(eq(workflows.id, workflowId));

    // Drop an audit log detailing the state change
    await db.insert(auditLogs).values({
      workflowId: workflowId,
      agent: 'System_StateMachine',
      action: 'State Transition',
      details: { from: currentState, to: newState, reason }
    });

    console.log(`[StateMachine] Workflow ${workflowId} transitioned to ${newState}. Reason: ${reason}`);
    return true;
  }

  /**
   * Pulls the entirety of a workflow's state/context from the database.
   */
  public async getCurrentState(workflowId: string) {
    const rows = await db.select().from(workflows).where(eq(workflows.id, workflowId));
    return rows[0] || null;
  }

  /**
   * Appends arbitrary JSON context to the workflow (e.g. tracking patient data discovered during execution).
   */
  public async updateContext(workflowId: string, updates: Record<string, any>): Promise<void> {
    const current = await this.getCurrentState(workflowId);
    if (!current) return;

    const mergedContext = {
      ...(current.context as Record<string, any> || {}),
      ...updates
    };

    await db.update(workflows)
      .set({ context: mergedContext, updatedAt: new Date() })
      .where(eq(workflows.id, workflowId));
  }
}

export const stateMachine = new WorkflowStateMachine();
