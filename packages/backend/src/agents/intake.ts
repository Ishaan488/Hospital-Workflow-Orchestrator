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
    const docsResult = await this.callMCPTool('ehr', 'check_document_completeness', {
      patient_id: patientId,
      appointment_type: appointmentType
    });

    if (docsResult.error) {
      await this.sendStatusUpdate(task.id, 'failed', docsResult.message);
      return;
    }

    // 2. Extract context
    const isComplete = docsResult.complete === true;
    const missingDocs = docsResult.missingDocuments || [];
    
    await this.logAudit(task.workflowId, `Document check finished. Complete: ${isComplete}`, { missingDocs });

    // 3. Conditional A2A Routing Routing
    if (!isComplete) {
      // DIVERGENCE: We need to inform the patient they are missing documents
      await this.sendStatusUpdate(task.id, 'working', 'Documents missing. Contacting Communication Agent.');
      
      const emailTaskPayload = {
        action: 'send_patient_reminder',
        patient_id: patientId,
        message: `Hello ${docsResult.patientName}. You are missing required documents: ${missingDocs.join(', ')}. Please upload them before your visit.`
      };

      await this.sendA2ATask('CommunicationAgent', emailTaskPayload, task.workflowId);
      
      // Conclude the intake task as blocked
      const report = {
        status: 'blocked',
        reason: 'missing_documents',
        details: missingDocs
      };

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify(report));
      
      // Normally we'd reply to the orchestrator, but the framework lets the Orchestrator listen to the TaskStatusUpdate.
    } else {
      // PROCEED: Documents are complete!
      await this.sendStatusUpdate(task.id, 'working', 'Documents complete. Passing to Insurance verification.');

      const insurancePayload = {
        action: 'check_eligibility',
        patient_id: patientId,
        procedure_code: appointmentType // mapping type to pseudo-code for POC
      };

      await this.sendA2ATask('InsuranceAgent', insurancePayload, task.workflowId);

      const report = {
        status: 'cleared_for_insurance',
        details: 'All required demographic and clinical documents present.'
      };

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify(report));
    }
  }
}
