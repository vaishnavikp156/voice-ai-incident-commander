import React, { useRef, useEffect, useState } from "react";
import { Terminal, Trash2, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

export function ConsoleLogs({ logs = [], onClearLogs }) {
  const scrollRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const handleCopy = (e) => {
    e.stopPropagation();
    const text = logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onClearLogs();
  };

  return (
    <div className={`console-logs-card ${isExpanded ? "expanded" : "collapsed"}`}>
      <div
        className="console-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        title={isExpanded ? "Click to collapse Developer Diagnostics" : "Click to expand Developer Diagnostics"}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
      >
        <div className="console-title-wrap">
          <Terminal size={14} className="text-cyan" />
          <span className="console-title">Developer Diagnostics</span>
          <span className="log-count">({logs.length})</span>
        </div>
        <div className="console-actions">
          {isExpanded && (
            <>
              <button
                type="button"
                className="btn-console-icon"
                onClick={handleCopy}
                title="Copy logs to clipboard"
              >
                {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              </button>
              <button
                type="button"
                className="btn-console-icon"
                onClick={handleClear}
                title="Clear logs"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-console-toggle"
            aria-label={isExpanded ? "Collapse Developer Diagnostics" : "Expand Developer Diagnostics"}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
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
      )}
    </div>
  );
}

