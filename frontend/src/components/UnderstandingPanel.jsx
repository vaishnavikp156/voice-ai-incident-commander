import React, { useState } from "react";
import {
  CheckCircle,
  HelpCircle,
  Gavel,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Check,
  X,
} from "lucide-react";

export function UnderstandingPanel({
  facts = [],
  hypotheses = [],
  decisions = [],
  conflicts = [],
  onResolveConflict,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [resolvingConflict, setResolvingConflict] = useState(null);
  const [resolutionText, setResolutionText] = useState("");

  const unresolvedConflicts = conflicts.filter((c) => !c.is_resolved);

  return (
    <div className="card understanding-card">
      <div className="card-header">
        <div className="header-title-group">
          <Sparkles size={16} className="text-cyan" />
          <h3>Structured Incident Intelligence</h3>
          <span className="badge badge-ai">Continuous AI Parsing</span>
        </div>

        {/* Tab Filters */}
        <div className="tab-filters">
          <button
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({facts.length + hypotheses.length + decisions.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "facts" ? "active" : ""}`}
            onClick={() => setActiveTab("facts")}
          >
            Facts ({facts.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "hypotheses" ? "active" : ""}`}
            onClick={() => setActiveTab("hypotheses")}
          >
            Hypotheses ({hypotheses.length})
          </button>
          <button
            className={`tab-btn ${activeTab === "decisions" ? "active" : ""}`}
            onClick={() => setActiveTab("decisions")}
          >
            Decisions ({decisions.length})
          </button>
        </div>
      </div>

      {/* Critical Conflict Banner if Active Conflicts Exist */}
      {unresolvedConflicts.length > 0 && (
        <div className="conflict-alert-banner">
          <div className="conflict-header">
            <div className="conflict-title-wrap">
              <AlertTriangle className="text-warning pulse-anim" size={18} />
              <strong>CONFLICT DETECTED — CONFIRMATION REQUIRED</strong>
            </div>
            <span className="severity-tag">High Severity Gap</span>
          </div>

          {unresolvedConflicts.map((conf) => (
            <div key={conf.id} className="conflict-item-box">
              <p className="conflict-desc">{conf.description}</p>
              <div className="conflict-claims-grid">
                <div className="claim-card claim-a">
                  <span className="claim-speaker">{conf.speaker_a}</span>
                  <p className="claim-text">"{conf.claim_a}"</p>
                </div>
                <div className="claim-vs">VS</div>
                <div className="claim-card claim-b">
                  <span className="claim-speaker">{conf.speaker_b}</span>
                  <p className="claim-text">"{conf.claim_b}"</p>
                </div>
              </div>

              {resolvingConflict === conf.id ? (
                <div className="conflict-resolve-form">
                  <input
                    type="text"
                    placeholder="Enter resolution note (e.g. 'Confirmed v2.4 rollback completed via CLI')"
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    className="resolve-input"
                    autoFocus
                  />
                  <div className="resolve-btn-group">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => {
                        onResolveConflict(conf.id, resolutionText);
                        setResolvingConflict(null);
                        setResolutionText("");
                      }}
                    >
                      <Check size={14} /> Resolve & Align Team
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setResolvingConflict(null)}
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-resolve-conflict"
                  onClick={() => setResolvingConflict(conf.id)}
                >
                  Resolve & Clarify Conflict
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Intelligence Items Container */}
      <div className="intelligence-grid">
        {/* FACTS */}
        {(activeTab === "all" || activeTab === "facts") &&
          facts.map((f) => (
            <div key={f.id} className="intel-card fact-card">
              <div className="intel-card-header">
                <div className="type-badge fact-badge">
                  <CheckCircle size={13} />
                  <span>FACT</span>
                </div>
                <span className="intel-time">{f.timestamp}</span>
              </div>
              <p className="intel-statement">{f.statement}</p>
              {f.evidence && (
                <div className="intel-evidence">
                  <span className="evidence-label">Evidence:</span> {f.evidence}
                </div>
              )}
              <div className="intel-footer">
                <span className="intel-author">Source: {f.speaker}</span>
                <span className="verified-pill">✓ Verified</span>
              </div>
            </div>
          ))}

        {/* HYPOTHESES */}
        {(activeTab === "all" || activeTab === "hypotheses") &&
          hypotheses.map((h) => (
            <div key={h.id} className="intel-card hypothesis-card">
              <div className="intel-card-header">
                <div className="type-badge hypothesis-badge">
                  <HelpCircle size={13} />
                  <span>HYPOTHESIS</span>
                </div>
                <div className="probability-meter">
                  <span className="prob-value">{h.probability_pct}% Likelihood</span>
                  <div className="prob-bar">
                    <div
                      className="prob-fill"
                      style={{ width: `${h.probability_pct}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="intel-statement">{h.statement}</p>
              {h.notes && <p className="intel-notes">{h.notes}</p>}
              <div className="intel-footer">
                <span className="intel-author">Proposed by: {h.speaker}</span>
                <span className={`status-pill status-${h.status.toLowerCase()}`}>
                  {h.status}
                </span>
              </div>
            </div>
          ))}

        {/* DECISIONS */}
        {(activeTab === "all" || activeTab === "decisions") &&
          decisions.map((d) => (
            <div key={d.id} className="intel-card decision-card">
              <div className="intel-card-header">
                <div className="type-badge decision-badge">
                  <Gavel size={13} />
                  <span>DECISION</span>
                </div>
                <span className="intel-time">{d.timestamp}</span>
              </div>
              <p className="intel-statement">{d.outcome}</p>
              {d.rationale && (
                <div className="intel-rationale">
                  <strong>Rationale:</strong> {d.rationale}
                </div>
              )}
              <div className="intel-footer">
                <span className="intel-author">
                  Agreed by: {d.agreed_by?.join(", ") || "Incident Commander"}
                </span>
                <span className="consensus-pill">Consensus Reached</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
