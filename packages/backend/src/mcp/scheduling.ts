/**
 * Scheduling MCP Server
 *
 * Stub MCP server for doctor availability and appointment booking.
 * Reads from PostgreSQL (doctors table) to check schedules and slots.
 *
 * Tools:
 *   - search_doctors_by_department(department)
 *   - get_doctor_availability(doctor_id, date)
 *   - book_appointment(patient_id, doctor_id, slot_time, appointment_type)
 */

import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';
import { db } from '../db/connection';
import { doctors, appointments, patients } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { DoctorSchedule } from '../db/schema';

const SERVER_NAME = 'scheduling';
const LATENCY_MS = 100;

export async function initSchedulingMCP(): Promise<void> {
  // Phase 1: Create server (no connection yet)
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Scheduling system — doctor search, availability lookups, and booking',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });

  // ─── Tool: search_doctors_by_department ────────────────
  const searchDoctorsSchema = {
    department: z.string().describe('Department name (e.g., Cardiology, Orthopedics, Neurology, General Medicine, Dermatology)'),
  };

  async function searchDoctorsHandler(args: { department: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { department } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        specialization: doctors.specialization,
        department: doctors.department,
      })
      .from(doctors)
      .where(eq(doctors.department, department));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          department,
          count: result.length,
          doctors: result,
        }),
      }],
    };
  }
  server.tool('search_doctors_by_department', 'Find doctors in a specific department', searchDoctorsSchema, searchDoctorsHandler);

  // ─── Tool: get_doctor_availability ─────────────────────
  const getAvailabilitySchema = {
    doctor_id: z.string().describe('UUID of the doctor'),
    date: z.string().describe('Target date (YYYY-MM-DD or day name like "monday")'),
  };

  async function getAvailabilityHandler(args: { doctor_id: string; date: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { doctor_id, date } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, doctor_id));

    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Doctor not found', doctor_id }) }],
        isError: true,
      };
    }

    const doctor = result[0];
    const schedule = doctor.schedule as DoctorSchedule;

    // Determine the day name (e.g., "monday")
    let dayName = date.toLowerCase();
    if (date.includes('-')) {
      const d = new Date(date);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      dayName = days[d.getDay()];
    }

    const daySchedule = schedule[dayName];
    if (!daySchedule || !daySchedule.available) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            doctor_id,
            doctorName: doctor.name,
            date,
            day: dayName,
            available: false,
            slots: [],
            message: `Doctor is not available on ${dayName}.`,
          }),
        }],
      };
    }

    // Filter out already booked slots for this date
    // Note: In a real system, we'd query the appointments table for that specific date.
    // For the POC, we return the base schedule slots.
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          doctor_id,
          doctorName: doctor.name,
          date,
          day: dayName,
          available: true,
          slots: daySchedule.slots,
        }),
      }],
    };
  }
  server.tool('get_doctor_availability', 'Get available time slots for a specific doctor on a given date', getAvailabilitySchema, getAvailabilityHandler);

  // ─── Tool: book_appointment ────────────────────────────
  const bookAppointmentSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    doctor_id: z.string().describe('UUID of the doctor'),
    slot_time: z.string().describe('ISO timestamp or YYYY-MM-DD HH:mm String'),
    appointment_type: z.string().optional().default('general').describe('Type of appointment'),
    notes: z.string().optional().describe('Optional clinical notes'),
  };

  async function bookAppointmentHandler(args: { 
    patient_id: string; 
    doctor_id: string; 
    slot_time: string;
    appointment_type?: string;
    notes?: string;
  }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, doctor_id, slot_time, appointment_type, notes } = args;
    await simulateLatency(LATENCY_MS * 2);

    // 1. Verify patient exists
    const patientResult = await db.select().from(patients).where(eq(patients.id, patient_id));
    if (patientResult.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    // 2. Verify doctor exists
    const doctorResult = await db.select().from(doctors).where(eq(doctors.id, doctor_id));
    if (doctorResult.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Doctor not found', doctor_id }) }],
        isError: true,
      };
    }

    const slotDate = new Date(slot_time);

    // 3. Create the appointment
    const newAppointment = await db.insert(appointments).values({
      patientId: patient_id,
      doctorId: doctor_id,
      department: doctorResult[0].department,
      slotTime: slotDate,
      appointmentType: appointment_type,
      notes: notes || 'Booked via Orchestrator',
      status: 'booked',
    }).returning();

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          appointment_id: newAppointment[0].id,
          patientName: patientResult[0].name,
          doctorName: doctorResult[0].name,
          slotTime: newAppointment[0].slotTime,
          status: newAppointment[0].status,
          message: `Appointment successfully booked for ${patientResult[0].name} with ${doctorResult[0].name} at ${slot_time}.`,
        }),
      }],
    };
  }
  server.tool('book_appointment', 'Book a new appointment for a patient', bookAppointmentSchema, bookAppointmentHandler);

  // Phase 2: Connect transport AFTER all tools are registered
  const { client } = await connectMCPServer(server, config);

  // Register with the global MCP registry
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}
