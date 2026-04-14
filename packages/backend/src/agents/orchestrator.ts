import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';
import { workflowEngine } from '../workflows/engine';
import { stateMachine } from '../workflows/state-machine';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, PLANNER_PROMPT_TEMPLATE, COORDINATOR_PROMPT_TEMPLATE } from './orchestrator-prompts';

// Initialize Gemini SDK
// Requires GEMINI_API_KEY environment variable to be set
const ai = new GoogleGenAI({});

export class OrchestratorAgent extends BaseAgent {
  constructor() {
    super(
      'OrchestratorAgent',
      'Central Gemini-powered orchestrator. Determines workflow routing and schedules tasks.',
      []
    );
    agentCardRegistry.registerCard(this.getAgentCard());
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
   * Invokes Gemini to dynamically determine which A2A Agents need to do what.
   */
  private async planWorkflow(workflowId: string, context: any): Promise<void> {
    await this.logAudit(workflowId, 'Invoking Gemini for initial workflow planning', { context });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: PLANNER_PROMPT_TEMPLATE(context),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2
        }
      });

      const rawText = response.text || '[]';
      // Clean up potential markdown formatting that GenAI sometimes adds despite prompt
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const plan = JSON.parse(jsonStr) as Array<{agent: string, action: string, payload: any, dependsOn: string[], id: string}>;

      await this.logAudit(workflowId, 'Gemini generated task plan', { plan });

      const internalIdMap = new Map<string, string>(); // Maps Gemini's "task_0" to real Postgres UUIDs

      // 1. First Pass: Insert into DB via WorkflowEngine
      for (const t of plan) {
        // Map any string dependencies that Gemini hallucinated to the real UUIDs
        const resolvedDeps = t.dependsOn.map(d => internalIdMap.get(d)).filter(Boolean) as string[];

        const realId = await workflowEngine.scheduleTask(workflowId, t.agent, t.action, t.payload, resolvedDeps);
        internalIdMap.set(t.id, realId);
      }

      // 2. State transition
      await stateMachine.transition(workflowId, 'in_progress', 'Planning complete. Executing DAG.');

      // 3. Dispatch tasks that have ZERO dependencies (roots)
      await this.dispatchReadyTasks(workflowId);

    } catch (err) {
      await this.logAudit(workflowId, 'Gemini Planning Failed', { error: err });
      await stateMachine.transition(workflowId, 'failed', 'Orchestrator failed to generate valid JSON plan.');
    }
  }

  /**
   * Resolves completed tasks against the DAG. If unblocked tasks exist, dispatch them.
   * Otherwise, ask Gemini to evaluate the final outputs for next steps.
   */
  private async coordinateStep(workflowId: string, completedTaskId: string, output: any): Promise<void> {
    // 1. Mark task complete in the DAG
    await workflowEngine.completeTask(workflowId, completedTaskId, output);
    
    // 2. Dispatch anything that is newly unblocked
    const dispatchedCount = await this.dispatchReadyTasks(workflowId);
    
    if (dispatchedCount === 0) {
      // The graph is stalled (all pending tasks have unmet dependencies, or everything is complete)
      // Check if everything is complete
      const currentState = await stateMachine.getCurrentState(workflowId);
      await this.logAudit(workflowId, 'Sub-task graph exhausted. Re-evaluating overall workflow state with Gemini.', { currentState, lastOutput: output });

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: COORDINATOR_PROMPT_TEMPLATE(currentState || {}, output),
          config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0.1
          }
        });

        const rawText = response.text || '{}';
        const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const decision = JSON.parse(jsonStr);

        await this.logAudit(workflowId, 'Gemini Coordinator Decision', { decision });

        if (decision.next_state) {
          await stateMachine.transition(workflowId, decision.next_state, decision.reasoning);
        }

        // If Gemini realized it forgot something, or an error requires new steps:
        if (decision.schedule_new_tasks && decision.schedule_new_tasks.length > 0) {
          // Logic for dynamic re-planning goes here
        }

      } catch (err) {
         await this.logAudit(workflowId, 'Gemini Coordinator Evaluation Failed', { error: err });
         await stateMachine.transition(workflowId, 'failed', 'Invalid LLM response during coordination.');
      }
    }
  }

  /**
   * Internal helper: Query DB for unblocked DAG tasks and push them to A2A Broker.
   */
  private async dispatchReadyTasks(workflowId: string): Promise<number> {
    const readyTasks = await workflowEngine.getReadyTasks(workflowId);
    
    for (const task of readyTasks) {
      // We wrap the DB task in our physical A2A Task wrapper payload
      const a2aPayload = {
        action: task.type,
        ...(task.input as any)
      };

      await this.sendA2ATask(task.agent, a2aPayload, workflowId);
      
      // Update DB to register it's in flight
      // (In a full scale system we'd track "in_flight" state to prevent double dispatch on race conditions)
    }

    return readyTasks.length;
  }
}

export const orchestratorAgent = new OrchestratorAgent();
