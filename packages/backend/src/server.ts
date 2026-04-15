import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { patientRoutes, appointmentRoutes, workflowRoutes, approvalRoutes } from './routes';
import mcpDebugRoutes from './routes/mcp-debug';
import { initializeMCPServers } from './mcp/init';

// --- A2A & Workflow Imports ---
import { eventRouter } from './workflows/events';
import { a2aRouter } from './a2a/broker';
import { auditRouter } from './audit/logger';
import { approvalRouter } from './approval/manager';
import { demoRouter } from './routes/demo';

// --- SSE Manager ---
import { sseManager } from './sse/manager';

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
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hospital-workflow-orchestrator',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: sseManager.getClientCount(),
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
      demo: 'POST /api/demo/trigger',
      stream: 'GET /api/workflows/:id/stream',
      globalStream: 'GET /api/stream/global',
    },
  });
});

// ─── SSE Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/workflows/:id/stream
 * SSE stream for a specific workflow — the frontend Swarm Graph connects here.
 * Each message contains typed events: a2a_message, agent_reasoning, mcp_tool_call, etc.
 */
app.get('/api/workflows/:id/stream', (req, res) => {
  const clientId = randomUUID();
  const workflowId = req.params.id;
  sseManager.addClient(clientId, workflowId, res);
});

/**
 * GET /api/stream/global
 * SSE stream for the dashboard — receives aggregated events from ALL workflows.
 */
app.get('/api/stream/global', (req, res) => {
  const clientId = randomUUID();
  sseManager.addClient(clientId, 'global', res);
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
app.use(demoRouter);

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
    console.log(`🏥 MedOrchestra — Hospital AI Workflow Platform`);
    console.log(`   Server:        http://localhost:${PORT}`);
    console.log(`   Health:        http://localhost:${PORT}/health`);
    console.log(`   API:           http://localhost:${PORT}/api`);
    console.log(`   Global SSE:    http://localhost:${PORT}/api/stream/global`);
    console.log(`   Demo trigger:  POST http://localhost:${PORT}/api/demo/trigger\n`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export default app;
