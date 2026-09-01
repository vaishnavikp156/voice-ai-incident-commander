import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Sparkles,
  User,
  Volume2,
  Shield,
  Zap,
  Layers,
} from "lucide-react";

export function VoiceRoom({
  participants = [],
  agoraConnected,
  isMuted,
  isListening,
  isAISpeaking,
  activeSpeaker,
  currentPersona,
  onChangePersona,
  onToggleJoinAgora,
  onToggleMute,
  onTriggerAIQuery,
}) {
  const [waveformBars, setWaveformBars] = useState([20, 45, 80, 60, 95, 40, 70, 85, 30, 65, 90, 50]);

  // Simulate subtle waveform fluctuations when speaking
  useEffect(() => {
    if (!isListening && !isAISpeaking) return;
    const interval = setInterval(() => {
      setWaveformBars(
        Array.from({ length: 14 }, () =>
          isAISpeaking ? Math.floor(Math.random() * 70 + 30) : isListening ? Math.floor(Math.random() * 50 + 20) : 10
        )
      );
    }, 120);
    return () => clearInterval(interval);
  }, [isListening, isAISpeaking]);

  return (
    <div className="card voice-room-card">
      <div className="card-header">
        <div className="header-title-group">
          <Radio size={16} className="text-cyan pulse-anim" />
          <h3>Agora Live Voice War Room</h3>
          <span className="badge badge-agora">RTC v4.22</span>
        </div>
        <div className="voice-stats">
          <span className="stat-pill">Latency: ~28ms</span>
          <span className="stat-pill">Participants: {participants.length}</span>
        </div>
      </div>

      {/* Participants Grid */}
      <div className="participants-grid">
        {participants.map((p) => {
          const isCurrentActive = activeSpeaker === p.name || (p.is_ai && isAISpeaking);
          const isUser = p.name === currentPersona.name;

          return (
            <div
              key={p.id || p.name}
              className={`participant-card ${isCurrentActive ? "active-speaker" : ""} ${p.is_ai ? "ai-commander-card" : ""} ${isUser ? "current-user-card" : ""}`}
              onClick={() => !p.is_ai && onChangePersona(p)}
              title={!p.is_ai ? `Click to speak as ${p.name} (${p.role})` : "Voice AI Incident Commander"}
            >
              <div className="avatar-wrapper">
                <span className="avatar-emoji">{p.avatar || "👤"}</span>
                {isCurrentActive && <div className="speaker-pulse-ring"></div>}
              </div>

              <div className="participant-info">
                <div className="participant-name-row">
                  <span className="participant-name">{p.name}</span>
                  {p.is_ai ? (
                    <span className="ai-tag">AI</span>
                  ) : isUser ? (
                    <span className="you-tag">YOU</span>
                  ) : null}
                </div>
                <span className="participant-role">{p.role}</span>
              </div>

              <div className="speaker-indicator">
                {isCurrentActive ? (
                  <span className="speaking-badge">
                    <Volume2 size={12} className="wave-icon" /> Talking
                  </span>
                ) : (
                  <span className="idle-badge">Ready</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Waveform Visualizer */}
      <div className="waveform-container">
        <div className="waveform-label">
          <span>{isAISpeaking ? "Echo Commander Voice Stream" : isListening ? `Microphone: ${currentPersona.name}` : "Audio Stream Idle"}</span>
          <span className="channel-id">Channel: incident-pay-2048</span>
        </div>

        <div className="waveform-bars">
          {waveformBars.map((height, idx) => (
            <div
              key={idx}
              className={`waveform-bar ${isAISpeaking ? "ai-bar" : isListening ? "live-bar" : "idle-bar"}`}
              style={{ height: `${height}%` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Voice Room Controls */}
      <div className="voice-controls-bar">
        <div className="persona-selector">
          <span className="control-label">Speaking as:</span>
          <select
            value={currentPersona.name}
            onChange={(e) => {
              const selected = participants.find((p) => p.name === e.target.value);
              if (selected) onChangePersona(selected);
            }}
            className="persona-select"
          >
            {participants
              .filter((p) => !p.is_ai)
              .map((p) => (
                <option key={p.id || p.name} value={p.name}>
                  {p.avatar} {p.name} ({p.role})
                </option>
              ))}
          </select>
        </div>

        <div className="buttons-cluster">
          <button
            className={`btn-control mic-btn ${!isMuted && isListening ? "active-mic" : "muted-mic"}`}
            onClick={onToggleMute}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted || !isListening ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isMuted ? "Mic Muted" : "Mic Active"}</span>
          </button>

          <button
            className={`btn-control call-btn ${agoraConnected ? "leave-btn" : "join-btn"}`}
            onClick={onToggleJoinAgora}
          >
            {agoraConnected ? (
              <>
                <PhoneOff size={16} />
                <span>Leave War Room</span>
              </>
            ) : (
              <>
                <PhoneCall size={16} />
                <span>Join Voice Room</span>
              </>
            )}
          </button>

          <button
            className="btn-control ai-ask-btn"
            onClick={onTriggerAIQuery}
            title="Ask AI Commander for alignment"
          >
            <Sparkles size={15} />
            <span>Ask Commander</span>
          </button>
        </div>
      </div>
    </div>
  );
}
