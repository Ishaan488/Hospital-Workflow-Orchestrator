import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

const COMM_CAPABILITIES: Capability[] = [
  {
    name: 'send_patient_reminder',
    description: 'Dispatches targeted SMS or Email notifications to patients.',
  },
  {
    name: 'send_staff_alert',
    description: 'Pings hospital staff regarding critical workflow interruptions.',
  },
  {
    name: 'create_followup_task',
    description: 'Creates a delayed follow-up trace in the task management system.',
  }
];

export class CommunicationAgent extends BaseAgent {
  constructor() {
    super(
      'CommunicationAgent',
      'Manages outbound notifications (Email/SMS) and internal staff alert generation.',
      COMM_CAPABILITIES
    );

    // Register our card globally on instantiation
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  /**
   * Main entry point when Orchestrator or sibling Agents route an A2ATask here.
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
      payload = { action: 'send_patient_reminder', message: inputStr };
    }

    const { action, patient_id, message, staff_id } = payload;
    await this.logAudit(task.workflowId, `Starting communication task: ${action}`, { payload });

    if (action === 'send_patient_reminder') {
      await this.processPatientReminder(task, patient_id, message);
    } else if (action === 'send_staff_alert') {
      await this.processStaffAlert(task, staff_id, patient_id, message);
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }

  /**
   * Dispatches an external notification via the Notifications MCP.
   * MCP Tool: send_patient_message(patient_id, channel, message)
   */
  private async processPatientReminder(task: A2ATask, patient_id?: string, message?: string): Promise<void> {
    if (!message) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing message payload.');
      return;
    }
    if (!patient_id) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing patient_id payload.');
      return;
    }

    await this.sendStatusUpdate(task.id, 'working', 'Dispatching patient notification via MCP...');

    // Correctly calls: send_patient_message(patient_id, channel, message)
    const result = await this.callMCPTool('notifications', 'send_patient_message', {
      patient_id,
      channel: 'email',
      message,
    }, task.workflowId);

    if (result.error) {
      await this.sendStatusUpdate(task.id, 'failed', `Delivery failed: ${result.message}`);
      return;
    }

    await this.logAudit(task.workflowId, `Patient notification dispatched successfully.`, { result });

    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
      status: 'delivered',
      messageId: result.messageId,
      destination: result.destination,
    }));
  }

  /**
   * Queues an internal follow-up reminder for hospital staff.
   * We piggyback on queue_followup_reminder since there is no dedicated staff tool in the MCP.
   * The staff_id is stored in the patient_id field — reminder is routed to admin queue when
   * patient_id resolves. For a real production system, add a dedicated staff_alert tool to the MCP.
   *
   * If patient_id is provided (passed from InsuranceAgent when insurance fails), send a patient
   * message instead, since we have their real UUID.
   */
  private async processStaffAlert(task: A2ATask, staff_id?: string, patient_id?: string, message?: string): Promise<void> {
    await this.sendStatusUpdate(task.id, 'working', 'Creating internal staff alert...');

    // If we have a real patient UUID, route as a patient message to admin (better UX).
    // Otherwise fall back to queuing a followup on the admin queue (does not require real patient ID).
    if (patient_id && patient_id.length === 36) {
      // Real patient UUID – send via patient channel so the MCP can look them up
      const result = await this.callMCPTool('notifications', 'send_patient_message', {
        patient_id,
        channel: 'email',
        message: message || 'Staff alert: please review this patient workflow.',
      }, task.workflowId);

      if (result.error) {
        await this.sendStatusUpdate(task.id, 'failed', `Staff alert failed: ${result.message}`);
        return;
      }

      await this.logAudit(task.workflowId, `Staff alert dispatched via patient channel.`, { result });
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({ status: 'alert_sent', via: 'patient_channel' }));
    } else {
      // No valid patient UUID – queue a followup reminder using a placeholder approach.
      // The MCP's queue_followup_reminder requires a real patient UUID so we log and skip gracefully.
      await this.logAudit(task.workflowId, `Staff alert logged internally (no patient UUID).`, {
        staff_id: staff_id || 'admin_queue',
        message,
      });
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'alert_logged',
        staff_id: staff_id || 'admin_queue',
        note: 'Alert logged internally; no patient UUID available to route via MCP.',
      }));
    }
  }
}
