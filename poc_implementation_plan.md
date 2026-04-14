# Hospital Admin Workflow Optimizer — POC Implementation Plan

## Goal

Build a working POC of the **Pre-Visit Intake + Insurance Readiness** workflow, demonstrating:
- Multi-agent orchestration (Gemini-powered dynamic planning)
- A2A protocol for agent communication
- MCP stub servers for hospital system access
- Persistent workflow state + audit trail
- Human approval gates
- Ops console (simple Next.js UI)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express + TypeScript |
| Frontend | Next.js + Tailwind CSS (minimal UI) |
| Database | PostgreSQL |
| LLM | Gemini (via `@google/genai` SDK) |
| A2A | Google A2A protocol (HTTP/JSON) |
| MCP | MCP TypeScript SDK (`@modelcontextprotocol/sdk`) |
| Monorepo | npm workspaces |

## Project Structure

```
Hospital-Workflow-Orchestrator/
├── packages/
│   ├── backend/                  # Express API + Orchestrator
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── db/               # Drizzle ORM schema + migrations
│   │   │   ├── mcp/              # MCP stub servers
│   │   │   │   ├── base.ts
│   │   │   │   ├── ehr.ts
│   │   │   │   ├── insurance.ts
│   │   │   │   ├── scheduling.ts
│   │   │   │   ├── notification.ts
│   │   │   │   └── task-audit.ts
│   │   │   ├── a2a/              # A2A protocol layer
│   │   │   │   ├── types.ts
│   │   │   │   ├── broker.ts
│   │   │   │   └── agent-card.ts
│   │   │   ├── agents/           # Specialized agents
│   │   │   │   ├── base-agent.ts
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── intake.ts
│   │   │   │   ├── insurance.ts
│   │   │   │   ├── scheduling.ts
│   │   │   │   └── communication.ts
│   │   │   ├── workflows/        # Workflow engine
│   │   │   │   ├── state-machine.ts
│   │   │   │   ├── engine.ts
│   │   │   │   └── events.ts
│   │   │   ├── audit/            # Audit + trace
│   │   │   └── routes/           # Express routes
│   │   └── package.json
│   └── frontend/                 # Next.js Ops Console
│       ├── src/app/
│       └── package.json
├── package.json                  # Workspace root
└── docker-compose.yml            # PostgreSQL
```

---

## Phase 1: Project Foundation

### Segment 1.1 — Monorepo + Backend Scaffold

**What**: Initialize npm workspace monorepo, scaffold Express+TypeScript backend.

**Tasks**:
- Create root `package.json` with `workspaces: ["packages/*"]`
- Initialize `packages/backend` with TypeScript, Express, ts-node-dev
- Add `tsconfig.json` with strict mode
- Create basic `src/server.ts` with health check endpoint (`GET /health`)
- Add npm scripts: `dev`, `build`

**Dependencies**: `express`, `typescript`, `ts-node-dev`, `@types/express`, `@types/node`, `cors`, `dotenv`, `zod`

**Deliverable**: Running Express server on `http://localhost:4000/health`

---

### Segment 1.2 — PostgreSQL + Drizzle ORM Setup

**What**: Set up PostgreSQL via Docker, configure Drizzle ORM, create initial schema.

**Tasks**:
- Create `docker-compose.yml` with PostgreSQL 16 service
- Install Drizzle ORM: `drizzle-orm`, `drizzle-kit`, `pg`
- Create `src/db/connection.ts` — pool connection
- Create `src/db/schema.ts` — initial tables:
  - `workflows` (id, type, status, patient_id, context JSON, created_at, updated_at)
  - `workflow_tasks` (id, workflow_id, agent, type, status, input JSON, output JSON, depends_on, created_at, completed_at)
  - `audit_logs` (id, workflow_id, task_id, agent, action, details JSON, timestamp)
  - `approval_requests` (id, workflow_id, task_id, action, reason, status, decided_by, decided_at, created_at)
  - `patients` (id, name, dob, phone, email, insurance_id, documents JSON, demographics JSON)
  - `appointments` (id, patient_id, doctor_id, department, slot_time, status, notes)
- Create `drizzle.config.ts`
- Run initial migration
- Create `.env` file with `DATABASE_URL`

**Deliverable**: Database running, schema migrated, connection verified

---

### Segment 1.3 — Seed Data + Base API Routes

**What**: Populate test data and create basic CRUD API routes.

**Tasks**:
- Create `src/db/seed.ts` with realistic fake data:
  - 5-10 sample patients (some with missing documents, some complete)
  - 5-10 doctors with departments and schedules
  - Sample appointments in various states
- Create API routes:
  - `GET /api/patients` / `GET /api/patients/:id`
  - `GET /api/appointments` / `GET /api/appointments/:id`
  - `GET /api/workflows` / `GET /api/workflows/:id`
  - `GET /api/approvals` (pending approvals)
  - `POST /api/approvals/:id/approve` | `/reject`
- Add request validation with Zod

**Deliverable**: Seeded DB, working REST endpoints

---

## Phase 2: MCP Stub Servers

> These are **in-process MCP servers** that simulate hospital system APIs. Each returns realistic fake data with configurable delays/failures.

### Segment 2.1 — MCP Base Framework

**What**: Create the base MCP server framework using the TypeScript MCP SDK.

**Tasks**:
- Install `@modelcontextprotocol/sdk`
- Create `src/mcp/base.ts` — base MCP server factory:
  - tool registration helper
  - standard error handling
  - simulated latency (configurable)
  - logging of all tool calls (for audit)
- Create `src/mcp/registry.ts` — MCP server registry (register, list, get by name)
- Create shared types for MCP tool responses

**Deliverable**: Reusable MCP server base, registry ready

---

### Segment 2.2 — EHR / Patient MCP Server

**What**: Stub MCP server for patient/EHR data.

**Tools**:
- `get_patient_profile(patient_id)` → returns patient demographics, documents, insurance info
- `get_appointment_details(appointment_id)` → returns appointment details
- `update_patient_demographics(patient_id, data)` → updates patient record
- `check_document_completeness(patient_id, appointment_type)` → returns list of required vs. uploaded docs

**Data source**: PostgreSQL `patients` + `appointments` tables

**Deliverable**: Working EHR MCP with 4 tools

---

### Segment 2.3 — Insurance MCP Server

**What**: Stub MCP server for insurance operations.

**Tools**:
- `check_insurance_eligibility(patient_id, procedure_code)` → returns eligibility status (simulated: 70% eligible, 20% needs more info, 10% ineligible)
- `submit_preauth_request(patient_id, procedure_code, details)` → returns request ID + estimated turnaround
- `get_preauth_status(request_id)` → returns status (simulated progression: pending → approved/denied)
- `fetch_rejection_reason(request_id)` → returns rejection classification

**Data source**: In-memory state + randomized responses with realistic delays

**Deliverable**: Working Insurance MCP with 4 tools

---

### Segment 2.4 — Scheduling MCP Server

**What**: Stub MCP server for appointment scheduling.

**Tools**:
- `get_doctor_slots(doctor_id, date_range)` → returns available slots
- `book_slot(doctor_id, patient_id, slot_time)` → confirms booking
- `reschedule_slot(appointment_id, new_slot_time)` → reschedules
- `mark_slot_provisional(appointment_id)` → marks as held/provisional
- `get_alternative_slots(department, date_range)` → returns alternatives

**Data source**: In-memory schedule grid with realistic availability

**Deliverable**: Working Scheduling MCP with 5 tools

---

### Segment 2.5 — Notification MCP Server

**What**: Stub MCP server for patient/staff communication.

**Tools**:
- `send_sms(phone, message)` → logs SMS (simulated, returns delivery ID)
- `send_email(email, subject, body)` → logs email
- `send_whatsapp(phone, message)` → logs WhatsApp message
- `create_staff_reminder(staff_id, message, due_at)` → creates internal reminder

**Data source**: In-memory log of all sent notifications (queryable for audit)

**Deliverable**: Working Notification MCP with 4 tools

---

### Segment 2.6 — Task / Audit MCP Server

**What**: Stub MCP server for task management and audit logging.

**Tools**:
- `create_task(assignee, description, due_at, workflow_id)` → creates staff task
- `mark_task_complete(task_id)` → marks done
- `write_audit_log(workflow_id, agent, action, details)` → writes to audit store
- `get_workflow_audit_trail(workflow_id)` → returns full trace

**Data source**: PostgreSQL `audit_logs` table + in-memory task list

**Deliverable**: Working Task/Audit MCP with 4 tools

---

## Phase 3: A2A Communication Layer

### Segment 3.1 — A2A Protocol Types + Agent Cards

**What**: Define A2A protocol types following Google's A2A spec.

**Tasks**:
- Create `src/a2a/types.ts`:
  - `AgentCard` — agent metadata (name, description, capabilities, endpoint URL)
  - `Task` — A2A task with id, status, input message, output, artifacts
  - `Message` — structured message with role, parts (text, data, file)
  - `TaskStatus` — enum: submitted, working, input-required, completed, failed, canceled
  - `TaskStatusUpdate` — for streaming updates
- Create `src/a2a/agent-card.ts`:
  - Agent card generation for each specialized agent
  - `/.well-known/agent.json` route for each agent

**Deliverable**: Full A2A type system, agent card definitions

---

### Segment 3.2 — A2A Message Broker

**What**: Build the in-process A2A message broker for agent-to-agent communication.

**Tasks**:
- Create `src/a2a/broker.ts`:
  - `AgentBroker` class — routes messages between agents
  - `sendTask(fromAgent, toAgent, task)` → delivers A2A task
  - `getTaskStatus(taskId)` → returns current status
  - `onTaskUpdate(taskId, callback)` → event-based updates
  - Task queue per agent (in-memory for POC)
- Create `src/a2a/registry.ts`:
  - Agent registration: each agent registers on startup
  - Agent discovery: lookup by name or capability
- Wire broker to Express routes:
  - `POST /a2a/:agentName/tasks/send` — send task to agent
  - `GET /a2a/:agentName/tasks/:taskId` — get task status

**Deliverable**: Working A2A broker with send, receive, status tracking

---

### Segment 3.3 — A2A Integration Tests

**What**: Verify A2A communication works end-to-end between two test agents.

**Tasks**:
- Create two dummy agents that can exchange messages
- Test: Agent A sends task to Agent B, Agent B processes and responds
- Test: Status transitions (submitted → working → completed)
- Test: Agent discovery via registry

**Deliverable**: Passing A2A integration tests

---

## Phase 4: Agent Layer

### Segment 4.1 — Base Agent Framework

**What**: Create the abstract base agent class that all specialized agents extend.

**Tasks**:
- Create `src/agents/base-agent.ts`:
  - `BaseAgent` abstract class:
    - `name`, `description`, `capabilities` properties
    - `getAgentCard()` → returns A2A AgentCard
    - `handleTask(task: A2ATask)` → abstract, processes incoming A2A task
    - `callMCPTool(serverName, toolName, args)` → calls an MCP tool via registry
    - `sendA2ATask(targetAgent, task)` → sends task via broker
    - `updateWorkflowState(workflowId, updates)` → writes to workflow state
    - `logAudit(workflowId, action, details)` → writes audit entry
  - Built-in error handling and retry logic
  - Built-in audit logging for every action

**Deliverable**: Reusable `BaseAgent` class

---

### Segment 4.2 — Intake Agent

**What**: Agent that handles patient intake completeness checks.

**Tasks**:
- Create `src/agents/intake.ts` extending `BaseAgent`
- Capabilities:
  - `check_intake_completeness` — fetches patient profile (EHR MCP), verifies demographics, checks document completeness (Document/EHR MCP)
  - `validate_required_documents` — compares uploaded docs against required docs for appointment type
  - `report_intake_status` — returns structured intake readiness report
- A2A behavior:
  - Receives task from Orchestrator
  - If documents missing → sends A2A task to Communication Agent
  - If insurance info incomplete → sends A2A notification to Insurance Agent
  - Returns intake status report to Orchestrator

**Deliverable**: Working Intake Agent with MCP + A2A integration

---

### Segment 4.3 — Insurance Agent

**What**: Agent that handles insurance eligibility and pre-auth.

**Tasks**:
- Create `src/agents/insurance.ts` extending `BaseAgent`
- Capabilities:
  - `check_eligibility` — calls Insurance MCP to verify coverage
  - `initiate_preauth` — submits pre-auth if required
  - `monitor_preauth_status` — polls/checks pre-auth status
  - `classify_delay_risk` — assesses likelihood of pre-auth delay
- A2A behavior:
  - Receives task from Orchestrator or info request from Intake Agent
  - If insurance card missing → responds to Intake Agent with "cannot proceed"
  - If delay risk high → sends A2A message to Scheduling Agent recommending provisional hold
  - Returns insurance readiness report to Orchestrator

**Deliverable**: Working Insurance Agent

---

### Segment 4.4 — Scheduling Agent

**What**: Agent that manages appointment scheduling decisions.

**Tasks**:
- Create `src/agents/scheduling.ts` extending `BaseAgent`
- Capabilities:
  - `check_slot_status` — verifies current appointment slot validity
  - `mark_provisional` — marks slot as provisionally held
  - `find_alternatives` — finds alternate slots if reschedule needed
  - `propose_reschedule` — generates reschedule options (may require human approval)
- A2A behavior:
  - Receives instructions from Orchestrator or Insurance Agent
  - If reschedule needed → creates approval request for human review
  - Returns scheduling status report

**Deliverable**: Working Scheduling Agent

---

### Segment 4.5 — Communication Agent

**What**: Agent that handles all patient/staff notifications.

**Tasks**:
- Create `src/agents/communication.ts` extending `BaseAgent`
- Capabilities:
  - `send_patient_reminder` — sends document/appointment reminders via Notification MCP
  - `send_staff_alert` — notifies staff of pending actions
  - `create_followup_task` — creates timed follow-up tasks via Task MCP
- A2A behavior:
  - Receives task from Orchestrator or other agents
  - Sends notifications and reports delivery status
  - Auto-approved for low-risk actions (SMS reminders), flags high-risk for approval

**Deliverable**: Working Communication Agent

---

## Phase 5: Workflow Orchestrator (Gemini-Powered)

### Segment 5.1 — Workflow State Machine

**What**: Build the workflow state persistence and transition engine.

**Tasks**:
- Create `src/workflows/state-machine.ts`:
  - `WorkflowStateMachine` class:
    - States: `created`, `planning`, `in_progress`, `waiting_approval`, `waiting_patient`, `waiting_external`, `completed`, `failed`, `escalated`
    - Valid transitions map
    - `transition(workflowId, newState, reason)` → validates + persists
    - `getCurrentState(workflowId)` → returns full workflow context
  - Task-level state tracking within a workflow
  - Dependency graph: task B depends on task A
- Create `src/workflows/engine.ts`:
  - `WorkflowEngine` class:
    - `createWorkflow(type, triggerEvent)` → creates new instance
    - `getReadyTasks(workflowId)` → returns tasks whose dependencies are met
    - `completeTask(workflowId, taskId, result)` → marks done, checks if new tasks are unblocked
    - `failTask(workflowId, taskId, reason)` → handles failure

**Deliverable**: Working workflow state machine with persistence

---

### Segment 5.2 — Gemini-Powered Orchestrator Agent

**What**: The central orchestrator that uses Gemini to dynamically plan and coordinate workflows.

**Tasks**:
- Install `@google/genai` SDK
- Create `src/agents/orchestrator.ts`:
  - `OrchestratorAgent` extending `BaseAgent`
  - **Planning phase**: Given a workflow goal + patient context, call Gemini to:
    - Determine which subtasks are needed (not all are needed every time)
    - Set task dependencies
    - Assign tasks to appropriate agents
  - **Coordination phase**: As agents complete tasks:
    - Feed results back to Gemini for next-step decisions
    - Determine if workflow can proceed or is blocked
    - Decide escalation or human approval needs
  - Gemini prompt structure:
    - System prompt: describes available agents, their capabilities, MCP tools, policies
    - Context: patient data, appointment data, current workflow state
    - Instruction: "Plan the next steps for this workflow" or "Given these results, what should happen next?"
  - Function calling: Gemini selects which agents to invoke (structured output)
- Create `src/agents/orchestrator-prompts.ts`:
  - Planning prompt template
  - Coordination prompt template
  - Available agents/capabilities descriptor

**Deliverable**: Working Gemini-powered orchestrator that dynamically plans workflows

---

### Segment 5.3 — Event Ingestion Layer

**What**: The entry point that receives hospital events and triggers workflow creation.

**Tasks**:
- Create `src/workflows/events.ts`:
  - `EventIngestion` class:
    - `ingestEvent(eventType, payload)` → validates, normalizes, deduplicates
    - Supported event types:
      - `appointment_booked` → triggers Pre-Visit Intake workflow
      - `document_uploaded` → updates existing workflow
      - `preauth_status_changed` → updates existing workflow
    - Event schema validation with Zod
- Create API route:
  - `POST /api/events` — receive and process events
- Wire event ingestion to WorkflowEngine and OrchestratorAgent

**Deliverable**: Event-driven workflow initiation

---

## Phase 6: Audit & Human Approval

### Segment 6.1 — Audit Trail System

**What**: Structured audit logging for all agent actions and decisions.

**Tasks**:
- Create `src/audit/logger.ts`:
  - `AuditLogger` class:
    - `logAgentAction(workflowId, agent, action, details)` → writes to DB
    - `logMCPCall(workflowId, agent, server, tool, args, result)` → logs tool usage
    - `logA2AMessage(workflowId, from, to, message)` → logs inter-agent comms
    - `logDecision(workflowId, agent, decision, reasoning)` → logs AI decisions
    - `getTrail(workflowId)` → returns ordered audit trail
- Integrate audit logger into `BaseAgent` (auto-log on every action)
- API route: `GET /api/workflows/:id/audit` → returns full audit trail

**Deliverable**: Complete audit trail for every workflow action

---

### Segment 6.2 — Human Approval Gates

**What**: Mechanism for agents to request human approval for sensitive actions.

**Tasks**:
- Create `src/approval/manager.ts`:
  - `ApprovalManager` class:
    - `requestApproval(workflowId, taskId, action, reason, details)` → creates pending approval, pauses workflow
    - `approve(approvalId, approvedBy)` → resumes workflow
    - `reject(approvalId, rejectedBy, reason)` → triggers alternative path
    - `getPendingApprovals()` → lists all pending
    - `getApprovalsByWorkflow(workflowId)` → lists approvals for a workflow
- Wire into workflow engine: when approval is requested, workflow transitions to `waiting_approval`
- When approved/rejected, orchestrator is notified to continue planning
- API routes:
  - `GET /api/approvals` — list pending
  - `POST /api/approvals/:id/approve`
  - `POST /api/approvals/:id/reject`

**Deliverable**: Working approval gate system

---

## Phase 7: Frontend — Ops Console (Next.js)

> Minimal, functional UI. Not a design exercise.

### Segment 7.1 — Next.js Project Setup

**What**: Scaffold the Next.js frontend with Tailwind.

**Tasks**:
- Initialize `packages/frontend` with Next.js + Tailwind + TypeScript
- Set up API proxy to backend (`localhost:4000`)
- Create basic layout: sidebar nav + main content area
- Pages: Dashboard, Workflows, Approvals, Workflow Detail

**Deliverable**: Running Next.js app at `localhost:3000`

---

### Segment 7.2 — Dashboard + Workflow List

**What**: Main dashboard showing workflow overview.

**Tasks**:
- Dashboard page (`/`):
  - Stats cards: total workflows, active, completed, pending approval
  - Recent workflows list (table: ID, patient, type, status, created)
- Workflow list page (`/workflows`):
  - Filterable table of all workflows
  - Status badges (color-coded)
  - Click to view detail

**Deliverable**: Working dashboard + workflow list

---

### Segment 7.3 — Workflow Detail Page

**What**: Detailed view of a single workflow's state, tasks, and audit trail.

**Tasks**:
- Workflow detail page (`/workflows/[id]`):
  - Header: workflow type, status, patient info
  - Task list: all subtasks with status, assigned agent, dependencies
  - Audit trail: chronological log of all actions/decisions
  - Approval section: if pending, show approve/reject buttons

**Deliverable**: Working workflow detail page with audit trail

---

### Segment 7.4 — Approvals Page

**What**: Dedicated page for handling pending human approvals.

**Tasks**:
- Approvals page (`/approvals`):
  - List of pending approvals
  - Each shows: action requested, reason, agent recommendation, patient context
  - Approve / Reject buttons with confirmation
  - Approved/rejected history

**Deliverable**: Working approval management page

---

## Phase 8: End-to-End POC Demo

### Segment 8.1 — Wire the Full Pre-Visit Intake Workflow

**What**: Connect all components for the complete POC demo flow.

**Tasks**:
- Wire the complete flow:
  1. `POST /api/events` with `appointment_booked` event
  2. Event ingestion creates workflow
  3. Orchestrator (Gemini) plans subtasks based on patient context
  4. Intake Agent checks document completeness via EHR MCP
  5. Insurance Agent checks eligibility via Insurance MCP
  6. A2A messages flow between agents (e.g., Intake → Insurance, Insurance → Scheduling)
  7. Communication Agent sends reminders via Notification MCP
  8. Scheduling Agent marks provisional or suggests reschedule
  9. If reschedule needed → approval request created
  10. Workflow reaches terminal state
- Ensure all actions are audit-logged
- Ensure workflow state persists through all transitions

**Deliverable**: Complete end-to-end workflow execution

---

### Segment 8.2 — Demo Scenarios + Seed Data

**What**: Create specific demo scenarios that showcase different workflow paths.

**Scenarios**:

1. **Happy Path**: Patient with complete docs + valid insurance → workflow completes automatically
2. **Missing Document**: Insurance card missing → Intake Agent detects, Communication Agent sends reminder, slot marked provisional
3. **Pre-Auth Required**: Procedure needs pre-auth → Insurance Agent submits, monitors status, possible delay
4. **Reschedule Needed**: High delay risk → Scheduling Agent proposes alternatives → human approval required
5. **Edge Case**: Multiple missing items → demonstrates parallel agent coordination

**Tasks**:
- Create seed data for each scenario
- Create a demo trigger script that runs each scenario
- Verify all paths produce correct audit trails

**Deliverable**: 5 runnable demo scenarios with expected outcomes

---

### Segment 8.3 — Testing & Validation

**What**: Validate the complete system works correctly.

**Tasks**:
- Integration tests for each segment:
  - MCP tool calls return expected data
  - A2A message delivery works correctly
  - Workflow state transitions are valid
  - Approval gates pause/resume workflows
  - Audit trail is complete
- End-to-end tests for each demo scenario
- Manual walkthrough of the frontend ops console

**Deliverable**: All tests passing, system validated

---

## Execution Order Summary

| # | Segment | Depends On | Estimated Effort |
|---|---------|-----------|-----------------|
| 1 | 1.1 Monorepo + Backend | — | Small |
| 2 | 1.2 PostgreSQL + Drizzle | 1.1 | Small |
| 3 | 1.3 Seed Data + Routes | 1.2 | Small |
| 4 | 2.1 MCP Base Framework | 1.1 | Small |
| 5 | 2.2 EHR MCP | 2.1, 1.2 | Small |
| 6 | 2.3 Insurance MCP | 2.1 | Small |
| 7 | 2.4 Scheduling MCP | 2.1 | Small |
| 8 | 2.5 Notification MCP | 2.1 | Small |
| 9 | 2.6 Task/Audit MCP | 2.1, 1.2 | Small |
| 10 | 3.1 A2A Types + Cards | 1.1 | Small |
| 11 | 3.2 A2A Broker | 3.1 | Medium |
| 12 | 3.3 A2A Integration Tests | 3.2 | Small |
| 13 | 4.1 Base Agent | 2.1, 3.2 | Medium |
| 14 | 4.2 Intake Agent | 4.1, 2.2 | Medium |
| 15 | 4.3 Insurance Agent | 4.1, 2.3 | Medium |
| 16 | 4.4 Scheduling Agent | 4.1, 2.4 | Medium |
| 17 | 4.5 Communication Agent | 4.1, 2.5 | Small |
| 18 | 5.1 Workflow State Machine | 1.2 | Medium |
| 19 | 5.2 Gemini Orchestrator | 4.1, 5.1 | Large |
| 20 | 5.3 Event Ingestion | 5.1, 5.2 | Small |
| 21 | 6.1 Audit Trail | 1.2, 4.1 | Small |
| 22 | 6.2 Approval Gates | 5.1 | Medium |
| 23 | 7.1 Next.js Setup | — | Small |
| 24 | 7.2 Dashboard | 7.1, 1.3 | Small |
| 25 | 7.3 Workflow Detail | 7.2 | Medium |
| 26 | 7.4 Approvals Page | 7.3, 6.2 | Small |
| 27 | 8.1 Full Wiring | All above | Medium |
| 28 | 8.2 Demo Scenarios | 8.1 | Small |
| 29 | 8.3 Testing | 8.2 | Medium |

---

## Open Questions

> [!IMPORTANT]
> **Gemini Model**: Which Gemini model do you want to use? `gemini-2.0-flash` (fast, cheaper) or `gemini-2.5-pro` (more capable planning)? For POC, Flash is recommended.

> [!NOTE]
> **A2A Transport**: For the POC, the A2A broker will be **in-process** (all agents run in the same Node.js process and communicate via the broker). In production, each agent would be a separate service with HTTP-based A2A. This is the standard approach for POC → production evolution.

## Verification Plan

### Automated Tests
- Unit tests for MCP stub tool responses
- A2A broker message delivery tests  
- Workflow state machine transition tests
- End-to-end workflow execution for each demo scenario

### Manual Verification
- Trigger `appointment_booked` event via API
- Observe workflow progression in ops console
- Approve/reject pending actions in approvals page
- Verify audit trail completeness in workflow detail page
