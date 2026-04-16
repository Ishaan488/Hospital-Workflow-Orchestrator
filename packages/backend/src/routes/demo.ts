import { Router } from 'express';
import { randomUUID } from 'crypto';
import { orchestratorAgent } from '../agents/orchestrator';
import { db } from '../db/connection';
import { incidents } from '../db/schema';

export const demoRouter = Router();

/**
 * Demo Scenario Definitions
 * Maps a scenario number to a named patient situation.
 * These use the seeded patient IDs from seed.ts.
 */
/**
 * Demo Scenario Definitions
 * Maps a scenario number to an emergency situation.
 */
const DEMO_SCENARIOS = {
  1: {
    name: 'Normal Flow',
    description: 'Full Internet Connectivity',
  },
  2: {
    name: 'Mesh Relay',
    description: 'Internet Saturated',
  },
  3: {
    name: 'Replanning',
    description: 'Condition worsens',
  },
};

/**
 * POST /api/demo/trigger
 * Body: { scenario: 1|2|3 }
 * Triggers a demo emergency workflow for the selected scenario.
 */
demoRouter.post('/api/demo/trigger', async (req, res) => {
  try {
    const { scenario } = req.body;
    const scenarioNum = parseInt(scenario, 10);

    if (!scenarioNum || !DEMO_SCENARIOS[scenarioNum as keyof typeof DEMO_SCENARIOS]) {
      res.status(400).json({
        error: 'Invalid scenario. Must be 1-3.',
        available: Object.entries(DEMO_SCENARIOS).map(([k, v]) => ({ id: k, name: v.name, description: v.description }))
      });
      return;
    }

    const scenarioDef = DEMO_SCENARIOS[scenarioNum as keyof typeof DEMO_SCENARIOS];

    // Create a synthetic incident ID
    const syntheticIncidentId = randomUUID();

    // Persist to the database so that workflow relationships (foreign keys) are valid
    await db.insert(incidents).values({
      id: syntheticIncidentId,
      triggerType: scenarioNum === 2 ? 'mesh_relay_triggered' : 'emergency_incident',
      location: { lat: 37.7749, lon: -122.4194, accuracy_m: 5, source: 'gps' },
      connectivity: { internet: scenarioNum !== 2, sms: true, battery: 85 },
      voiceText: scenarioNum === 1 
        ? "I just got into a car crash on highway 10, my leg is bleeding badly and I cannot stand. Please help."
        : scenarioNum === 2
        ? "[SMS RELAY] Hiker fallen off red trail. Broken arm, head injury. No internet signal here."
        : "Mild chest pain... Wait, he collapsed! He is completely unconscious and not breathing!",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const triggerEvent = {
      type: scenarioNum === 2 ? 'mesh_relay_triggered' : 'emergency_incident',
      incident_id: syntheticIncidentId,
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
