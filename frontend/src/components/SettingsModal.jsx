import React, { useState } from "react";
import {
  Settings,
  Key,
  Radio,
  Sparkles,
  Save,
  X,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
}) {
  const [agoraAppId, setAgoraAppId] = useState(
    localStorage.getItem("AGORA_APP_ID") || ""
  );
  const [agoraCert, setAgoraCert] = useState(
    localStorage.getItem("AGORA_APP_CERTIFICATE") || ""
  );
  const [geminiApiKey, setGeminiApiKey] = useState(
    localStorage.getItem("GEMINI_API_KEY") || ""
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    localStorage.setItem("AGORA_APP_ID", agoraAppId.trim());
    localStorage.setItem("AGORA_APP_CERTIFICATE", agoraCert.trim());
    localStorage.setItem("GEMINI_API_KEY", geminiApiKey.trim());

    await onSave({
      agoraAppId: agoraAppId.trim(),
      agoraAppCertificate: agoraCert.trim(),
      geminiApiKey: geminiApiKey.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content settings-modal">
        <div className="modal-header">
          <div className="header-title-group">
            <Settings size={18} className="text-cyan" />
            <h2>System & API Configuration</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          {/* Agora Section */}
          <div className="config-section">
            <div className="section-title">
              <Radio size={16} className="text-cyan" />
              <strong>Agora RTC Real-Time Voice Credentials</strong>
            </div>
            <p className="section-desc">
              Obtain your App ID and Certificate from{" "}
              <a
                href="https://console.agora.io"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                Agora Console <ExternalLink size={11} />
              </a>
              . (If empty, the app runs in WebRTC / Simulated Voice Room mode).
            </p>

            <div className="form-group">
              <label>Agora App ID</label>
              <input
                type="text"
                placeholder="e.g. 963f45f8a0b..."
                value={agoraAppId}
                onChange={(e) => setAgoraAppId(e.target.value)}
                className="config-input"
              />
            </div>

            <div className="form-group">
              <label>Agora App Certificate (Optional for Token generation)</label>
              <input
                type="password"
                placeholder="e.g. c3d92837..."
                value={agoraCert}
                onChange={(e) => setAgoraCert(e.target.value)}
                className="config-input"
              />
            </div>
          </div>

          {/* Gemini Section */}
          <div className="config-section">
            <div className="section-title">
              <Sparkles size={16} className="text-purple" />
              <strong>Google Gemini API Key</strong>
            </div>
            <p className="section-desc">
              Get an API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                Google AI Studio <ExternalLink size={11} />
              </a>
              . (If empty, the app uses built-in high-precision NLP extraction).
            </p>

            <div className="form-group">
              <label>Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="config-input"
              />
            </div>
          </div>

          {savedSuccess && (
            <div className="save-success-msg">
              <CheckCircle2 size={16} /> Configuration saved & applied!
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={15} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
