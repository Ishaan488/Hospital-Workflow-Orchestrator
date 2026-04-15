import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db/connection';
import { patients, appointments, doctors } from '../db/schema';
import { orchestratorAgent } from '../agents/orchestrator';

export const demoRouter = Router();

/**
 * Demo Scenario Definitions
 * Maps a scenario number to a named patient situation.
 * These use the seeded patient IDs from seed.ts.
 */
const DEMO_SCENARIOS = {
  1: {
    name: 'Happy Path',
    description: 'Patient with complete documents + valid insurance → workflow completes automatically',
    patientSeedIndex: 0,
  },
  2: {
    name: 'Missing Insurance Card',
    description: 'Insurance card missing → Intake detects, Communication sends reminder, slot marked provisional',
    patientSeedIndex: 1,
  },
  3: {
    name: 'Pre-Auth Required',
    description: 'Procedure needs pre-authorization → Insurance Agent submits, monitors for delay risk',
    patientSeedIndex: 2,
  },
  4: {
    name: 'Reschedule Needed',
    description: 'High delay risk → Scheduling Agent proposes alternatives → Human approval gate triggered',
    patientSeedIndex: 3,
  },
  5: {
    name: 'Multiple Missing Items',
    description: 'Missing ID + missing referral + incomplete demographics → parallel agent coordination',
    patientSeedIndex: 4,
  },
};

/**
 * POST /api/demo/trigger
 * Body: { scenario: 1|2|3|4|5 }
 * Triggers a demo workflow for the selected scenario using seeded patient data.
 */
demoRouter.post('/api/demo/trigger', async (req, res) => {
  try {
    const { scenario } = req.body;
    const scenarioNum = parseInt(scenario, 10);

    if (!scenarioNum || !DEMO_SCENARIOS[scenarioNum as keyof typeof DEMO_SCENARIOS]) {
      res.status(400).json({
        error: 'Invalid scenario. Must be 1-5.',
        available: Object.entries(DEMO_SCENARIOS).map(([k, v]) => ({ id: k, name: v.name, description: v.description }))
      });
      return;
    }

    const scenarioDef = DEMO_SCENARIOS[scenarioNum as keyof typeof DEMO_SCENARIOS];

    // Fetch a real seeded patient for this scenario
    const allPatients = await db.select().from(patients).limit(10);
    const allDoctors = await db.select().from(doctors).limit(5);

    if (allPatients.length === 0 || allDoctors.length === 0) {
      res.status(503).json({ error: 'No seed data found. Run: npm run db:seed first.' });
      return;
    }

    // Pick patient by scenario index (falls back gracefully)
    const patient = allPatients[scenarioDef.patientSeedIndex % allPatients.length];
    const doctor = allDoctors[scenarioNum % allDoctors.length];

    // Create a synthetic appointment triggerEvent
    const syntheticAppointmentId = randomUUID();
    const slotTime = new Date();
    slotTime.setDate(slotTime.getDate() + 7); // 7 days from now

    const triggerEvent = {
      type: scenarioNum === 2 ? 'document_uploaded' : 
            scenarioNum === 3 || scenarioNum === 4 ? 'preauth_status_changed' : 
            'appointment_booked',
      appointmentId: syntheticAppointmentId,
      patientId: patient.id,
      doctorId: doctor.id,
      department: doctor.department,
      slotTime: slotTime.toISOString(),
      appointmentType: scenarioNum === 3 ? 'specialist_procedure' : 'general',
      demoScenario: scenarioNum,
      demoScenarioName: scenarioDef.name,
    };

    // Fire the orchestrator directly (same as if the event ingestion layer received it)
    const workflowId = await orchestratorAgent.startWorkflow(triggerEvent);

    res.status(202).json({
      success: true,
      scenario: scenarioNum,
      scenarioName: scenarioDef.name,
      description: scenarioDef.description,
      workflowId,
      patient: { id: patient.id, name: patient.name },
      streamUrl: `/api/workflows/${workflowId}/stream`,
      detailUrl: `/workflows/${workflowId}`,
    });

  } catch (err: any) {
    console.error('[Demo API] Error triggering demo:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/demo/scenarios
 * Returns the list of available demo scenarios for the God Mode panel.
 */
demoRouter.get('/api/demo/scenarios', (_req, res) => {
  res.json({
    scenarios: Object.entries(DEMO_SCENARIOS).map(([id, s]) => ({
      id: parseInt(id),
      name: s.name,
      description: s.description,
    }))
  });
});
