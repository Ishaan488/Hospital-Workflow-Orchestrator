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
      await this.processStaffAlert(task, staff_id, message);
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }

  /**
   * Dispatches an external notification via the Notifications MCP.
   */
  private async processPatientReminder(task: A2ATask, patient_id?: string, message?: string): Promise<void> {
    if (!message) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing message payload.');
      return;
    }

    await this.sendStatusUpdate(task.id, 'working', 'Dispatching digital patient reminder via MCP...');

    // We assume email for the POC. Fetching the actual email address would normally
    // require calling the EHR MCP to pull `demographics.email`, but for simplicity 
    // the Notification MCP mock accepts pure strings.
    const result = await this.callMCPTool('notifications', 'send_email', {
      email: `${patient_id || 'patient'}@hospital-poc.local`,
      subject: 'Update regarding your upcoming visit',
      body: message
    });

    if (result.error) {
      await this.sendStatusUpdate(task.id, 'failed', `Delivery failed: ${result.message}`);
      return;
    }

    await this.logAudit(task.workflowId, `Notification dispatched successfully.`, { result });

    // Mark task as fully completed. Leaf node action, no further A2A bounces needed.
    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
      status: 'delivered',
      delivery_id: result.deliveryId
    }));
  }

  /**
   * Pings internal hospital staff via Notifications MCP.
   */
  private async processStaffAlert(task: A2ATask, staff_id?: string, message?: string): Promise<void> {
    await this.sendStatusUpdate(task.id, 'working', 'Creating internal staff reminder...');

    const result = await this.callMCPTool('notifications', 'create_staff_reminder', {
      staff_id: staff_id || 'admin_queue',
      message: message || 'Please review patient workflow.',
      due_at: new Date(Date.now() + 86400000).toISOString() // Due in 24 hours
    });

    if (result.error) {
      await this.sendStatusUpdate(task.id, 'failed', `Alert creation failed: ${result.message}`);
      return;
    }

    await this.logAudit(task.workflowId, `Staff alert scheduled successfully.`, { result });
    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({ status: 'alert_created' }));
  }
}
