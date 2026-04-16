import { db } from '../db/connection';
import { workflows, workflowTasks, auditLogs } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { stateMachine, WorkflowState } from './state-machine';

/**
 * Handles the execution and lifecycle of a workflow instance.
 * Manages the graph computation of nested agent tasks (which task can run next, etc.)
 */
export class WorkflowEngine {

  /**
   * Initializes a brand new workflow instance based on an external pulse/event.
   */
  public async createWorkflow(type: string, triggerEvent: Record<string, any>, incidentId?: string): Promise<string> {
    const workflowId = randomUUID();
    
    await db.insert(workflows).values({
      id: workflowId,
      type,
      status: 'created',
      incidentId: incidentId ?? null,
      context: { trigger: triggerEvent },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await stateMachine.transition(workflowId, 'planning', `Workflow initialized by event: ${type}`);
    return workflowId;
  }

  /**
   * Adds an orchestrator-planned task into the database.
   */
  public async scheduleTask(workflowId: string, agent: string, taskType: string, inputPayload: any, deps: string[] = []): Promise<string> {
    const taskId = randomUUID();
    
    await db.insert(workflowTasks).values({
      id: taskId,
      workflowId,
      agent,
      type: taskType,
      status: 'pending',
      input: inputPayload,
      dependsOn: deps,
      createdAt: new Date()
    });

    return taskId;
  }

  public async markTaskDispatched(taskId: string): Promise<void> {
    await db.update(workflowTasks)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(eq(workflowTasks.id, taskId));
  }

  public async hasRunningTasks(workflowId: string): Promise<boolean> {
    const allTasks = await db.select().from(workflowTasks).where(eq(workflowTasks.workflowId, workflowId));
    return allTasks.some(t => t.status === 'in_progress' || t.status === 'assigned');
  }

  /**
   * Scans the workflow's task graph and returns tasks that have no pending dependencies!
   */
  public async getReadyTasks(workflowId: string): Promise<any[]> {
    const allTasks = await db.select().from(workflowTasks).where(eq(workflowTasks.workflowId, workflowId));
    const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'failed');
    const completedIds = new Set(completedTasks.map(t => t.id));

    // A task is "ready" if it is still pending AND all of its dependencies are strictly inside the completedIds set.
    return allTasks.filter(t => {
      if (t.status !== 'pending') return false;

      const deps = t.dependsOn as string[] || [];
      if (deps.length === 0) return true;

      // Are all strings in the deps array present in completedIds?
      return deps.every(dep => completedIds.has(dep));
    });
  }

  /**
   * Marks a DB task as completed and tracks its output.
   */
  public async completeTask(workflowId: string, taskId: string, resultPayload: any): Promise<void> {
    await db.update(workflowTasks)
      .set({ 
        status: 'completed', 
        output: resultPayload, 
        completedAt: new Date() 
      })
      .where(eq(workflowTasks.id, taskId));

    await db.insert(auditLogs).values({
      workflowId,
      taskId,
      agent: 'System_Engine',
      action: 'Task Completed',
      details: { result: resultPayload }
    });
  }

  /**
   * Marks a task as failed, and by extension potentially blocks the entire workflow loop.
   */
  public async failTask(workflowId: string, taskId: string, reason: string): Promise<void> {
    await db.update(workflowTasks)
      .set({ 
        status: 'failed', 
        output: { error: reason }, 
        completedAt: new Date() 
      })
      .where(eq(workflowTasks.id, taskId));

    await db.insert(auditLogs).values({
      workflowId,
      taskId,
      agent: 'System_Engine',
      action: 'Task Failed',
      details: { reason }
    });
  }
}

export const workflowEngine = new WorkflowEngine();
