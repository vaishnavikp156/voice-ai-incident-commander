import React, { useState } from "react";
import {
  CheckSquare,
  Clock,
  User,
  ShieldCheck,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Plus,
  Terminal,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

export function ActionBoard({
  actions = [],
  criticalActions = [],
  onToggleAction,
  onConfirmCriticalAction,
  onAddNewAction,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newAssignee, setNewAssignee] = useState("Rahul Sharma");
  const [newPriority, setNewPriority] = useState("High");

  const pendingCritical = criticalActions.filter(
    (c) => c.status === "Pending Confirmation"
  );
  const resolvedCritical = criticalActions.filter(
    (c) => c.status !== "Pending Confirmation"
  );

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    onAddNewAction({
      task: newTask.trim(),
      assignee: newAssignee,
      priority: newPriority,
    });
    setNewTask("");
    setShowAddForm(false);
  };

  return (
    <div className="card action-board-card">
      <div className="card-header">
        <div className="header-title-group">
          <CheckSquare size={16} className="text-cyan" />
          <h3>Incident Actions & Safety</h3>
          <span className="badge badge-action">{actions.length} Active Items</span>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={14} /> Add Action
        </button>
      </div>

      {/* Human Confirmation -> Critical Actions Section */}
      {pendingCritical.length > 0 && (
        <div className="critical-actions-container">
          <div className="critical-header">
            <ShieldAlert size={17} className="text-danger pulse-anim" />
            <div>
              <strong>HUMAN CONFIRMATION REQUIRED</strong>
              <p className="subtext">
                Safety Safeguard: Critical remediation actions must be explicitly approved by the Incident Commander.
              </p>
            </div>
          </div>

          <div className="critical-items-list">
            {pendingCritical.map((crit) => (
              <div key={crit.id} className="critical-item-card">
                <div className="crit-top-row">
                  <div className="crit-title-wrap">
                    <span className="risk-tag">{crit.risk_level} RISK</span>
                    <strong className="crit-title">{crit.title}</strong>
                  </div>
                  <span className="crit-service">{crit.service}</span>
                </div>

                <p className="crit-desc">{crit.description}</p>

                {crit.command_preview && (
                  <div className="command-preview-box">
                    <Terminal size={13} className="terminal-icon" />
                    <code>{crit.command_preview}</code>
                  </div>
                )}

                <div className="crit-footer">
                  <span className="requested-by">Proposed by: {crit.requested_by}</span>
                  <div className="crit-action-buttons">
                    <button
                      className="btn btn-sm btn-approve"
                      onClick={() => onConfirmCriticalAction(crit.id, true)}
                    >
                      <CheckCircle2 size={14} /> Approve & Dispatch
                    </button>
                    <button
                      className="btn btn-sm btn-reject"
                      onClick={() => onConfirmCriticalAction(crit.id, false)}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Action Inline Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="add-action-form">
          <input
            type="text"
            placeholder="Action description (e.g. 'Drain canary pods on us-west-2')"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            className="action-input"
            autoFocus
          />
          <div className="form-row">
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="action-select"
            >
              <option value="Rahul Sharma">Rahul Sharma (Lead SRE)</option>
              <option value="Priya Patel">Priya Patel (Database Admin)</option>
              <option value="Arun Verma">Arun Verma (Backend Lead)</option>
              <option value="Vaishnavi K P">Vaishnavi K P (Commander)</option>
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="action-select"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
            </select>
            <button type="submit" className="btn btn-sm btn-primary">
              Create Item
            </button>
          </div>
        </form>
      )}

      {/* Action Items List */}
      <div className="actions-list">
        {actions.map((act) => {
          const isDone = act.status === "Completed";
          const isInProgress = act.status === "In Progress";

          return (
            <div
              key={act.id}
              className={`action-row ${isDone ? "action-done" : isInProgress ? "action-in-progress" : ""}`}
            >
              <button
                className={`status-checkbox ${isDone ? "checked" : isInProgress ? "progress" : ""}`}
                onClick={() => onToggleAction(act.id)}
                title={`Click to cycle status (Current: ${act.status})`}
              >
                {isDone ? <CheckCircle2 size={16} /> : <div className="checkbox-dot" />}
              </button>

              <div className="action-details">
                <div className="action-task-title">{act.task}</div>
                <div className="action-meta-row">
                  <span className="action-assignee">
                    <User size={12} /> {act.assignee} ({act.role})
                  </span>
                  <span className="action-due">
                    <Clock size={12} /> Due: ~{act.due_in_min || 10}m
                  </span>
                  <span className={`priority-tag priority-${act.priority.toLowerCase()}`}>
                    {act.priority}
                  </span>
                </div>
              </div>

              <div className="status-badge-col">
                <span
                  className={`status-indicator-badge status-${act.status.toLowerCase().replace(" ", "-")}`}
                  onClick={() => onToggleAction(act.id)}
                >
                  {act.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Log of Approved/Rejected Critical Actions */}
      {resolvedCritical.length > 0 && (
        <div className="audit-trail">
          <span className="audit-label">Commander Action Audit Trail:</span>
          {resolvedCritical.map((c) => (
            <div key={c.id} className="audit-item">
              <span className={`audit-badge ${c.status.toLowerCase()}`}>{c.status}</span>
              <span className="audit-text">{c.title}</span>
              <span className="audit-author">by {c.approved_by || "Commander"} ({c.executed_at || c.created_at})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
