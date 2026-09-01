/**
 * API & WebSocket Service
 * Communicates with the FastAPI Voice AI Incident Commander backend.
 */

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

class ApiService {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.reconnectTimer = null;
    this.incidentId = "PAY-2048";
  }

  // REST API Methods
  async getIncident(incidentId = "PAY-2048") {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${incidentId}`);
      if (!res.ok) throw new Error("Failed to fetch incident");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Using local fallback for getIncident:", err);
      return null;
    }
  }

  async getAgoraToken(channelName, uid = 0, role = 1) {
    try {
      const res = await fetch(`${API_BASE}/api/agora/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_name: channelName, uid, role }),
      });
      if (!res.ok) throw new Error("Failed to fetch Agora token");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Falling back to mock token:", err);
      return {
        token: `mock_agora_token_${channelName}_${uid}`,
        app_id: "mock_agora_app_id",
        channel_name: channelName,
        uid,
        is_mock: true,
      };
    }
  }

  async analyzeUtterance(incidentId, speaker, role, text) {
    try {
      const res = await fetch(`${API_BASE}/api/ai/analyze-utterance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: incidentId, speaker, role, text }),
      });
      if (!res.ok) throw new Error("Failed to analyze utterance");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error calling analyzeUtterance:", err);
      return null;
    }
  }

  async getSpokenBriefing(incidentId = "PAY-2048") {
    try {
      const res = await fetch(`${API_BASE}/api/ai/briefing?incident_id=${incidentId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to get briefing");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error calling getSpokenBriefing:", err);
      return null;
    }
  }

  async toggleAction(incidentId, actionId, newStatus = null) {
    try {
      const res = await fetch(`${API_BASE}/api/actions/${incidentId}/${actionId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: newStatus }),
      });
      return await res.json();
    } catch (err) {
      console.error("[ApiService] Error toggling action:", err);
      return null;
    }
  }

  async resolveConflict(incidentId, conflictId, resolutionNote) {
    try {
      const res = await fetch(`${API_BASE}/api/conflicts/${incidentId}/${conflictId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution_note: resolutionNote }),
      });
      return await res.json();
    } catch (err) {
      console.error("[ApiService] Error resolving conflict:", err);
      return null;
    }
  }

  async confirmCriticalAction(incidentId, actionId, approved, commanderName = "Vaishnavi K P") {
    try {
      const res = await fetch(`${API_BASE}/api/actions/critical/${incidentId}/${actionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, commander_name: commanderName }),
      });
      return await res.json();
    } catch (err) {
      console.error("[ApiService] Error confirming critical action:", err);
      return null;
    }
  }

  async updateIncidentState(incidentId, { severity, state, summary }) {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, state, summary }),
      });
      return await res.json();
    } catch (err) {
      console.error("[ApiService] Error updating incident state:", err);
      return null;
    }
  }

  async syncJira(incidentId) {
    const res = await fetch(`${API_BASE}/api/integrations/jira?incident_id=${incidentId}`, { method: "POST" });
    return await res.json();
  }

  async postSlack(message, incidentId) {
    const res = await fetch(`${API_BASE}/api/integrations/slack?incident_id=${incidentId}&message=${encodeURIComponent(message)}`, { method: "POST" });
    return await res.json();
  }

  async triggerPagerDuty(incidentId) {
    const res = await fetch(`${API_BASE}/api/integrations/pagerduty?incident_id=${incidentId}`, { method: "POST" });
    return await res.json();
  }

  async saveSettings({ agoraAppId, agoraAppCertificate, geminiApiKey }) {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agora_app_id: agoraAppId,
        agora_app_certificate: agoraAppCertificate,
        gemini_api_key: geminiApiKey,
      }),
    });
    return await res.json();
  }

  // WebSocket Connection for Real-Time State Sync
  connectWebSocket(incidentId, onMessage) {
    this.incidentId = incidentId;
    if (onMessage) this.subscribers.add(onMessage);

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(`${WS_BASE}/ws/incident/${incidentId}`);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected to incident war room: ${incidentId}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.subscribers.forEach((cb) => cb(data));
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[WebSocket] Disconnected. Reconnecting in 3s...");
        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket(this.incidentId);
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn("[WebSocket] Connection issue (backend may be starting):", err);
      };
    } catch (e) {
      console.warn("[WebSocket] Init failed:", e);
    }
  }

  disconnectWebSocket(onMessage) {
    if (onMessage) this.subscribers.delete(onMessage);
    if (this.subscribers.size === 0 && this.ws) {
      clearTimeout(this.reconnectTimer);
      this.ws.close();
      this.ws = null;
    }
  }

  sendWsEvent(event) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
}

export const apiService = new ApiService();
