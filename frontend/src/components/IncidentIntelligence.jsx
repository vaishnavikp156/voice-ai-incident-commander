import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Lightbulb,
  Scale,
  ListTodo,
  AlertTriangle,
  BrainCircuit,
  Clock,
  User,
  Activity,
  MessageSquareText,
  Bot,
  Radio,
  FileCheck2,
  Copy,
  Check,
  CheckSquare,
  Milestone,
  History,
  Tag,
} from "lucide-react";

export function IncidentIntelligence({
  intelligence = {},
  isAgentActive = false,
  currentDisplayName = "You",
  onUpdateActionStatus,
  onCreateJiraFromAction,
}) {
  const {
    incident_id = "INC-2048",
    room_code = "2048",
    channel_name = "incident-pay-2048",
    status = "Active",
    facts = [],
    hypotheses = [],
    decisions = [],
    actions = [],
    conflicts = [],
    transcript = [],
    timeline = [],
    participants = [],
    total_items = 0,
    last_updated,
  } = intelligence;

  const notesEndRef = useRef(null);
  const timelineEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [updatingActionId, setUpdatingActionId] = useState(null);

  // Auto-scroll to bottom of notes when new transcript turns arrive
  useEffect(() => {
    if (notesEndRef.current) {
      notesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript.length]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room_code || incident_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActionComplete = async (action) => {
    if (!onUpdateActionStatus) return;
    const newStatus = action.status === "Completed" ? "Pending" : "Completed";
    setUpdatingActionId(action.id);
    try {
      await onUpdateActionStatus(action.id, newStatus);
    } catch (err) {
      console.error("Failed to update action status:", err);
    } finally {
      setUpdatingActionId(null);
    }
  };

  // Helper to render timeline event type badges
  const renderTimelineBadge = (type) => {
    const norm = (type || "").toUpperCase();
    switch (norm) {
      case "FACT":
        return <span className="tl-badge tl-badge-fact"><CheckCircle2 size={11} /> FACT</span>;
      case "HYPOTHESIS":
        return <span className="tl-badge tl-badge-hypo"><Lightbulb size={11} /> HYPOTHESIS</span>;
      case "DECISION":
        return <span className="tl-badge tl-badge-dec"><Scale size={11} /> DECISION</span>;
      case "ACTION":
        return <span className="tl-badge tl-badge-act"><ListTodo size={11} /> ACTION</span>;
      case "CONFLICT":
        return <span className="tl-badge tl-badge-conf"><AlertTriangle size={11} /> CONFLICT</span>;
      case "SYSTEM":
      default:
        return <span className="tl-badge tl-badge-system"><Milestone size={11} /> SYSTEM</span>;
    }
  };

  return (
    <div className="incident-intelligence-container">
      {/* Header with Title & Dual Status Distinction */}
      <div className="intelligence-header">
        <div className="intelligence-title-group">
          <div className="intelligence-icon-box">
            <BrainCircuit size={18} className="text-cyan animate-pulse" />
          </div>
          <div>
            <div className="title-with-id">
              <h3 className="intelligence-title">Incident Intelligence Board</h3>
              <span className="incident-id-pill" title="Shared Incident ID">{incident_id}</span>
              <button
                type="button"
                className="btn-pill-copy"
                onClick={handleCopyCode}
                title="Copy Room Code"
              >
                {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                <span>{copied ? "Copied" : room_code || "Code"}</span>
              </button>
            </div>
            <p className="intelligence-subtitle">
              Shared real-time extraction & transcript across all room participants
            </p>
          </div>
        </div>

        {/* Status Indicators: Distinct AI Agent status vs Incident Record status */}
        <div className="intelligence-header-badges">
          {/* 1. AI Agent Status */}
          <span className={`status-tag ${isAgentActive ? "tag-live" : "tag-offline"}`}>
            <Radio size={12} className={isAgentActive ? "pulse-dot text-emerald" : "text-muted"} />
            <strong>AI Agent:</strong> {isAgentActive ? "Live / Listening" : "Offline"}
          </span>

          {/* 2. Incident Record Status */}
          <span className={`status-tag ${status === "Active" ? "tag-incident-active" : "tag-incident-preserved"}`}>
            <FileCheck2 size={12} />
            <strong>Incident:</strong> {status === "Active" ? "Active" : "Preserved"}
          </span>

          {/* 3. Items Count */}
          <span className="count-badge-total">{total_items} Intel Items</span>
        </div>
      </div>

      {/* Primary Category Grid */}
      <div className="intelligence-grid">
        {/* ROW 1: FACTS & HYPOTHESES */}

        {/* 1. FACTS */}
        <div className="intelligence-card card-fact">
          <div className="card-header">
            <div className="card-title-line">
              <CheckCircle2 size={16} className="text-success" />
              <h4>Confirmed Facts</h4>
            </div>
            <span className="category-count count-fact">{facts.length}</span>
          </div>

          <div className="card-content">
            {facts.length === 0 ? (
              <div className="empty-intel-state">
                <p>No confirmed facts yet</p>
                <span>Speak an observed system condition to the AI Commander.</span>
              </div>
            ) : (
              <ul className="intel-list">
                {facts.map((fact) => (
                  <li key={fact.id} className="intel-item item-fact">
                    <div className="intel-text">{fact.text}</div>
                    <div className="intel-meta">
                      <Clock size={11} /> {fact.timestamp}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 2. HYPOTHESES */}
        <div className="intelligence-card card-hypo">
          <div className="card-header">
            <div className="card-title-line">
              <Lightbulb size={16} className="text-purple" />
              <h4>Hypotheses / Assumptions</h4>
            </div>
            <span className="category-count count-hypo">{hypotheses.length}</span>
          </div>

          <div className="card-content">
            {hypotheses.length === 0 ? (
              <div className="empty-intel-state">
                <p>No active hypotheses</p>
                <span>Voice unverified root-cause theories or assumptions.</span>
              </div>
            ) : (
              <ul className="intel-list">
                {hypotheses.map((hypo) => (
                  <li key={hypo.id} className="intel-item item-hypo">
                    <div className="intel-text">{hypo.text}</div>
                    <div className="intel-meta">
                      <Clock size={11} /> {hypo.timestamp}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ROW 2: DECISIONS & ACTIONS */}

        {/* 3. DECISIONS */}
        <div className="intelligence-card card-dec">
          <div className="card-header">
            <div className="card-title-line">
              <Scale size={16} className="text-blue" />
              <h4>Agreed Decisions</h4>
            </div>
            <span className="category-count count-dec">{decisions.length}</span>
          </div>

          <div className="card-content">
            {decisions.length === 0 ? (
              <div className="empty-intel-state">
                <p>No decisions recorded yet</p>
                <span>State agreed mitigation decisions to lock them in.</span>
              </div>
            ) : (
              <ul className="intel-list">
                {decisions.map((dec) => (
                  <li key={dec.id} className="intel-item item-dec">
                    <div className="dec-top-row">
                      <span className="dec-status-pill">
                        <Check size={10} className="text-emerald" /> Confirmed
                      </span>
                    </div>
                    <div className="intel-text">{dec.text}</div>
                    <div className="intel-meta">
                      <Clock size={11} /> {dec.timestamp}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 4. ACTIONS */}
        <div className="intelligence-card card-act">
          <div className="card-header">
            <div className="card-title-line">
              <ListTodo size={16} className="text-orange" />
              <h4>Active Actions</h4>
            </div>
            <span className="category-count count-act">{actions.length}</span>
          </div>

          <div className="card-content">
            {actions.length === 0 ? (
              <div className="empty-intel-state">
                <p>No pending actions</p>
                <span>Assign tasks like "@SRE drain affected pods".</span>
              </div>
            ) : (
              <ul className="intel-list">
                {actions.map((act) => {
                  const isCompleted = act.status === "Completed";
                  const isUpdating = updatingActionId === act.id;
                  return (
                    <li
                      key={act.id}
                      className={`intel-item item-act ${isCompleted ? "action-completed" : ""}`}
                    >
                      <div className="act-top-row">
                        <span className="act-owner-pill">
                          <User size={11} /> {act.owner || "Unassigned"}
                        </span>
                        <span
                          className={`act-status-pill ${
                            isCompleted ? "status-completed" : "status-pending"
                          }`}
                        >
                          {isCompleted ? "Completed" : "Pending"}
                        </span>
                      </div>

                      <div className={`intel-text ${isCompleted ? "text-completed" : ""}`}>
                        {act.text}
                      </div>

                      <div className="act-bottom-row">
                        <div className="intel-meta">
                          <Clock size={11} /> {act.timestamp}
                        </div>
                        <div className="act-btn-group">
                          {onCreateJiraFromAction && (
                            <button
                              type="button"
                              className="btn-action-jira"
                              onClick={() => onCreateJiraFromAction(act.text)}
                              title="Export action item to Jira"
                            >
                              Jira
                            </button>
                          )}
                          <button
                            type="button"
                            className={`btn-action-complete ${
                              isCompleted ? "btn-act-reopen" : "btn-act-complete"
                            }`}
                            onClick={() => handleToggleActionComplete(act)}
                            disabled={isUpdating}
                            title={isCompleted ? "Re-open action" : "Mark action as completed"}
                          >
                            <CheckSquare size={12} />
                            <span>
                              {isUpdating
                                ? "Updating..."
                                : isCompleted
                                ? "Completed ✓"
                                : "Mark Complete"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ROW 3: CONFLICTS (Span full width if needed) */}
        <div className="intelligence-card card-conf full-width-card">
          <div className="card-header">
            <div className="card-title-line">
              <AlertTriangle size={16} className="text-danger" />
              <h4>Detected Conflicts</h4>
            </div>
            <span className="category-count count-conf">{conflicts.length}</span>
          </div>

          <div className="card-content">
            {conflicts.length === 0 ? (
              <div className="empty-intel-state">
                <p>No conflicts detected</p>
                <span>Contradictory claims between responders are flagged here automatically.</span>
              </div>
            ) : (
              <ul className="intel-list">
                {conflicts.map((conf) => (
                  <li key={conf.id} className="intel-item item-conf">
                    <div className="conf-badge">⚠️ INCONSISTENCY FLAGGED</div>
                    <div className="intel-text">{conf.text}</div>
                    <div className="intel-meta">
                      <Clock size={11} /> {conf.timestamp}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================================================
          LIVE INCIDENT TIMELINE SECTION
          ========================================================================== */}
      <div className="incident-timeline-container">
        <div className="timeline-header">
          <div className="timeline-title-line">
            <History size={16} className="text-cyan" />
            <h4 className="timeline-title">Live Incident Timeline</h4>
            <span className="timeline-badge-count">{timeline.length} Events</span>
          </div>
          <p className="timeline-subtitle">
            Chronological audit log of verified facts, hypotheses, decisions, and action assignments
          </p>
        </div>

        <div className="timeline-scroll-body">
          {timeline.length === 0 ? (
            <div className="empty-timeline-box">
              <History size={24} className="empty-timeline-icon text-muted" />
              <p>No incident events yet.</p>
              <span>
                As responders communicate and intelligence is extracted, chronological milestones will be logged here.
              </span>
            </div>
          ) : (
            <div className="timeline-stream">
              {timeline.map((event, idx) => {
                const evType = (event.type || "system").toLowerCase();
                const evText = event.text || event.event || "";
                const isAction = evType === "action";
                const isDecision = evType === "decision";
                const isCompleted = event.status === "Completed";

                return (
                  <div key={event.id || idx} className={`timeline-entry tl-entry-${evType}`}>
                    <div className="tl-node-column">
                      <div className={`tl-node-dot dot-${evType}`} />
                      {idx < timeline.length - 1 && <div className="tl-connector-line" />}
                    </div>

                    <div className="tl-content-card">
                      <div className="tl-entry-header">
                        <div className="tl-time-badge">
                          <Clock size={11} />
                          <span>{event.timestamp || "--:--"}</span>
                        </div>
                        {renderTimelineBadge(evType)}
                        {event.owner && (
                          <span className="tl-owner-pill">
                            <User size={10} /> @{event.owner}
                          </span>
                        )}
                        {isAction && (
                          <span
                            className={`tl-status-pill ${
                              isCompleted ? "status-completed" : "status-pending"
                            }`}
                          >
                            {isCompleted ? "Completed" : "Pending"}
                          </span>
                        )}
                        {isDecision && (
                          <span className="tl-dec-confirmed">
                            <Check size={10} /> Confirmed
                          </span>
                        )}
                      </div>

                      <div className="tl-entry-body">
                        <p className={`tl-text ${isCompleted ? "text-completed" : ""}`}>
                          {evText}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={timelineEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Real Agora Incident Notes / Shared Multi-Person Conversation Section */}
      <div className="incident-notes-container">
        <div className="notes-header">
          <div className="notes-title-line">
            <MessageSquareText size={15} className="text-cyan" />
            <h4 className="notes-title">Incident Notes / Spoken Conversation</h4>
            <span className="notes-source-badge">Agora REST API History</span>
          </div>
          <div className="notes-meta">
            <span className="turns-count">{transcript.length} Spoken Turns Recorded</span>
          </div>
        </div>

        <div className="notes-scroll-body">
          {transcript.length === 0 ? (
            <div className="empty-notes-box">
              <MessageSquareText size={24} className="empty-notes-icon text-muted" />
              <p>No conversation notes recorded yet.</p>
              <span>
                Participants can speak into the shared Agora room. As the AI Agent listens, dialogue turns from the real Agora History API will be recorded and shared with all participants.
              </span>
            </div>
          ) : (
            <div className="notes-turn-list">
              {transcript.map((turn, idx) => {
                const isUser = turn.role === "user";
                return (
                  <div key={idx} className={`note-turn-row ${isUser ? "turn-user" : "turn-assistant"}`}>
                    <div className="note-turn-meta">
                      <span className="note-time">{turn.timestamp || turn.timestamp_sec}</span>
                      <span className={`note-speaker-pill ${isUser ? "speaker-you" : "speaker-ai"}`}>
                        {isUser ? <User size={11} /> : <Bot size={11} />}
                        {isUser ? "Participant / Team" : "Echo AI"}
                      </span>
                    </div>
                    <div className="note-bubble">
                      <p className="note-text">{turn.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={notesEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
