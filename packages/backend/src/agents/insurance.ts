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
      await this.processInsuranceEligibility(task, patient_id, procedure_code || 'general');
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${targetAction}`);
    }
  }

  /**
   * Calls the Insurance MCP to run the eligibility workflow.
   *
   * MCP Tool Signatures:
   *   verify_insurance_eligibility(patient_id) → { eligible: boolean, patientName, insuranceProvider, ... }
   *   check_prior_authorization(patient_id, procedure_code) → { requiresPriorAuth: boolean, ... }
   *   submit_prior_auth_request(patient_id, procedure_code, reason) → { success, authorizationId, ... }
   */
  private async processInsuranceEligibility(task: A2ATask, patientId: string, procedureCode: string): Promise<void> {
    // ── Step 1: Verify base insurance eligibility ─────────────────────────
    await this.sendStatusUpdate(task.id, 'working', 'Verifying base insurance eligibility...');
    const eligibilityResult = await this.callMCPTool('insurance', 'verify_insurance_eligibility', {
      patient_id: patientId,
    }, task.workflowId);

    if (eligibilityResult.error) {
      await this.sendStatusUpdate(task.id, 'failed', eligibilityResult.message || 'Eligibility check failed.');
      return;
    }

    // MCP returns { eligible: boolean, hasInsurance: boolean, patientName, ... }
    const isEligible: boolean = eligibilityResult.eligible === true;
    await this.logAudit(task.workflowId, `Eligibility check completed. Eligible: ${isEligible}`, { eligibilityResult });

    if (!isEligible) {
      // DIVERGENCE 1: Insurance is expired, inactive, or self-pay → notify patient
      await this.sendStatusUpdate(task.id, 'working', `Insurance issue detected. Contacting patient via Communication Agent.`);

      const patientName = eligibilityResult.patientName || 'Patient';
      const reason = eligibilityResult.paymentMode === 'self_pay'
        ? 'no insurance on file'
        : `your policy appears to be expired or inactive`;

      const emailTaskPayload = {
        action: 'send_patient_reminder',
        patient_id: patientId,
        message: `Hello ${patientName}, there appears to be an issue with your insurance: ${reason}. Please contact our billing desk before your visit.`,
      };

      await this.sendA2ATask('CommunicationAgent', emailTaskPayload, task.workflowId);

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'blocked',
        reason: 'invalid_insurance',
        details: eligibilityResult,
      }));
      return;
    }

    // ── Step 2: Check if prior authorization is required ──────────────────
    await this.sendStatusUpdate(task.id, 'working', 'Insurance valid. Checking prior authorization requirements...');
    const priorAuthCheck = await this.callMCPTool('insurance', 'check_prior_authorization', {
      patient_id: patientId,       // ← Correct: MCP needs patient_id, not insurance_id
      procedure_code: procedureCode,
    }, task.workflowId);

    if (priorAuthCheck.error) {
      await this.sendStatusUpdate(task.id, 'failed', priorAuthCheck.message || 'Prior auth check failed.');
      return;
    }

    // MCP returns { requiresPriorAuth: boolean, isCovered: boolean, ... }
    const requiresAuth: boolean = priorAuthCheck.requiresPriorAuth === true;
    await this.logAudit(task.workflowId, `Prior auth check completed. Required: ${requiresAuth}`, { priorAuthCheck });

    if (requiresAuth) {
      // DIVERGENCE 2: Submit a prior authorization request automatically
      await this.sendStatusUpdate(task.id, 'working', 'Prior auth required. Automatically submitting request...');

      const submissionResult = await this.callMCPTool('insurance', 'submit_prior_auth_request', {
        patient_id: patientId,
        procedure_code: procedureCode,
        reason: `Automated submission via AI Orchestrator for procedure: ${procedureCode}.`, // ← Correct field name: 'reason'
      }, task.workflowId);

      if (submissionResult.error) {
        await this.sendStatusUpdate(task.id, 'failed', `Prior Auth Submission Failed: ${submissionResult.message}`);
        return;
      }

      await this.logAudit(task.workflowId, `Prior auth submitted automatically.`, { submissionResult });

      // Signal the Orchestrator: auth is pending. Coordinator will decide scheduling hold.
      // Do NOT chain to SchedulingAgent here — let the Orchestrator handle that coordination.
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'pending_authorization',
        insurance_cleared: false,
        prior_auth_pending: true,
        authorizationId: submissionResult.authorizationId,
        patient_id: patientId,
        details: `Prior auth submitted. ID: ${submissionResult.authorizationId}. Awaiting insurer response.`,
      }));

    } else {
      // PROCEED: No prior auth required — insurance fully cleared
      await this.sendStatusUpdate(task.id, 'working', 'No prior authorization required. Insurance fully cleared.');

      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'cleared_for_visit',
        insurance_cleared: true,
        prior_auth_pending: false,
        patient_id: patientId,
        details: `Insurance verified. Procedure "${procedureCode}" is covered and does not require prior authorization.`,
      }));
    }
  }
}
