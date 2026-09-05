import React, { useState } from "react";
import { Users, X, ArrowRight, Shield, User, KeyRound } from "lucide-react";

export function JoinRoomModal({
  isOpen,
  onClose,
  onJoin,
  initialDisplayName = "Engineer",
  initialRole = "Incident Responder",
}) {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [role, setRole] = useState(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a Room Code (e.g. INC-4827 or 4827)");
      return;
    }
    if (!displayName.trim()) {
      setError("Please enter your Display Name");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onJoin({
        roomCode: roomCode.trim(),
        displayName: displayName.trim(),
        role: role.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content join-modal-box">
        <div className="modal-header">
          <div className="header-title-group">
            <div className="modal-icon-wrap">
              <Users size={16} className="text-cyan" />
            </div>
            <div>
              <h3 className="modal-title">Join Incident Room</h3>
              <p className="modal-subtitle">Connect to an active multi-person technical outage bridge</p>
            </div>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="join-form-body">
          {error && <div className="join-error-banner">{error}</div>}

          <div className="input-group">
            <label>
              <KeyRound size={11} className="text-cyan" /> Incident Room Code / Channel
            </label>
            <input
              type="text"
              className="config-input"
              placeholder="e.g. INC-4827 or 4827"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              autoFocus
            />
            <span className="input-hint">Ask the incident commander for their shareable Room Code.</span>
          </div>

          <div className="input-group">
            <label>
              <User size={11} className="text-purple" /> Your Display Name
            </label>
            <input
              type="text"
              className="config-input"
              placeholder="e.g. Rahul or SRE Lead"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>
              <Shield size={11} className="text-blue" /> Your Operational Role
            </label>
            <select
              className="config-input config-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="Incident Commander">Incident Commander</option>
              <option value="Backend Engineer">Backend Engineer</option>
              <option value="SRE Engineer">SRE Engineer</option>
              <option value="Database Administrator">Database Administrator (DBA)</option>
              <option value="Security Lead">Security Lead</option>
              <option value="DevOps Engineer">DevOps Engineer</option>
              <option value="Frontend Engineer">Frontend Engineer</option>
              <option value="Incident Responder">Incident Responder</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? "Connecting..." : (
                <>
                  <span>Join Incident</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
