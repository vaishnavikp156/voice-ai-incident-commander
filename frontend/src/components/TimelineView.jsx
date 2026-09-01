import React, { useState } from "react";
import {
  Clock,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Gavel,
  Zap,
  ShieldAlert,
  Award,
  Filter,
} from "lucide-react";

export function TimelineView({ timeline = [] }) {
  const [filter, setFilter] = useState("all");

  const filteredEvents =
    filter === "all"
      ? timeline
      : timeline.filter((e) => e.event_type.toLowerCase() === filter);

  const getEventIcon = (type) => {
    switch (type.toLowerCase()) {
      case "alert":
        return <AlertCircle size={14} className="text-danger" />;
      case "fact":
        return <CheckCircle size={14} className="text-cyan" />;
      case "hypothesis":
        return <HelpCircle size={14} className="text-warning" />;
      case "decision":
        return <Gavel size={14} className="text-purple" />;
      case "conflict":
        return <ShieldAlert size={14} className="text-warning" />;
      case "mitigation":
        return <Zap size={14} className="text-success" />;
      case "resolution":
        return <Award size={14} className="text-success" />;
      default:
        return <Clock size={14} className="text-muted" />;
    }
  };

  return (
    <div className="card timeline-card">
      <div className="card-header">
        <div className="header-title-group">
          <Clock size={16} className="text-cyan" />
          <h3>Live Incident Timeline</h3>
          <span className="badge badge-live">Real-time Stream</span>
        </div>

        {/* Filter Pills */}
        <div className="timeline-filter-pills">
          {["all", "alert", "fact", "decision", "action", "conflict", "mitigation"].map((f) => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-stream">
        {filteredEvents.length === 0 ? (
          <div className="empty-timeline">No events match filter</div>
        ) : (
          filteredEvents.map((evt, idx) => (
            <div key={evt.id || idx} className={`timeline-row type-${evt.event_type}`}>
              <div className="time-marker">
                <span className="time-text">{evt.time_str}</span>
                <div className="timeline-dot-wrapper">
                  <div className="timeline-dot">{getEventIcon(evt.event_type)}</div>
                  {idx < filteredEvents.length - 1 && <div className="timeline-connector" />}
                </div>
              </div>

              <div className="timeline-content-card">
                <div className="event-header">
                  <strong className="event-title">{evt.title}</strong>
                  <span className="event-author">{evt.author}</span>
                </div>
                <p className="event-description">{evt.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
