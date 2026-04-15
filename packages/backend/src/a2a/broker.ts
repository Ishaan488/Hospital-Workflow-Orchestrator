import { A2ATask, TaskStatus, TaskStatusUpdate } from './types';
import { EventEmitter } from 'events';
import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { randomUUID } from 'crypto';
import { Router } from 'express';
import { sseManager } from '../sse/manager';

// Extend the router from agent-card to include task routing
import { agentDiscoveryRouter } from './agent-card';

/**
 * A2A Message Broker.
 * Routes `A2ATask` payloads between agents.
 * Now emits real-time SSE events for every message so the frontend
 * can animate the live swarm graph.
 */
class A2ABroker {
  private emitter: EventEmitter;
  private taskStore: Map<string, A2ATask> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * Dispatches a task to the target agent.
   * Fires an SSE event so the frontend graph animates the message in real time.
   */
  public async sendTask(task: A2ATask): Promise<void> {
    // Save to our in-memory store for status lookups
    this.taskStore.set(task.id, task);

    // Emit the task to the specific target agent's queue
    const topic = `agent.task.${task.toAgent}`;
    
    // Asynchronously dispatch
    setImmediate(() => {
      this.emitter.emit(topic, task);
    });

    // ─── SSE: Broadcast to any frontend watching this workflow ───────────
    if (task.workflowId) {
      sseManager.broadcast(task.workflowId, 'a2a_message', {
        taskId: task.id,
        from: task.fromAgent,
        to: task.toAgent,
        status: task.status,
        message: task.inputMessage?.parts?.[0]?.text?.slice(0, 200) ?? '',
      });
    }
    sseManager.broadcastGlobal('a2a_message', {
      taskId: task.id,
      from: task.fromAgent,
      to: task.toAgent,
      workflowId: task.workflowId,
      status: task.status,
    });

    // Automatically audit log the A2A message
    try {
      await db.insert(auditLogs).values({
        workflowId: task.workflowId || null,
        agent: 'A2ABroker',
        action: 'A2A Task Dispatched',
        details: {
          taskId: task.id,
          from: task.fromAgent,
          to: task.toAgent,
          status: task.status
        },
      });
      console.log(`[A2A] Dispatched task ${task.id} from ${task.fromAgent} to ${task.toAgent}`);
    } catch (err) {
      console.error('[A2A ERROR] Failed to audit log task dispatch:', err);
    }
  }

  /**
   * Retrieves the current state of a task.
   */
  public getTaskStatus(taskId: string): A2ATask | undefined {
    return this.taskStore.get(taskId);
  }

  /**
   * Updates an existing task's status / output and notifies listeners.
   * Also broadcasts SSE update for the frontend.
   */
  public async updateTaskStatus(update: TaskStatusUpdate): Promise<void> {
    const task = this.taskStore.get(update.taskId);
    if (!task) return;

    task.status = update.status;
    task.updatedAt = update.updatedAt;

    // Emit to a status-specific topic so the sender can listen
    const topic = `task.status.${task.id}`;
    
    setImmediate(() => {
      this.emitter.emit(topic, update);
    });

    // ─── SSE: Broadcast status transition ─────────────────────────────────
    if (task.workflowId) {
      sseManager.broadcast(task.workflowId, 'task_status_update', {
        taskId: task.id,
        from: task.fromAgent,
        to: task.toAgent,
        status: update.status,
        progressMessage: update.progressMessage,
      });
    }

    try {
      await db.insert(auditLogs).values({
        workflowId: task.workflowId || null,
        agent: 'A2ABroker',
        action: `Task Status Update: ${update.status}`,
        details: {
          taskId: task.id,
          update
        },
      });
    } catch (err) {
      console.error('[A2A ERROR] Failed to audit log task update:', err);
    }
  }

  /**
   * Agents use this to subscribe to their inward-bound task queue.
   */
  public onTaskAssigned(agentName: string, handler: (task: A2ATask) => Promise<void> | void): void {
    const topic = `agent.task.${agentName}`;
    // Remove any stale listeners first (guards against hot-reload double-registration
    // on the singleton broker — without this, every dev-server restart stacks a new
    // listener, causing each task to be processed N times).
    this.emitter.removeAllListeners(topic);
    this.emitter.on(topic, handler);
  }

  /**
   * Used to listen for updates on a specific task you dispatched.
   */
  public onTaskUpdate(taskId: string, handler: (update: TaskStatusUpdate) => Promise<void> | void): void {
    const topic = `task.status.${taskId}`;
    this.emitter.on(topic, handler);
  }
}

export const a2aBroker = new A2ABroker();

/**
 * REST HTTP Routes for A2A Interaction
 */

// POST /a2a/:agentName/tasks/send
agentDiscoveryRouter.post('/a2a/:agentName/tasks/send', async (req, res) => {
  try {
    const targetAgent = req.params.agentName;
    const { fromAgent, inputMessage, workflowId } = req.body;

    if (!fromAgent || !inputMessage) {
      res.status(400).json({ error: 'Missing fromAgent or inputMessage body fields.' });
      return;
    }

    const task: A2ATask = {
      id: randomUUID(),
      workflowId,
      fromAgent,
      toAgent: targetAgent,
      status: 'submitted',
      inputMessage,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await a2aBroker.sendTask(task);
    res.status(202).json({ taskId: task.id, status: task.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /a2a/:agentName/tasks/:taskId
agentDiscoveryRouter.get('/a2a/:agentName/tasks/:taskId', (req, res) => {
  const task = a2aBroker.getTaskStatus(req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  
  // Strict matching to ensure we don't leak other agents' tasks on this route
  if (task.toAgent !== req.params.agentName) {
    res.status(403).json({ error: 'Task belongs to a different agent' });
    return;
  }

  res.json(task);
});

export { agentDiscoveryRouter as a2aRouter };
