import React from "react";
import { Radio, Bot, AlertCircle, Loader2 } from "lucide-react";

/**
 * ConnectionStatePill
 * Renders the explicit connection state machine:
 * - Disconnected
 * - Connecting (Agora RTC)
 * - Agora Connected
 * - AI Agent Joining
 * - AI Agent Connected
 * - Error
 */
export function ConnectionStatePill({ state = "Disconnected", errorMessage = null }) {
  let icon = <Radio size={13} className="text-muted" />;
  let label = "Disconnected";
  let colorClass = "state-disconnected";

  switch (state) {
    case "Connecting":
      icon = <Loader2 size={13} className="spin-anim text-cyan" />;
      label = "Connecting to Agora RTC...";
      colorClass = "state-connecting";
      break;
    case "Agora Connected":
      icon = <Radio size={13} className="text-cyan pulse-anim" />;
      label = "Agora RTC Connected";
      colorClass = "state-agora-connected";
      break;
    case "AI Agent Joining":
      icon = <Loader2 size={13} className="spin-anim text-purple" />;
      label = "AI Agent Joining...";
      colorClass = "state-agent-joining";
      break;
    case "AI Agent Connected":
      icon = <Bot size={14} className="text-purple pulse-anim" />;
      label = "Agora AI Agent Live";
      colorClass = "state-agent-connected";
      break;
    case "Error":
      icon = <AlertCircle size={13} className="text-danger" />;
      label = errorMessage ? `Error: ${errorMessage}` : "Connection Error";
      colorClass = "state-error";
      break;
    default:
      icon = <Radio size={13} className="text-muted" />;
      label = "Disconnected";
      colorClass = "state-disconnected";
      break;
  }

  return (
    <div className={`connection-pill ${colorClass}`}>
      <span className="pill-icon">{icon}</span>
      <span className="pill-label">{label}</span>
    </div>
  );
}
