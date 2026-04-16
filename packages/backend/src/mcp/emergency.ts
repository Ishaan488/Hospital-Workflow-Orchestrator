/**
 * Emergency MCP Server
 *
 * Mock MCP server for pre-hospital emergency data and tools (Geography, SMS, Dispatch, Triage).
 */
import { z } from 'zod';
import { createMCPServer, connectMCPServer, simulateLatency } from './base';
import { mcpRegistry } from './registry';

const SERVER_NAME = 'emergency';
const LATENCY_MS = 200;

export async function initEmergencyMCP(): Promise<void> {
  const { server, config } = createMCPServer({
    name: SERVER_NAME,
    description: 'Pre-Hospital Emergency Tools',
    version: '1.0.0',
    simulatedLatencyMs: LATENCY_MS,
  });

  // 1. Speech to Text
  server.tool('speech_to_text', 'Converts raw radio/audio input into text', { audio_blob: z.string() }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ text: "I just got into a car crash on highway 10, my leg is bleeding badly and I cannot stand. Please help." }) }],
    };
  });

  // 2. Summarize Victim Statement
  server.tool('summarize_victim_statement', 'Extracts key facts from raw statement', { text: z.string() }, async (args) => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ summary: "Severe leg bleeding after car crash, victim unable to stand." }) }],
    };
  });

  // 3. Classify Incident
  server.tool('classify_incident', 'Outputs a structured Triage Profile', { summary: z.string() }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ urgency: "high", ambulance_required: true, probable_case: "trauma_bleeding", guidance_class: "bleeding_control_safe" }) }],
    };
  });

  // 4. Search Nearby Hospitals
  server.tool('search_nearby_hospitals', 'Finds trauma capable hospitals and capacities', { location: z.record(z.any()) }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify([
        { id: "hosp_1", name: "City General", traumaLevel: 1, capacity: "critical", eta_mins: 15 },
        { id: "hosp_2", name: "St. Jude Trauma Center", traumaLevel: 1, capacity: "moderate", eta_mins: 10 }
      ]) }],
    };
  });

  // 5. Request Ambulance
  server.tool('request_ambulance', 'Dispatches an ambulance', { location: z.record(z.any()), priority: z.string(), hospitalId: z.string() }, async (args) => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ vehicle_id: "AMB-042", status: "dispatched", estimated_arrival_mins: 8, target_hospital: args.hospitalId }) }],
    };
  });

  // 6. Send SMS
  server.tool('send_sms', 'Sends SMS via fallback or normal relay', { contact: z.string(), message: z.string() }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, delivered_at: new Date().toISOString() }) }],
    };
  });
  
  // 7. Check Action Policy
  server.tool('check_action_policy', 'Verifies if an action is clinically/legally safe for AI execution', { action: z.string(), context: z.string() }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ isSafe: true }) }],
    };
  });

  // 8. Send Pre-Arrival Alert
  server.tool('send_prearrival_alert', 'Sends handover packet to hospital trauma team', { hospital_id: z.string(), packet: z.record(z.any()) }, async () => {
    await simulateLatency(LATENCY_MS);
    return {
      content: [{ type: "text", text: JSON.stringify({ received: true, ack_id: "ack_88192" }) }],
    };
  });

  const { client } = await connectMCPServer(server, config);
  mcpRegistry.register(SERVER_NAME, { server, client, config });
}
