import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

const INTAKE_CAPABILITIES: Capability[] = [
  {
    name: 'check_intake_completeness',
    description: 'Fetches patient profile and verifies demographics/document completeness.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string' },
        appointment_type: { type: 'string' }
      },
      required: ['patient_id', 'appointment_type']
    }
  },
  {
    name: 'validate_required_documents',
    description: 'Compares uploaded documents against required ones for a procedure.',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'string' },
        appointment_type: { type: 'string' }
      },
      required: ['patient_id', 'appointment_type']
    }
  }
];

export class IntakeAgent extends BaseAgent {
  constructor() {
    super(
      'IntakeAgent',
      'Handles patient intake completeness checks and prerequisite verification.',
      INTAKE_CAPABILITIES
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
      // If it's pure text, assume it's just a general check payload
      payload = { action: 'check_intake_completeness', patient_id: inputStr };
    }

    const { action, patient_id, appointment_type } = payload;
    await this.logAudit(task.workflowId, `Starting processing for action: ${action}`, { patient_id });

    // Ensure we have a patient_id
    if (!patient_id) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing patient_id in payload');
      return;
    }

    if (action === 'check_intake_completeness') {
      await this.processIntakeCompleteness(task, patient_id, appointment_type || 'general');
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }

  /**
   * Step 1: Use the EHR MCP to pull profile and check documents
   */
  private async processIntakeCompleteness(task: A2ATask, patientId: string, appointmentType: string): Promise<void> {
    // 1. Check document completeness via EHR MCP
    // MCP Tool: check_document_completeness(patient_id, appointment_type)
    // MCP Response: { isComplete: boolean, missingDocuments: string[], patientName: string, ... }
    const docsResult = await this.callMCPTool('ehr', 'check_document_completeness', {
      patient_id: patientId,
      appointment_type: appointmentType,
    }, task.workflowId);

    if (docsResult.error) {
      await this.sendStatusUpdate(task.id, 'failed', docsResult.message || 'Document check failed.');
      return;
    }

    // 2. Extract context — MCP returns 'isComplete', NOT 'complete'
    const isComplete = docsResult.isComplete === true;
    const missingDocs: string[] = docsResult.missingDocuments || [];
    
    await this.logAudit(task.workflowId, `Document check finished. Complete: ${isComplete}`, { missingDocs });

    // 3. Conditional outcome — Orchestrator's coordinator will read these flags
    //    and decide what runs next. Agents do NOT chain to peers directly.
    if (!isComplete) {
      await this.sendStatusUpdate(task.id, 'working', `Documents missing: ${missingDocs.join(', ')}. Notifying patient.`);

      // Inform patient of missing documents via CommunicationAgent
      // NOTE: This is the ONE exception — CommunicationAgent is a leaf node (side-effect only),
      // so IntakeAgent can trigger a notification directly without causing coordination loops.
      const emailTaskPayload = {
        action: 'send_patient_reminder',
        patient_id: patientId,
        message: `Hello ${docsResult.patientName || 'Patient'}. You are missing required documents for your upcoming appointment: ${missingDocs.join(', ')}. Please upload them at your earliest convenience.`,
      };
      await this.sendA2ATask('CommunicationAgent', emailTaskPayload, task.workflowId);

      // Signal the Orchestrator: intake is blocked
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'blocked',
        reason: 'missing_documents',
        docs_complete: false,
        missing: missingDocs,
        patient_id: patientId,
      }));

    } else {
      // All documents present — report clean completion to the Orchestrator.
      // The Orchestrator's coordinator will schedule InsuranceAgent next based on this flag.
      // Do NOT call sendA2ATask('InsuranceAgent') here — that causes double execution.
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'cleared_for_insurance',
        docs_complete: true,
        patient_id: patientId,
        details: 'All required documents are uploaded and verified.',
      }));
    }
  }
}
