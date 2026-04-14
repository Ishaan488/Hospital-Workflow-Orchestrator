/**
 * EHR / Patient MCP Server
 *
 * Stub MCP server for patient and EHR data.
 * Reads from PostgreSQL (seeded data) to simulate a real EHR system.
 *
 * Tools:
 *   - get_patient_profile(patient_id)
 *   - get_appointment_details(appointment_id)
 *   - update_patient_demographics(patient_id, data)
 *   - check_document_completeness(patient_id, appointment_type)
 */

import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';
import { db } from '../db/connection';
import { patients, appointments, doctors } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { PatientDocument } from '../db/schema';

const SERVER_NAME = 'ehr';
const LATENCY_MS = 150; // simulate EHR system response time

// Document requirements by appointment type
const REQUIRED_DOCS_BY_TYPE: Record<string, string[]> = {
  specialist_consultation: ['insurance_card', 'id_proof', 'referral_letter'],
  general: ['id_proof'],
  procedure: ['insurance_card', 'id_proof', 'referral_letter', 'consent_form'],
  follow_up: ['id_proof'],
  emergency: ['id_proof'],
};

export async function initEHRMCP(): Promise<void> {
  // Phase 1: Create server (no connection yet)
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Electronic Health Records — patient profiles, appointments, documents',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });  // ─── Tool: get_patient_profile ─────────────────────────
  const getPatientProfileSchema = {
    patient_id: z.string().describe('UUID of the patient'),
  };
  async function getPatientProfileHandler(args: { patient_id: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
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
    const response = {
      id: patient.id,
      name: patient.name,
      dob: patient.dob,
      phone: patient.phone,
      email: patient.email,
      insuranceId: patient.insuranceId,
      insuranceProvider: patient.insuranceProvider,
      documents: patient.documents,
      demographics: patient.demographics,
      demographicsComplete: isDemographicsComplete(patient.demographics as Record<string, unknown>),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(response) }],
    };
  }
  server.tool('get_patient_profile', 'Fetch a patient profile including demographics, insurance, and uploaded documents', getPatientProfileSchema as any, getPatientProfileHandler as any);

  // ─── Tool: get_appointment_details ─────────────────────
  const getAppointmentDetailsSchema = {
    appointment_id: z.string().describe('UUID of the appointment'),
  };
  async function getAppointmentDetailsHandler(args: { appointment_id: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { appointment_id } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        patientEmail: patients.email,
        patientInsuranceId: patients.insuranceId,
        patientInsuranceProvider: patients.insuranceProvider,
        doctorId: appointments.doctorId,
        doctorName: doctors.name,
        department: appointments.department,
        slotTime: appointments.slotTime,
        status: appointments.status,
        appointmentType: appointments.appointmentType,
        notes: appointments.notes,
        requiredDocuments: appointments.requiredDocuments,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .where(eq(appointments.id, appointment_id));

    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Appointment not found', appointment_id }) }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result[0]) }],
    };
  }
  server.tool('get_appointment_details', 'Fetch appointment details including patient and doctor info', getAppointmentDetailsSchema, getAppointmentDetailsHandler);

  // ─── Tool: update_patient_demographics ─────────────────
  const updatePatientDemographicsSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    demographics: z.record(z.any()).describe('Demographic fields to update'),
  };
  async function updatePatientDemographicsHandler(args: { patient_id: string; demographics: Record<string, any> }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, demographics } = args;
    await simulateLatency(LATENCY_MS);

    const existing = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patient_id));

    if (existing.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    const merged = {
      ...(existing[0].demographics as Record<string, unknown> || {}),
      ...demographics,
    };

    await db
      .update(patients)
      .set({ demographics: merged, updatedAt: new Date() })
      .where(eq(patients.id, patient_id));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          patient_id,
          updatedFields: Object.keys(demographics),
          demographicsComplete: isDemographicsComplete(merged),
        }),
      }],
    };
  }
  server.tool('update_patient_demographics', 'Update patient demographic information (address, emergency contact, etc.)', updatePatientDemographicsSchema, updatePatientDemographicsHandler);

  // ─── Tool: check_document_completeness ─────────────────
  const checkDocumentCompletenessSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    appointment_type: z.string().describe('Type of appointment'),
  };
  async function checkDocumentCompletenessHandler(args: { patient_id: string; appointment_type: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, appointment_type } = args;
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
    const uploadedDocs = (patient.documents as PatientDocument[] || []);
    const uploadedTypes = uploadedDocs.map((d) => d.type);
    const requiredDocs = REQUIRED_DOCS_BY_TYPE[appointment_type] || REQUIRED_DOCS_BY_TYPE['general'];

    const missingDocs = requiredDocs.filter((doc) => !uploadedTypes.includes(doc));
    const unverifiedDocs = uploadedDocs.filter(
      (doc) => requiredDocs.includes(doc.type) && !doc.verified
    );

    const isComplete = missingDocs.length === 0 && unverifiedDocs.length === 0;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          patient_id,
          patientName: patient.name,
          appointmentType: appointment_type,
          requiredDocuments: requiredDocs,
          uploadedDocuments: uploadedTypes,
          missingDocuments: missingDocs,
          unverifiedDocuments: unverifiedDocs.map((d) => d.type),
          isComplete,
          summary: isComplete
            ? 'All required documents are uploaded and verified'
            : `Missing: ${missingDocs.join(', ') || 'none'}.`,
        }),
      }],
    };
  }
  server.tool('check_document_completeness', 'Check if a patient has all required documents for a given appointment type', checkDocumentCompletenessSchema, checkDocumentCompletenessHandler);

  // Phase 2: Connect transport AFTER all tools are registered
  const { client } = await connectMCPServer(server, config);

  // Register with the global MCP registry
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}

// ─── Helpers ─────────────────────────────────────────────

function isDemographicsComplete(demographics: Record<string, unknown> | null): boolean {
  if (!demographics) return false;
  const requiredFields = ['address', 'city', 'state', 'zipCode', 'emergencyContact', 'emergencyPhone'];
  return requiredFields.every((field) => {
    const value = demographics[field];
    return value !== undefined && value !== null && value !== '';
  });
}
