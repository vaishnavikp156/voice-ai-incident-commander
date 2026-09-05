import React, { useState } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Bot,
  Square,
  Users,
  Volume2,
  Copy,
  Check,
  Radio,
} from "lucide-react";

export function AgentControls({
  channelName,
  userUid,
  agentUid,
  displayName = "You",
  userRole = "Incident Commander",
  isJoined,
  isMuted,
  isAgentActive,
  isAgentLoading,
  remoteUsers = [],
  participants = [],
  userVolume = 0,
  agentVolume = 0,
  incidentId = "INC-2048",
  roomCode = "2048",
  onToggleJoin,
  onToggleMute,
  onToggleAgent,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    const textToCopy = roomCode || incidentId;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build list of remote human participants by matching RTC remote users with backend participant metadata
  const remoteParticipants = remoteUsers
    .filter((u) => String(u.uid) !== String(agentUid))
    .map((u) => {
      const match = participants.find((p) => String(p.uid) === String(u.uid));
      return {
        uid: u.uid,
        displayName: match ? match.display_name : `Participant #${u.uid}`,
        role: match ? match.role : "Responder",
      };
    });

  const totalHumans = 1 + remoteParticipants.length;
  const totalAI = isAgentActive ? 1 : 0;

  return (
    <div className="agent-controls-card">
      {/* Incident Room Banner with Shareable Room Code */}
      <div className="controls-header">
        <div className="room-title-line">
          <h2 className="controls-title">Incident Room</h2>
          <div className="room-code-badge-group">
            <span className="room-code-label">CODE:</span>
            <span className="room-code-val">{roomCode || incidentId}</span>
            <button
              type="button"
              className="btn-copy-code"
              onClick={handleCopyCode}
              title="Copy shareable Room Code"
            >
              {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Participant Presence Box */}
      <div className="participants-section">
        <div className="participants-header">
          <div className="part-title-line">
            <Users size={13} className="text-cyan" />
            <span className="part-title">Responders ({totalHumans})</span>
          </div>
          <span className="part-count-tag">{totalHumans} Human{totalHumans === 1 ? "" : "s"} + {totalAI ? "1 AI Bot" : "0 AI"}</span>
        </div>

        <div className="participants-grid">
          {/* 1. Local User Card */}
          <div className={`participant-box local-user-card ${userVolume > 10 ? "is-talking" : ""}`}>
            <div className="pbox-avatar">👤</div>
            <div className="pbox-info">
              <div className="pbox-name-row">
                <span className="pbox-name">{displayName} (You)</span>
                <span className="pbox-role-tag">{userRole}</span>
              </div>
              <span className="pbox-uid">UID: {userUid}</span>
            </div>
            <div className="pbox-status">
              {isJoined ? (
                <span className={`vol-tag ${userVolume > 10 ? "talking" : ""}`}>
                  {userVolume > 10 ? <Volume2 size={12} className="wave-icon" /> : null}
                  {isMuted ? "Muted" : userVolume > 10 ? "Speaking" : "Connected"}
                </span>
              ) : (
                <span className="idle-tag">Offline</span>
              )}
            </div>
          </div>

          {/* 2. Remote Participants */}
          {remoteParticipants.map((p) => (
            <div key={p.uid} className="participant-box remote-user-card">
              <div className="pbox-avatar">👤</div>
              <div className="pbox-info">
                <div className="pbox-name-row">
                  <span className="pbox-name">{p.displayName}</span>
                  <span className="pbox-role-tag">{p.role}</span>
                </div>
                <span className="pbox-uid">UID: {p.uid}</span>
              </div>
              <div className="pbox-status">
                <span className="vol-tag">
                  <Radio size={10} className="text-emerald animate-pulse" />
                  <span>In Room</span>
                </span>
              </div>
            </div>
          ))}

          {/* 3. Echo AI Voice Agent Card */}
          <div className={`participant-box ai-agent-box ${isAgentActive ? "agent-online" : ""} ${isAgentActive && agentVolume > 10 ? "is-talking-ai" : ""}`}>
            <div className="pbox-avatar">🤖</div>
            <div className="pbox-info">
              <div className="pbox-name-row">
                <span className="pbox-name">Echo AI Voice Agent</span>
                <span className="pbox-role-tag ai-role-tag">Incident Commander</span>
              </div>
              <span className="pbox-uid">UID: {agentUid} (Agora AI Bot)</span>
            </div>
            <div className="pbox-status">
              {isAgentActive ? (
                <span className={`agent-status-tag ${agentVolume > 10 ? "talking" : ""}`}>
                  {agentVolume > 10 ? <Volume2 size={12} className="wave-icon" /> : null}
                  {agentVolume > 10 ? "AI Speaking" : "AI Listening"}
                </span>
              ) : (
                <span className="idle-tag">Not Joined</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="controls-buttons-toolbar">
        {/* 1. Join / Leave Agora Room */}
        <button
          type="button"
          className={`btn-ctrl ${isJoined ? "btn-leave" : "btn-join"}`}
          onClick={onToggleJoin}
        >
          {isJoined ? (
            <>
              <PhoneOff size={15} />
              <span>Leave Room</span>
            </>
          ) : (
            <>
              <PhoneCall size={15} />
              <span>Join Voice Bridge</span>
            </>
          )}
        </button>

        {/* 2. Mute / Unmute */}
        <button
          type="button"
          className={`btn-ctrl ${isMuted ? "btn-muted" : "btn-unmuted"}`}
          onClick={onToggleMute}
          disabled={!isJoined}
          title={!isJoined ? "Join room first to unmute" : "Toggle microphone"}
        >
          {isMuted ? (
            <>
              <MicOff size={15} />
              <span>Unmute Mic</span>
            </>
          ) : (
            <>
              <Mic size={15} />
              <span>Mute Mic</span>
            </>
          )}
        </button>

        {/* 3. Start / Stop Agora Conversational AI Agent */}
        <button
          type="button"
          className={`btn-ctrl ${isAgentActive ? "btn-stop-agent" : "btn-start-agent"}`}
          onClick={onToggleAgent}
          disabled={isAgentLoading}
        >
          {isAgentActive ? (
            <>
              <Square size={14} fill="currentColor" />
              <span>Stop Agora AI Agent</span>
            </>
          ) : (
            <>
              <Bot size={15} />
              <span>{isAgentLoading ? "Deploying Agent..." : "Start Agora AI Agent"}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
