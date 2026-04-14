import { broker, AgentMessage } from './broker';
import { mcpRegistry } from '../mcp/registry';
import { db } from '../db/connection';
import { auditLogs, workflowTasks, workflows } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Abstract BaseAgent Component.
 * Every specific agent (Intake, Insurance, Orchestrator) extends this class.
 * Provides built-in connectivity to the Message Broker and MCP Tools.
 */
export abstract class BaseAgent {
  public readonly name: string;
  public readonly description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Called to startup the agent. Agents should register their subscriptions here.
   */
  public abstract start(): void;

  /**
   * Helper to subscribe to broker events without needing the direct broker reference.
   */
  protected subscribe<T = any>(
    topic: string,
    handler: (message: AgentMessage<T>) => Promise<void> | void
  ): void {
    broker.subscribe(topic, this.name, handler.bind(this));
  }

  /**
   * Helper to publish messages to other agents.
   */
  protected async publish<T>(
    topic: string,
    payload: T,
    options?: { target?: string; workflowId?: string; taskId?: string }
  ): Promise<void> {
    await broker.publish(topic, this.name, payload, options);
  }

  /**
   * Helper to execute a tool from any registered MCP Server.
   * Handles registry lookup and response unwrapping.
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
  protected async logActivity(action: string, details?: Record<string, any>, workflowId?: string, taskId?: string): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        agent: this.name,
        action,
        details: details || {},
        workflowId: workflowId || null,
        taskId: taskId || null,
      });
      console.log(`[${this.name}] ACTION: ${action}`);
    } catch (err) {
      console.error(`[${this.name}] Failed to log activity:`, err);
    }
  }

  /**
   * Helper to update the status of a Workflow Task in the database.
   */
  protected async updateTaskStatus(taskId: string, status: 'in_progress' | 'completed' | 'failed' | 'waiting_approval', output?: Record<string, any>): Promise<void> {
    await this.callMCPTool('workflow_management', 'update_task_status', {
      task_id: taskId,
      status,
      output,
    });
  }
}
