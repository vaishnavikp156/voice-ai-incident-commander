# EchoSphere — Real-Time Voice AI Incident Commander

EchoSphere is an authentic, real-time Voice AI Incident Commander built with **Agora RTC** and the official **Agora Conversational AI Agent REST API**. EchoSphere joins an incident voice room directly as an active voice participant, listens to distributed responders in real time, structures high-tempo incident dialogue into actionable intelligence categories, and maintains alignment across the incident response team while keeping human engineers in full control of all critical decisions.

---

## 1. Project Overview

During major production incidents, engineering teams communicate via live voice channels while juggling monitoring dashboards, alerts, and chat rooms. Critical updates, hypotheses, and action items get buried in conversational noise.

**EchoSphere** solves this by embedding an AI Incident Commander directly inside the live **Agora RTC voice room**. The AI listens to the spoken stream across multiple responders, extracts structured incident intelligence in real time, and populates a synchronized incident workspace. By acting as a real-time voice participant rather than an external text bot, EchoSphere facilitates rapid triage, eliminates duplicate effort, flags contradictory data, and ensures every responder shares an up-to-date operating picture.

---

## 2. Problem

Modern incident management suffers from significant cognitive overload:

- **Fragmented Information:** Incident data is scattered across voice bridges, chat channels, alert streams, and telemetry dashboards.
- **Ambiguity and Confusion:** Unverified theories, established facts, assigned tasks, and conflicting observations blend together during verbal discussions.
- **Coordination Delays:** Teams waste valuable time repeatedly summarizing current status, clarifying action ownership, and reconciling conflicting reports.
- **Lack of Persistent Record:** Verbal decisions and assigned action items made on voice bridges are frequently lost or unrecorded until post-incident reviews.

---

## 3. Solution

EchoSphere introduces an AI-powered voice co-pilot that participates directly in the incident triage room:

- **Joins the Voice Room:** Connects directly into the Agora RTC channel alongside human engineers.
- **Multi-Party Audio Comprehension:** Listens to all human responders simultaneously on the voice bridge.
- **Spoken Dialogue Understanding:** Understands operational terminology, system components, and diagnostic findings spoken during the call.
- **Structured Intelligence Extraction:** Automatically categorizes spoken content into structured incident categories.
- **Action & Owner Tracking:** Identifies tasks, extracts assigned owners, and tracks execution status.
- **Conflict Highlighting:** Detects contradictory statements between responders or monitoring metrics before misguided actions occur.
- **Shared Incident Timeline:** Maintains an immutable, timestamped incident timeline and live conversation record.
- **Human-in-the-Loop Control:** Provides decision support without ever autonomously executing critical actions on production systems.

---

## 4. Key Features

- **Real-Time Agora Voice Communication:** Low-latency, crystal-clear bidirectional audio powered by the Agora RTC Web SDK (`agora-rtc-sdk-ng`).
- **Conversational AI Agent:** Cloud-hosted Agora Conversational AI Agent that listens, reasons, and speaks back into the RTC channel as an active participant.
- **Multi-Person Incident Rooms:** Dynamic room creation with unique incident codes, enabling distributed teams to collaborate in isolated channels.
- **Incident Codes & Room Sharing:** Instant 6-character incident codes (e.g., `PAY-2048`) for one-click team onboarding.
- **Participant Profiles & Roles:** Track active responders by name and specialized role (e.g., Incident Commander, Database Lead, SRE Lead).
- **Shared AI Incident Intelligence:** Automatic real-time classification into 5 distinct intelligence pillars:
  - **FACT:** Verified, observed facts and system measurements.
  - **HYPOTHESIS:** Unconfirmed theories and potential root causes.
  - **DECISION:** Explicit consensus and approved operational directions.
  - **ACTION:** Assigned mitigation tasks with designated owners and pending/complete status.
  - **CONFLICT:** Discrepancies and contradictory reports requiring human verification.
- **Live Incident Timeline:** Chronological event feed capturing intelligence items and status updates as they occur.
- **Spoken Conversation Transcript:** Complete, speaker-tagged transcript of all spoken dialogue within the incident room.
- **Interactive Action Management:** One-click UI controls to mark action items as completed, automatically synchronizing with the room timeline.
- **Incident Data Persistence:** Persistent local JSON storage (`incident_data.json`) ensuring notes, intelligence, and timelines survive browser refreshes.
- **Agent Lifecycle Management:** Full lifecycle control to start, stop, and restart the AI agent at any time without resetting room state or intelligence.
- **Theme Support:** Polished Dark and Light mode interface designed for high-focus operational environments.
- **Developer Diagnostics:** Expandable developer diagnostic drawer providing real-time visibility into Agora RTC states, agent session IDs, and API telemetry without cluttering the primary incident board.

---

## 5. Incident Intelligence

EchoSphere classifies spoken dialogue into 5 core intelligence categories:

| Category | Description | Example |
| :--- | :--- | :--- |
| **FACT** | Verified or directly observed system state, metrics, and event confirmations. | *"The payment database CPU is pinned at 100%."* |
| **HYPOTHESIS** | Speculative root-cause theories or unverified explanations requiring investigation. | *"I suspect the latest schema migration caused lock contention."* |
| **DECISION** | Formally agreed mitigation strategies, policy calls, or operational pivots. | *"We are initiating a production deployment freeze immediately."* |
| **ACTION** | Explicit task assigned to a designated role or engineer with active tracking. | *"SRE team will scale the connection pool replicas (Owner: SRE)."* |
| **CONFLICT** | Contradictory information or conflicting metric reports requiring team reconciliation. | *"DBA reports 0 active connections, but API gateway reports pool exhaustion."* |

---

## 6. How Agora Is Used

Agora provides the foundational real-time communication and conversational AI infrastructure for EchoSphere:

1. **Agora RTC Real-Time Voice Bridge:**
   - Responders join an Agora RTC voice channel from their web browsers using the `agora-rtc-sdk-ng` client.
   - Microphones capture and publish live participant audio directly to the Agora software-defined real-time network (SD-RTN).

2. **Agora Conversational AI Agent:**
   - The backend utilizes the **Agora Conversational AI Agent REST API v2** (`/v2/projects/{appid}/join`) to deploy a cloud AI agent worker into the exact same RTC channel.
   - The AI agent joins with a dedicated RTC UID (`9999`) as an active peer on the audio bridge.

3. **Multi-Party Listening & Voice Response:**
   - The AI agent subscribes to all human audio streams in the channel, transcribes spoken dialogue via real-time speech recognition (ASR), and processes the context with an incident commander system prompt.
   - The agent synthesizes speech (TTS) and publishes native audio back into the Agora RTC channel, allowing responders to hear the AI commander directly in their headsets.

4. **Agent Lifecycle Management:**
   - The FastAPI backend interacts directly with Agora's RESTful API endpoints to initiate (`join`), disconnect (`leave`), and inspect the conversational agent's real-time status and conversational turn history.

5. **Active Participant Paradigm:**
   - Rather than functioning as a passive text chatbot on the periphery, Agora enables the AI to be an active, audible participant on the voice bridge, reducing context switching during high-stakes outages.

---

## 7. Architecture

```
+-------------------------------------------------------------------------------+
|                               Human Responders                                |
|          [ Incident Commander ]      [ SRE Lead ]      [ Database DBA ]       |
+-------------------------------------------------------------------------------+
                                      |
                                      | Voice Audio (agora-rtc-sdk-ng)
                                      v
+-------------------------------------------------------------------------------+
|                       Agora RTC Channel (SD-RTN Bridge)                       |
|                          (e.g., incident-pay-2048)                            |
+-------------------------------------------------------------------------------+
           |                                                       |
           | Subscribes / Mixes Voice                              | Subscribes / Publishes
           v                                                       v
+-----------------------------+         +---------------------------------------+
|     Human Participants      |         |     Agora Conversational AI Agent     |
|   (Browser Speakers/Audio)  |         |      (Dedicated RTC Peer UID 9999)    |
+-----------------------------+         +---------------------------------------+
                                                           |
                                                           v
                                        +---------------------------------------+
                                        |    Speech & Intelligence Pipeline     |
                                        |   - Agora ASR (Speech Recognition)    |
                                        |   - Contextual Incident Prompt        |
                                        |   - Agora TTS (Audio Synthesis)       |
                                        |   - Intelligence Classification Engine|
                                        +---------------------------------------+
                                                           |
                                                           v
                                        +---------------------------------------+
                                        |     Structured Incident Intel         |
                                        | +-----------------------------------+ |
                                        | | FACT | HYPOTHESIS | DECISION      | |
                                        | | ACTION (Owner & Status) | CONFLICT| |
                                        | +-----------------------------------+ |
                                        +---------------------------------------+
                                                           |
                                                           v
+-------------------------------------------------------------------------------+
|                          Shared Incident Web UI                               |
|   - Real-Time Intelligence Board    - Live Action Item Tracking               |
|   - Synchronized Timeline Feed      - Complete Conversation Transcript        |
|   - Room / Participant Metadata     - Developer Diagnostics Drawer            |
+-------------------------------------------------------------------------------+
```

---

## 8. Tech Stack

### Frontend
- **React 19:** Modern component-based user interface.
- **Vite 6:** Fast frontend build tooling and development server.
- **JavaScript (ES Modules):** Application logic and state management.
- **Vanilla CSS:** Modular styling with dark/light mode themes and responsive layouts.
- **Lucide React:** Clean icon set for operational dashboards.
- **Agora RTC Web SDK (`agora-rtc-sdk-ng` v4.24.8):** Browser-side real-time voice streaming.

### Backend
- **Python 3.13 / FastAPI:** High-performance asynchronous API backend.
- **Uvicorn:** ASGI web server.
- **HTTPX:** Async HTTP client for communicating with Agora REST APIs.
- **Pydantic v2:** Robust request validation and data modeling.
- **Python-Dotenv:** Environment configuration management.
- **Official Agora Token Builder (`agora_token.py` / `agora-token-builder`):** Secure dynamic RTC token generation.

### Agora Cloud Services
- **Agora Real-Time Communication (RTC):** Low-latency multi-party voice channel.
- **Agora Conversational AI Agent REST API v2:** Cloud agent deployment, real-time speech-to-text, LLM orchestration, and text-to-speech synthesis.

---

## 9. Project Structure

```
voice-ai-incident-commander/
├── README.md                           # Project documentation & submission details
├── .gitignore                          # Git ignore rules (.env, node_modules, etc.)
│
├── backend/                            # FastAPI Python Backend
│   ├── main.py                         # Application entrypoint & REST API endpoints
│   ├── agora_convo_ai.py               # Agora agent manager & intelligence classification
│   ├── agora_token.py                  # Agora RTC token generator
│   ├── requirements.txt                # Python backend dependencies
│   ├── incident_data.json              # Persistent incident records, notes & timeline
│   ├── .env.example                    # Template for environment configuration
│   └── .env                            # Local configuration (never committed)
│
└── frontend/                           # React + Vite Frontend
    ├── index.html                      # HTML template
    ├── package.json                    # Frontend dependencies & scripts
    ├── vite.config.js                  # Vite configuration
    └── src/
        ├── main.jsx                    # React entrypoint
        ├── App.jsx                     # Core application container & layout
        ├── App.css                     # Primary styles, themes, and animations
        ├── index.css                   # Global styles and resets
        ├── components/
        │   ├── AgentControls.jsx       # Start / Stop / Status AI agent controls
        │   ├── ConnectionStatePill.jsx # Agora RTC & Agent status indicators
        │   ├── ConsoleLogs.jsx         # Collapsible Developer Diagnostics drawer
        │   ├── IncidentIntelligence.jsx# 5-column intelligence board & timeline
        │   ├── JoinRoomModal.jsx       # Modal for creating/joining incident rooms
        │   └── SettingsModal.jsx       # Modal for updating Agora credentials
        └── services/
            ├── agoraService.js         # Agora RTC Web SDK client management
            └── apiService.js           # Frontend REST client for backend APIs
```

---

## 10. Setup & Installation

Follow these instructions to set up and run the project locally. Instructions are provided for **Windows (PowerShell)**, followed by macOS/Linux.

### Prerequisites
- **Node.js:** v18 or newer
- **Python:** v3.10 or newer
- **Agora Developer Account:** With an active project App ID, App Certificate, and RESTful API credentials.

---

### Step 1: Backend Setup

1. Open a terminal and navigate to `backend/`:
   ```powershell
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```powershell
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```powershell
   pip install -r requirements.txt
   ```

4. Create your `.env` configuration file from `.env.example`:
   ```powershell
   # Windows (PowerShell)
   Copy-Item .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

5. Open `backend/.env` in your editor and configure your Agora credentials (see [Section 11: Configuration](#11-configuration)).

6. Start the FastAPI backend server:
   ```powershell
   uvicorn main:app --reload --port 8000
   ```
   *The backend will start at `http://localhost:8000`.*

---

### Step 2: Frontend Setup

1. Open a new terminal and navigate to `frontend/`:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   *The web application will be accessible at `http://localhost:5173`.*

---

## 11. Configuration

Configure the environment variables in `backend/.env`. A template is provided in `backend/.env.example`:

| Environment Variable | Description | Source in Agora Console |
| :--- | :--- | :--- |
| `AGORA_APP_ID` | Your Agora Project App ID | **Agora Console > Project Management** |
| `AGORA_APP_CERTIFICATE` | Primary App Certificate for token generation | **Agora Console > Project Management > Edit Project** |
| `AGORA_CUSTOMER_ID` | RESTful API Customer ID (Basic Auth key) | **Agora Console > RESTful API > Add Secret / Key** |
| `AGORA_CUSTOMER_SECRET` | RESTful API Customer Secret | **Agora Console > RESTful API** |
| `AGORA_CHANNEL_NAME` | Default RTC channel name | Default: `incident-pay-2048` |
| `AGORA_AGENT_RTC_UID` | Dedicated RTC UID for the AI Agent peer | Default: `9999` |
| `HOST` | Backend bind address | Default: `0.0.0.0` |
| `PORT` | Backend port | Default: `8000` |

> [!IMPORTANT]
> Never commit your real `.env` file or Agora secrets to version control. The repository `.gitignore` automatically excludes `backend/.env`.

---

## 12. Running the Application

Here is the standard operational workflow for responders using EchoSphere:

1. **Access the Application:** Open your browser and navigate to `http://localhost:5173`.
2. **Create or Join an Incident:**
   - Click **"New Incident"** to generate a clean incident room with a unique code (e.g., `PAY-2048`), or enter an existing code to join a colleague's room.
   - Enter your name and responder role (e.g., "Jane Doe — Lead SRE").
3. **Connect to the Voice Bridge:**
   - Click **"Join Agora Room"** to connect your browser microphone to the Agora RTC channel.
   - The connection pill updates to **"Agora RTC Connected"**.
4. **Deploy the Voice AI Incident Commander:**
   - Click **"Start AI Agent"** in the commander controls.
   - The backend provisions the cloud Conversational AI worker, which enters the voice room under UID `9999`.
5. **Conduct Live Triage:**
   - Responders speak naturally on the voice bridge discussing symptoms, actions, and theories.
   - The AI responds via real-time audio and updates the structured incident intelligence board automatically.
6. **Track & Complete Action Items:**
   - As tasks are assigned, they appear under the **ACTIONS** column with designated owners.
   - Responders can click **"Mark Complete"** directly on action cards to update status and record completion in the timeline.
7. **Agent Lifecycle Control:**
   - The AI Agent can be stopped or restarted at any time using the control panel without losing extracted intelligence, action items, or timeline records.

---

## 13. Example Incident Demo

The following scenario illustrates how EchoSphere structures real-time spoken incident dialogue:

```
[Spoken Dialogue]
Responder (Lead SRE): "The payment database is down."
└── [EchoSphere Intelligence] ──> FACT: Payment database is down.

[Spoken Dialogue]
Responder (DevOps): "I think the recent v2.4 deployment caused the failure."
└── [EchoSphere Intelligence] ──> HYPOTHESIS: Recent deployment caused the failure.

[Spoken Dialogue]
Responder (Incident Commander): "We will freeze production deployments."
└── [EchoSphere Intelligence] ──> DECISION: Freeze production deployments.

[Spoken Dialogue]
Responder (Incident Commander): "SRE should restart the affected database replicas."
└── [EchoSphere Intelligence] ──> ACTION: Restart affected database replicas
                                  Owner: SRE
                                  Status: Pending

[Spoken Dialogue]
Responder (DBA): "The DBA reports connection timeouts but monitoring shows normal latency."
└── [EchoSphere Intelligence] ──> CONFLICT: Conflicting database health signals.
```

---

## 14. Design Principles

1. **Human-in-the-Loop Authority:**
   EchoSphere is designed as a co-pilot and intelligence synthesizer. It assists human commanders by organizing chaotic information, but never executes critical infrastructure actions or changes autonomously.

2. **Evidence vs. Uncertainty:**
   Clear visual and semantic separation between verified **FACTS** and speculative **HYPOTHESES** prevents teams from making premature decisions based on unverified assumptions.

3. **Real-Time Voice First:**
   Incident response happens on voice bridges. Forcing engineers into text-only chat during critical outages increases response latency; voice-native AI participates where the triage is already happening.

4. **Shared Incident Context:**
   All responders in an incident room share a single synchronized view of facts, decisions, actions, and conflicts, eliminating onboarding lag when new specialists join the call.

5. **Operational Reliability:**
   Decoupled architecture ensures that voice communication, intelligence persistence, and agent lifecycles remain resilient even if individual services experience transient disconnects.

---

## 15. API Reference

All backend endpoints are implemented in `backend/main.py`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Root endpoint returning service status and active incident ID. |
| `GET` | `/api/health` | Health check reporting credential readiness and active room metadata without revealing secrets. |
| `POST` | `/api/agora/token` | Generates a valid Agora RTC token for a given user UID, channel name, and role. |
| `POST` | `/api/agora/agent/start` | Initiates and joins the Agora Conversational AI Agent to the specified channel. |
| `POST` | `/api/agora/agent/stop` | Stops the running Agora Conversational AI Agent while preserving room intelligence. |
| `GET` | `/api/agora/agent/status` | Returns the current running state and session details of the AI Agent. |
| `GET` | `/api/agora/agent/history` | Fetches raw conversational turns and transcript messages from the active agent session. |
| `GET` | `/api/incident/intelligence` | Returns structured intelligence categories (Facts, Hypotheses, Decisions, Actions, Conflicts) and transcripts. |
| `GET` | `/api/incident/current` | Returns a complete snapshot of the current persistent incident record. |
| `GET` | `/api/incident/lookup/{code}` | Looks up incident room metadata by room code or channel name. |
| `POST` | `/api/incident/new` | Initializes a new incident room with a unique room code and clean boards. |
| `POST` | `/api/incident/join` | Registers a responder's presence, display name, and role in an incident room. |
| `POST` | `/api/incident/action/update` | Updates the status of an assigned action item (e.g., marks as Completed). |
| `POST` | `/api/settings` | Updates and persists Agora credentials at runtime. |

---

## 16. Security

- **Credential Isolation:** All Agora API credentials, certificates, and secrets are stored exclusively in the server-side `backend/.env` file.
- **No Secrets in Source Control:** `backend/.env` is excluded via `.gitignore`. Only `backend/.env.example` containing non-functional placeholders is tracked in Git.
- **Dynamic Token Generation:** RTC channels use short-lived Agora RTC tokens generated on-demand by the backend rather than static tokens.
- **Safe Health & Diagnostic APIs:** Diagnostic and health endpoints report boolean configuration flags (`is_configured: true`) without exposing raw secret keys or tokens in responses.

---

## 17. Hackathon Context

**EchoSphere** was developed for the **Agora EchoSphere Hackathon**, competing in the **Voice AI Incident Commander** track.

It demonstrates how Agora's low-latency Real-Time Communication (RTC) and conversational AI agent infrastructure can be applied to high-stakes enterprise workflows—transforming emergency voice bridges into intelligent, structured, and synchronized incident war rooms.
