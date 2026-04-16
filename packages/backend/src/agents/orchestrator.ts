import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';
import { workflowEngine } from '../workflows/engine';
import { stateMachine } from '../workflows/state-machine';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, PLANNER_PROMPT_TEMPLATE, COORDINATOR_PROMPT_TEMPLATE } from './orchestrator-prompts';
import { a2aBroker } from '../a2a/broker';

// Initialize Gemini SDK with API Key from environment (Unified SDK Syntax)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export class OrchestratorAgent extends BaseAgent {
  // Concurrency lock to prevent multiple identical Gemini evaluations from firing simultaneously
  private evaluationLocks: Map<string, boolean> = new Map();

  constructor() {
    super(
      'OrchestratorAgent',
      'Central AI-powered orchestrator. Determines workflow routing and schedules tasks.',
      []
    );
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  /**
   * Public entry point to create and begin a new workflow.
   * Called by the event ingestion layer (webhook, demo route, etc.)
   * 1. Creates the workflow record in the database.
   * 2. Sends a self-addressed A2A task to kick off the planning phase.
   * Returns the new workflow ID.
   */
  public async startWorkflow(triggerEvent: Record<string, any>): Promise<string> {
    const workflowType = triggerEvent.type ?? 'emergency_incident';
    const incidentId = triggerEvent.incident_id;

    // Create the persisteed workflow row
    const workflowId = await workflowEngine.createWorkflow(workflowType, triggerEvent, incidentId);

    await this.logAudit(workflowId, `Workflow created via trigger: ${workflowType}`, { triggerEvent });

    // Self-dispatch: send a plan_workflow task to the Orchestrator's own queue
    await this.sendA2ATask(
      'OrchestratorAgent',
      { action: 'plan_workflow', context: triggerEvent },
      workflowId
    );

    return workflowId;
  }

  /**
   * Listens for two types of inbound tasks:
   * 1. 'plan_workflow' - Bootstraps a fresh workflow graph based on trigger context
   * 2. 'coordinate_step' - Re-evaluates state after a leaf node task completes
   */
  public async handleTask(task: A2ATask): Promise<void> {
    const inputStr = task.inputMessage.parts[0].text || '{}';
    const payload = JSON.parse(inputStr);

    if (!task.workflowId) {
      throw new Error(`Orchestrator requires an explicit workflowId`);
    }

    if (payload.action === 'plan_workflow') {
      await this.planWorkflow(task.workflowId, payload.context);
      await this.sendStatusUpdate(task.id, 'completed');
    } else if (payload.action === 'coordinate_step') {
      await this.coordinateStep(task.workflowId, payload.completedTaskId, payload.output);
      await this.sendStatusUpdate(task.id, 'completed');
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown Orchestrator instruction: ${payload.action}`);
    }
  }

  /**
   * Invokes the MedOrchestra AI to dynamically determine which A2A Agents need to do what.
   */
  private async planWorkflow(workflowId: string, context: any): Promise<void> {
    await this.logAudit(workflowId, 'Invoking Coordinator AI for initial workflow planning', { context });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [SYSTEM_PROMPT + "\n\n" + PLANNER_PROMPT_TEMPLATE(context)],
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });

      const rawText = response.text || '[]';
      // Clean up potential markdown formatting that GenAI sometimes adds despite prompt
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const plan = JSON.parse(jsonStr) as Array<{agent: string, action: string, payload: any, dependsOn: string[], id: string}>;

      await this.logAudit(workflowId, 'AI generated task plan', { plan });

      const internalIdMap = new Map<string, string>(); // Maps AI's "task_0" to real Postgres UUIDs

      // 1. First Pass: Insert into DB via WorkflowEngine
      for (const t of plan) {
        // Map any string dependencies that the AI hallucinated to the real UUIDs
        const resolvedDeps = t.dependsOn.map(d => internalIdMap.get(d)).filter(Boolean) as string[];

        const realId = await workflowEngine.scheduleTask(workflowId, t.agent, t.action, t.payload, resolvedDeps);
        internalIdMap.set(t.id, realId);
      }

      // 2. State transition
      await stateMachine.transition(workflowId, 'in_progress', 'Planning complete. Executing DAG.');

      // 3. Dispatch tasks that have ZERO dependencies (roots)
      await this.dispatchReadyTasks(workflowId);

    } catch (err: any) {
      await this.logAudit(workflowId, 'AI Planning Failed', { error: err?.message || String(err) });
      await stateMachine.transition(workflowId, 'failed', `Orchestrator failed: ${err?.message || 'Invalid JSON plan'}`);
    }
  }

  /**
   * Resolves completed tasks against the DAG. If unblocked tasks exist, dispatch them.
   * Otherwise, ask the AI to evaluate the final outputs for next steps.
   */
  private async coordinateStep(workflowId: string, completedTaskId: string, output: any): Promise<void> {
    // 1. Mark task complete in the DAG
    await workflowEngine.completeTask(workflowId, completedTaskId, output);
    
    // 2. Dispatch anything that is newly unblocked
    const dispatchedCount = await this.dispatchReadyTasks(workflowId);
    
    // Check if other tasks are still running
    const hasRunning = await workflowEngine.hasRunningTasks(workflowId);

    if (dispatchedCount === 0 && !hasRunning) {
      if (this.evaluationLocks.get(workflowId)) {
        return; // Already evaluating
      }
      this.evaluationLocks.set(workflowId, true);

      try {
        // The graph is completely exhausted (all paths terminated)
        // Check if everything is complete
        const currentState = await stateMachine.getCurrentState(workflowId);
        await this.logAudit(workflowId, 'Sub-task graph exhausted. Re-evaluating overall workflow state with AI Coordinator.', { currentState, lastOutput: output });

        const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: [SYSTEM_PROMPT + "\n\n" + COORDINATOR_PROMPT_TEMPLATE(currentState || {}, output)],
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        });

        const rawText = response.text || '{}';
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const decision = JSON.parse(jsonStr);

        await this.logAudit(workflowId, 'AI Coordinator Decision', { decision });

        if (decision.next_state) {
          await stateMachine.transition(workflowId, decision.next_state, decision.reasoning);
        }

        // If the AI realized it forgot something, or an error requires new steps:
        if (decision.schedule_new_tasks && decision.schedule_new_tasks.length > 0) {
          for (const t of decision.schedule_new_tasks) {
            const deps = t.dependsOn || [];
            await workflowEngine.scheduleTask(workflowId, t.agent, t.action, t.payload || {}, deps);
          }
          await this.logAudit(workflowId, 'AI generated follow-up tasks', { plan: decision.schedule_new_tasks });
          await this.dispatchReadyTasks(workflowId);
        }

      } catch (err: any) {
         await this.logAudit(workflowId, 'AI Coordinator Evaluation Failed', { error: err?.message || String(err) });
         await stateMachine.transition(workflowId, 'failed', `Evaluation failed: ${err?.message || 'Invalid LLM response'}`);
      } finally {
         this.evaluationLocks.delete(workflowId);
      }
    }
  }

  /**
   * Internal helper: Query DB for unblocked DAG tasks and push them to A2A Broker.
   */
  private async dispatchReadyTasks(workflowId: string): Promise<number> {
    const readyTasks = await workflowEngine.getReadyTasks(workflowId);
    
    for (const task of readyTasks) {
      // Mark as dispatched immediately to prevent duplicate reads on next cycle
      await workflowEngine.markTaskDispatched(task.id);

      // We wrap the DB task in our physical A2A Task wrapper payload
      const a2aPayload = {
        action: task.type,
        ...(task.input as any)
      };

      const a2aTaskId = await this.sendA2ATask(task.agent, a2aPayload, workflowId);
      
      // Wait for the A2A task to finish, then trigger the Orchestrator's coordinate_step
      a2aBroker.onTaskUpdate(a2aTaskId, async (update) => {
         if (update.status === 'completed' || update.status === 'failed') {
            await this.sendA2ATask('OrchestratorAgent', {
               action: 'coordinate_step',
               completedTaskId: task.id, // the internal DAG node ID
               output: update.progressMessage ? JSON.parse(update.progressMessage) : { status: update.status }
            }, workflowId);
         }
      });
      
      // Update DB to register it's in flight
      // (In a full scale system we'd track "in_flight" state to prevent double dispatch on race conditions)
    }

    return readyTasks.length;
  }
}

export const orchestratorAgent = new OrchestratorAgent();
