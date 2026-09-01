import React, { useState } from "react";
import {
  Share2,
  ExternalLink,
  Bell,
  MessageSquare,
  Ticket,
  Activity,
  TrendingDown,
  Server,
  RefreshCw,
} from "lucide-react";

export function IntegrationsPanel({
  incident,
  onSyncJira,
  onPostSlack,
  onTriggerPagerDuty,
}) {
  const [syncingJira, setSyncingJira] = useState(false);
  const [postingSlack, setPostingSlack] = useState(false);
  const [triggeringPD, setTriggeringPD] = useState(false);
  const [slackInput, setSlackInput] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const handleJira = async () => {
    setSyncingJira(true);
    await onSyncJira();
    setSyncingJira(false);
    showToast("Jira ticket #INC-2048 updated with latest facts & actions!");
  };

  const handleSlack = async () => {
    setPostingSlack(true);
    await onPostSlack(slackInput || "AI Commander posted live incident briefing to war room.");
    setPostingSlack(false);
    setSlackInput("");
    showToast("Broadcasted update to Slack channel #incident-pay-2048-war-room!");
  };

  const handlePD = async () => {
    setTriggeringPD(true);
    await onTriggerPagerDuty();
    setTriggeringPD(false);
    showToast("PagerDuty escalation triggered for secondary on-call SRE lead!");
  };

  const telemetryHistory = incident?.telemetry?.history || [
    { time: "10:00", error_rate: 0.4, latency: 120 },
    { time: "10:05", error_rate: 42.8, latency: 1420 },
    { time: "10:10", error_rate: 38.0, latency: 1290 },
    { time: "10:15", error_rate: incident?.telemetry?.error_rate_pct || 35.4, latency: incident?.telemetry?.latency_p99_ms || 1150 },
  ];

  return (
    <div className="card integrations-card">
      <div className="card-header">
        <div className="header-title-group">
          <Share2 size={16} className="text-cyan" />
          <h3>Enterprise Integrations & Telemetry</h3>
          <span className="badge badge-integrations">Jira · Slack · PagerDuty</span>
        </div>
      </div>

      {toastMsg && <div className="integration-toast">{toastMsg}</div>}

      <div className="integrations-grid">
        {/* Jira Integration */}
        <div className="integration-box jira-box">
          <div className="int-header">
            <div className="int-brand">
              <Ticket size={16} className="text-primary" />
              <strong>Jira Service Mgmt</strong>
            </div>
            <span className="int-status-badge">Synced</span>
          </div>
          <div className="int-body">
            <span className="ticket-key">INC-2048</span>
            <p className="ticket-title">{incident?.title || "Payment Service Outage"}</p>
          </div>
          <div className="int-actions">
            <button
              className="btn btn-xs btn-outline"
              onClick={handleJira}
              disabled={syncingJira}
            >
              <RefreshCw size={12} className={syncingJira ? "spin-anim" : ""} />
              <span>{syncingJira ? "Syncing..." : "Sync Ticket"}</span>
            </button>
            <a
              href="https://echosphere-incidents.atlassian.net"
              target="_blank"
              rel="noreferrer"
              className="btn btn-xs btn-ghost"
            >
              <ExternalLink size={12} /> View
            </a>
          </div>
        </div>

        {/* Slack Integration */}
        <div className="integration-box slack-box">
          <div className="int-header">
            <div className="int-brand">
              <MessageSquare size={16} className="text-success" />
              <strong>Slack War Room</strong>
            </div>
            <span className="int-status-badge live-badge">Live Feed</span>
          </div>
          <div className="int-body">
            <span className="slack-channel">#incident-pay-2048-war-room</span>
            <p className="slack-msg-preview">
              {incident?.summary || "14 engineers active. AI Commander listening."}
            </p>
          </div>
          <div className="int-actions">
            <button
              className="btn btn-xs btn-outline"
              onClick={handleSlack}
              disabled={postingSlack}
            >
              <MessageSquare size={12} />
              <span>{postingSlack ? "Posting..." : "Broadcast Briefing"}</span>
            </button>
          </div>
        </div>

        {/* PagerDuty Integration */}
        <div className="integration-box pd-box">
          <div className="int-header">
            <div className="int-brand">
              <Bell size={16} className="text-warning" />
              <strong>PagerDuty On-Call</strong>
            </div>
            <span className="int-status-badge triggered-badge">Triggered</span>
          </div>
          <div className="int-body">
            <span className="pd-id">Alert #PD-98421</span>
            <p className="pd-tier">Tier-1 SRE & DBA Escalation</p>
          </div>
          <div className="int-actions">
            <button
              className="btn btn-xs btn-outline-danger"
              onClick={handlePD}
              disabled={triggeringPD}
            >
              <Bell size={12} />
              <span>{triggeringPD ? "Escalating..." : "Escalate Tier-2"}</span>
            </button>
          </div>
        </div>

        {/* Telemetry / Monitoring Chart */}
        <div className="integration-box telemetry-box">
          <div className="int-header">
            <div className="int-brand">
              <Activity size={16} className="text-cyan" />
              <strong>Telemetry Metrics (Datadog)</strong>
            </div>
            <span className="int-status-badge">Live 1s</span>
          </div>

          <div className="telemetry-sparklines">
            <div className="sparkline-metric">
              <span className="metric-name">Error Rate</span>
              <span className={`metric-val ${incident?.telemetry?.error_rate_pct > 5 ? "text-danger" : "text-success"}`}>
                {incident?.telemetry?.error_rate_pct || 42.8}%
              </span>
            </div>

            <div className="sparkline-metric">
              <span className="metric-name">P99 Latency</span>
              <span className="metric-val text-warning">
                {incident?.telemetry?.latency_p99_ms || 1420}ms
              </span>
            </div>

            <div className="sparkline-metric">
              <span className="metric-name">RPS</span>
              <span className="metric-val text-cyan">
                {incident?.telemetry?.rps || 3450}
              </span>
            </div>
          </div>

          {/* Visual SVG Mini Chart */}
          <div className="mini-chart-container">
            <svg viewBox="0 0 200 40" className="sparkline-svg">
              <path
                d="M 10 35 Q 40 30 70 10 T 130 14 T 190 28"
                fill="none"
                stroke="var(--neon-cyan)"
                strokeWidth="2.5"
              />
              <circle cx="190" cy="28" r="4" fill="var(--neon-cyan)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
