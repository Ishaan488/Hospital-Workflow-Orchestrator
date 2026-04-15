import { a2aBroker } from '../a2a/broker';
import { AgentCard, A2ATask, Capability, TaskStatusUpdate } from '../a2a/types';
import { mcpRegistry } from '../mcp/registry';
import { db } from '../db/connection';
import { auditLogs, workflowTasks } from '../db/schema';
import { randomUUID } from 'crypto';
import { sseManager } from '../sse/manager';

const MAX_RETRY_ATTEMPTS = 2;

/**
 * Abstract BaseAgent Component.
 * Every specific agent (Intake, Insurance, Orchestrator) extends this class.
 *
 * Upgrades in this version:
 *  1. Structured Reasoning Logs — every agent decision saves LLM thought + prompt context
 *  2. Escalation Escape Hatch — if an agent fails MAX_RETRY_ATTEMPTS times, it auto-escalates
 *  3. SSE broadcasting — all major events are streamed to the frontend in real time
 *  4. MCP X-Ray Logging — raw MCP JSON payload + result saved for frontend tooltip inspection
 */
export abstract class BaseAgent {
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: Capability[];
  public readonly endpointUrl: string;

  // Per-task retry counter for escalation escape hatch
  private retryCounters: Map<string, number> = new Map();

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
   * Internal wrapper to catch errors and enforce audit logging + escalation logic.
   * THE ESCALATION ESCAPE HATCH: if an agent fails MAX_RETRY_ATTEMPTS times,
   * it stops retrying and escalates to the Orchestrator via A2A.
   */
  private async handleTaskWrapper(task: A2ATask): Promise<void> {
    try {
      // Auto-update task status to working
      await this.sendStatusUpdate(task.id, 'working');
      await this.logAudit(task.workflowId, `Started processing task ${task.id}`, { from: task.fromAgent });

      // Broadcast agent is working to SSE
      if (task.workflowId) {
        sseManager.broadcast(task.workflowId, 'task_status_update', {
          taskId: task.id,
          agent: this.name,
          status: 'working',
          from: task.fromAgent,
        });
      }

      await this.handleTask(task);

      // Reset retry counter on success
      this.retryCounters.delete(task.id);

    } catch (err) {
      console.error(`[${this.name}] Failed to handle task ${task.id}:`, err);

      // ─── ESCALATION ESCAPE HATCH ───────────────────────────────────────
      const retries = (this.retryCounters.get(task.id) ?? 0) + 1;
      this.retryCounters.set(task.id, retries);

      if (retries >= MAX_RETRY_ATTEMPTS) {
        // Max retries hit → escalate to Orchestrator instead of silently failing
        console.warn(`[${this.name}] ESCALATING task ${task.id} after ${retries} failures.`);
        await this.escalate(task, err instanceof Error ? err.message : 'Unknown error');
        this.retryCounters.delete(task.id);
      } else {
        // Normal failure path for first attempt
        await this.sendStatusUpdate(task.id, 'failed', err instanceof Error ? err.message : 'Unknown error');
        await this.logAudit(task.workflowId, `Failed processing task ${task.id} (attempt ${retries}/${MAX_RETRY_ATTEMPTS})`, { error: String(err) });
      }
    }
  }

  /**
   * ESCALATION METHOD.
   * When an agent cannot recover, it sends an escalation A2A task back
   * to the OrchestratorAgent with full context for human review.
   */
  protected async escalate(originalTask: A2ATask, reason: string): Promise<void> {
    await this.sendStatusUpdate(originalTask.id, 'failed', `Escalated: ${reason}`);

    await this.logAudit(originalTask.workflowId, `ESCALATED — Sending to Orchestrator for human review`, {
      reason,
      originalTaskId: originalTask.id,
      failedAgent: this.name,
    });

    // SSE broadcast escalation event
    if (originalTask.workflowId) {
      sseManager.broadcast(originalTask.workflowId, 'agent_escalation', {
        agent: this.name,
        taskId: originalTask.id,
        reason,
      });
    }
    sseManager.broadcastGlobal('agent_escalation', {
      agent: this.name,
      workflowId: originalTask.workflowId,
      reason,
    });

    // Send escalation task to Orchestrator
    if (this.name !== 'OrchestratorAgent') {
      await this.sendA2ATask(
        'OrchestratorAgent',
        {
          type: 'ESCALATION',
          reason,
          failedAgent: this.name,
          originalTaskId: originalTask.id,
          originalInput: originalTask.inputMessage,
        },
        originalTask.workflowId
      );
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
   * Now logs the RAW request args and raw response result to the audit trail
   * so the frontend can show "MCP X-Ray" tooltips revealing what each agent actually fetched.
   */
  protected async callMCPTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>,
    workflowId?: string
  ): Promise<any> {
    console.log(`[${this.name}] Executing Tool: ${serverName}.${toolName}()`, args);
    const startTime = Date.now();

    try {
      const response = await mcpRegistry.callTool(serverName, toolName, args, { calledBy: this.name });
      const durationMs = Date.now() - startTime;

      // ─── SSE: Broadcast MCP tool call for X-Ray tooltips ──────────────
      if (workflowId) {
        sseManager.broadcast(workflowId, 'mcp_tool_call', {
          agent: this.name,
          server: serverName,
          tool: toolName,
          args,
          result: response.success ? response.data : { error: response.error },
          durationMs,
          success: response.success,
        });
      }

      // Save MCP call to audit log with full raw payload (for X-Ray tooltips)
      await this.logAudit(workflowId, `MCP: ${serverName}.${toolName}()`, {
        type: 'mcp_call',
        server: serverName,
        tool: toolName,
        args,
        result: response.success ? response.data : { error: response.error },
        durationMs,
        success: response.success,
      });

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
   * Log an agent's LLM reasoning process to the audit trail and broadcast via SSE.
   * Call this BEFORE making a decision so the frontend Reasoning Inspector can display:
   *   - The system prompt context the agent was given
   *   - The agent's chain-of-thought
   *   - The final decision taken
   */
  protected async logReasoning(
    workflowId: string | undefined,
    context: {
      systemPrompt: string;
      inputContext: Record<string, any>;
      chainOfThought: string;
      decision: string;
      confidence?: 'high' | 'medium' | 'low';
    }
  ): Promise<void> {
    await this.logAudit(workflowId, `Agent Reasoning: ${context.decision}`, {
      type: 'agent_reasoning',
      systemPrompt: context.systemPrompt,
      inputContext: context.inputContext,
      chainOfThought: context.chainOfThought,
      decision: context.decision,
      confidence: context.confidence ?? 'high',
    });

    // SSE: Stream reasoning to the frontend Reasoning Inspector panel
    if (workflowId) {
      sseManager.broadcast(workflowId, 'agent_reasoning', {
        agent: this.name,
        systemPrompt: context.systemPrompt,
        inputContext: context.inputContext,
        chainOfThought: context.chainOfThought,
        decision: context.decision,
        confidence: context.confidence ?? 'high',
      });
    }
  }

  /**
   * Log internal thoughts or processing steps to the database audit trail.
   * Also broadcasts to SSE so the frontend audit feed updates in real time.
   */
  protected async logAudit(workflowId: string | undefined, action: string, details?: Record<string, any>): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        agent: this.name,
        action,
        details: details || {},
        workflowId: workflowId || null,
      });

      // SSE: Stream audit log entry to the frontend live feed
      if (workflowId) {
        sseManager.broadcast(workflowId, 'audit_log', {
          agent: this.name,
          action,
          details: details || {},
        });
      }
      sseManager.broadcastGlobal('audit_log', {
        agent: this.name,
        action,
        workflowId: workflowId ?? null,
        details: details || {},
      });

      console.log(`[${this.name}] ACTION: ${action}`);
    } catch (err) {
      console.error(`[${this.name}] Failed to log activity:`, err);
    }
  }
}
