import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import "./App.css";

import { Topbar } from "./components/Topbar";
import { VoiceRoom } from "./components/VoiceRoom";
import { UnderstandingPanel } from "./components/UnderstandingPanel";
import { ActionBoard } from "./components/ActionBoard";
import { TimelineView } from "./components/TimelineView";
import { LiveTranscriptStream } from "./components/LiveTranscriptStream";
import { IntegrationsPanel } from "./components/IntegrationsPanel";
import { ScenarioSimulator } from "./components/ScenarioSimulator";
import { SettingsModal } from "./components/SettingsModal";

import { apiService } from "./services/apiService";
import { agoraService } from "./services/agoraService";
import { speechService } from "./services/speechService";

const DEFAULT_INCIDENT_ID = "PAY-2048";

function App() {
  const [incident, setIncident] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [agoraConnected, setAgoraConnected] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState("Vaishnavi K P");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [currentPersona, setCurrentPersona] = useState({
    id: "p1",
    name: "Vaishnavi K P",
    role: "Incident Commander",
    avatar: "👑",
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Initialize Data & WebSocket
  useEffect(() => {
    // 1. Fetch initial incident state
    apiService.getIncident(DEFAULT_INCIDENT_ID).then((data) => {
      if (data) setIncident(data);
    });

    // 2. Connect live WebSocket for real-time multi-client updates
    apiService.connectWebSocket(DEFAULT_INCIDENT_ID, (event) => {
      if (event.type === "INITIAL_STATE" || event.type === "INCIDENT_UPDATED") {
        if (event.incident) setIncident(event.incident);

        // If an AI spoken response or briefing was generated
        if (event.spoken_response) {
          speechService.speakAsAI(event.spoken_response);
        } else if (event.spoken_briefing) {
          speechService.speakAsAI(event.spoken_briefing);
        }
      }
    });

    // 3. Connect speech synthesis listener
    speechService.onAISpeakingChange = (speaking) => {
      setIsAISpeaking(speaking);
      if (speaking) setActiveSpeaker("Echo Commander");
    };

    return () => {
      apiService.disconnectWebSocket();
      speechService.stopListening();
      agoraService.leaveChannel();
    };
  }, []);

  // Handle Speech Recognition Callback
  const handleUtterance = useCallback(
    async ({ text, speaker, role, timestamp }) => {
      if (!text.trim()) return;
      setActiveSpeaker(speaker);

      const res = await apiService.analyzeUtterance(
        DEFAULT_INCIDENT_ID,
        speaker,
        role,
        text
      );

      if (res?.incident) {
        setIncident(res.incident);
      }

      if (res?.spoken_response) {
        speechService.speakAsAI(res.spoken_response, () => {
          setActiveSpeaker(null);
        });
      } else {
        setTimeout(() => setActiveSpeaker(null), 3000);
      }
    },
    []
  );

  // Toggle Continuous Microphone Listening
  const handleToggleMute = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      setIsMuted(true);
      agoraService.toggleMute();
    } else {
      speechService.setSpeaker(currentPersona.name, currentPersona.role);
      speechService.startListening(
        handleUtterance,
        (interim) => setInterimTranscript(interim),
        (listening) => setIsListening(listening)
      );
      setIsListening(true);
      setIsMuted(false);
      agoraService.toggleMute();
    }
  };

  // Join / Leave Agora RTC Channel
  const handleToggleJoinAgora = async () => {
    if (agoraConnected) {
      await agoraService.leaveChannel();
      speechService.stopListening();
      setAgoraConnected(false);
      setIsListening(false);
    } else {
      const res = await agoraService.joinChannel({
        channelName: "incident-pay-2048",
        onVolume: (volumes) => {
          if (volumes && volumes.length > 0) {
            const top = volumes.reduce((max, v) => (v.level > max.level ? v : max), volumes[0]);
            if (top.level > 10) {
              setActiveSpeaker(currentPersona.name);
            }
          }
        },
      });

      if (res?.success) {
        setAgoraConnected(true);
        // Start STT automatically on join
        speechService.setSpeaker(currentPersona.name, currentPersona.role);
        speechService.startListening(
          handleUtterance,
          (interim) => setInterimTranscript(interim),
          (listening) => setIsListening(listening)
        );
        setIsListening(true);
        setIsMuted(false);
      }
    }
  };

  // Change Persona / Role
  const handleChangePersona = (persona) => {
    setCurrentPersona(persona);
    speechService.setSpeaker(persona.name, persona.role);
  };

  // Trigger Spoken AI Briefing Aloud
  const handleTriggerBriefing = async () => {
    const res = await apiService.getSpokenBriefing(DEFAULT_INCIDENT_ID);
    if (res?.spoken_text) {
      speechService.speakAsAI(res.spoken_text);
    }
  };

  // Ask AI Commander
  const handleTriggerAIQuery = async () => {
    handleUtterance({
      text: "Echo Commander, provide a situational alignment briefing on active blockers and conflicts.",
      speaker: currentPersona.name,
      role: currentPersona.role,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  // Toggle Action Status
  const handleToggleAction = async (actionId) => {
    const res = await apiService.toggleAction(DEFAULT_INCIDENT_ID, actionId);
    if (res) {
      setIncident((prev) => {
        if (!prev) return prev;
        const updated = prev.actions.map((a) => (a.id === actionId ? res : a));
        return { ...prev, actions: updated };
      });
    }
  };

  // Add Action Item
  const handleAddNewAction = async ({ task, assignee, priority }) => {
    await handleUtterance({
      text: `I am assigning an action item to ${assignee}: ${task} with ${priority} priority.`,
      speaker: currentPersona.name,
      role: currentPersona.role,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  // Resolve Conflict
  const handleResolveConflict = async (conflictId, resolutionNote) => {
    const res = await apiService.resolveConflict(
      DEFAULT_INCIDENT_ID,
      conflictId,
      resolutionNote
    );
    if (res) {
      setIncident((prev) => {
        if (!prev) return prev;
        const updated = prev.conflicts.map((c) =>
          c.id === conflictId ? { ...c, is_resolved: true, resolution_note: resolutionNote } : c
        );
        return { ...prev, conflicts: updated };
      });
    }
  };

  // Human Confirmation for Critical Action
  const handleConfirmCriticalAction = async (actionId, approved) => {
    const res = await apiService.confirmCriticalAction(
      DEFAULT_INCIDENT_ID,
      actionId,
      approved,
      currentPersona.name
    );

    if (res && approved) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  // Resolve Incident & Sign Off
  const handleResolveIncident = async () => {
    const res = await apiService.updateIncidentState(DEFAULT_INCIDENT_ID, {
      state: "Resolved",
      severity: "Resolved",
      summary: "Incident successfully mitigated and verified. All telemetry metrics nominal.",
    });

    if (res) {
      setIncident(res);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
      speechService.speakAsAI(
        "Incident PAY-2048 has been successfully resolved and signed off by Commander Vaishnavi. All telemetry metrics are healthy."
      );
    }
  };

  // Play Scenario Step from Simulator
  const handlePlaySimulatorStep = async (step) => {
    speechService.speakAsAI(step.text, async () => {
      await handleUtterance({
        text: step.text,
        speaker: step.speaker,
        role: step.role,
        timestamp: new Date().toLocaleTimeString(),
      });
    });
  };

  // Save Settings
  const handleSaveSettings = async (settings) => {
    await apiService.saveSettings(settings);
  };

  return (
    <div className="app-container">
      {/* Topbar Header */}
      <Topbar
        incident={incident}
        isListening={isListening}
        isAISpeaking={isAISpeaking}
        agoraConnected={agoraConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onTriggerBriefing={handleTriggerBriefing}
        onResolveIncident={handleResolveIncident}
      />

      {/* Main Command Center Layout */}
      <main className="dashboard-layout">
        {/* Left Column: Voice Hub & Structured Understanding */}
        <div className="grid-col left-col">
          {/* Agora RTC Voice Hub */}
          <VoiceRoom
            participants={incident?.participants || []}
            agoraConnected={agoraConnected}
            isMuted={isMuted}
            isListening={isListening}
            isAISpeaking={isAISpeaking}
            activeSpeaker={activeSpeaker}
            currentPersona={currentPersona}
            onChangePersona={handleChangePersona}
            onToggleJoinAgora={handleToggleJoinAgora}
            onToggleMute={handleToggleMute}
            onTriggerAIQuery={handleTriggerAIQuery}
          />

          {/* Structured Intelligence (Facts, Hypotheses, Decisions, Conflicts) */}
          <UnderstandingPanel
            facts={incident?.facts || []}
            hypotheses={incident?.hypotheses || []}
            decisions={incident?.decisions || []}
            conflicts={incident?.conflicts || []}
            onResolveConflict={handleResolveConflict}
          />

          {/* Enterprise Integrations & Telemetry Metrics */}
          <IntegrationsPanel
            incident={incident}
            onSyncJira={() => apiService.syncJira(DEFAULT_INCIDENT_ID)}
            onPostSlack={(msg) => apiService.postSlack(msg, DEFAULT_INCIDENT_ID)}
            onTriggerPagerDuty={() => apiService.triggerPagerDuty(DEFAULT_INCIDENT_ID)}
          />
        </div>

        {/* Right Column: Actions, Live Transcripts, Timeline */}
        <div className="grid-col right-col">
          {/* Action Items Board & Human Confirmation for Critical Actions */}
          <ActionBoard
            actions={incident?.actions || []}
            criticalActions={incident?.critical_actions || []}
            onToggleAction={handleToggleAction}
            onConfirmCriticalAction={handleConfirmCriticalAction}
            onAddNewAction={handleAddNewAction}
          />

          {/* Real-Time Spoken Transcript Diarization Stream */}
          <LiveTranscriptStream
            transcripts={incident?.transcripts || []}
            interimTranscript={interimTranscript}
            currentPersona={currentPersona}
            onSendUtterance={handleUtterance}
            isListening={isListening}
          />

          {/* Chronological Incident Timeline */}
          <TimelineView timeline={incident?.timeline || []} />
        </div>
      </main>

      {/* Scenario Simulator Modal */}
      <ScenarioSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onPlayStep={handlePlaySimulatorStep}
        isAISpeaking={isAISpeaking}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;