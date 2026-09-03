# EchoSphere — Real-Time Agora Conversational AI Incident Commander

An authentic, real-time Voice AI Incident Commander prototype built with **Agora RTC** and the official **Agora Conversational AI Agent REST API v2**.

---

## Architecture Flow

```
[ Browser (User Mic) ] 
       │ (agora-rtc-sdk-ng)
       ▼
[ Agora RTC Channel: incident-pay-2048 ]
       ▲
       │ (Subscribes / Publishes Native Voice Audio)
       ▼
[ Agora Conversational AI Agent (Cloud Worker) ]
       │ ──> [ Agora ASR (Speech-to-Text) ]
       │ ──> [ Agora-managed LLM (Incident Commander System Prompt) ]
       │ ──> [ Agora TTS (Speech Generation) ]
       ▼
[ Audio Broadcast back to Agora RTC Channel ] ──> [ Browser Speakers (Remote Audio Track) ]
```

---

## 1. Required Credentials (Agora Console)

To enable the real Agora Conversational AI voice agent, you need 4 credentials in `backend/.env`:

| Credential | Where to get it from Agora Console | Purpose |
| :--- | :--- | :--- |
| **`AGORA_APP_ID`** | [Agora Console > Project Management](https://console.agora.io/projects) | Authenticates RTC voice channel |
| **`AGORA_APP_CERTIFICATE`** | [Agora Console > Project Management](https://console.agora.io/projects) (Click Edit on project) | Used by backend to generate secure RTC tokens |
| **`AGORA_CUSTOMER_ID`** | [Agora Console > RESTful API](https://console.agora.io/restfulApi) (Click Add Secret / Key) | HTTP Basic Auth username for Conversational AI REST API |
| **`AGORA_CUSTOMER_SECRET`** | [Agora Console > RESTful API](https://console.agora.io/restfulApi) | HTTP Basic Auth password for Conversational AI REST API |

---

## 2. Setup & Installation

### Backend (Python + FastAPI)

1. Open a terminal in `/backend`:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure `.env`:
   ```env
   AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_app_certificate
   AGORA_CUSTOMER_ID=your_agora_customer_id
   AGORA_CUSTOMER_SECRET=your_agora_customer_secret
   AGORA_CHANNEL_NAME=incident-pay-2048
   AGORA_AGENT_RTC_UID=9999
   ```

5. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will be running at `http://localhost:8000`.*

---

### Frontend (React + Vite)

1. Open a terminal in `/frontend`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will open at `http://localhost:5173`.*

---

## 3. How to Test the Agora AI Agent (Verification Steps)

1. **Open the Web UI** (`http://localhost:5173`).
2. **Verify Credentials**: Click **"Credentials"** in the top-right header to ensure your `App ID`, `Certificate`, `Customer ID`, and `Customer Secret` are set.
3. **Join Voice Room**: Click **"Join Agora Room"**.
   - The browser requests microphone permission and connects to Agora RTC.
   - The connection pill turns **"Agora RTC Connected"**.
4. **Deploy the Cloud AI Agent**: Click **"Start Agora AI Agent"**.
   - The backend calls Agora's Conversational AI REST API (`/v2/projects/{appid}/join`).
   - The AI Agent bot joins the channel with UID `9999`.
   - The status changes to **"Agora AI Agent Live"**.
5. **Speak to the AI**:
   - Speak through your microphone: *"Echo Commander, what is the status of the payment service outage?"*
   - The Agora Conversational AI Agent processes the audio stream via Agora ASR, reasons with the Incident Commander prompt, and speaks back directly through the Agora RTC remote audio track.
6. **Stop Agent / Leave**: Click **"Stop Agora AI Agent"** and **"Leave Room"**.

---

## 4. API Reference

- `GET /api/health`: Validates server and Agora credentials configuration.
- `POST /api/agora/token`: Generates an RTC token for a given user UID and channel name.
- `POST /api/agora/agent/start`: Launches cloud Conversational AI Agent into the channel.
- `POST /api/agora/agent/stop`: Disconnects cloud Conversational AI Agent from the channel.
- `GET /api/agora/agent/status`: Returns current agent status and runtime details.
- `POST /api/settings`: Updates Agora credentials dynamically.
