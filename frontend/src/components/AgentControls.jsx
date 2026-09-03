import React from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Bot,
  Square,
  Users,
  Volume2,
} from "lucide-react";

export function AgentControls({
  channelName,
  userUid,
  agentUid,
  isJoined,
  isMuted,
  isAgentActive,
  isAgentLoading,
  remoteUsers = [],
  userVolume = 0,
  agentVolume = 0,
  onToggleJoin,
  onToggleMute,
  onToggleAgent,
}) {
  const isAgentInRoom = remoteUsers.some((u) => String(u.uid) === String(agentUid));

  return (
    <div className="agent-controls-card">
      <div className="controls-header">
        <h2 className="controls-title">Agora Conversational AI Controls</h2>
        <div className="channel-badge">
          Channel: <strong>{channelName}</strong>
        </div>
      </div>

      {/* Participant Presence & Waveform Row */}
      <div className="room-presence-row">
        {/* Local User Tile */}
        <div className={`participant-box ${userVolume > 10 ? "is-talking" : ""}`}>
          <div className="pbox-avatar">👤</div>
          <div className="pbox-info">
            <span className="pbox-name">You (Incident Commander)</span>
            <span className="pbox-uid">UID: {userUid}</span>
          </div>
          <div className="pbox-status">
            {isJoined ? (
              <span className={`vol-tag ${userVolume > 10 ? "talking" : ""}`}>
                {userVolume > 10 ? <Volume2 size={12} className="wave-icon" /> : null}
                {isMuted ? "Muted" : userVolume > 10 ? "Speaking" : "Active"}
              </span>
            ) : (
              <span className="idle-tag">Offline</span>
            )}
          </div>
        </div>

        {/* Agora AI Voice Agent Tile */}
        <div className={`participant-box ai-agent-box ${isAgentActive || isAgentInRoom ? "agent-online" : ""} ${agentVolume > 10 ? "is-talking-ai" : ""}`}>
          <div className="pbox-avatar">🤖</div>
          <div className="pbox-info">
            <span className="pbox-name">Echo AI Voice Agent</span>
            <span className="pbox-uid">UID: {agentUid}</span>
          </div>
          <div className="pbox-status">
            {isAgentActive || isAgentInRoom ? (
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
              <span>Join Agora Room</span>
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

      {/* Remote participants counter */}
      <div className="remote-presence-footer">
        <Users size={13} className="text-muted" />
        <span>
          Remote Participants in Agora Channel: <strong>{remoteUsers.length}</strong>
          {isAgentInRoom ? " (Includes Echo AI Agent)" : ""}
        </span>
      </div>
    </div>
  );
}
