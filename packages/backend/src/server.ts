import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { patientRoutes, appointmentRoutes, workflowRoutes, approvalRoutes } from './routes';
import mcpDebugRoutes from './routes/mcp-debug';
import { initializeMCPServers } from './mcp/init';

// --- A2A & Workflow Imports ---
import { eventRouter } from './workflows/events';
import { a2aRouter } from './a2a/broker';
import { auditRouter } from './audit/logger';
import { approvalRouter } from './approval/manager';

// --- Agents ---
import { IntakeAgent } from './agents/intake';
import { InsuranceAgent } from './agents/insurance';
import { SchedulingAgent } from './agents/scheduling';
import { CommunicationAgent } from './agents/communication';
import { orchestratorAgent } from './agents/orchestrator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hospital-workflow-orchestrator',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// --- API Root ---
app.get('/api', (_req, res) => {
  res.json({
    message: 'Hospital Workflow Orchestrator API',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      patients: 'GET /api/patients',
      appointments: 'GET /api/appointments',
      workflows: 'GET /api/workflows',
      approvals: 'GET /api/approvals',
      events: 'POST /api/events',
    },
  });
});

// --- Routes ---
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/mcp', mcpDebugRoutes);

// --- Workflow & A2A Routes ---
app.use(eventRouter);
app.use(a2aRouter);
app.use(auditRouter);
app.use(approvalRouter);

// --- Start Server ---
async function start() {
  // Initialize MCP servers before accepting requests
  await initializeMCPServers();

  // Boot up the A2A Event Workers so they subscribe to the broker queues
  console.log('--- Starting A2A Agent Services ---');
  new IntakeAgent().start();
  new InsuranceAgent().start();
  new SchedulingAgent().start();
  new CommunicationAgent().start();
  orchestratorAgent.start();
  console.log('--- A2A Agents Online ---\n');

  app.listen(PORT, () => {
    console.log(`🏥 Hospital Workflow Orchestrator`);
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log(`   Health check:     http://localhost:${PORT}/health`);
    console.log(`   API root:         http://localhost:${PORT}/api\n`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export default app;
