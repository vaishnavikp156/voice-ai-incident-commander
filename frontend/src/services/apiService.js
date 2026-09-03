/**
 * API Service
 * Handles communication with the FastAPI Voice AI backend for Agora tokens & Conversational AI.
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

  async saveSettings(settings) {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    return await res.json();
  }
}

export const apiService = new ApiService();
