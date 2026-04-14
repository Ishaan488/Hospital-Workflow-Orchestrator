import { BaseAgent } from '../agents/base';
import { A2ATask } from './types';
import { agentCardRegistry } from './agent-card';
import { db } from '../db/connection';
import { auditLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

// 1. Define Dummy Agent A (Sender)
class AlphaAgent extends BaseAgent {
  constructor() {
    super('AlphaAgent', 'Test agent A', [{ name: 'ping', description: 'sends pings' }]);
  }

  public async handleTask(task: A2ATask): Promise<void> {
    console.log(`[Alpha] Received task: ${task.inputMessage.parts[0].text}`);
    if (task.inputMessage.parts[0].text === 'PING') {
      await this.sendA2ATask('BetaAgent', 'PONG');
      await this.sendStatusUpdate(task.id, 'completed', 'I replied with PONG');
    }
  }

  // Helper to trigger the test
  public async initiateTest(): Promise<void> {
    console.log(`[Alpha] Initiating test... sending PING to BetaAgent.`);
    await this.sendA2ATask('BetaAgent', 'PING');
  }
}

// 2. Define Dummy Agent B (Receiver)
class BetaAgent extends BaseAgent {
  constructor() {
    super('BetaAgent', 'Test agent B', [{ name: 'pong', description: 'receives pings' }]);
  }

  public async handleTask(task: A2ATask): Promise<void> {
    console.log(`[Beta] Received task: ${task.inputMessage.parts[0].text}`);
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (task.inputMessage.parts[0].text === 'PING') {
      console.log(`[Beta] Processing PING... sending PONG back to Alpha.`);
      await this.sendStatusUpdate(task.id, 'completed', 'Processed PING');
      await this.sendA2ATask('AlphaAgent', 'PONG');
    } else if (task.inputMessage.parts[0].text === 'PONG') {
      console.log(`[Beta] Received the final PONG! Test complete.`);
      await this.sendStatusUpdate(task.id, 'completed');
    }
  }
}

async function runTests() {
  console.log('--- STARTING A2A INTEGRATION TESTS ---\n');

  // Step 1: Instantiate & Start Agents
  const alpha = new AlphaAgent();
  const beta = new BetaAgent();
  
  agentCardRegistry.registerCard(alpha.getAgentCard());
  agentCardRegistry.registerCard(beta.getAgentCard());

  alpha.start();
  beta.start();

  // Test: Agent discovery
  console.log(`\n--- Test: Agent Discovery ---`);
  const cards = agentCardRegistry.getAllCards();
  if (cards.length >= 2) {
    console.log('✅ AgentCardRegistry successfully holds metadata for Alpha & Beta.');
  } else {
    console.error('❌ Registry failed.');
  }

  // Test: Message exchange
  console.log(`\n--- Test: Message Exchange & Status Transitions ---`);
  await alpha.initiateTest();

  // Wait 2 seconds for event loop flushes and DB writes
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test: Postgres Audit Trail Check
  console.log(`\n--- Test: Audit Trail Persistance ---`);
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(5);
    const brokerLogs = logs.filter(l => l.agent === 'A2ABroker');
    const systemLogs = logs.filter(l => l.agent === 'AlphaAgent' || l.agent === 'BetaAgent');

    if (brokerLogs.length > 0 && systemLogs.length > 0) {
      console.log('✅ Drizzle ORM correctly intercepted A2A messages and Agent state updates!');
    } else {
      console.error('❌ Audit logs missing in database.');
    }
  } catch (err) {
    console.error('❌ Database error during validation:', err);
  }

  console.log('\n--- TESTS COMPLETED ---');
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
