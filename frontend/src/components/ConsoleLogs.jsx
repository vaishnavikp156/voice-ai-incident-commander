import React, { useRef, useEffect } from "react";
import { Terminal, Trash2, Copy, Check } from "lucide-react";

export function ConsoleLogs({ logs = [], onClearLogs }) {
  const scrollRef = useRef(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    const text = logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="console-logs-card">
      <div className="console-header">
        <div className="console-title-wrap">
          <Terminal size={14} className="text-cyan" />
          <span className="console-title">Live Diagnostic & Event Logs</span>
          <span className="log-count">({logs.length})</span>
        </div>
        <div className="console-actions">
          <button type="button" className="btn-console-icon" onClick={handleCopy} title="Copy logs to clipboard">
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
          <button type="button" className="btn-console-icon" onClick={onClearLogs} title="Clear logs">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="console-body" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="empty-logs">Ready. Click 'Join Room' or 'Start Agora AI Agent' to begin...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-row log-${log.type}`}>
              <span className="log-time">[{log.time}]</span>
              <span className="log-tag">{log.type.toUpperCase()}</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
