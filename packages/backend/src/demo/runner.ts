import axios from 'axios';
import { db } from '../db/connection';
import { patients, appointments } from '../db/schema';
import { randomUUID } from 'crypto';

const API_BASE = 'http://localhost:4000/api';

/**
 * Executes the End-to-End Walkthrough of the Orchestrator Pipeline.
 * Simulates a third-party EHR webhooking an 'appointment_booked' event into our Ingress.
 */
async function runDemoScenario() {
  console.log('💉 --- Hospital Workflow POC: End-to-End Demo Trigger --- 💉\n');

  try {
    // 1. Seed Demo Patient & Appointment
    const patId = randomUUID();
    const docId = randomUUID();
    const appId = randomUUID();

    // 1a. Seed Demo Doctor
    console.log(`[1] Seeding Test Doctor: ${docId}`);
    try {
      await db.insert(require('../db/schema').doctors).values({
        id: docId,
        name: 'Dr. Sarah Smith',
        department: 'Cardiology'
      });
    } catch (e) {
      // Ignore if doctor already exists
    }

    // 1b. Seed Demo Patient
    console.log(`[1] Seeding Test Patient: ${patId}`);
    await db.insert(patients).values({
      id: patId,
      name: 'E2E Demo Patient',
      dob: '1985-06-15',
      phone: '+15550198273',
      insuranceProvider: 'BlueCross',
      insuranceId: 'BC-9999-DEMO'
    });

    // 1c. Seed Demo Appointment
    console.log(`[1] Seeding Test Appointment: ${appId}`);
    await db.insert(appointments).values({
      id: appId,
      patientId: patId,
      doctorId: docId,
      department: 'Cardiology',
      slotTime: new Date(Date.now() + 86400000 * 7), // 7 days from now
      appointmentType: 'cardio_consult',
      status: 'booked'
    });

    // 2. Fire the Webhook to the Event Router
    console.log(`\n[2] Firing Event Webhook to ${API_BASE}/events...`);
    const payload = {
      eventType: 'appointment_booked',
      patientId: patId,
      appointmentId: appId,
      payload: {
        reasonForVisit: 'Chest pain evaluation, requires EKG pre-auth.',
        urgency: 'high'
      }
    };

    const response = await axios.post(`${API_BASE}/events`, payload);
    
    console.log('\n✅ [SUCCESS] Ingestion Layer accepted webhook!');
    console.log(`📦 Workflow ID Generated: ${response.data.workflowId}`);
    
    console.log('\n======================================================');
    console.log('🤖 THE ORCHESTRATOR IS NOW RUNNING IN THE BACKGROUND!');
    console.log(`👉 Open http://localhost:3000/workflows/${response.data.workflowId} to watch the AI Agents work live!`);
    console.log('======================================================\n');
    
  } catch (error: any) {
    console.error('❌ Demo Trigger Failed:', error.response?.data || error.message);
  }
}

runDemoScenario();
