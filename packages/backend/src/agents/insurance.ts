import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

const INSURANCE_CAPABILITIES: Capability[] = [
  {
    name: 'check_eligibility',
    description: 'Calls Insurance MCP to verify state of insurance coverage.',
  },
  {
    name: 'initiate_preauth',
    description: 'Submits a prior authorization request if the MCP determines it is required.',
  },
  {
    name: 'monitor_preauth_status',
    description: 'Polls for pre-auth status changes (mocked via MCP timing).',
  }
];

export class InsuranceAgent extends BaseAgent {
  constructor() {
    super(
      'InsuranceAgent',
      'Handles insurance eligibility verification and automated prior authorization logic.',
      INSURANCE_CAPABILITIES
    );

    // Register our card globally on instantiation
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  /**
   * Main entry point when Orchestrator (or IntakeAgent) routes an A2ATask here.
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
      throw new Error('Insurance Agent requires JSON payload containing patient_id and procedure_code.');
    }

    const { action, patient_id, procedure_code } = payload;
    await this.logAudit(task.workflowId, `Starting insurance task: ${action || 'check_eligibility'}`, { patient_id, procedure_code });

    if (!patient_id) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing patient_id in payload');
      return;
    }

    // Default action if none specified
    const targetAction = action || 'check_eligibility';

    if (targetAction === 'check_eligibility') {
      await this.processInsuranceEligibility(task, patient_id, procedure_code || 'GEN-VISIT');
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${targetAction}`);
    }
  }

  /**
   * Calls the Insurance MCP to run the eligibility workflow
   */
  private async processInsuranceEligibility(task: A2ATask, patientId: string, procedureCode: string): Promise<void> {
    // 1. Verify basic eligibility
    await this.sendStatusUpdate(task.id, 'working', 'Verifying base insurance eligibility...');
    const eligibilityResult = await this.callMCPTool('insurance', 'verify_insurance_eligibility', {
      patient_id: patientId
    });

    if (eligibilityResult.error) {
      // Revert task back to orchestrator or flag to human
      await this.sendStatusUpdate(task.id, 'failed', eligibilityResult.message);
      return;
    }

    const isEligible = eligibilityResult.status === 'valid';
    await this.logAudit(task.workflowId, `Eligibility check completed. Status: ${eligibilityResult.status}`, { eligibilityResult });

    if (!isEligible) {
      // DIVERGENCE 1: Insurance is expired, inactive, or self-pay
      await this.sendStatusUpdate(task.id, 'working', `Insurance issue detected (${eligibilityResult.status}). Contacting Communication Agent.`);
      
      const emailTaskPayload = {
        action: 'send_patient_reminder',
        patient_id: patientId,
        message: `Hello ${eligibilityResult.patientName}. There appears to be an issue with your insurance on file (${eligibilityResult.status}). Please update your payment details or contact our billing desk.`
      };

      // Fork a task to notify the patient
      await this.sendA2ATask('CommunicationAgent', emailTaskPayload, task.workflowId);
      
      // Conclude the insurance task as blocked
      const report = {
        status: 'blocked',
        reason: 'invalid_insurance',
        details: eligibilityResult
      };

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify(report));
      return;
    }

    // 2. Insurance is valid. Check if Prior Authorization is required for this procedure.
    await this.sendStatusUpdate(task.id, 'working', 'Insurance valid. Checking prior authorization requirements...');
    const priorAuthCheck = await this.callMCPTool('insurance', 'check_prior_authorization', {
      insurance_id: eligibilityResult.insuranceId,
      procedure_code: procedureCode
    });

    if (priorAuthCheck.error) {
      await this.sendStatusUpdate(task.id, 'failed', priorAuthCheck.message);
      return;
    }

    await this.logAudit(task.workflowId, `Prior auth check completed. Required: ${priorAuthCheck.required}`, { priorAuthCheck });

    if (priorAuthCheck.required) {
      // DIVERGENCE 2: We need to submit a prior authorization request!
      await this.sendStatusUpdate(task.id, 'working', 'Prior auth required. Automatically submitting request to payer gateway...');
      
      const submissionResult = await this.callMCPTool('insurance', 'submit_prior_auth_request', {
        patient_id: patientId,
        procedure_code: procedureCode,
        clinical_notes: `Automated submission via Orchestrator based on Intake verification for ${procedureCode}.`
      });

      if (submissionResult.error) {
        await this.sendStatusUpdate(task.id, 'failed', `Prior Auth Submission Failed: ${submissionResult.message}`);
        return;
      }

      await this.logAudit(task.workflowId, `Prior auth requested automatically`, { submissionResult });

      // In a real system, the agent would poll or await a webhook. For POC, we just report it as pending.
      // DIVERGENCE 3: High delay risk! Let Schedule Agent know it might need to provisionalize the slot.
      await this.sendStatusUpdate(task.id, 'working', 'Pre-auth is pending. Recommending provisional hold to Scheduling Agent.');
      
      const schedulePayload = {
        action: 'mark_provisional',
        patient_id: patientId,
        reason: 'Pending Insurance Pre-Auth'
      };

      await this.sendA2ATask('SchedulingAgent', schedulePayload, task.workflowId);

      const report = {
        status: 'pending_authorization',
        authReference: submissionResult.requestId,
        details: 'Submitted pre-auth. Scheduled slot flagged as provisional.'
      };

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify(report));
      
    } else {
      // PROCEED: No prior auth required! Entire billing pipeline cleared.
      await this.sendStatusUpdate(task.id, 'working', 'No prior authorization required. Insurance fully cleared.');

      const report = {
        status: 'cleared_for_visit',
        details: `Insurance verified. Procedure ${procedureCode} does not require prior authorization.`
      };

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify(report));
    }
  }
}
