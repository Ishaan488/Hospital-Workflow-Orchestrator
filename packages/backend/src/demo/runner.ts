/**
 * Emergency Orchestrator CLI Demo Runner
 *
 * Fires a POST to /api/demo/trigger for a chosen scenario.
 */

const API_BASE = 'http://localhost:4000/api';

async function runDemoScenario(scenarioId = 1) {
  console.log('🚨 --- Philips Pre-Hospital Emergency Orchestrator: Demo Trigger --- 🚨\n');

  try {
    console.log(`[1] Firing Demo Scenario ${scenarioId} to ${API_BASE}/demo/trigger...`);
    const res = await fetch(`${API_BASE}/demo/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: scenarioId })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    
    const data = await res.json() as any;

    console.log('\n✅ [SUCCESS] Emergency workflow triggered!');
    console.log(`📦 Workflow ID: ${data.workflowId}`);
    console.log(`📋 Scenario:   ${data.scenarioName} — ${data.description}`);
    console.log('\n======================================================');
    console.log('🤖 EMERGENCY ORCHESTRATOR RUNNING IN THE BACKGROUND!');
    console.log(`👉 Open http://localhost:3000/workflows/${data.workflowId} to watch live`);
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('❌ Demo Trigger Failed:', error.message);
  }
}

const scenario = parseInt(process.argv[2] ?? '1', 10);
runDemoScenario(scenario);
