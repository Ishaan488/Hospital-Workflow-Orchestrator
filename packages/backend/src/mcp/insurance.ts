/**
 * Insurance MCP Server
 *
 * Stub MCP server for insurance verification and authorization.
 * Simulates interactions with payer systems using seeded patient data.
 *
 * Tools:
 *   - verify_insurance_eligibility(patient_id)
 *   - check_prior_authorization(patient_id, procedure_code)
 *   - get_coverage_details(insurance_id, provider)
 *   - submit_prior_auth_request(patient_id, procedure_code, reason)
 */

import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';
import { db } from '../db/connection';
import { patients } from '../db/schema';
import { eq } from 'drizzle-orm';

const SERVER_NAME = 'insurance';
const LATENCY_MS = 200; // insurance systems are typically slower

// Simulated insurance plan database
const INSURANCE_PLANS: Record<string, {
  planName: string;
  planType: string;
  copay: number;
  deductible: number;
  maxCoverage: number;
  coversProcedures: string[];
  requiresPriorAuth: string[];
  networkHospitals: string[];
}> = {
  'Star Health Insurance': {
    planName: 'Star Comprehensive',
    planType: 'comprehensive',
    copay: 500,
    deductible: 5000,
    maxCoverage: 1000000,
    coversProcedures: ['consultation', 'lab_tests', 'imaging', 'surgery', 'physiotherapy'],
    requiresPriorAuth: ['surgery', 'mri', 'ct_scan', 'specialist_consultation'],
    networkHospitals: ['City Hospital', 'Apollo', 'Fortis', 'Max Healthcare'],
  },
  'HDFC ERGO Health': {
    planName: 'HDFC Optima Restore',
    planType: 'comprehensive',
    copay: 750,
    deductible: 7500,
    maxCoverage: 750000,
    coversProcedures: ['consultation', 'lab_tests', 'imaging', 'surgery'],
    requiresPriorAuth: ['surgery', 'mri', 'ct_scan'],
    networkHospitals: ['Apollo', 'Fortis', 'Manipal'],
  },
  'Bajaj Allianz Health': {
    planName: 'Bajaj Health Guard',
    planType: 'basic',
    copay: 1000,
    deductible: 10000,
    maxCoverage: 500000,
    coversProcedures: ['consultation', 'lab_tests', 'imaging'],
    requiresPriorAuth: ['imaging', 'specialist_consultation'],
    networkHospitals: ['Apollo', 'Max Healthcare'],
  },
  'New India Assurance': {
    planName: 'New India Mediclaim',
    planType: 'government',
    copay: 200,
    deductible: 2000,
    maxCoverage: 1500000,
    coversProcedures: ['consultation', 'lab_tests', 'imaging', 'surgery', 'physiotherapy', 'emergency'],
    requiresPriorAuth: ['surgery'],
    networkHospitals: ['City Hospital', 'Apollo', 'Fortis', 'Max Healthcare', 'AIIMS'],
  },
  'ICICI Lombard': {
    planName: 'ICICI Health Booster',
    planType: 'comprehensive',
    copay: 600,
    deductible: 6000,
    maxCoverage: 800000,
    coversProcedures: ['consultation', 'lab_tests', 'imaging', 'surgery'],
    requiresPriorAuth: ['surgery', 'mri', 'specialist_consultation'],
    networkHospitals: ['Apollo', 'Fortis', 'Manipal', 'Max Healthcare'],
  },
};

// Track simulated prior auth requests (in-memory for POC)
const priorAuthRequests: Map<string, {
  id: string;
  patientId: string;
  procedureCode: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: string;
  estimatedResponseHours: number;
}> = new Map();

export async function initInsuranceMCP(): Promise<void> {
  // Phase 1: Create server (no connection yet)
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Insurance verification, eligibility checks, and prior authorization',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });

  // ─── Tool: verify_insurance_eligibility ────────────────
  const verifyEligibilitySchema = {
    patient_id: z.string().describe('UUID of the patient'),
  };
  async function verifyEligibilityHandler(args: { patient_id: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patient_id));

    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    const patient = result[0];

    // No insurance → self-pay
    if (!patient.insuranceId || !patient.insuranceProvider) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          patient_id,
          patientName: patient.name,
          hasInsurance: false,
          eligible: false,
          paymentMode: 'self_pay',
          message: 'No insurance on file. Patient is self-pay.',
        }) }],
      };
    }

    // Simulate expired insurance (insurance ID contains 'EXPIRED')
    if (patient.insuranceId.includes('EXPIRED')) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          patient_id,
          patientName: patient.name,
          hasInsurance: true,
          insuranceId: patient.insuranceId,
          insuranceProvider: patient.insuranceProvider,
          eligible: false,
          reason: 'policy_expired',
          expiryDate: '2025-06-30',
          message: 'Insurance policy has expired. Patient needs to renew or switch to self-pay.',
          suggestedActions: [
            'Contact patient to update insurance information',
            'Offer self-pay option with cost estimate',
            'Check if employer has renewed group policy',
          ],
        }) }],
      };
    }

    // Valid insurance
    const plan = INSURANCE_PLANS[patient.insuranceProvider];
    return {
      content: [{ type: "text", text: JSON.stringify({
        patient_id,
        patientName: patient.name,
        hasInsurance: true,
        insuranceId: patient.insuranceId,
        insuranceProvider: patient.insuranceProvider,
        eligible: true,
        planDetails: plan ? {
          planName: plan.planName,
          planType: plan.planType,
          copay: plan.copay,
          deductible: plan.deductible,
          maxCoverage: plan.maxCoverage,
        } : null,
        message: 'Insurance is active and eligible.',
      }) }],
    };
  }
  server.tool('verify_insurance_eligibility', 'Verify if a patient has active, eligible insurance coverage', verifyEligibilitySchema as any, verifyEligibilityHandler as any);

  // ─── Tool: check_prior_authorization ───────────────────
  const checkPriorAuthSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    procedure_code: z.string().describe('Procedure code to check: consultation, lab_tests, imaging, mri, ct_scan, surgery, specialist_consultation, physiotherapy, emergency'),
  };
  async function checkPriorAuthHandler(args: { patient_id: string; procedure_code: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, procedure_code } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patient_id));

    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    const patient = result[0];

    if (!patient.insuranceProvider) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          patient_id,
          procedureCode: procedure_code,
          requiresPriorAuth: false,
          reason: 'self_pay',
          message: 'No insurance. Prior authorization not applicable for self-pay patients.',
        }) }],
      };
    }

    const plan = INSURANCE_PLANS[patient.insuranceProvider];
    if (!plan) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          patient_id,
          procedureCode: procedure_code,
          requiresPriorAuth: true,
          reason: 'unknown_provider',
          message: `Insurance provider "${patient.insuranceProvider}" not in our system. Prior auth required by default.`,
        }) }],
      };
    }

    const needsAuth = plan.requiresPriorAuth.includes(procedure_code);
    const isCovered = plan.coversProcedures.includes(procedure_code);

    // Check if there's already a pending/approved auth
    const existingAuth = Array.from(priorAuthRequests.values()).find(
      (auth) => auth.patientId === patient_id && auth.procedureCode === procedure_code
    );

    return {
      content: [{ type: "text", text: JSON.stringify({
        patient_id,
        patientName: patient.name,
        procedureCode: procedure_code,
        insuranceProvider: patient.insuranceProvider,
        isCovered,
        requiresPriorAuth: needsAuth,
        existingAuthorization: existingAuth ? {
          id: existingAuth.id,
          status: existingAuth.status,
          submittedAt: existingAuth.submittedAt,
        } : null,
        estimatedCopay: isCovered ? plan.copay : null,
        message: !isCovered
          ? `Procedure "${procedure_code}" is not covered under ${plan.planName}. Full cost applies.`
          : needsAuth
            ? (existingAuth
              ? `Prior authorization ${existingAuth.status}. ID: ${existingAuth.id}`
              : `Prior authorization required for "${procedure_code}". Please submit a request.`)
            : `Procedure "${procedure_code}" is covered and does not require prior authorization.`,
      }) }],
    };
  }
  server.tool('check_prior_authorization', 'Check if a procedure requires prior authorization for a patient', checkPriorAuthSchema, checkPriorAuthHandler);

  // ─── Tool: get_coverage_details ────────────────────────
  const getCoverageSchema = {
    insurance_provider: z.string().describe('Name of the insurance provider'),
  };
  async function getCoverageHandler(args: { insurance_provider: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { insurance_provider } = args;
    await simulateLatency(LATENCY_MS);

    const plan = INSURANCE_PLANS[insurance_provider];
    if (!plan) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: 'Provider not found',
          insurance_provider,
          availableProviders: Object.keys(INSURANCE_PLANS),
        }) }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        insuranceProvider: insurance_provider,
        ...plan,
      }) }],
    };
  }
  server.tool('get_coverage_details', 'Get detailed coverage information for an insurance provider', getCoverageSchema, getCoverageHandler);

  // ─── Tool: submit_prior_auth_request ───────────────────
  const submitPriorAuthSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    procedure_code: z.string().describe('Procedure code requiring authorization'),
    reason: z.string().describe('Clinical reason for the procedure'),
  };
  async function submitPriorAuthHandler(args: { patient_id: string; procedure_code: string; reason: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, procedure_code, reason } = args;
    await simulateLatency(LATENCY_MS * 2); // submission takes longer

    const result = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patient_id));

    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    const patient = result[0];

    if (!patient.insuranceProvider) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: 'Cannot submit prior auth for self-pay patient',
          patient_id,
        }) }],
        isError: true,
      };
    }

    // Check for existing request
    const existing = Array.from(priorAuthRequests.values()).find(
      (auth) => auth.patientId === patient_id && auth.procedureCode === procedure_code
    );

    if (existing) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          alreadyExists: true,
          authorizationId: existing.id,
          status: existing.status,
          submittedAt: existing.submittedAt,
          message: `Prior authorization already submitted (${existing.status}).`,
        }) }],
      };
    }

    // Create new prior auth request
    const authId = `PA-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const authRequest = {
      id: authId,
      patientId: patient_id,
      procedureCode: procedure_code,
      reason,
      status: 'pending' as const,
      submittedAt: new Date().toISOString(),
      estimatedResponseHours: 24 + Math.floor(Math.random() * 48), // 24-72 hours
    };

    priorAuthRequests.set(authId, authRequest);

    return {
      content: [{ type: "text", text: JSON.stringify({
        success: true,
        authorizationId: authId,
        patientName: patient.name,
        insuranceProvider: patient.insuranceProvider,
        procedureCode: procedure_code,
        reason,
        status: 'pending',
        submittedAt: authRequest.submittedAt,
        estimatedResponseHours: authRequest.estimatedResponseHours,
        message: `Prior authorization request submitted. Expected response in ${authRequest.estimatedResponseHours} hours.`,
        nextSteps: [
          'Monitor authorization status',
          'Follow up with insurance if no response in 72 hours',
          'Inform patient about authorization timeline',
        ],
      }) }],
    };
  }
  server.tool('submit_prior_auth_request', 'Submit a prior authorization request to the insurance provider', submitPriorAuthSchema, submitPriorAuthHandler);

  // Phase 2: Connect transport AFTER all tools are registered
  const { client } = await connectMCPServer(server, config);

  // Register with the global MCP registry
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}
