# Transitioning to Philips Pre-Hospital Emergency Orchestrator

This document outlines the implementation plan for pivoting from the **MedOrchestra (Hospital Routing)** prototype to the new **Philips Pre-Hospital Emergency Orchestrator**. The system transitions from an in-hospital administrative workflow orchestrator into a pre-hospital emergency coordinator operating on dynamic data.

## System Comparison & Concept Mapping

Here's an overview of how we will reuse the existing foundation to build the new prototype.

| Existing System (MedOrchestra) | New System (Pre-Hospital Emergency Orchestrator) | Action |
| --- | --- | --- |
| `orchestrator.ts` (Graph execution & Replanning) | **Emergency Orchestrator Agent** (Central planner) | **Partial Refactor**: Keep graph logic & dynamic replanning. Update the master prompt and state variables to focus on pre-hospital incident routing. |
| `intake.ts` (Data gathering) | **Incident Understanding Agent** & **Triage Agent** | **Partial Refactor**: Convert to extract structured trauma facts (type, severity, markers) instead of hospital intake forms. |
| `scheduling.ts` (Matching & time slots) | **Hospital Match Agent** & **Dispatch Agent** | **Partial Refactor**: Switch from slot matching to capability/ETA-based hospital ranking and ambulance dispatch. |
| `insurance.ts` (Verification) | **Audit & Safety Agent** | **Conceptual Repurpose**: Switch from insurance clearing to enforcing system safety policy and decisions. |
| N/A | **Contact Agent**, **Guidance Agent**, **Handover Agent** | **Completely New**: Implement specific handling for relative relay SMS, user guidance templates, and hospital handover alerting. |

## Proposed Changes

---

### Phase 1: Database & Core Models
The current system focuses on `patients`, `doctors`, and `appointments`. We will add new models to structure the emergency context while keeping the core orchestrator models intact.

#### [NEW] `packages/backend/src/db/schema.ts` (Updates)
- **Keep exactly as-is**: `workflows`, `workflowTasks`, `auditLogs`, `approvalRequests`.
- **Add Entities**: 
  - `incidents` (tracks the live emergency: location, severity, network_status, images)
  - `hospitals` (trauma levels, capacity metrics, coordinates)
  - `trusted_contacts` (relatives and relay devices)
  - `ambulances` (vehicle fleet & status)

> Note: Reusing the `workflows` & `workflowTasks` tables means the frontend Task Graph and timeline components will work almost immediately out of the box with the new task names!

---

### Phase 2: Backend Agents & MCP Servers
We will rewrite the specialist worker agents to match the 8 functional areas defined in the architecture.

#### [MODIFY] `packages/backend/src/agents/orchestrator.ts`
- Modify the base prompt to understand the Incident Packet.
- Let it dynamically plan which subset of the 8 agents are required based on connectivity and triage output.

#### [NEW] `packages/backend/src/agents/...` (Multiple Files)
- `incident.ts`: Calls MCP tool `speech_to_text`, `summarize_victim_statement`.
- `triage.ts`: Maps incident to `Triage Profile` via `classify_incident`.
- `hospital-matching.ts`: Uses MCP `search_nearby_hospitals` and capabilities.
- `dispatch.ts`: Manages ambulance assignments.
- `contact.ts`: Invokes SMS relay and fallback handling tools.
- `guidance.ts`: Provides user instruction.
- `handover.ts`: Structures hospital payload.
- `audit.ts`: Inspects actions for bounds and safety.

#### [MODIFY] `packages/backend/src/mcp/...`
- Introduce new MCP mock servers for simulated Geography, SMS routing, and Dispatch logic. Discard the old scheduling and insurance tools.

---

### Phase 3: Frontend Scenarios & UI

Per the updated requirements, **we will strictly stick to the current UI design and structure**. There will be no tabs or structural layout pivots.

#### [MODIFY] `packages/frontend/src/app/page.tsx`
- Maintain the exact current dashboard layout. 
- Map the emergency workflow visualization onto the existing UI components.
- The `ReasoningDrawer` will continue to show the live A2A thought process and tasks.
- The main table / timeline components will just ingest the new pre-hospital tasks (e.g. "Hospital Matched", "Ambulance Dispatched") instead of administrative tasks.

#### [MODIFY] `packages/frontend/src/app/components/GodModePanel.tsx`
- Refactor the injection triggers within the existing GodMode panel to start Scenario A (With Internet), Scenario B (Fallback / No Internet), and Scenario C (Replanning).

## Verification Plan

### Automated Tests
- Mock MCP responses for geographical ETAs and ambulance assignments to ensure reproducible demo state.

### Manual Verification
- Test "Scenario A" via GodMode trigger to verify that the Orchestrator successfully spins up the `incident -> triage -> match -> dispatch -> handover` pipeline and renders properly on the existing frontend UI.
