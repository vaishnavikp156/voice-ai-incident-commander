import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  User,
  Mic,
  Tag,
  Volume2,
} from "lucide-react";

export function LiveTranscriptStream({
  transcripts = [],
  interimTranscript = "",
  currentPersona,
  onSendUtterance,
  isListening,
}) {
  const [manualText, setManualText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts, interimTranscript]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    onSendUtterance({
      text: manualText.trim(),
      speaker: currentPersona.name,
      role: currentPersona.role,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
    setManualText("");
  };

  const getTagBadge = (tag) => {
    switch (tag.toLowerCase()) {
      case "fact":
        return <span className="transcript-tag tag-fact">Fact</span>;
      case "hypothesis":
        return <span className="transcript-tag tag-hypo">Hypothesis</span>;
      case "decision":
        return <span className="transcript-tag tag-dec">Decision</span>;
      case "action":
        return <span className="transcript-tag tag-act">Action</span>;
      case "conflict":
        return <span className="transcript-tag tag-conf">Conflict</span>;
      case "ai_commander":
      case "ai_briefing":
        return <span className="transcript-tag tag-ai">AI Response</span>;
      default:
        return null;
    }
  };

  return (
    <div className="card transcript-stream-card">
      <div className="card-header">
        <div className="header-title-group">
          <MessageSquare size={16} className="text-cyan" />
          <h3>Live Conversation & AI Diarization</h3>
          <span className="badge badge-live">Speech-to-Text</span>
        </div>
        <span className="transcript-count">{transcripts.length} Turns</span>
      </div>

      <div className="transcript-messages">
        {transcripts.map((t) => {
          const isAI = t.is_ai || t.speaker.includes("Echo") || t.speaker.includes("AI");

          return (
            <div
              key={t.id || Math.random()}
              className={`transcript-bubble-row ${isAI ? "ai-row" : ""}`}
            >
              <div className="transcript-avatar">
                {isAI ? "🤖" : t.speaker.split(" ")[0][0]}
              </div>

              <div className="transcript-content">
                <div className="transcript-header-row">
                  <div className="speaker-label-group">
                    <strong className="speaker-name">{t.speaker}</strong>
                    <span className="speaker-role">({t.role})</span>
                  </div>
                  <span className="transcript-time">{t.timestamp}</span>
                </div>

                <p className="transcript-text">{t.text}</p>

                {t.tags && t.tags.length > 0 && (
                  <div className="transcript-tags-row">
                    {t.tags.map((tag, idx) => (
                      <React.Fragment key={idx}>{getTagBadge(tag)}</React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Interim Speech Bubble */}
        {interimTranscript && (
          <div className="transcript-bubble-row interim-row">
            <div className="transcript-avatar live-mic-avatar">
              <Mic size={14} className="pulse-anim" />
            </div>
            <div className="transcript-content interim-content">
              <div className="speaker-label-group">
                <strong className="speaker-name">{currentPersona.name}</strong>
                <span className="speaker-role">({currentPersona.role} - Speaking...)</span>
              </div>
              <p className="transcript-text interim-text">"{interimTranscript}..."</p>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Manual Utterance Input Bar */}
      <form onSubmit={handleSubmit} className="transcript-input-form">
        <input
          type="text"
          placeholder={`Speak into mic or type as ${currentPersona.name}...`}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          className="transcript-input"
        />
        <button type="submit" className="btn btn-send" disabled={!manualText.trim()}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
