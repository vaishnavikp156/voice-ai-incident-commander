import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

import { ConnectionStatePill } from "./components/ConnectionStatePill";
import { AgentControls } from "./components/AgentControls";
import { IncidentIntelligence } from "./components/IncidentIntelligence";
import { ConsoleLogs } from "./components/ConsoleLogs";
import { SettingsModal } from "./components/SettingsModal";
import { JoinRoomModal } from "./components/JoinRoomModal";

import { apiService } from "./services/apiService";
import { agoraService } from "./services/agoraService";
import { Settings, ShieldCheck, FilePlus, UserPlus, User, Sun, Moon } from "lucide-react";

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("echosphere_theme") || "dark";
  });

  const [connectionState, setConnectionState] = useState("Disconnected");
  const [errorMessage, setErrorMessage] = useState(null);
  const [channelName, setChannelName] = useState("incident-2048");
  const [userUid] = useState(() => agoraService.uid);
  const [agentUid] = useState(9999);

  // Participant Identity state
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem("echo_display_name") || "Vaishnavi";
  });
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem("echo_user_role") || "Incident Commander";
  });

  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [isAgentLoading, setIsAgentLoading] = useState(false);

  // Timestamp and sequence tracking to suppress stale in-flight polling responses after Stop
  const lastStopTimestampRef = React.useRef(0);
  const pollSeqRef = React.useRef(0);

  const [remoteUsers, setRemoteUsers] = useState([]);
  const [userVolume, setUserVolume] = useState(0);
  const [agentVolume, setAgentVolume] = useState(0);

  const [intelligence, setIntelligence] = useState({
    incident_id: "INC-2048",
    room_code: "2048",
    channel_name: "incident-2048",
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
  });

  // Apply theme to document element and persist in localStorage
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("echosphere_theme", theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [logs, setLogs] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [healthInfo, setHealthInfo] = useState(null);

  const addLog = useCallback((entry) => {
    setLogs((prev) => [...prev.slice(-150), entry]);
  }, []);

  // Sync display name changes to local storage
  const handleUpdateDisplayName = (newName) => {
    const clean = newName.trim() || "Responder";
    setDisplayName(clean);
    localStorage.setItem("echo_display_name", clean);
  };

  // Initialize service listeners & check URL params on mount
  useEffect(() => {
    // 1. Subscribe to Agora logs
    const unsubLog = agoraService.onLog(addLog);

    // 2. Subscribe to remote users list - updates connection text, but does not override agent lifecycle
    const unsubUsers = agoraService.onRemoteUsersChange((users) => {
      setRemoteUsers(users);
      const agentJoined = users.some((u) => String(u.uid) === String(agentUid));
      if (agentJoined && isAgentActive) {
        setConnectionState("AI Agent Connected");
      } else if (isJoined) {
        setConnectionState("Agora Connected");
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

    // 4. Check URL search parameters (e.g. ?room=INC-4827 or ?code=4827)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room") || urlParams.get("code") || urlParams.get("channel");

    if (roomParam) {
      apiService.lookupIncident(roomParam).then((inc) => {
        if (inc && inc.channel_name) {
          setChannelName(inc.channel_name);
          setIntelligence(inc);
          setIsAgentActive(inc.agent_status === "RUNNING");
          addLog({
            id: Math.random().toString(),
            time: new Date().toLocaleTimeString(),
            message: `Connected to Incident Room: ${inc.incident_id} (Channel: ${inc.channel_name})`,
            type: "info",
          });
        }
      }).catch((e) => console.warn("[App] Error looking up URL room:", e));
    } else {
      // Fetch default/current incident
      apiService.getCurrentIncident().then((inc) => {
        if (inc && inc.channel_name) {
          setChannelName(inc.channel_name);
          setIntelligence(inc);
          setIsAgentActive(inc.agent_status === "RUNNING");
        }
      });
    }

    // 5. Health & Agent status check
    apiService.getHealth().then((h) => {
      setHealthInfo(h);
    });

    return () => {
      unsubLog();
      unsubUsers();
      unsubVol();
    };
  }, [addLog, userUid, agentUid, isAgentActive, isJoined]);

  // Check agent status when channel changes
  useEffect(() => {
    apiService.getAgoraAgentStatus(channelName).then((agentStatus) => {
      if (agentStatus.is_active || agentStatus.status === "RUNNING") {
        setIsAgentActive(true);
      } else {
        setIsAgentActive(false);
      }
    });
  }, [channelName]);

  // Track previous turn/intel count to log updates to UI Event Logs
  const prevTurnsCountRef = React.useRef(0);
  const prevItemsCountRef = React.useRef(0);

  // Poll Incident Intelligence & Participants from backend
  useEffect(() => {
    let timer = null;

    const fetchIntel = async () => {
      const seq = ++pollSeqRef.current;
      try {
        console.log(`[INTEL POLL] Starting poll | Channel: ${channelName}`);
        const data = await apiService.getIntelligence(channelName);
        // Ignore stale out-of-order response
        if (seq < pollSeqRef.current) return;

        if (data && (data.facts !== undefined || data.transcript !== undefined)) {
          console.log(`[INTEL POLL] Incident: ${data.incident_id} | Channel: ${channelName} | Agent: ${data.agent_status} | Turns: ${data.transcript?.length || 0} | Items: ${data.total_items || 0}`);
          
          // Log spoken turn updates to UI Diagnostic Logs
          const currentTurns = data.transcript?.length || 0;
          if (currentTurns > prevTurnsCountRef.current) {
            addLog({
              id: Math.random().toString(),
              time: new Date().toLocaleTimeString(),
              message: `[HISTORY] Received ${currentTurns} spoken turns from Agora Conversational AI Agent.`,
              type: "success",
            });
            prevTurnsCountRef.current = currentTurns;
          }

          // Log structured intelligence extraction updates to UI Diagnostic Logs
          const currentItems = data.total_items || 0;
          if (currentItems > prevItemsCountRef.current) {
            addLog({
              id: Math.random().toString(),
              time: new Date().toLocaleTimeString(),
              message: `[INTELLIGENCE] Facts=${data.facts?.length || 0} Hypotheses=${data.hypotheses?.length || 0} Decisions=${data.decisions?.length || 0} Actions=${data.actions?.length || 0} Conflicts=${data.conflicts?.length || 0}`,
              type: "success",
            });
            prevItemsCountRef.current = currentItems;
          }

          setIntelligence(data);
          const isRunning = data.agent_status === "RUNNING";

          // If user recently stopped the agent (within last 10s) and response returned RUNNING due to network in-flight lag, suppress RUNNING
          if (isRunning && Date.now() - lastStopTimestampRef.current < 10000) {
            console.log(`[App] Polling response received for channel '${channelName}': Suppressing stale RUNNING status following recent Stop action.`);
          } else {
            setIsAgentActive(isRunning);
            if (!isRunning && isJoined) {
              setConnectionState("Agora Connected");
            }
          }
        }
      } catch (err) {
        console.warn("[App] Error polling intelligence:", err);
      }
    };

    // Immediate fetch
    fetchIntel();

    // Poll frequently (every 2.5s) to stay synchronized across multiple participants
    timer = setInterval(fetchIntel, 2500);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [channelName, isJoined, addLog]);

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
        // 1. Join Agora RTC Channel
        await agoraService.joinChannel({ channelName, uid: userUid });
        setIsJoined(true);
        setIsMuted(false);
        setConnectionState(isAgentActive ? "AI Agent Connected" : "Agora Connected");

        // 2. Register participant presence in the shared backend room
        const roomCode = intelligence.room_code || intelligence.incident_id;
        apiService.joinIncidentRoom(roomCode, userUid, displayName, userRole).then((res) => {
          if (res) setIntelligence((prev) => ({ ...prev, ...res }));
        }).catch((e) => console.warn("[App] Error registering participant presence:", e));

        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Connected to Voice Bridge as '${displayName}' (${userRole}) in '${channelName}'`,
          type: "success",
        });
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
      // Record stop timestamp to immediately suppress in-flight poll responses
      lastStopTimestampRef.current = Date.now();

      // Immediately mark as inactive locally & remove AI agent RTC track
      setIsAgentActive(false);
      agoraService.removeRemoteUser(agentUid);
      setConnectionState(isJoined ? "Agora Connected" : "Disconnected");

      console.log(`[App] Stop requested for channel '${channelName}', incident '${intelligence.incident_id}'`);
      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Stopping Agora Conversational AI Agent in channel '${channelName}'...`,
        type: "info",
      });

      const res = await apiService.stopAgoraAgent(channelName);
      console.log(`[App] Stop API response for channel '${channelName}':`, res);
      console.log(`[App] Resulting agent status: isAgentActive=false, incident.agent_status=${res.incident?.agent_status || "STOPPED"}`);

      if (res.success) {
        setIsAgentActive(false);
        agoraService.removeRemoteUser(agentUid);
        setConnectionState(isJoined ? "Agora Connected" : "Disconnected");
        if (res.incident) {
          setIntelligence(res.incident);
        }
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: "Agora Conversational AI Agent stopped. Shared incident intelligence & notes preserved.",
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
      // Reset stop suppression on intentional start
      lastStopTimestampRef.current = 0;
      setConnectionState("AI Agent Joining");
      console.log(`[App] Start requested for channel '${channelName}', incident '${intelligence.incident_id}'`);

      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Deploying Agora Conversational AI Agent into channel '${channelName}'...`,
        type: "info",
      });

      const res = await apiService.startAgoraAgent(channelName);
      console.log(`[App] Start API response for channel '${channelName}':`, res);

      if (res.success && res.status === "RUNNING") {
        setIsAgentActive(true);
        setConnectionState("AI Agent Connected");
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Agora AI Agent Live in '${channelName}'! Agent ID: ${res.agent_id} (UID: ${res.agent_rtc_uid})`,
          type: "success",
        });
        const fresh = await apiService.getIntelligence(channelName);
        if (fresh) setIntelligence(fresh);
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

  // Create a Fresh Incident Room
  const handleNewIncident = async () => {
    try {
      lastStopTimestampRef.current = 0;
      // Leave old voice bridge if joined
      if (isJoined) {
        await agoraService.leaveChannel();
        setIsJoined(false);
        setIsMuted(false);
        setUserVolume(0);
        setAgentVolume(0);
        setConnectionState("Disconnected");
      }

      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: "Provisioning fresh incident room with unique Agora channel...",
        type: "info",
      });

      const fresh = await apiService.createNewIncident();
      if (fresh) {
        setChannelName(fresh.channel_name);
        setIntelligence(fresh);
        setIsAgentActive(false);
        agoraService.removeRemoteUser(agentUid);

        // Update URL to make sharing seamless
        const url = new URL(window.location);
        url.searchParams.set("room", fresh.room_code || fresh.incident_id);
        window.history.replaceState({}, "", url);

        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `New Incident Room Created: ${fresh.incident_id} (Room Code: ${fresh.room_code}, Channel: ${fresh.channel_name})`,
          type: "success",
        });
      }
    } catch (err) {
      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Failed to create new incident: ${err.message}`,
        type: "error",
      });
    }
  };

  // Join Existing Incident Room with Code & Display Name
  const handleJoinExistingRoom = async ({ roomCode, displayName: newName, role: newRole }) => {
    lastStopTimestampRef.current = 0;
    // Save identity locally
    setDisplayName(newName);
    setUserRole(newRole);
    localStorage.setItem("echo_display_name", newName);
    localStorage.setItem("echo_user_role", newRole);

    // Leave current RTC channel if connected
    if (isJoined) {
      await agoraService.leaveChannel();
      setIsJoined(false);
      setIsMuted(false);
      setUserVolume(0);
      setAgentVolume(0);
      setConnectionState("Disconnected");
    }

    // Lookup incident metadata
    const inc = await apiService.lookupIncident(roomCode);
    if (!inc || !inc.channel_name) {
      throw new Error(`Incident room '${roomCode}' could not be found.`);
    }

    setChannelName(inc.channel_name);
    setIntelligence(inc);
    const isRunning = inc.agent_status === "RUNNING";
    setIsAgentActive(isRunning);
    if (!isRunning) {
      agoraService.removeRemoteUser(agentUid);
    }

    // Register participant
    const updated = await apiService.joinIncidentRoom(inc.room_code || roomCode, userUid, newName, newRole);
    if (updated) setIntelligence((prev) => ({ ...prev, ...updated }));

    // Update URL param
    const url = new URL(window.location);
    url.searchParams.set("room", inc.room_code || inc.incident_id);
    window.history.replaceState({}, "", url);

    addLog({
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      message: `Switched to Incident Room: ${inc.incident_id} (Code: ${inc.room_code}, Channel: ${inc.channel_name})`,
      type: "success",
    });
  };

  // Update Action Status (e.g. Mark Complete)
  const handleUpdateActionStatus = async (actionId, newStatus) => {
    try {
      const updated = await apiService.updateActionStatus(channelName, actionId, newStatus);
      if (updated) {
        setIntelligence((prev) => ({ ...prev, ...updated }));
        addLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Action '${actionId}' status marked '${newStatus}' in room ${updated.incident_id || channelName}`,
          type: "info",
        });
      }
    } catch (err) {
      addLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `Failed to update action status: ${err.message}`,
        type: "error",
      });
      throw err;
    }
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
          <span className="proto-badge">Multi-Person Voice Incident Room</span>
        </div>

        <div className="header-center">
          <ConnectionStatePill state={connectionState} errorMessage={errorMessage} />
        </div>

        <div className="header-right">
          {/* User Display Name Tag */}
          <div className="user-profile-badge" title="Your display name in this incident room">
            <User size={12} className="text-cyan" />
            <span className="profile-name">{displayName}</span>
            <span className="profile-role">({userRole})</span>
          </div>

          {/* Theme Toggle Button: [ 🌙 Dark ] / [ ☀️ Light ] */}
          <button
            type="button"
            className="btn-header-theme-toggle"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          >
            {theme === "dark" ? (
              <>
                <Sun size={13} className="text-amber" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={13} className="text-purple" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-header-action btn-header-join-room"
            onClick={() => setIsJoinModalOpen(true)}
            title="Join an existing incident room by Room Code"
          >
            <UserPlus size={13} />
            <span>Join Incident</span>
          </button>

          <button
            type="button"
            className="btn-header-action btn-header-new-incident"
            onClick={handleNewIncident}
            title="Create a fresh incident room"
          >
            <FilePlus size={13} />
            <span>New Incident</span>
          </button>

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

      {/* Main Grid: Controls + Incident Intelligence + Logs */}
      <main className="prototype-main-grid">
        {/* Left Column: Voice Room & Agent Controls */}
        <div className="grid-col left-col">
          <AgentControls
            channelName={channelName}
            userUid={userUid}
            agentUid={agentUid}
            displayName={displayName}
            userRole={userRole}
            isJoined={isJoined}
            isMuted={isMuted}
            isAgentActive={isAgentActive}
            isAgentLoading={isAgentLoading}
            remoteUsers={remoteUsers}
            participants={intelligence.participants || []}
            userVolume={userVolume}
            agentVolume={agentVolume}
            incidentId={intelligence.incident_id}
            roomCode={intelligence.room_code || intelligence.incident_id}
            onToggleJoin={handleToggleJoin}
            onToggleMute={handleToggleMute}
            onToggleAgent={handleToggleAgent}
          />

          {/* Multi-Person Architecture Guide */}
          <div className="architecture-guide-card">
            <div className="guide-header">
              <ShieldCheck size={16} className="text-cyan" />
              <strong>Shared Multi-Person Technical Bridge</strong>
            </div>
            <p className="guide-desc">
              All responders join the same Agora RTC channel and talk in real-time. A single shared <strong>Echo AI Incident Commander</strong> bot listens to every participant simultaneously, extracting confirmed facts, active hypotheses, locked decisions, and assigned actions into a unified persistent incident record.
            </p>
            <div className="pipeline-steps-grid">
              <div className="pipe-step">
                <span className="pipe-num">1</span>
                <div>
                  <strong>Share Room Code</strong>
                  <span>Invite responders using Room Code <code>{intelligence.room_code || intelligence.incident_id}</code>.</span>
                </div>
              </div>
              <div className="pipe-step">
                <span className="pipe-num">2</span>
                <div>
                  <strong>Multi-Person Voice Bridge</strong>
                  <span>Publish mic tracks and hear all engineers in real-time over Agora RTC.</span>
                </div>
              </div>
              <div className="pipe-step">
                <span className="pipe-num">3</span>
                <div>
                  <strong>Shared AI Commander</strong>
                  <span>AI bot reasons over team dialogue and logs intelligence cards for all viewers.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Incident Intelligence & Operational Logs */}
        <div className="grid-col right-col">
          <IncidentIntelligence
            intelligence={intelligence}
            isAgentActive={isAgentActive}
            currentDisplayName={displayName}
            onUpdateActionStatus={handleUpdateActionStatus}
          />
          <ConsoleLogs logs={logs} onClearLogs={() => setLogs([])} />
        </div>
      </main>

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoinExistingRoom}
        initialDisplayName={displayName}
        initialRole={userRole}
      />

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
