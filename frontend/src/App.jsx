import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

import { ConnectionStatePill } from "./components/ConnectionStatePill";
import { AgentControls } from "./components/AgentControls";
import { ConsoleLogs } from "./components/ConsoleLogs";
import { SettingsModal } from "./components/SettingsModal";

import { apiService } from "./services/apiService";
import { agoraService } from "./services/agoraService";
import { Settings, ShieldCheck } from "lucide-react";

function App() {
  const [connectionState, setConnectionState] = useState("Disconnected");
  const [errorMessage, setErrorMessage] = useState(null);
  const [channelName, setChannelName] = useState("incident-pay-2048");
  const [userUid] = useState(() => agoraService.uid);
  const [agentUid] = useState(9999);

  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);

  const [remoteUsers, setRemoteUsers] = useState([]);
  const [userVolume, setUserVolume] = useState(0);
  const [agentVolume, setAgentVolume] = useState(0);

  const [logs, setLogs] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [healthInfo, setHealthInfo] = useState(null);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [...prev.slice(-150), entry]);
  }, []);

  // Initialize service listeners
  useEffect(() => {
    // 1. Subscribe to Agora logs
    const unsubLog = agoraService.onLog(addLog);

    // 2. Subscribe to remote users list
    const unsubUsers = agoraService.onRemoteUsersChange((users) => {
      setRemoteUsers(users);
      const agentJoined = users.some((u) => String(u.uid) === String(agentUid));
      if (agentJoined) {
        setConnectionState("AI Agent Connected");
        setIsAgentActive(true);
      }
    });

    // 3. Subscribe to audio volume indicator
    const unsubVol = agoraService.onVolume((volumes) => {
      volumes.forEach((v) => {
        if (v.uid === userUid || v.uid === 0) {
          setUserVolume(v.level);
        } else if (String(v.uid) === String(agentUid)) {
          setAgentVolume(v.level);
        }
      });
    });

    // 4. Health & Agent status check on mount
    apiService.getHealth().then((h) => {
      setHealthInfo(h);
      if (h.channel_name) setChannelName(h.channel_name);
    });

    apiService.getAgoraAgentStatus("incident-pay-2048").then((agentStatus) => {
      if (agentStatus.is_active || agentStatus.status === "RUNNING") {
        setIsAgentActive(true);
      }
    });

    return () => {
      unsubLog();
      unsubUsers();
      unsubVol();
    };
  }, [addLog, userUid, agentUid]);

  // Join / Leave Agora RTC Channel
  const handleToggleJoin = async () => {
    if (isJoined) {
      await agoraService.leaveChannel();
      setIsJoined(false);
      setIsMuted(false);
      setUserVolume(0);
      setAgentVolume(0);
      setConnectionState("Disconnected");
    } else {
      setConnectionState("Connecting");
      setErrorMessage(null);
      try {
        await agoraService.joinChannel({ channelName, uid: userUid });
        setIsJoined(true);
        setIsMuted(false);
        setConnectionState(isAgentActive ? "AI Agent Connected" : "Agora Connected");
      } catch (err) {
        setConnectionState("Error");
        setErrorMessage(err.message);
      }
    }
  };

  // Toggle Microphone Mute
  const handleToggleMute = async () => {
    const muted = await agoraService.toggleMute();
    setIsMuted(muted);
    if (muted) setUserVolume(0);
  };

  // Start / Stop Agora Conversational AI Agent
  const handleToggleAgent = async () => {
    setIsAgentLoading(true);
    setErrorMessage(null);

    if (isAgentActive) {
      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Stopping Agora Conversational AI Agent in channel '${channelName}'...`,
        type: "info",
      });

      const res = await apiService.stopAgoraAgent(channelName);
      if (res.success) {
        setIsAgentActive(false);
        setConnectionState(isJoined ? "Agora Connected" : "Disconnected");
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: "Agora Conversational AI Agent stopped.",
          type: "success",
        });
      } else {
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Failed to stop agent: ${res.error}`,
          type: "error",
        });
      }
    } else {
      setConnectionState("AI Agent Joining");
      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Deploying Agora Conversational AI Agent into channel '${channelName}'...`,
        type: "info",
      });

      const res = await apiService.startAgoraAgent(channelName);

      if (res.success && res.status === "RUNNING") {
        setIsAgentActive(true);
        setConnectionState("AI Agent Connected");
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Agora AI Agent Live! Agent ID: ${res.agent_id} (UID: ${res.agent_rtc_uid})`,
          type: "success",
        });
      } else if (res.status === "MISSING_CREDENTIALS") {
        setConnectionState("Error");
        setErrorMessage("Missing Customer ID/Secret");
        setIsSettingsOpen(true);
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: res.error,
          type: "warning",
        });
      } else {
        setConnectionState("Error");
        setErrorMessage(res.error || "Agent failed to join");
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Agora Agent Error: ${res.error || JSON.stringify(res)}`,
          type: "error",
        });
      }
    }

    setIsAgentLoading(false);
  };

  // Save Settings from Modal
  const handleSaveSettings = async (settings) => {
    const res = await apiService.saveSettings(settings);
    if (settings.agora_channel_name) setChannelName(settings.agora_channel_name);
    addLog({
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      message: "Agora credentials updated on server.",
      type: "success",
    });
    const h = await apiService.getHealth();
    setHealthInfo(h);
    return res;
  };

  return (
    <div className="prototype-app">
      {/* Top Header */}
      <header className="prototype-header">
        <div className="header-left">
          <div className="brand-dot"></div>
          <h1 className="brand-title">EchoSphere</h1>
          <span className="proto-badge">Agora Conversational AI Prototype</span>
        </div>

        <div className="header-center">
          <ConnectionStatePill state={connectionState} errorMessage={errorMessage} />
        </div>

        <div className="header-right">
          <button
            type="button"
            className="btn-settings-header"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure Agora credentials"
          >
            <Settings size={14} />
            <span>Credentials</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Controls + Diagnostic Logs */}
      <main className="prototype-main-grid">
        {/* Left Column: Voice Room & Agent Controls */}
        <div className="grid-col left-col">
          <AgentControls
            channelName={channelName}
            userUid={userUid}
            agentUid={agentUid}
            isJoined={isJoined}
            isMuted={isMuted}
            isAgentActive={isAgentActive}
            isAgentLoading={isAgentLoading}
            remoteUsers={remoteUsers}
            userVolume={userVolume}
            agentVolume={agentVolume}
            onToggleJoin={handleToggleJoin}
            onToggleMute={handleToggleMute}
            onToggleAgent={handleToggleAgent}
          />

          {/* Architecture & Verification Guide */}
          <div className="architecture-guide-card">
            <div className="guide-header">
              <ShieldCheck size={16} className="text-cyan" />
              <strong>Real Agora Conversational AI Pipeline</strong>
            </div>
            <p className="guide-desc">
              This prototype connects your browser microphone directly to an Agora RTC voice channel and orchestrates a cloud <strong>Agora Conversational AI Voice Agent</strong> bot inside the same channel.
            </p>
            <div className="pipeline-steps-grid">
              <div className="pipe-step">
                <span className="pipe-num">1</span>
                <div>
                  <strong>Join Room</strong>
                  <span>Publish mic audio track to Agora RTC channel.</span>
                </div>
              </div>
              <div className="pipe-step">
                <span className="pipe-num">2</span>
                <div>
                  <strong>Start AI Agent</strong>
                  <span>Backend calls Agora REST API v2 to deploy AI agent bot (UID {agentUid}).</span>
                </div>
              </div>
              <div className="pipe-step">
                <span className="pipe-num">3</span>
                <div>
                  <strong>Speak Naturally</strong>
                  <span>AI listens via Agora ASR, reasons with Incident Commander LLM, and speaks back via Agora TTS.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Operational Logs */}
        <div className="grid-col right-col">
          <ConsoleLogs logs={logs} onClearLogs={() => setLogs([])} />
        </div>
      </main>

      {/* Credentials Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialConfig={healthInfo || {}}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
