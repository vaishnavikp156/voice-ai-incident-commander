import React, { useState, useEffect } from "react";
import {
  Radio,
  Volume2,
  VolumeX,
  Settings,
  PlayCircle,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";

export function Topbar({
  incident,
  isListening,
  isAISpeaking,
  agoraConnected,
  onOpenSettings,
  onOpenSimulator,
  onTriggerBriefing,
  onResolveIncident,
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isResolved = incident?.state === "Resolved";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand-badge">
          <div className="pulse-dot"></div>
          <span className="brand-name">EchoSphere</span>
          <span className="hackathon-tag">AGORA 2026</span>
        </div>

        <div className="incident-meta">
          <div className="incident-id-group">
            <span className="incident-id">#{incident?.id || "PAY-2048"}</span>
            <span className={`severity-badge ${incident?.severity?.toLowerCase() || "critical"}`}>
              {incident?.severity || "Critical"} (Sev-1)
            </span>
            <span className={`state-pill ${incident?.state?.toLowerCase() || "investigating"}`}>
              {incident?.state || "Investigating"}
            </span>
          </div>
          <h1 className="incident-title">{incident?.title || "Payment Service Outage"}</h1>
        </div>
      </div>

      <div className="topbar-center">
        <div className="status-kpi">
          <Clock className="kpi-icon" size={16} />
          <div>
            <span className="kpi-label">WAR ROOM MTTR</span>
            <span className="kpi-value">{formatElapsed(elapsedSeconds)}</span>
          </div>
        </div>

        <div className="status-kpi">
          <Activity className="kpi-icon text-cyan" size={16} />
          <div>
            <span className="kpi-label">ERROR RATE</span>
            <span className={`kpi-value ${incident?.telemetry?.error_rate_pct > 5 ? "text-danger" : "text-success"}`}>
              {incident?.telemetry?.error_rate_pct || 42.8}%
            </span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Agora Voice Status */}
        <div className={`agora-status-pill ${agoraConnected ? "connected" : "idle"}`}>
          <Radio size={14} className={agoraConnected ? "pulse-anim text-cyan" : ""} />
          <span>{agoraConnected ? "Agora Voice Active" : "Voice Ready"}</span>
        </div>

        {/* AI Commander Status */}
        <div className={`ai-badge ${isAISpeaking ? "speaking" : isListening ? "listening" : "idle"}`}>
          {isAISpeaking ? (
            <>
              <Volume2 size={15} className="wave-icon" />
              <span>AI Speaking...</span>
            </>
          ) : isListening ? (
            <>
              <span className="listening-glow"></span>
              <span>AI Listening</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>AI Commander</span>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="topbar-actions">
          <button
            className="btn btn-secondary"
            onClick={onTriggerBriefing}
            title="Generate & Speak Concise Briefing"
          >
            <Volume2 size={15} />
            <span>Spoken Briefing</span>
          </button>

          <button
            className="btn btn-gradient"
            onClick={onOpenSimulator}
            title="Simulate Incident Scenarios"
          >
            <PlayCircle size={15} />
            <span>Demo Scenarios</span>
          </button>

          {!isResolved ? (
            <button
              className="btn btn-resolve"
              onClick={onResolveIncident}
              title="Sign off & Mark Incident Resolved"
            >
              <CheckCircle2 size={15} />
              <span>Sign Off</span>
            </button>
          ) : (
            <div className="resolved-stamp">
              <CheckCircle2 size={15} /> RESOLVED
            </div>
          )}

          <button
            className="btn btn-icon"
            onClick={onOpenSettings}
            title="Agora & Gemini Settings"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
