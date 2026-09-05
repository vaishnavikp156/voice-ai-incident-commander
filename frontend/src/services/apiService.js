/**
 * API Service
 * Handles communication with the FastAPI Voice AI backend for Agora tokens & Conversational AI.
 * Supports Multi-Person Incident Rooms, shared intelligence, participant presence, and transcripts.
 */

const API_BASE = "http://localhost:8000";

class ApiService {
  async getHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) throw new Error("Health check failed");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Health check error:", err);
      return { status: "offline", error: err.message };
    }
  }

  async getAgoraToken(channelName = "incident-pay-2048", uid = 0, role = 1) {
    const res = await fetch(`${API_BASE}/api/agora/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_name: channelName, uid, role }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to fetch Agora token");
    }

    return await res.json();
  }

  async startAgoraAgent(channelName = "incident-pay-2048", customPrompt = null) {
    const res = await fetch(`${API_BASE}/api/agora/agent/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_name: channelName, custom_prompt: customPrompt }),
    });

    return await res.json();
  }

  async stopAgoraAgent(channelName = "incident-pay-2048", agentId = null) {
    const res = await fetch(`${API_BASE}/api/agora/agent/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_name: channelName, agent_id: agentId }),
    });

    return await res.json();
  }

  async getAgoraAgentStatus(channelName = "incident-pay-2048") {
    try {
      const res = await fetch(`${API_BASE}/api/agora/agent/status?channel_name=${encodeURIComponent(channelName)}`);
      if (!res.ok) throw new Error("Failed to get agent status");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error getting agent status:", err);
      return { is_active: false, status: "IDLE" };
    }
  }

  async getIntelligence(channelName = "incident-pay-2048", incidentId = null) {
    try {
      let url = `${API_BASE}/api/incident/intelligence?channel_name=${encodeURIComponent(channelName)}`;
      if (incidentId) {
        url += `&incident_id=${encodeURIComponent(incidentId)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to get intelligence");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error getting incident intelligence:", err);
      return {
        incident_id: incidentId || "INC-2048",
        channel_name: channelName,
        status: "Active",
        agent_status: "IDLE",
        facts: [],
        hypotheses: [],
        decisions: [],
        actions: [],
        conflicts: [],
        transcript: [],
        timeline: [],
        participants: [],
        total_items: 0,
      };
    }
  }

  async getCurrentIncident(identifier = null) {
    try {
      const url = identifier ? `${API_BASE}/api/incident/current?identifier=${encodeURIComponent(identifier)}` : `${API_BASE}/api/incident/current`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to get current incident");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error getting current incident:", err);
      return null;
    }
  }

  async createNewIncident(channelName = null) {
    const res = await fetch(`${API_BASE}/api/incident/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_name: channelName }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to create new incident");
    }

    return await res.json();
  }

  async lookupIncident(code) {
    const res = await fetch(`${API_BASE}/api/incident/lookup/${encodeURIComponent(code)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Incident room '${code}' not found`);
    }
    return await res.json();
  }

  async joinIncidentRoom(code, uid, displayName, role = "Incident Responder") {
    const res = await fetch(`${API_BASE}/api/incident/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        uid,
        display_name: displayName,
        role,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to register in incident room");
    }

    return await res.json();
  }

  async updateActionStatus(codeOrChannel, actionId, status = "Completed") {
    const res = await fetch(`${API_BASE}/api/incident/action/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: codeOrChannel,
        channel_name: codeOrChannel,
        action_id: actionId,
        status,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to update action status");
    }

    return await res.json();
  }

  async getAgentHistory(channelName = "incident-pay-2048") {
    try {
      const res = await fetch(`${API_BASE}/api/agora/agent/history?channel_name=${encodeURIComponent(channelName)}`);
      if (!res.ok) throw new Error("Failed to get history");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error getting agent history:", err);
      return { contents: [] };
    }
  }

  async saveSettings(settings) {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    return await res.json();
  }

  // Integrations & Telemetry APIs
  async getIntegrationsStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/status`);
      if (!res.ok) throw new Error("Failed to fetch integrations status");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error fetching integrations status:", err);
      return {
        jira: { status: "Not configured", is_configured: false },
        slack: { status: "Not configured", is_configured: false },
        pagerduty: { status: "Not configured", is_configured: false },
        monitoring: { status: "Demo", is_configured: false, mode: "DEMO" },
      };
    }
  }

  async createJiraIssue(payload) {
    const res = await fetch(`${API_BASE}/api/integrations/jira/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async broadcastSlack(payload) {
    const res = await fetch(`${API_BASE}/api/integrations/slack/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async triggerPagerDuty(payload) {
    const res = await fetch(`${API_BASE}/api/integrations/pagerduty/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  }

  async getMonitoringMetrics() {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/monitoring/metrics`);
      if (!res.ok) throw new Error("Failed to fetch monitoring metrics");
      return await res.json();
    } catch (err) {
      console.warn("[ApiService] Error fetching monitoring metrics:", err);
      return { is_simulated: true, mode: "DEMO", system_signals: [] };
    }
  }

  async correlateMonitoringMetric(payload) {
    const res = await fetch(`${API_BASE}/api/integrations/monitoring/correlate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  }
}

export const apiService = new ApiService();
