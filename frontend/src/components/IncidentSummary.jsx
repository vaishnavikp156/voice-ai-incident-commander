import React, { useState } from "react";
import {
  HelpCircle,
  Compass,
  AlertOctagon,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from "lucide-react";

export function IncidentSummary({ intelligence = {} }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    current_understanding = "",
    unresolved_risks = [],
    missing_information = [],
    recommendations = [],
    facts = [],
    hypotheses = [],
    decisions = [],
    actions = [],
    conflicts = [],
  } = intelligence;

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  // Derive evidence status tag
  const hasFacts = facts.length > 0;
  const hasHypoOnly = hypotheses.length > 0 && !hasFacts;
  const evidenceStatus = hasFacts
    ? "Verified Telemetry & Fact Observation"
    : hasHypoOnly
    ? "Hypothesis Investigation (Unconfirmed)"
    : "Initial Triage (Awaiting Signal)";

  return (
    <div className="incident-summary-container">
      {/* Summary Header with Collapsible Toggle */}
      <div className="summary-header" onClick={toggleExpand}>
        <div className="summary-header-left">
          <div className="summary-icon-box">
            <FileText size={18} className="text-cyan" />
          </div>
          <div>
            <div className="summary-title-line">
              <h3 className="summary-title">Incident Overview & Operational Intelligence</h3>
              <span className={`evidence-status-pill ${hasFacts ? "pill-verified" : "pill-investigating"}`}>
                <Info size={11} /> {evidenceStatus}
              </span>
            </div>
            <p className="summary-subtitle">
              Synthesized situational awareness, evidence status, missing data, and next-step recommendations
            </p>
          </div>
        </div>

        <div className="summary-header-right">
          <div className="summary-quick-stats">
            <span className="stat-chip chip-facts">{facts.length} Facts</span>
            <span className="stat-chip chip-hypo">{hypotheses.length} Hypotheses</span>
            <span className="stat-chip chip-missing">{missing_information.length} Missing</span>
            <span className="stat-chip chip-rec">{recommendations.length} Recs</span>
          </div>
          <button
            type="button"
            className="btn-toggle-summary"
            aria-label={isExpanded ? "Collapse summary" : "Expand summary"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="summary-body">
          {/* TOP SECTION: Current Understanding & Unresolved Risks */}
          <div className="summary-dual-grid">
            {/* 1. Current Understanding */}
            <div className="summary-card card-understanding">
              <div className="card-sub-header">
                <Sparkles size={15} className="text-cyan" />
                <h4>Current Understanding</h4>
              </div>
              <div className="understanding-text-box">
                <p className="understanding-text">
                  {current_understanding ||
                    "Incident triage is active. As responders converse in the Agora voice room, EchoSphere synthesizes confirmed observations and separates them from unverified assumptions."}
                </p>
              </div>
            </div>

            {/* 2. Unresolved Risks */}
            <div className="summary-card card-risks">
              <div className="card-sub-header">
                <ShieldAlert size={15} className="text-danger" />
                <h4>Unresolved Risks ({unresolved_risks.length})</h4>
              </div>
              {unresolved_risks.length === 0 ? (
                <div className="empty-sub-state">
                  <p>No critical unresolved risks flagged</p>
                </div>
              ) : (
                <ul className="risk-list">
                  {unresolved_risks.map((risk, idx) => (
                    <li key={idx} className="risk-item">
                      <AlertOctagon size={13} className="text-danger flex-shrink-0" />
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* BOTTOM SECTION: Missing Information & Recommended Next Steps */}
          <div className="summary-dual-grid">
            {/* 3. Missing Information Detection */}
            <div className="summary-card card-missing-info">
              <div className="card-sub-header">
                <HelpCircle size={15} className="text-warning" />
                <h4>Missing Information ({missing_information.length})</h4>
              </div>
              {missing_information.length === 0 ? (
                <div className="empty-sub-state">
                  <p>All core incident parameters are documented</p>
                </div>
              ) : (
                <ul className="missing-info-list">
                  {missing_information.map((item) => (
                    <li key={item.id} className="missing-info-item">
                      <div className="missing-badge-row">
                        <span className="missing-category-badge">{item.category || "Data"}</span>
                        <span className={`missing-sev-badge sev-${(item.severity || "medium").toLowerCase()}`}>
                          {item.severity || "Medium"} Priority
                        </span>
                      </div>
                      <p className="missing-text">{item.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 4. Recommended Next Steps */}
            <div className="summary-card card-recommendations">
              <div className="card-sub-header">
                <Compass size={15} className="text-emerald" />
                <h4>Recommended Next Steps ({recommendations.length})</h4>
              </div>
              {recommendations.length === 0 ? (
                <div className="empty-sub-state">
                  <p>Awaiting additional incident dialogue</p>
                </div>
              ) : (
                <ul className="rec-list">
                  {recommendations.map((rec) => (
                    <li key={rec.id} className="rec-item">
                      <div className="rec-header-row">
                        <span className={`rec-priority-pill prio-${rec.priority?.toLowerCase()}`}>
                          {rec.priority || "P2"}
                        </span>
                        <span className="rec-category-label">{rec.category || "Action"}</span>
                        {rec.suggested_role && (
                          <span className="rec-role-pill">
                            <ArrowRight size={10} /> {rec.suggested_role}
                          </span>
                        )}
                      </div>
                      <p className="rec-text">{rec.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
