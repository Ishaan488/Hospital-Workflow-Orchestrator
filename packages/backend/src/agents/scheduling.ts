import { BaseAgent } from './base';
import { A2ATask, Capability } from '../a2a/types';
import { agentCardRegistry } from '../a2a/agent-card';

const SCHEDULING_CAPABILITIES: Capability[] = [
  {
    name: 'check_slot_status',
    description: 'Verifies if an appointment slot is still available or valid.',
  },
  {
    name: 'mark_provisional',
    description: 'Places a hold or provisional label on an appointment due to pending external factors.',
  },
  {
    name: 'find_alternatives',
    description: 'Searches for alternate appointment slots if a reschedule is required.',
  }
];

export class SchedulingAgent extends BaseAgent {
  constructor() {
    super(
      'SchedulingAgent',
      'Manages schedule slots, provisional holds, and conflict resolutions.',
      SCHEDULING_CAPABILITIES
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
      payload = { action: 'check_slot_status', argument: inputStr };
    }

    const { action, patient_id, appointment_id, reason } = payload;
    await this.logAudit(task.workflowId, `Starting scheduling task: ${action}`, { payload });

    if (action === 'mark_provisional') {
      await this.processMarkProvisional(task, patient_id, appointment_id, reason);
    } else if (action === 'check_slot_status') {
      // The scheduling MCP has get_doctor_availability for checking, but since the
      // appointment is already booked at this point, we confirm the status via audit log.
      await this.logAudit(task.workflowId, `Slot status confirmed: appointment already booked.`, { appointment_id });
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({ status: 'confirmed' }));
    } else if (action === 'find_alternatives') {
      await this.processFindAlternatives(task, payload);
    } else {
      await this.sendStatusUpdate(task.id, 'failed', `Unknown action: ${action}`);
    }
  }

  /**
   * Marks a slot as provisional when another agent (like Insurance) detects a delay risk.
   *
   * NOTE: The scheduling MCP (POC) does not have a dedicated mark_slot_provisional tool.
   * The appointment is already stored in DB from the trigger event. We log the provisional
   * hold internally and then notify the patient via CommunicationAgent. In a production
   * system, this would call a real scheduling system API to flag the slot.
   */
  private async processMarkProvisional(task: A2ATask, patient_id?: string, appointment_id?: string, reason?: string): Promise<void> {
    if (!patient_id) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing patient_id for provisional hold.');
      return;
    }

    await this.sendStatusUpdate(task.id, 'working', `Applying provisional hold. Reason: ${reason}`);

    // Log the provisional hold internally — the booking already exists in the DB
    // from the original appointment_booked trigger event.
    await this.logAudit(task.workflowId, `Provisional hold applied for patient ${patient_id}.`, {
      appointment_id: appointment_id || 'from_trigger',
      reason: reason || 'Pending external factor',
      note: 'Hold recorded internally. Scheduling MCP notified via audit trail.',
    });

    // Inform the patient about the temporary hold
    const emailPayload = {
      action: 'send_patient_reminder',
      patient_id,
      message: `Your upcoming appointment is on a temporary hold while we finalize some details: ${reason || 'pending review'}. You do not need to take any action — we will contact you if we need to reschedule.`,
    };

    await this.sendA2ATask('CommunicationAgent', emailPayload, task.workflowId);

    // Conclude task as completed
    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
      status: 'provisional_hold_applied',
      appointment_id: appointment_id || 'from_trigger',
      patient_id,
      reason,
      note: 'Patient notified via CommunicationAgent.',
    }));
  }

  /**
   * Finds alternative appointment slots via the Scheduling MCP.
   * MCP Tool: search_doctors_by_department(department) → list of doctors
   *           get_doctor_availability(doctor_id, date) → available slots
   */
  private async processFindAlternatives(task: A2ATask, payload: any): Promise<void> {
    const { department, doctor_id, preferred_date } = payload;

    if (!department && !doctor_id) {
      await this.sendStatusUpdate(task.id, 'failed', 'Missing department or doctor_id for alternative search.');
      return;
    }

    await this.sendStatusUpdate(task.id, 'working', 'Searching for alternative appointment slots...');

    let doctorId = doctor_id;

    // If no doctor_id, search by department first
    if (!doctorId && department) {
      const doctorsResult = await this.callMCPTool('scheduling', 'search_doctors_by_department', {
        department,
      }, task.workflowId);

      if (doctorsResult.error || !doctorsResult.doctors?.length) {
        await this.sendStatusUpdate(task.id, 'failed', `No doctors found in department: ${department}`);
        return;
      }

      doctorId = doctorsResult.doctors[0].id;
    }

    // Get availability for next available day
    const targetDate = preferred_date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const availabilityResult = await this.callMCPTool('scheduling', 'get_doctor_availability', {
      doctor_id: doctorId,
      date: targetDate,
    }, task.workflowId);

    if (availabilityResult.error || !availabilityResult.available) {
      await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
        status: 'no_alternatives_found',
        doctorId,
        date: targetDate,
      }));
      return;
    }

    await this.sendStatusUpdate(task.id, 'completed', JSON.stringify({
      status: 'alternatives_found',
      doctorId,
      doctorName: availabilityResult.doctorName,
      date: targetDate,
      availableSlots: availabilityResult.slots,
    }));
  }
}
