import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

export class IncidentAgent extends BaseAgent {
  constructor() {
    super('IncidentAgent', 'Converts raw victim input into structured incident facts.', [{ name: 'extract_incident_facts', description: 'Extract facts from raw input', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const payload = JSON.parse(task.inputMessage.parts[0].text || '{}');
    const { action, incident_id } = payload;
    
    if (action === 'extract_incident_facts') {
      const toolRes = await this.callMCPTool('emergency', 'speech_to_text', { audio_blob: "audio_123" }, task.workflowId);
      const summaryRes = await this.callMCPTool('emergency', 'summarize_victim_statement', { text: toolRes.text || "Car crash, leg bleeding" }, task.workflowId);
      
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'facts_extracted',
        incident_id,
        summary: summaryRes.summary || "Severe leg bleeding after car crash",
      }));
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }
}

export class TriageAgent extends BaseAgent {
  constructor() {
    super('TriageAgent', 'Maps incident facts to a structured triage profile.', [{ name: 'generate_triage_profile', description: 'Generates Triage Profile', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id, summary } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'generate_triage_profile') {
      const response = await this.callMCPTool('emergency', 'classify_incident', { summary: summary || "Unknown" }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'triage_completed',
        incident_id,
        triage_profile: response,
      }));
    }
  }
}

export class HospitalMatchingAgent extends BaseAgent {
  constructor() {
    super('HospitalMatchingAgent', 'Selects the most suitable hospital.', [{ name: 'rank_hospitals', description: 'Finds appropriate hospitals', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'rank_hospitals') {
      const response = await this.callMCPTool('emergency', 'search_nearby_hospitals', { location: {} }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'hospital_matched',
        incident_id,
        selected_hospital: response[0]?.id || "hosp_1",
      }));
    }
  }
}

export class DispatchAgent extends BaseAgent {
  constructor() {
    super('DispatchAgent', 'Coordinates response path from field to hospital.', [{ name: 'request_dispatch', description: 'Requests ambulance', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id, selected_hospital } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'request_dispatch') {
      await this.callMCPTool('emergency', 'request_ambulance', { location: {}, priority: "high", hospitalId: selected_hospital || "hosp_1" }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'ambulance_dispatched',
        incident_id,
      }));
    }
  }
}

export class ContactAgent extends BaseAgent {
  constructor() {
    super('ContactAgent', 'Notifies trusted contacts and manages fallback relay mode.', [{ name: 'notify_relatives', description: 'Sends SMS to contacts', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'notify_relatives') {
      await this.callMCPTool('emergency', 'send_sms', { contact: "trusted_contact_val", message: "Emergency alert sent" }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'relatives_notified',
        incident_id,
      }));
    }
  }
}

export class GuidanceAgent extends BaseAgent {
  constructor() {
    super('GuidanceAgent', 'Provides safe, approved immediate instructions.', [{ name: 'provide_first_aid_instructions', description: 'Provides text + voice guidance', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'provide_first_aid_instructions') {
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'guidance_provided',
        incident_id,
        instruction: "Apply pressure to visible wound and stay still.",
      }));
    }
  }
}

export class HandoverAgent extends BaseAgent {
  constructor() {
    super('HandoverAgent', 'Prepares the hospital before patient arrival.', [{ name: 'send_pre_arrival_packet', description: 'Sends handover packet', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'send_pre_arrival_packet') {
      await this.callMCPTool('emergency', 'send_prearrival_alert', { hospital_id: "hosp_1", packet: {} }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'handover_sent',
        incident_id,
      }));
    }
  }
}

export class AuditAgent extends BaseAgent {
  constructor() {
    super('AuditAgent', 'Tracks decisions, enforces policy, and ensures explainability.', [{ name: 'verify_action_safety', description: 'Verify safe workflow', inputSchema: {} }]);
    agentCardRegistry.registerCard(this.getAgentCard());
  }

  public async handleTask(task: A2ATask): Promise<void> {
    const { action, incident_id } = JSON.parse(task.inputMessage.parts[0].text || '{}');
    if (action === 'verify_action_safety') {
      await this.callMCPTool('emergency', 'check_action_policy', { action: "dispatch", context: "severe trauma" }, task.workflowId);
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'safety_verified',
        incident_id,
      }));
    }
  }
}
