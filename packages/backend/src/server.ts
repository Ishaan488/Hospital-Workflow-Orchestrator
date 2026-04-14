import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { patientRoutes, appointmentRoutes, workflowRoutes, approvalRoutes } from './routes';

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
app.use('/api/approvals', approvalRoutes);

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\n🏥 Hospital Workflow Orchestrator`);
  console.log(`   Server running on http://localhost:${PORT}`);
  console.log(`   Health check:     http://localhost:${PORT}/health`);
  console.log(`   API root:         http://localhost:${PORT}/api\n`);
});

export default app;
