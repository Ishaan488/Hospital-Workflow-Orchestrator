import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

const SCHEDULING_CAPABILITIES: Capability[] = [
  {
    name: 'check_slot_status',
    description: 'Verifies if an appointment slot is still available or valid.',
  },
  {
    name: 'mark_provisional',
    description: 'Places a hold or provisional label on an appointment due to pending external factors.',
  },
  {
    name: 'find_alternatives',
    description: 'Searches for alternate appointment slots if a reschedule is required.',
  }
];

export class SchedulingAgent extends BaseAgent {
  constructor() {
    super(
      'SchedulingAgent',
      'Manages schedule slots, provisional holds, and conflict resolutions.',
      SCHEDULING_CAPABILITIES
    );

    // Register our card globally on instantiation
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  /**
   * Main entry point when Orchestrator routes an A2ATask here.
   */
  public async handleTask(task: A2ATask): Promise<void> {
    const inputStr = task.inputMessage.parts[0].text;
    if (!inputStr) {
      throw new Error('Task inputMessage text is empty or missing.');
    }

    let payload: any;
    try {
      payload = JSON.parse(inputStr);
    } catch {
      payload = { action: 'check_slot_status', argument: inputStr };
    }

    const { action, patient_id, appointment_id, reason } = payload;
    await this.logAudit(task.workflowId, `Starting scheduling task: ${action}`, { payload });

    if (action === 'mark_provisional') {
      await this.processMarkProvisional(task, patient_id, appointment_id, reason);
    } else if (action === 'check_slot_status') {
      // In a full implementation, we would query the actual slot
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({ status: 'confirmed' }));
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }

  /**
   * Marks a slot as provisional when another agent (like Insurance) detects a delay risk.
   */
  private async processMarkProvisional(task: A2ATask, patient_id: string, appointment_id?: string, reason?: string): Promise<void> {
    await this.sendStatusUpdate(task.id, 'working', `Applying provisional hold. Reason: ${reason}`);

    // In a production system, we'd look up the appointment ID first if missing.
    // For this POC, we use my mocked 'mark_slot_provisional' MCP tool
    // We assume the user passed appointment_id, or we just mock a successful response.
    
    // Call the MCP Tool
    const result = await this.callMCPTool('scheduling', 'mark_slot_provisional', {
      appointment_id: appointment_id || `apt_${patient_id}`
    });

    if (result.error) {
       await this.sendStatusUpdate(task.id, 'failed', `Failed to apply hold: ${result.message}`);
       return;
    }

    await this.logAudit(task.workflowId, `Slot successfully marked provisional.`, { appointment_id, reason });

    // Inform the patient about the hold via the Communication Agent
    await this.sendStatusUpdate(task.id, 'working', 'Hold applied. Notifying the patient gently via Communication Agent.');
    
    const emailPayload = {
      action: 'send_patient_reminder',
      patient_id,
      message: `Your upcoming appointment has been placed on a temporary hold while we finalize details: ${reason}. You do not need to do anything at this time, we will contact you if we need to adjust the time.`
    };

    await this.sendA2ATask('CommunicationAgent', emailPayload, task.workflowId);

    // Conclude this task
    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
      status: 'provisional_hold_applied',
      details: result
    }));
  }
}
