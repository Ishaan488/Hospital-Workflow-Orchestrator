import { a2aBroker } from '../a2a/broker';
import { AgentCard, A2ATask, Capability, TaskStatusUpdate } from '../a2a/types';
import { mcpRegistry } from '../mcp/registry';
import { db } from '../db/connection';
import { auditLogs, workflowTasks } from '../db/schema';
import { randomUUID } from 'crypto';

/**
 * Abstract BaseAgent Component.
 * Every specific agent (Intake, Insurance, Orchestrator) extends this class.
 * Provides built-in connectivity to the A2A Event Broker and MCP Tools.
 */
export abstract class BaseAgent {
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: Capability[];
  public readonly endpointUrl: string;

  constructor(name: string, description: string, capabilities: Capability[] = [], endpointUrl?: string) {
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.endpointUrl = endpointUrl || `http://localhost:4000/a2a/${name}`;
  }

  /**
   * Generates the AgentCard for A2A discovery.
   */
  public getAgentCard(): AgentCard {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      endpointUrl: this.endpointUrl,
      version: '1.0.0'
    };
  }

  /**
   * Called to startup the agent. Subscribes the agent to its inbound A2A task queue.
   */
  public start(): void {
    a2aBroker.onTaskAssigned(this.name, this.handleTaskWrapper.bind(this));
    console.log(`[AGENT] ${this.name} started and listening for tasks.`);
  }

  /**
   * Abstract method that subclasses must implement to process an incoming A2A task.
   */
  public abstract handleTask(task: A2ATask): Promise<void>;

  /**
   * Internal wrapper to catch errors and enforce audit logging during task handling.
   */
  private async handleTaskWrapper(task: A2ATask): Promise<void> {
    try {
      // Auto-update task status to working
      await this.sendStatusUpdate(task.id, 'working');
      await this.logAudit(task.workflowId, `Started processing task ${task.id}`, { from: task.fromAgent });
      
      await this.handleTask(task);
      
    } catch (err) {
      console.error(`[${this.name}] Failed to handle task ${task.id}:`, err);
      // Auto-fail the task on unhandled errors
      await this.sendStatusUpdate(task.id, 'failed', err instanceof Error ? err.message : 'Unknown error');
      await this.logAudit(task.workflowId, `Failed processing task ${task.id}`, { error: err });
    }
  }

  /**
   * Dispatches a new task to another agent.
   */
  protected async sendA2ATask(targetAgent: string, inputMessage: any, workflowId?: string): Promise<string> {
    const task: A2ATask = {
      id: randomUUID(),
      workflowId,
      fromAgent: this.name,
      toAgent: targetAgent,
      status: 'submitted',
      inputMessage: {
        id: randomUUID(),
        role: 'agent',
        parts: [{ type: 'text', text: typeof inputMessage === 'string' ? inputMessage : JSON.stringify(inputMessage) }],
        timestamp: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await a2aBroker.sendTask(task);
    return task.id;
  }

  /**
   * Sends a status update back to the sender of a task.
   */
  protected async sendStatusUpdate(taskId: string, status: A2ATask['status'], progressMessage?: string): Promise<void> {
    await a2aBroker.updateTaskStatus({
      taskId,
      status,
      progressMessage,
      updatedAt: new Date()
    });
  }

  /**
   * Helper to execute a tool from any registered MCP Server.
   * Handles registry lookup and unified responses.
   */
  protected async callMCPTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    console.log(`[${this.name}] Executing Tool: ${serverName}.${toolName}()`);
    try {
      const response = await mcpRegistry.callTool(serverName, toolName, args, { calledBy: this.name });

      if (!response.success) {
        console.warn(`[${this.name}] Tool ${toolName} returned an error state:`, response.error);
        return { error: true, message: response.error };
      }

      return response.data;
    } catch (err) {
      console.error(`[${this.name}] CRITICAL ERROR executing ${serverName}.${toolName}:`, err);
      throw err;
    }
  }

  /**
   * Log internal thoughts or processing steps to the database audit trail.
   */
  protected async logAudit(workflowId: string | undefined, action: string, details?: Record<string, any>): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        agent: this.name,
        action,
        details: details || {},
        workflowId: workflowId || null,
      });
      console.log(`[${this.name}] ACTION: ${action}`);
    } catch (err) {
      console.error(`[${this.name}] Failed to log activity:`, err);
    }
  }
}
