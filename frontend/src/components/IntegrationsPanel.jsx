import React, { useState, useEffect } from "react";
import {
  Layers,
  Send,
  Bell,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Zap,
  Info,
  X,
} from "lucide-react";
import { apiService } from "../services/apiService";

export function IntegrationsPanel({
  incidentId = "INC-2048",
  roomCode = "2048",
  intelligence = {},
  onAddLog = () => {},
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [statuses, setStatuses] = useState({
    jira: { status: "Not configured", is_configured: false },
    slack: { status: "Not configured", is_configured: false },
    pagerduty: { status: "Not configured", is_configured: false },
    monitoring: { status: "Demo", is_configured: false, mode: "DEMO" },
  });

  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Jira Issue Creation Modal State
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraSummary, setJiraSummary] = useState("");
  const [jiraDesc, setJiraDesc] = useState("");
  const [jiraPriority, setJiraPriority] = useState("High");
  const [jiraResult, setJiraResult] = useState(null);
  const [isJiraSubmitting, setIsJiraSubmitting] = useState(false);

  // Slack Action State
  const [slackResult, setSlackResult] = useState(null);
  const [isSlackSending, setIsSlackSending] = useState(false);

  // PagerDuty Action State
  const [pdResult, setPdResult] = useState(null);
  const [isPdTriggering, setIsPdTriggering] = useState(false);

  // Monitoring Correlation State
  const [correlatingSignalId, setCorrelatingSignalId] = useState(null);

  // Fetch integration statuses and metrics on mount and when expanded
  const fetchStatusAndMetrics = async () => {
    setIsLoading(true);
    try {
      const [st, m] = await Promise.all([
        apiService.getIntegrationsStatus(),
        apiService.getMonitoringMetrics(),
      ]);
      if (st) setStatuses(st);
      if (m) setMetrics(m);
    } catch (err) {
      console.warn("[IntegrationsPanel] Failed to fetch integrations status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndMetrics();
  }, [incidentId]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isJiraModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsJiraModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isJiraModalOpen]);

  // Handle Jira Issue Creation
  const handleOpenJiraModal = (presetSummary = "") => {
    setJiraSummary(presetSummary || `[${incidentId}] Incident Remediation Task`);
    setJiraDesc(
      presetSummary
        ? `Task originated from Voice AI Incident Commander room ${incidentId} (Code: ${roomCode}).`
        : `Incident Overview: ${intelligence.current_understanding || "Active incident triage"}`
    );
    setJiraResult(null);
    setIsJiraModalOpen(true);
  };

  const handleSubmitJira = async (e) => {
    e.preventDefault();
    if (!jiraSummary.trim()) return;

    setIsJiraSubmitting(true);
    setJiraResult(null);

    try {
      const res = await apiService.createJiraIssue({
        summary: jiraSummary.trim(),
        description: jiraDesc.trim(),
        priority: jiraPriority,
        incident_id: incidentId,
      });
      setJiraResult(res);

      if (res.success) {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[JIRA] Created live issue ${res.issue_key}: ${res.issue_url}`,
          type: "success",
        });
      } else {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[JIRA] ${res.message || "Jira not configured"}`,
          type: "warning",
        });
      }
    } catch (err) {
      setJiraResult({ success: false, message: err.message });
    } finally {
      setIsJiraSubmitting(false);
    }
  };

  // Handle Slack Broadcast
  const handleBroadcastSlack = async () => {
    setIsSlackSending(true);
    setSlackResult(null);

    try {
      const res = await apiService.broadcastSlack({
        incident_id: incidentId,
        room_code: roomCode,
      });
      setSlackResult(res);

      if (res.success) {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[SLACK] Broadcasted incident update for ${incidentId} to ${statuses.slack?.channel || "Slack"}`,
          type: "success",
        });
      } else {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[SLACK] ${res.message || "Slack webhook not configured"}`,
          type: "warning",
        });
      }
    } catch (err) {
      setSlackResult({ success: false, message: err.message });
    } finally {
      setIsSlackSending(false);
    }
  };

  // Handle PagerDuty Trigger
  const handleTriggerPagerDuty = async () => {
    setIsPdTriggering(true);
    setPdResult(null);

    try {
      const res = await apiService.triggerPagerDuty({
        incident_id: incidentId,
        summary: intelligence.current_understanding || `Active Incident ${incidentId} in progress`,
        severity: "critical",
      });
      setPdResult(res);

      if (res.success) {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[PAGERDUTY] Alert triggered: ${res.dedup_key}`,
          type: "success",
        });
      } else {
        onAddLog({
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `[PAGERDUTY] ${res.message || "PagerDuty not configured"}`,
          type: "warning",
        });
      }
    } catch (err) {
      setPdResult({ success: false, message: err.message });
    } finally {
      setIsPdTriggering(false);
    }
  };

  // Handle Correlating a Monitoring Signal into Incident Intelligence
  const handleCorrelateSignal = async (signal) => {
    setCorrelatingSignalId(signal.id);
    try {
      const res = await apiService.correlateMonitoringMetric({
        incident_id: incidentId,
        metric_name: signal.metric,
        metric_value: signal.value,
        source: signal.source || "Observability APM",
      });

      onAddLog({
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        message: `[MONITORING] Correlated telemetry signal into incident facts: ${signal.metric} (${signal.value})`,
        type: "success",
      });
    } catch (err) {
      console.warn("Failed to correlate signal:", err);
    } finally {
      setCorrelatingSignalId(null);
    }
  };

  // Helper for Status Pill rendering
  const renderStatusPill = (statusObj) => {
    const status = (statusObj?.status || "Not configured").toLowerCase();
    if (status === "connected") {
      return (
        <span className="integ-status-pill status-connected">
          <CheckCircle2 size={11} /> Connected
        </span>
      );
    } else if (status === "demo") {
      return (
        <span className="integ-status-pill status-demo">
          <Zap size={11} /> Demo (Simulated)
        </span>
      );
    } else {
      return (
        <span className="integ-status-pill status-unconfigured">
          <XCircle size={11} /> Not configured
        </span>
      );
    }
  };

  return (
    <div className="integrations-panel-container">
      {/* Panel Header */}
      <div className="integrations-header" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="integrations-header-left">
          <div className="integrations-icon-box">
            <Layers size={18} className="text-purple" />
          </div>
          <div>
            <div className="integ-title-line">
              <h3 className="integrations-title">Incident Command Integrations Hub</h3>
              <span className="integ-count-badge">4 Connectors</span>
            </div>
            <p className="integrations-subtitle">
              Jira ticketing, Slack broadcasts, PagerDuty alerting, and real-time observability telemetry
            </p>
          </div>
        </div>

        <div className="integrations-header-right">
          <div className="integ-header-pills">
            <span className={`mini-pill ${statuses.jira?.is_configured ? "pill-on" : "pill-off"}`}>Jira</span>
            <span className={`mini-pill ${statuses.slack?.is_configured ? "pill-on" : "pill-off"}`}>Slack</span>
            <span className={`mini-pill ${statuses.pagerduty?.is_configured ? "pill-on" : "pill-off"}`}>PagerDuty</span>
            <span className="mini-pill pill-demo">Observability</span>
          </div>
          <button
            type="button"
            className="btn-toggle-integrations"
            aria-label={isExpanded ? "Collapse integrations" : "Expand integrations"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="integrations-body">
          {/* Grid of 4 Integration Cards */}
          <div className="integrations-grid">
            {/* 1. JIRA CARD */}
            <div className="integ-card card-jira">
              <div className="integ-card-header">
                <div className="integ-card-title">
                  <span className="integ-logo logo-jira">J</span>
                  <h4>Atlassian Jira</h4>
                </div>
                {renderStatusPill(statuses.jira)}
              </div>
              <p className="integ-card-desc">
                Export and track action items, mitigation tasks, and incident remediation tickets in Jira.
              </p>

              <div className="integ-card-footer">
                <button
                  type="button"
                  className="btn-integ-action btn-jira"
                  onClick={() => handleOpenJiraModal()}
                >
                  <Plus size={12} /> Create Jira Issue
                </button>
              </div>
            </div>

            {/* 2. SLACK CARD */}
            <div className="integ-card card-slack">
              <div className="integ-card-header">
                <div className="integ-card-title">
                  <Send size={15} className="text-cyan" />
                  <h4>Slack Incident Channel</h4>
                </div>
                {renderStatusPill(statuses.slack)}
              </div>
              <p className="integ-card-desc">
                Broadcast situation updates, confirmed facts, and active actions directly to your responder channel.
              </p>

              {slackResult && (
                <div className={`integ-inline-feedback ${slackResult.success ? "fb-success" : "fb-warning"}`}>
                  <Info size={12} />
                  <span>{slackResult.message}</span>
                </div>
              )}

              <div className="integ-card-footer">
                <button
                  type="button"
                  className="btn-integ-action btn-slack"
                  onClick={handleBroadcastSlack}
                  disabled={isSlackSending}
                >
                  <Send size={12} /> {isSlackSending ? "Broadcasting..." : "Broadcast Update"}
                </button>
              </div>
            </div>

            {/* 3. PAGERDUTY CARD */}
            <div className="integ-card card-pagerduty">
              <div className="integ-card-header">
                <div className="integ-card-title">
                  <Bell size={15} className="text-emerald" />
                  <h4>PagerDuty Alerts</h4>
                </div>
                {renderStatusPill(statuses.pagerduty)}
              </div>
              <p className="integ-card-desc">
                Trigger or sync incident alerts via PagerDuty Events API v2 for on-call engineer paging.
              </p>

              {pdResult && (
                <div className={`integ-inline-feedback ${pdResult.success ? "fb-success" : "fb-warning"}`}>
                  <Info size={12} />
                  <span>{pdResult.message}</span>
                </div>
              )}

              <div className="integ-card-footer">
                <button
                  type="button"
                  className="btn-integ-action btn-pd"
                  onClick={handleTriggerPagerDuty}
                  disabled={isPdTriggering}
                >
                  <Bell size={12} /> {isPdTriggering ? "Triggering..." : "Trigger / Sync Alert"}
                </button>
              </div>
            </div>

            {/* 4. MONITORING & OBSERVABILITY CARD */}
            <div className="integ-card card-monitoring">
              <div className="integ-card-header">
                <div className="integ-card-title">
                  <Activity size={15} className="text-warning" />
                  <h4>Observability & Telemetry</h4>
                </div>
                {renderStatusPill(statuses.monitoring)}
              </div>
              <p className="integ-card-desc">
                Live system health signals. Correlate telemetry metrics directly with incident intelligence.
              </p>

              <div className="integ-card-footer">
                <span className="demo-tag-label">
                  {metrics?.is_simulated ? "🧪 DEMO / SIMULATED SIGNALS" : "🟢 LIVE APM TELEMETRY"}
                </span>
              </div>
            </div>
          </div>

          {/* MONITORING SIGNALS DRAWER */}
          {metrics?.system_signals && (
            <div className="monitoring-signals-container">
              <div className="signals-header">
                <div className="signals-title-line">
                  <Activity size={15} className="text-warning" />
                  <h4>Active System Telemetry Signals</h4>
                  <span className="signals-mode-badge">
                    {metrics.is_simulated ? "Demo / Simulated Dataset" : "Live Stream"}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-refresh-metrics"
                  onClick={fetchStatusAndMetrics}
                  disabled={isLoading}
                  title="Refresh signals"
                >
                  <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="signals-grid">
                {metrics.system_signals.map((sig) => (
                  <div key={sig.id} className={`signal-item-card sig-status-${sig.status}`}>
                    <div className="signal-top">
                      <span className="signal-name">{sig.metric}</span>
                      <span className={`signal-status-pill status-${sig.status}`}>
                        {sig.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="signal-value-row">
                      <span className="signal-value">{sig.value}</span>
                      <span className="signal-threshold">Threshold: {sig.threshold}</span>
                    </div>

                    <div className="signal-bottom">
                      <span className="signal-source">{sig.source}</span>
                      <button
                        type="button"
                        className="btn-correlate-signal"
                        onClick={() => handleCorrelateSignal(sig)}
                        disabled={correlatingSignalId === sig.id}
                        title="Inject verified signal into incident facts board"
                      >
                        {correlatingSignalId === sig.id ? "Correlating..." : "Correlate with Facts"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* JIRA ISSUE CREATION MODAL */}
      {isJiraModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsJiraModalOpen(false)}>
          <div className="modal-content modal-jira" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group">
                <span className="integ-logo logo-jira">J</span>
                <h3 className="modal-title">Create Jira Issue from Incident</h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setIsJiraModalOpen(false)}
                aria-label="Close modal"
                title="Close (Esc)"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmitJira} className="modal-form">
              <div className="form-group">
                <label>Issue Summary *</label>
                <input
                  type="text"
                  value={jiraSummary}
                  onChange={(e) => setJiraSummary(e.target.value)}
                  placeholder="e.g. [INC-2048] Restart database replicas"
                  required
                />
              </div>

              <div className="form-group">
                <label>Issue Description</label>
                <textarea
                  rows={3}
                  value={jiraDesc}
                  onChange={(e) => setJiraDesc(e.target.value)}
                  placeholder="Details, owners, and diagnostic observations..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={jiraPriority}
                    onChange={(e) => setJiraPriority(e.target.value)}
                  >
                    <option value="Highest">Highest (P0)</option>
                    <option value="High">High (P1)</option>
                    <option value="Medium">Medium (P2)</option>
                    <option value="Low">Low (P3)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Project</label>
                  <input
                    type="text"
                    value={statuses.jira?.project_key || "INC (Default)"}
                    disabled
                  />
                </div>
              </div>

              {jiraResult && (
                <div
                  className={`modal-alert-box ${
                    jiraResult.success ? "alert-success" : "alert-warning"
                  }`}
                >
                  <AlertCircle size={14} />
                  <div>
                    <p>{jiraResult.message}</p>
                    {jiraResult.issue_url && (
                      <a
                        href={jiraResult.issue_url}
                        target="_blank"
                        rel="noreferrer"
                        className="jira-link"
                      >
                        Open Issue {jiraResult.issue_key} <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsJiraModalOpen(false)}
                  title="Close modal"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={isJiraSubmitting || !jiraSummary.trim()}
                >
                  {isJiraSubmitting ? "Creating Issue..." : "Create Jira Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
