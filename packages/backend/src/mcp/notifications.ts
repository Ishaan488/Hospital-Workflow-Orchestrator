/**
 * Notification MCP Server
 *
 * Stub MCP server for patient communications (Email/SMS).
 * Simulates message delivery and logs notifications for tracking.
 *
 * Tools:
 *   - send_patient_message(patient_id, channel, message)
 *   - queue_followup_reminder(patient_id, date, message)
 */

import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';
import { db } from '../db/connection';
import { patients } from '../db/schema';
import { eq } from 'drizzle-orm';

const SERVER_NAME = 'notifications';
const LATENCY_MS = 150;

// In-memory message store for POC
const messageHistory: {
  id: string;
  patientId: string;
  channel: 'email' | 'sms' | 'push';
  message: string;
  timestamp: string;
}[] = [];

export async function initNotificationMCP(): Promise<void> {
  // Phase 1: Create server
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Patient notification system — Email and SMS simulation',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });

  // ─── Tool: send_patient_message ───────────────────────
  const sendMessageSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    channel: z.enum(['email', 'sms', 'push']).describe('Communication channel'),
    message: z.string().describe('The message content to send'),
  };

  async function sendMessageHandler(args: { patient_id: string; channel: 'email' | 'sms' | 'push'; message: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, channel, message } = args;
    await simulateLatency(LATENCY_MS);

    // 1. Fetch patient contact info
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
    const destination = channel === 'email' ? patient.email : patient.phone;

    if (!destination) {
      return {
        content: [{ type: "text", text: JSON.stringify({ 
          error: `No ${channel} address/number on file for patient`, 
          patient_id,
          patientName: patient.name
        }) }],
        isError: true,
      };
    }

    // 2. Simulate sending
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const logEntry = {
      id: msgId,
      patientId: patient_id,
      channel,
      message,
      timestamp: new Date().toISOString(),
    };
    
    // Store for auditing/debug
    messageHistory.push(logEntry);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          messageId: msgId,
          patientName: patient.name,
          channel,
          destination: channel === 'email' ? destination : `***-***-${destination.slice(-4)}`,
          status: 'sent',
          deliveredAt: logEntry.timestamp,
        }),
      }],
    };
  }
  server.tool('send_patient_message', 'Send a message to a patient via their preferred channel', sendMessageSchema as any, sendMessageHandler as any);

  // ─── Tool: queue_followup_reminder ────────────────────
  const queueReminderSchema = {
    patient_id: z.string().describe('UUID of the patient'),
    date: z.string().describe('ISO Date or relative time (e.g. "tomorrow", "in 2 days")'),
    message: z.string().describe('Reminder content'),
  };

  async function queueReminderHandler(args: { patient_id: string; date: string; message: string }): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
    const { patient_id, date, message } = args;
    await simulateLatency(LATENCY_MS);

    const result = await db.select().from(patients).where(eq(patients.id, patient_id));
    if (result.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: 'Patient not found', patient_id }) }],
        isError: true,
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          success: true,
          reminderId: `rem_${Date.now()}`,
          patientId: patient_id,
          patientName: result[0].name,
          scheduledDate: date,
          message,
          status: 'queued',
        }),
      }],
    };
  }
  server.tool('queue_followup_reminder', 'Queue a follow-up reminder for a patient', queueReminderSchema, queueReminderHandler);

  // Phase 2: Connect transport
  const { client } = await connectMCPServer(server, config);

  // Register with global registry
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}
