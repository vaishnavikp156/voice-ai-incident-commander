import React, { useState, useEffect } from "react";
import { Settings, X, ExternalLink, Save, CheckCircle2, Bot, Radio } from "lucide-react";

export function SettingsModal({
  isOpen,
  onClose,
  initialConfig = {},
  onSave,
}) {
  const [appId, setAppId] = useState("");
  const [appCert, setAppCert] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerSecret, setCustomerSecret] = useState("");
  const [channelName, setChannelName] = useState("incident-pay-2048");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialConfig.agora_app_id) {
      setAppId(initialConfig.agora_app_id);
    }
    if (initialConfig.channel_name) {
      setChannelName(initialConfig.channel_name);
    }
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {};
    if (appId.trim()) payload.agora_app_id = appId.trim();
    if (appCert.trim()) payload.agora_app_certificate = appCert.trim();
    if (customerId.trim()) payload.agora_customer_id = customerId.trim();
    if (customerSecret.trim()) payload.agora_customer_secret = customerSecret.trim();
    if (channelName.trim()) payload.agora_channel_name = channelName.trim();

    await onSave(payload);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content settings-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title-group">
            <Settings size={18} className="text-cyan" />
            <h2 className="modal-title">Agora Credentials & Configuration</h2>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="settings-form-body">
          {/* Agora RTC Section */}
          <div className="config-section">
            <div className="section-title-line">
              <Radio size={15} className="text-cyan" />
              <strong>1. Agora RTC Project Credentials</strong>
            </div>
            <p className="section-help-text">
              From{" "}
              <a href="https://console.agora.io" target="_blank" rel="noreferrer" className="ext-link">
                Agora Console &gt; Project Management <ExternalLink size={10} />
              </a>
            </p>

            <div className="input-group">
              <label>Agora App ID</label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="e.g. 4a8b1c9d2e3f..."
                className="config-input"
              />
            </div>

            <div className="input-group">
              <label>Agora App Certificate (Leave blank to keep current)</label>
              <input
                type="password"
                value={appCert}
                onChange={(e) => setAppCert(e.target.value)}
                placeholder={initialConfig.agora_app_certificate_configured ? "•••••••••••••••• (Configured)" : "e.g. 8f7e6d5c..."}
                className="config-input"
              />
            </div>
          </div>

          {/* Agora Conversational AI Section */}
          <div className="config-section">
            <div className="section-title-line">
              <Bot size={15} className="text-purple" />
              <strong>2. Agora Conversational AI REST API Credentials</strong>
            </div>
            <p className="section-help-text">
              Required to deploy the Cloud AI Voice Agent bot. Obtain from{" "}
              <a href="https://console.agora.io/restfulApi" target="_blank" rel="noreferrer" className="ext-link">
                Agora Console &gt; RESTful API <ExternalLink size={10} />
              </a>
            </p>

            <div className="input-group">
              <label>Customer ID (Key)</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder={initialConfig.customer_id_set ? "•••••••• (Configured - enter new to change)" : "e.g. 1a2b3c4d..."}
                className="config-input"
              />
            </div>

            <div className="input-group">
              <label>Customer Secret</label>
              <input
                type="password"
                value={customerSecret}
                onChange={(e) => setCustomerSecret(e.target.value)}
                placeholder={initialConfig.customer_secret_set ? "•••••••••••••••• (Configured - enter new to change)" : "e.g. 9z8y7x6w..."}
                className="config-input"
              />
            </div>
          </div>

          {/* Channel Name */}
          <div className="config-section">
            <div className="input-group">
              <label>Default Channel Name</label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="incident-pay-2048"
                className="config-input"
              />
            </div>
          </div>

          {savedSuccess && (
            <div className="save-toast-banner">
              <CheckCircle2 size={15} /> Credentials updated on backend!
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={14} /> Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
