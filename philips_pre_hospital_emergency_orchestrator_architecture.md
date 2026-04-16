# Philips Pre-Hospital Emergency Orchestrator

## 1. Executive Summary

**Philips Pre-Hospital Emergency Orchestrator** is a multi-agent emergency workflow platform that converts a chaotic real-world emergency into a structured, hospital-ready response pipeline.

Instead of behaving like a basic SOS feature that only triggers a call or sends a location, the system uses:
- **A2A (Agent-to-Agent)** for dynamic collaboration among specialist agents
- **MCP (Model Context Protocol)** for tool access and execution
- **Dynamic planning** instead of hardcoded step-by-step flows
- **Fallback relay mode** so the workflow can continue even when the victim device has no internet

The system is designed as a **pre-hospital care orchestration layer** that bridges the gap between incident detection and hospital readiness.

---

## 2. Problem Statement

Current emergency systems are fragmented.

Typical systems may:
- detect a crash
- call emergency services
- send location to contacts
- notify a family member

But they usually do **not**:
- interpret the victim’s situation into structured clinical context
- choose the best-fit hospital based on need and capability
- coordinate ambulance, hospital, and family in one workflow
- prepare the hospital before the patient arrives
- adapt the workflow dynamically as the situation changes
- continue operating when the victim has no internet

This creates delays, poor hospital preparation, and broken coordination during the most critical minutes.

---

## 3. Proposed Solution

Build an **agentic emergency response workflow system** that:
1. Collects emergency input from the victim through trigger, voice, optional image, and location.
2. Uses specialized agents to analyze severity, triage the situation, match the right hospital, coordinate dispatch, notify relatives, and prepare hospital handover.
3. Uses non-hardcoded planning so the workflow changes depending on severity, confidence, network availability, hospital availability, and location.
4. Supports a **Distributed Emergency Relay Mode** where a trusted relative’s device can continue the workflow if the victim has no internet.

---

## 4. Philips Alignment

This idea aligns with Philips in a practical way because Philips is strong in:
- patient monitoring
- connected care
- care-pathway orchestration
- clinical informatics
- hospital workflow optimization

This project does **not** position Philips as a generic consumer SOS app provider.
It positions Philips as the provider of an **intelligent pre-hospital to hospital workflow layer** that extends connected care earlier in the patient journey.

**Positioning line:**
> Philips has strong in-hospital and connected-care capabilities. This project extends that intelligence into the pre-hospital response phase.

---

## 5. Product Vision

### One-line Vision
A multi-agent emergency orchestration platform that turns voice, location, and situational signals into autonomous triage, coordination, and hospital readiness before patient arrival.

### Core Value
The system does not stop at “alerting.” It performs **orchestration**.

### What Makes It Different
- dynamic task planning
- multi-agent collaboration
- hospital readiness before arrival
- capability-aware hospital selection
- degraded-mode fallback through relatives’ devices

---

## 6. Goals and Non-Goals

### Goals
- Build a visible, end-to-end emergency workflow demo
- Show real A2A coordination between specialist agents
- Show MCP-based tool execution instead of hardcoded integrations
- Show hospital pre-alert and readiness workflow
- Show internet-loss fallback workflow via SMS relay

### Non-Goals
- replace licensed emergency operators
- provide clinical diagnosis
- integrate with real hospital production systems in the POC
- guarantee medical correctness beyond safe guidance rules

---

## 7. High-Level System Architecture

```text
+---------------------------------------------------------------+
|                        User / Victim Device                   |
|---------------------------------------------------------------|
| Emergency Trigger | Voice Input | Optional Image | GPS        |
+-----------------------------|---------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|                  Emergency Intake & Session Layer             |
|---------------------------------------------------------------|
| Session Manager | Incident Packet Builder | Connectivity Check |
+-----------------------------|---------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|                    Emergency Orchestrator Agent               |
|---------------------------------------------------------------|
| Dynamic Planner | Task Graph | Replanning Engine | Policy Gate|
+---------|-------------------|-------------------|-------------+
          |                   |                   |
          v                   v                   v
+----------------+  +----------------+  +----------------------+
| Incident Agent |  | Triage Agent   |  | Hospital Match Agent |
+----------------+  +----------------+  +----------------------+
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
+---------------------------------------------------------------+
|      Dispatch Agent | Contact Agent | Guidance Agent         |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|                    Hospital Handover Agent                    |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|                    MCP Tool & Integration Layer               |
|---------------------------------------------------------------|
| STT | Image Analysis | Maps | Hospital DB | SMS | Call | etc. |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|       External Systems / Simulated POC Connectors            |
|---------------------------------------------------------------|
| Hospital Directory | Ambulance Fleet | Contacts | Maps        |
+---------------------------------------------------------------+
```

---

## 8. Core Architectural Principles

### 8.1 Event-Driven
The system reacts to events:
- emergency triggered
- voice transcription complete
- triage updated
- network lost
- dispatch confirmed
- ETA changed
- hospital accepted

### 8.2 Dynamic Planning
The workflow is generated from context, not fixed `if-else` chains.
The orchestrator chooses which agents to invoke and in what order based on runtime signals.

### 8.3 Safety-Gated Autonomy
High-risk actions must pass policy checks.
Examples:
- auto-notify family: allowed
- auto-send structured hospital handover: allowed
- definitive medical instruction: restricted to safe approved guidance only

### 8.4 Graceful Degradation
The platform remains useful with poor or no internet by switching to fallback transport methods.

### 8.5 Explainability
Each agent should emit:
- what it received
- what it concluded
- confidence level
- why it took an action

---

## 9. Agent Architecture

## 9.1 Emergency Orchestrator Agent
### Purpose
Central planner and workflow controller.

### Responsibilities
- receive incident packet
- create initial task plan
- delegate tasks to specialist agents
- collect results
- replan when new information arrives
- enforce policy gates

### Inputs
- incident packet
- connectivity state
- outputs from specialist agents
- external acknowledgements

### Outputs
- dynamic task graph
- agent task requests
- session state updates

### Why it exists
Without this agent, the system becomes a hardcoded pipeline instead of a real multi-agent workflow.

---

## 9.2 Incident Understanding Agent
### Purpose
Convert raw victim input into structured incident facts.

### Inputs
- voice transcript
- optional image
- GPS location
- device metadata
- trigger type

### Outputs
- incident category
- extracted symptoms
- likely injury indicators
- confidence score
- structured incident summary

### Example Output
```json
{
  "incident_type": "road_traffic_accident",
  "injury_markers": ["leg_bleeding", "cannot_stand", "conscious"],
  "confidence": 0.86,
  "summary": "Possible road traffic trauma with active bleeding and mobility impairment"
}
```

---

## 9.3 Triage Agent
### Purpose
Map the incident facts to a structured triage profile.

### Inputs
- structured incident summary
- image findings if available
- user state (responsive/unresponsive)

### Outputs
- urgency level
- ambulance necessity
- probable trauma class
- safe immediate guidance class
- escalation priority

### Example Output
```json
{
  "urgency": "high",
  "ambulance_required": true,
  "probable_case": "trauma_bleeding",
  "guidance_class": "bleeding_control_safe",
  "escalation_priority": "critical"
}
```

---

## 9.4 Hospital Matching Agent
### Purpose
Select the most suitable hospital, not just the nearest one.

### Inputs
- triage profile
- location
- hospital capability data
- travel time
- load/availability

### Outputs
- ranked hospital list
- top match
- selection rationale

### Decision Factors
- trauma capability
- emergency bed status
- estimated arrival time
- specialty availability
- current load

---

## 9.5 Dispatch Coordination Agent
### Purpose
Coordinate the response path from field to hospital.

### Inputs
- urgency
- location
- chosen hospital
- connectivity state

### Outputs
- dispatch request
- ambulance assignment
- ETA updates
- route recommendations

### Actions
- request ambulance dispatch
- update ETA
- notify handover agent of delay changes

---

## 9.6 Relative / Emergency Contact Agent
### Purpose
Notify trusted contacts and, in fallback mode, activate a relay device.

### Inputs
- victim profile
- contact list
- incident state
- fallback mode state

### Outputs
- SMS sent
- notification status
- relay acknowledgment state

### Special Role in Fallback Mode
If victim device lacks internet, the agent sends a structured SMS packet to trusted contacts.
A relative’s device can continue the cloud-side workflow.

---

## 9.7 Guidance Agent
### Purpose
Provide safe, approved, non-diagnostic immediate instructions.

### Inputs
- guidance class
- victim state
- agent confidence

### Outputs
- short safe instruction set
- text + voice guidance

### Example Guidance
- apply pressure to visible wound
- stay still if severe pain or possible fracture
- do not remove helmet after road accident unless necessary for breathing

---

## 9.8 Hospital Handover Agent
### Purpose
Prepare the hospital before patient arrival.

### Inputs
- triage profile
- dispatch ETA
- chosen hospital
- structured summary

### Outputs
- pre-arrival case packet
- department recommendation
- prep suggestion list

### Why this matters
This is one of the strongest differentiators of the platform.
The hospital receives a structured case context before arrival instead of a vague “accident case coming.”

---

## 9.9 Audit & Safety Agent
### Purpose
Track decisions, enforce policy, and ensure explainability.

### Inputs
- all task decisions
- confidence values
- action requests

### Outputs
- policy approvals or denials
- logs
- escalation flags

### Role
This agent prevents unsafe or unjustified automation and makes the demo defensible.

---

## 10. Agent-to-Agent (A2A) Connections

### Primary A2A Flow
```text                                                                                   
Orchestrator -> Incident Understanding Agent                                                             
Orchestrator -> Triage Agent
Orchestrator -> Hospital Matching Agent
Orchestrator -> Dispatch Coordination Agent
Orchestrator -> Relative Contact Agent
Orchestrator -> Guidance Agent
Orchestrator -> Hospital Handover Agent
Orchestrator -> Audit & Safety Agent
```

### Secondary A2A Collaboration
```text
Incident Understanding Agent -> Triage Agent
Triage Agent -> Hospital Matching Agent                                                       
Hospital Matching Agent -> Dispatch Coordination Agent
Dispatch Coordination Agent -> Hospital Handover Agent                                      
Relative Contact Agent -> Orchestrator (relay acknowledgement)
Audit & Safety Agent -> Orchestrator (policy decision)
```

### A2A Design Principle
Each agent should be independently responsible for one domain-specific decision surface.      
Do not make one giant “smart agent” that does everything.
That defeats the point of A2A.

---

## 11. MCP Layer Design

The MCP layer exposes tools to agents in a standardized, non-hardcoded way.
Each agent asks for tool execution through MCP instead of embedding direct API logic inside its own code.

## 11.1 MCP Servers / Tool Groups

### A. Communication MCP Server
**Purpose:** messaging and calling

**Tools:**
- `send_sms(contact, message)`
- `place_call(number, script)`
- `send_push(contact, payload)`
- `send_voice_alert(contact, message)`

**Used by:**
- Relative Contact Agent
- Dispatch Agent
- Guidance Agent

---

### B. Geolocation & Maps MCP Server
**Purpose:** location and route reasoning

**Tools:**
- `get_current_location(session_id)`
- `get_last_known_location(session_id)`
- `estimate_eta(source, destination)`
- `get_route(source, destination)`
- `get_location_accuracy(session_id)`

**Used by:**
- Incident Agent
- Hospital Matching Agent
- Dispatch Agent

---

### C. Speech & Media MCP Server
**Purpose:** process voice and image input

**Tools:**
- `speech_to_text(audio_blob)`
- `extract_keywords(text)`
- `analyze_emergency_image(image_blob)`
- `summarize_victim_statement(text)`

**Used by:**
- Incident Understanding Agent

---

### D. Triage Knowledge MCP Server
**Purpose:** structured emergency triage assistance

**Tools:**
- `classify_incident(summary)`
- `compute_urgency(incident_facts)`
- `safe_guidance_for(case_type)`
- `needs_ambulance(incident_facts)`

**Used by:**
- Triage Agent
- Guidance Agent

---

### E. Hospital Capability MCP Server
**Purpose:** hospital discovery and matching

**Tools:**
- `search_nearby_hospitals(location)`
- `get_hospital_capabilities(hospital_id)`
- `get_current_load(hospital_id)`
- `rank_hospitals(case_profile, location)`

**Used by:**
- Hospital Matching Agent
- Hospital Handover Agent

---

### F. Dispatch Simulation MCP Server
**Purpose:** emergency vehicle assignment for the POC

**Tools:**
- `request_ambulance(location, priority)`
- `assign_vehicle(request_id)`
- `get_vehicle_eta(vehicle_id, location)`
- `update_dispatch_status(request_id)`

**Used by:**
- Dispatch Coordination Agent

---

### G. Contact & Identity MCP Server
**Purpose:** trusted contact retrieval and validation

**Tools:**
- `get_emergency_contacts(user_id)`
- `validate_trusted_contact(contact_id)`
- `resolve_contact_preferences(contact_id)`

**Used by:**
- Relative Contact Agent

---

### H. Hospital Intake MCP Server
**Purpose:** send pre-arrival handover packet

**Tools:**
- `build_case_packet(case_state)`
- `send_prearrival_alert(hospital_id, packet)`
- `confirm_handover_receipt(hospital_id, packet_id)`

**Used by:**
- Hospital Handover Agent

---

### I. Policy & Audit MCP Server
**Purpose:** guardrails and explainability

**Tools:**
- `check_action_policy(action, context)`
- `log_agent_decision(agent, decision)`
- `escalate_to_human_if_needed(context)`

**Used by:**
- Audit & Safety Agent
- Orchestrator Agent

---

## 12. Data Model

## 12.1 Incident Packet
This is the first structured object created after trigger.

```json
{
  "session_id": "sess_001",
  "user_id": "user_123",
  "trigger_type": "button_press",
  "timestamp": "2026-04-16T12:10:00Z",
  "location": {
    "lat": 12.9716,
    "lon": 77.5946,
    "accuracy_m": 20,
    "source": "gps"
  },
  "connectivity": {
    "internet": false,
    "sms": true,
    "battery": 18
  },
  "voice_text": "I got hit by a car. My leg is bleeding. I cannot stand.",
  "image_present": true
}
```

## 12.2 Triage Profile
```json
{
  "urgency": "high",
  "ambulance_required": true,
  "probable_case": "trauma_bleeding",
  "victim_state": "conscious",
  "guidance_class": "bleeding_control_safe"
}
```

## 12.3 Hospital Match Result
```json
{
  "selected_hospital": "hospital_07",
  "reason": ["trauma_capable", "eta_12_min", "load_moderate"],
  "alternatives": ["hospital_03", "hospital_11"]
}
```

## 12.4 Relay SMS Packet
```json
{
  "type": "relay_sms_packet",
  "session_id": "sess_001",
  "user_token": "AX92",
  "timestamp": "2026-04-16T12:10:20Z",
  "lat": 12.9716,
  "lon": 77.5946,
  "incident_type": "road_traffic_accident",
  "severity": "high",
  "summary": "bleeding leg, conscious, cannot stand",
  "verification_code": "5812"
}
```

---

## 13. Connectivity and Fallback Architecture

## 13.1 Normal Mode
Victim has internet.

Flow:
1. emergency triggered
2. incident packet uploaded
3. orchestrator runs in cloud/backend
4. agents coordinate normally
5. hospital and dispatch workflows execute

## 13.2 Distributed Emergency Relay Mode
Victim has **no internet** but can send SMS.

Flow:
1. victim device detects internet unavailable
2. fallback communication module builds compact relay SMS packet
3. trusted relative receives SMS
4. relative device opens companion app or link
5. relative device authenticates relay session
6. cloud orchestration continues using relative’s connectivity
7. victim device rejoins if internet returns later

### Why this matters
This makes the project materially stronger because it does not collapse under poor connectivity.

## 13.3 Delayed Sync Mode
Victim has no internet and no SMS temporarily.

Flow:
1. incident packet stored locally
2. system retries transport periodically
3. once signal returns, packet is sent

## 13.4 Relay Device Rules
The relative device is a **network relay and workflow continuation node**, not an unrestricted controller.

Rules:
- only trusted contacts can activate relay mode
- critical actions may require confirmation
- relay actions are logged
- victim device can reclaim primary control when reconnected

---

## 14. Detailed Workflow Scenarios

## 14.1 Scenario A: Severe Road Accident with Internet
1. victim presses emergency trigger
2. voice captured
3. Incident Agent extracts road trauma + bleeding + conscious
4. Triage Agent marks urgency high and ambulance required
5. Hospital Matching Agent chooses trauma-capable hospital
6. Dispatch Agent requests ambulance and computes ETA
7. Guidance Agent tells victim to apply pressure to wound and stay still
8. Relative Agent notifies emergency contact
9. Hospital Handover Agent sends pre-arrival packet
10. timeline updates until arrival

## 14.2 Scenario B: Severe Road Accident without Internet
1. victim presses emergency trigger
2. no internet detected
3. fallback packet built
4. SMS sent to trusted relative
5. relative device opens relay session
6. orchestrator reconstructs case using SMS packet + relative-side internet
7. hospital match and dispatch continue
8. hospital pre-alert sent

## 14.3 Scenario C: Lower Severity Incident
1. victim reports fall and pain but no major bleeding
2. Triage Agent computes medium urgency
3. Hospital Matching Agent suggests nearby urgent care instead of trauma center
4. relative notified at lower priority
5. self-care guidance shown
6. no ambulance auto-request in demo mode

---

## 15. Replanning Logic

The orchestrator should change the workflow when context changes.

### Triggers for replanning
- severity upgraded
- hospital rejected or overloaded
- network lost or restored
- ETA delay increased
- contact acknowledged relay mode
- location updated significantly

### Example
Initial plan:
- hospital A selected
- ETA 10 min

New event:
- hospital A unavailable

Replanned output:
- hospital B selected
- dispatch route updated
- handover packet redirected
- family notified of updated destination

This is essential to proving non-hardcoded behavior.

---

## 16. Frontend Architecture

## 16.1 Victim App / PWA
### Screens
- emergency trigger screen
- voice recording and confirmation screen
- live status screen
- map + ETA view
- offline / fallback status view

### Key UI Elements
- large emergency button
- “listening” state
- short incident summary
- live workflow status
- guidance card

## 16.2 Judge / Command Center Dashboard
### Panels
- live incident map
- timeline of workflow actions
- agent cards showing inputs and outputs
- hospital selection panel
- dispatch panel
- contact notification panel

This dashboard is crucial for demo clarity.

## 16.3 Hospital Intake Dashboard
### Panels
- patient case summary
- probable severity
- ETA
- recommended preparation
- acknowledgement control

---

## 17. Backend / Service Architecture

## 17.1 Suggested Stack
### Frontend
- Next.js
- React
- Tailwind CSS
- WebSocket client for live updates

### Backend
- Node.js + TypeScript for orchestrator and APIs
- Python microservice optional for advanced voice/image classification

### Data / State
- PostgreSQL for session state and logs
- Redis optional for realtime session coordination

### Realtime
- WebSockets / Socket.IO

### MCP
- Local or containerized MCP servers for all tool groups

### A2A
- Independent agent services or modular isolated agent runtimes communicating through internal messages/events

---

## 18. Logical Service Breakdown

```text
Frontend (Victim App / Dashboard / Hospital View)
        |
        v
API Gateway / Session Manager
        |
        v
Emergency Orchestrator Service
        |
        +--> Incident Agent Service
        +--> Triage Agent Service
        +--> Hospital Match Agent Service
        +--> Dispatch Agent Service
        +--> Contact Agent Service
        +--> Guidance Agent Service
        +--> Handover Agent Service
        +--> Audit Agent Service
                |
                v
            MCP Servers
                |
                v
        Simulated External Services / Mock Data
```

---

## 19. Security and Trust Model

### Trust Assumptions
- victim registered trusted contacts earlier
- contact relay activation requires verification
- hospital dashboard in POC is simulated and authenticated

### Basic Security Controls
- session tokenization
- signed relay packets
- one-time verification code for relay activation
- audit logs for every outbound action
- role-based UI access

### Privacy Controls
- send minimum necessary data over SMS
- do not send full diagnosis over fallback channels
- mask sensitive details where unnecessary

---

## 20. Safety Constraints

This system must avoid overclaiming.

### Safe Claims
- workflow orchestration
- structured triage assistance
- guidance from approved safe response templates
- handover preparation

### Unsafe Claims to Avoid
- definitive diagnosis
- autonomous replacement of emergency professionals
- guaranteed medical correctness
- production readiness without validation

---

## 21. POC Scope Recommendation

Do not try to build a real national emergency platform.
That is unrealistic and unnecessary.

### What to Build
- 1 victim trigger app
- 1 command center dashboard
- 1 hospital intake dashboard
- 6 to 8 agents
- 5 to 8 MCP tool groups
- 3 scenarios
- simulated dispatch + hospital datasets

### What to Simulate
- hospital capability directory
- ambulance fleet
- contact registry
- ETA service
- pre-arrival hospital acceptance

---

## 22. Demo Script Outline

### Demo 1: Internet Available
- user triggers emergency
- voice says accident details
- agents analyze and triage
- best hospital chosen
- ambulance assigned
- family notified
- hospital prep alert shown

### Demo 2: No Internet on Victim Device
- no internet detected
- fallback SMS packet sent
- relative device receives alert
- relay session activated
- workflow continues from relative device
- hospital and dispatch still coordinated

### Demo 3: Replanning
- initial hospital selected
- hospital becomes unavailable
- orchestrator replans and redirects handover

---

## 23. Why This Idea Can Score Well

### Strengths
- emotionally important use case
- clear need for orchestration
- excellent fit for A2A + MCP concepts
- visible, dramatic demo
- strong fallback novelty
- credible Philips alignment if framed as pre-hospital workflow intelligence

### Weaknesses
- real-world deployment complexity
- hospital integration challenge
- legal and safety concerns
- risk of appearing like a generic SOS app if pitched poorly

### How to Win
Emphasize:
- orchestration, not just alerting
- dynamic planning, not static flows
- hospital readiness, not just family notification
- degraded-mode resilience, not internet-only dependency

---

## 24. Future Enhancements

- wearable integration for automatic triggers
- vehicle telematics integration
- multilingual guidance and translation
- responder-side live video stream
- Philips patient monitoring linkage after admission
- AI confidence calibration from historical cases
- operator copilot mode for call center staff

---

## 25. Final Positioning Statement

**Philips Pre-Hospital Emergency Orchestrator** is not another emergency button app.
It is an **agentic workflow platform** that transforms fragmented emergency actions into a coordinated, explainable, and hospital-ready response pipeline.

Its strongest technical differentiators are:
- A2A-driven specialist collaboration
- MCP-based non-hardcoded tool execution
- dynamic replanning under changing conditions
- relay-mode continuity when the victim has no internet
- structured pre-arrival hospital preparation

That is the actual project.
