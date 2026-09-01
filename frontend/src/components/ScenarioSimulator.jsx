import React, { useState } from "react";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  Volume2,
} from "lucide-react";

export const PRESET_SCENARIOS = [
  {
    id: "scenario-1",
    title: "Scenario 1: Payment Gateway Outage (Sev-1)",
    description: "High error rates, contradictory deployment rollback claims, and critical rollback confirmation.",
    steps: [
      {
        speaker: "Vaishnavi K P",
        role: "Incident Commander",
        text: "Team, we have a Sev-1 on Payment Service. Error rates are surging. Rahul, give us situational awareness.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "Error rate is currently sitting at 48.2% on payment-api, and Stripe webhook latency is over 4500ms.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "I suspect the payment gateway upstream is rate limiting our egress IPs.",
      },
      {
        speaker: "Vaishnavi K P",
        role: "Incident Commander",
        text: "Let's throttle non-critical batch syncs immediately so checkout flows succeed.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "I just executed the rollback to v2.3.9 five minutes ago, so that should be done.",
      },
      {
        speaker: "Priya Patel",
        role: "Database Admin",
        text: "Wait Rahul, I'm checking Consul mesh and v2.4 pods are still receiving live traffic. The rollback is not active.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "I propose we force an emergency rollback of Payment Service to v2.3.9 right now.",
      },
    ],
  },
  {
    id: "scenario-2",
    title: "Scenario 2: Postgres Replica Lag & Deadlock (Sev-2)",
    description: "Database connection saturation, replica lag exceeding 90 seconds, and database failover approval.",
    steps: [
      {
        speaker: "Vaishnavi K P",
        role: "Incident Commander",
        text: "Opening Sev-2 war room for database latency spike. Priya, what are the metrics?",
      },
      {
        speaker: "Priya Patel",
        role: "Database Admin",
        text: "Postgres primary connection pool is at 98% saturation with 450 active locks.",
      },
      {
        speaker: "Priya Patel",
        role: "Database Admin",
        text: "Hypothesis: A long-running analytics migration is holding row-level locks on user_wallets table.",
      },
      {
        speaker: "Arun Verma",
        role: "Backend Lead",
        text: "I will terminate the analytics backend connection worker pool immediately.",
      },
      {
        speaker: "Priya Patel",
        role: "Database Admin",
        text: "We should failover database connection pool to warm standby replica-02 in US-East.",
      },
    ],
  },
  {
    id: "scenario-3",
    title: "Scenario 3: Auth Token Storm & Ingress Flood (Sev-1)",
    description: "Distributed token refresh storm causing ingress timeouts, rate limit decision, and resolution.",
    steps: [
      {
        speaker: "Vaishnavi K P",
        role: "Incident Commander",
        text: "Auth service ingress is throwing HTTP 504 gateway timeouts across all regions.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "Auth token verification requests spiked from 5,000 RPS to 85,000 RPS in two minutes.",
      },
      {
        speaker: "Arun Verma",
        role: "Backend Lead",
        text: "Hypothesis: Mobile app update has an aggressive retry loop on expired JWT tokens.",
      },
      {
        speaker: "Vaishnavi K P",
        role: "Incident Commander",
        text: "Decision: Apply Cloudflare WAF rate-limiting rule to cap token refresh to 10 per minute per IP.",
      },
      {
        speaker: "Rahul Sharma",
        role: "Lead SRE",
        text: "WAF rule applied. Auth ingress error rate dropped to 0.1% and latency is back to 65ms.",
      },
    ],
  },
];

export function ScenarioSimulator({
  isOpen,
  onClose,
  onPlayStep,
  isAISpeaking,
}) {
  const [selectedScenario, setSelectedScenario] = useState(PRESET_SCENARIOS[0]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timerRef, setTimerRef] = useState(null);

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (currentStepIdx < selectedScenario.steps.length) {
      const step = selectedScenario.steps[currentStepIdx];
      onPlayStep(step);
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const handleAutoPlay = () => {
    if (isPlaying) {
      clearInterval(timerRef);
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    let stepIndex = currentStepIdx;

    const interval = setInterval(() => {
      if (stepIndex < selectedScenario.steps.length) {
        const step = selectedScenario.steps[stepIndex];
        onPlayStep(step);
        stepIndex++;
        setCurrentStepIdx(stepIndex);
      } else {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, 4500);

    setTimerRef(interval);
  };

  const handleReset = () => {
    if (timerRef) clearInterval(timerRef);
    setIsPlaying(false);
    setCurrentStepIdx(0);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content scenario-modal">
        <div className="modal-header">
          <div className="header-title-group">
            <Sparkles size={18} className="text-cyan" />
            <h2>Incident War Room Simulator</h2>
            <span className="badge badge-agora">Demo & Evaluation</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="modal-subtitle">
          Select an incident scenario to simulate live multi-speaker war room audio and watch the AI Commander extract facts, detect conflicts, and generate spoken updates in real time.
        </p>

        {/* Scenario Selection Tabs */}
        <div className="scenario-tabs">
          {PRESET_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              className={`scenario-tab-btn ${selectedScenario.id === sc.id ? "active" : ""}`}
              onClick={() => {
                handleReset();
                setSelectedScenario(sc);
              }}
            >
              <strong>{sc.title}</strong>
              <p>{sc.description}</p>
            </button>
          ))}
        </div>

        {/* Scenario Steps Preview */}
        <div className="scenario-dialogue-list">
          {selectedScenario.steps.map((step, idx) => {
            const isPlayed = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;

            return (
              <div
                key={idx}
                className={`dialogue-step ${isPlayed ? "step-played" : ""} ${isCurrent ? "step-current" : ""}`}
              >
                <div className="step-num">{idx + 1}</div>
                <div className="step-body">
                  <div className="step-speaker-row">
                    <strong className="speaker-name">{step.speaker}</strong>
                    <span className="speaker-role">({step.role})</span>
                    {isPlayed && <span className="played-tag">✓ Processed</span>}
                    {isCurrent && <span className="current-tag">Next Turn</span>}
                  </div>
                  <p className="step-text">"{step.text}"</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Simulator Control Bar */}
        <div className="modal-footer simulator-footer">
          <div className="sim-progress">
            Step {Math.min(currentStepIdx, selectedScenario.steps.length)} of {selectedScenario.steps.length}
          </div>

          <div className="sim-actions">
            <button className="btn btn-outline" onClick={handleReset}>
              <RotateCcw size={15} /> Reset
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleNextStep}
              disabled={currentStepIdx >= selectedScenario.steps.length}
            >
              <SkipForward size={15} /> Step Turn
            </button>

            <button
              className={`btn ${isPlaying ? "btn-danger" : "btn-gradient"}`}
              onClick={handleAutoPlay}
            >
              {isPlaying ? (
                <>
                  <Pause size={15} /> Pause Simulation
                </>
              ) : (
                <>
                  <Play size={15} /> Autoplay Scenario
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
