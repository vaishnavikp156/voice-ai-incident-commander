"""
Incident State Manager & Data Models
Maintains structured incident intelligence in real-time.
"""

from datetime import datetime, timezone
import json
import os
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid


class Participant(BaseModel):
    id: str
    name: str
    role: str
    email: Optional[str] = None
    avatar: str = "👤"
    is_speaking: bool = False
    is_muted: bool = False
    is_ai: bool = False
    joined_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Fact(BaseModel):
    id: str = Field(default_factory=lambda: f"fact-{uuid.uuid4().hex[:6]}")
    statement: str
    evidence: str = ""
    speaker: str = "System"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))
    verified: bool = True
    verified_by: str = "AI Commander"
    category: str = "system"


class Hypothesis(BaseModel):
    id: str = Field(default_factory=lambda: f"hypo-{uuid.uuid4().hex[:6]}")
    statement: str
    probability_pct: int = 70
    status: str = "Active"  # Active, Testing, Disproven, Validated
    speaker: str = "Team"
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))
    notes: str = ""


class Decision(BaseModel):
    id: str = Field(default_factory=lambda: f"dec-{uuid.uuid4().hex[:6]}")
    outcome: str
    rationale: str = ""
    agreed_by: List[str] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))


class ActionItem(BaseModel):
    id: str = Field(default_factory=lambda: f"act-{uuid.uuid4().hex[:6]}")
    task: str
    assignee: str
    role: str = "Engineer"
    status: str = "Pending"  # Pending, In Progress, Completed, Blocked
    priority: str = "High"   # Critical, High, Medium, Low
    due_in_min: int = 15
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))


class ConflictAlert(BaseModel):
    id: str = Field(default_factory=lambda: f"conf-{uuid.uuid4().hex[:6]}")
    title: str
    description: str
    speaker_a: str
    claim_a: str
    speaker_b: str
    claim_b: str
    severity: str = "High"  # High, Medium, Low
    requires_confirmation: bool = True
    is_resolved: bool = False
    resolution_note: str = ""
    detected_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))


class CriticalAction(BaseModel):
    id: str = Field(default_factory=lambda: f"crit-{uuid.uuid4().hex[:6]}")
    title: str
    description: str
    command_preview: str = ""
    service: str = "Payment Service"
    risk_level: str = "Critical"  # Critical, High
    status: str = "Pending Confirmation"  # Pending Confirmation, Approved, Rejected, Executed
    requested_by: str = "AI Commander"
    approved_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))
    executed_at: Optional[str] = None


class TimelineEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"time-{uuid.uuid4().hex[:6]}")
    time_str: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M"))
    timestamp: float = Field(default_factory=time.time)
    title: str
    description: str
    event_type: str = "investigation"  # alert, fact, hypothesis, action, decision, conflict, mitigation, resolution
    author: str = "AI Commander"


class TranscriptUtterance(BaseModel):
    id: str = Field(default_factory=lambda: f"utt-{uuid.uuid4().hex[:6]}")
    speaker: str
    role: str = "Team Member"
    text: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S"))
    tags: List[str] = Field(default_factory=list)  # fact, hypothesis, decision, action, conflict
    is_ai: bool = False


class TelemetryData(BaseModel):
    error_rate_pct: float = 42.8
    latency_p99_ms: int = 1420
    rps: int = 3450
    active_connections: int = 890
    history: List[Dict[str, Any]] = Field(default_factory=list)


class Incident(BaseModel):
    id: str = "PAY-2048"
    title: str = "Payment Service Outage"
    service: str = "Payment Service"
    severity: str = "Critical"  # Critical, Major, Minor, Informational
    state: str = "Investigating"  # Investigating, Identified, Mitigating, Monitoring, Resolved
    summary: str = "Payment failures remain elevated (42.8% error rate). Gateway investigation is in progress."
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))
    start_timestamp: float = Field(default_factory=time.time)
    resolved_at: Optional[str] = None
    participants: List[Participant] = Field(default_factory=list)
    facts: List[Fact] = Field(default_factory=list)
    hypotheses: List[Hypothesis] = Field(default_factory=list)
    decisions: List[Decision] = Field(default_factory=list)
    actions: List[ActionItem] = Field(default_factory=list)
    conflicts: List[ConflictAlert] = Field(default_factory=list)
    critical_actions: List[CriticalAction] = Field(default_factory=list)
    timeline: List[TimelineEvent] = Field(default_factory=list)
    transcripts: List[TranscriptUtterance] = Field(default_factory=list)
    telemetry: TelemetryData = Field(default_factory=TelemetryData)
    integrations: Dict[str, Any] = Field(default_factory=dict)


class IncidentManager:
    """In-memory store and lifecycle manager for incidents."""

    def __init__(self):
        self.incidents: Dict[str, Incident] = {}
        self.active_incident_id = "PAY-2048"
        self._init_default_incident()

    def _init_default_incident(self):
        """Seed the realistic initial incident state matching PPT Slide 7."""
        inc = Incident(
            id="PAY-2048",
            title="Payment Service Outage",
            service="Payment Service",
            severity="Critical",
            state="Investigating",
            summary="Payment failures remain elevated. Gateway investigation is in progress.",
            participants=[
                Participant(id="p1", name="Vaishnavi K P", role="Incident Commander", avatar="👑", email="vaishnavikp156@gmail.com"),
                Participant(id="p2", name="Rahul Sharma", role="Lead SRE", avatar="⚡", is_speaking=True),
                Participant(id="p3", name="Priya Patel", role="Database Admin", avatar="🗄️"),
                Participant(id="p4", name="Arun Verma", role="Backend Lead", avatar="💻"),
                Participant(id="p5", name="Echo Commander", role="Voice AI Commander", avatar="🤖", is_ai=True),
            ],
            facts=[
                Fact(
                    statement="Payment API error rate is elevated at 42.8%",
                    evidence="Datadog alert & Grafana dashboard (HTTP 502/504)",
                    speaker="Rahul Sharma",
                    timestamp="10:05:12",
                    category="metrics",
                ),
                Fact(
                    statement="Stripe Webhook response latency exceeds 5000ms threshold",
                    evidence="Ingress Gateway access logs",
                    speaker="Rahul Sharma",
                    timestamp="10:07:44",
                    category="network",
                ),
            ],
            hypotheses=[
                Hypothesis(
                    statement="Third-party payment gateway or rate limit is contributing to failures",
                    probability_pct=85,
                    status="Active",
                    speaker="Rahul Sharma",
                    timestamp="10:08:20",
                    notes="Investigating upstream status page and auth tokens",
                ),
                Hypothesis(
                    statement="Recent v2.4 deployment introduced database connection leak",
                    probability_pct=40,
                    status="Testing",
                    speaker="Priya Patel",
                    timestamp="10:09:55",
                    notes="Checking pool stats on replica US-East",
                ),
            ],
            decisions=[
                Decision(
                    outcome="Throttle non-essential batch payment syncs to reduce gateway pressure",
                    rationale="Free up network connection slots for user checkout flow",
                    agreed_by=["Vaishnavi K P", "Rahul Sharma"],
                    timestamp="10:11:00",
                ),
            ],
            actions=[
                ActionItem(
                    task="Investigate payment gateway API endpoint & auth tokens",
                    assignee="Rahul Sharma",
                    role="Lead SRE",
                    status="In Progress",
                    priority="Critical",
                    due_in_min=10,
                ),
                ActionItem(
                    task="Verify service rollback status to v2.3.9",
                    assignee="Priya Patel",
                    role="Database Admin",
                    status="Pending",
                    priority="High",
                    due_in_min=15,
                ),
                ActionItem(
                    task="Broadcast incident briefing to customer support channel",
                    assignee="Arun Verma",
                    role="Backend Lead",
                    status="Completed",
                    priority="Medium",
                    due_in_min=5,
                ),
            ],
            conflicts=[
                ConflictAlert(
                    title="Conflicting Rollback Status Detected",
                    description="Rahul stated that deployment rollback to v2.3.9 completed 5 minutes ago, while Priya noted v2.4 pods are still receiving 100% traffic.",
                    speaker_a="Rahul Sharma",
                    claim_a="Rollback to v2.3.9 is complete across cluster.",
                    speaker_b="Priya Patel",
                    claim_b="v2.4 pods are still active in traffic mesh routing.",
                    severity="High",
                    requires_confirmation=True,
                    is_resolved=False,
                ),
            ],
            critical_actions=[
                CriticalAction(
                    title="Emergency Rollback Payment Service to v2.3.9",
                    description="Reverts payment-api container image to tag v2.3.9 and drains active canary traffic.",
                    command_preview="kubectl rollout undo deployment/payment-api -n prod",
                    service="Payment Service",
                    risk_level="Critical",
                    status="Pending Confirmation",
                    requested_by="AI Commander (based on discussion)",
                ),
                CriticalAction(
                    title="Failover Database Pool to Replica-02 (US-East)",
                    description="Reroutes read-write connection string to warm standby pool to relieve master contention.",
                    command_preview="consul kv put services/payment/db-endpoint pgbouncer-replica-02.internal",
                    service="Postgres Cluster",
                    risk_level="High",
                    status="Pending Confirmation",
                    requested_by="Priya Patel",
                ),
            ],
            timeline=[
                TimelineEvent(time_str="10:02", title="Payment Outage Alert Triggered", description="PagerDuty triggered Sev-1 incident #PAY-2048", event_type="alert", author="PagerDuty"),
                TimelineEvent(time_str="10:05", title="Error Rate Surge Confirmed", description="API 502/504 errors reached 42.8%", event_type="fact", author="Rahul Sharma"),
                TimelineEvent(time_str="10:08", title="Gateway Dependency Suspected", description="Marked third-party gateway as primary hypothesis", event_type="hypothesis", author="Rahul Sharma"),
                TimelineEvent(time_str="10:11", title="Batch Sync Throttled", description="Commander approved non-essential traffic throttling", event_type="decision", author="Vaishnavi K P"),
                TimelineEvent(time_str="10:12", title="Investigation Assigned", description="Rahul assigned to inspect API gateway tokens", event_type="action", author="Echo Commander"),
                TimelineEvent(time_str="10:14", title="Conflict Flagged by AI", description="Mismatched rollback status detected between Rahul and Priya", event_type="conflict", author="Echo Commander"),
            ],
            transcripts=[
                TranscriptUtterance(speaker="Vaishnavi K P", role="Incident Commander", text="Welcome everyone to the Sev-1 war room for Payment Service outage. Let's get situational awareness. Rahul, what's the latest?", timestamp="10:04:10"),
                TranscriptUtterance(speaker="Rahul Sharma", role="Lead SRE", text="Error rate is currently sitting at 42.8% on payment-api. Latency is spiking over 5 seconds.", timestamp="10:05:02", tags=["fact"]),
                TranscriptUtterance(speaker="Rahul Sharma", role="Lead SRE", text="I suspect the payment gateway upstream is rate limiting us or down.", timestamp="10:08:15", tags=["hypothesis"]),
                TranscriptUtterance(speaker="Vaishnavi K P", role="Incident Commander", text="Let's throttle background sync jobs immediately so checkout traffic gets priority.", timestamp="10:10:50", tags=["decision"]),
                TranscriptUtterance(speaker="Rahul Sharma", role="Lead SRE", text="I just ran the rollback command to v2.3.9 five minutes ago, so that should be done.", timestamp="10:13:20", tags=["fact"]),
                TranscriptUtterance(speaker="Priya Patel", role="Database Admin", text="Wait Rahul, I'm checking Consul mesh and v2.4 pods are still receiving live requests.", timestamp="10:14:05", tags=["conflict"]),
                TranscriptUtterance(speaker="Echo Commander", role="Voice AI Commander", text="Attention team: Conflicting information detected regarding rollback status. Commander confirmation required before proceeding.", timestamp="10:14:15", is_ai=True, tags=["conflict"]),
            ],
            telemetry=TelemetryData(
                error_rate_pct=42.8,
                latency_p99_ms=1420,
                rps=3450,
                active_connections=890,
                history=[
                    {"time": "10:00", "error_rate": 0.4, "latency": 120},
                    {"time": "10:02", "error_rate": 18.2, "latency": 650},
                    {"time": "10:05", "error_rate": 42.8, "latency": 1420},
                    {"time": "10:08", "error_rate": 41.5, "latency": 1380},
                    {"time": "10:12", "error_rate": 38.0, "latency": 1290},
                    {"time": "10:15", "error_rate": 35.4, "latency": 1150},
                ],
            ),
            integrations={
                "jira": {
                    "issue_key": "INC-2048",
                    "status": "In Progress",
                    "url": "https://echosphere-incidents.atlassian.net/browse/INC-2048",
                    "synced_at": "10:06:00",
                },
                "slack": {
                    "channel": "#incident-pay-2048-war-room",
                    "status": "Broadcasting",
                    "members": 14,
                    "last_message": "AI Commander posted live briefing (10:12 AM)",
                },
                "pagerduty": {
                    "incident_number": "PD-98421",
                    "status": "Triggered",
                    "urgency": "High",
                    "escalation_policy": "Tier-1 SRE & DBAs",
                    "assigned_to": "Vaishnavi K P (Commander)",
                },
            },
        )
        self.incidents[inc.id] = inc

    def get_incident(self, incident_id: str = "PAY-2048") -> Optional[Incident]:
        if incident_id not in self.incidents:
            self._init_default_incident()
        return self.incidents.get(incident_id)

    def add_fact(self, incident_id: str, fact: Fact) -> Fact:
        inc = self.get_incident(incident_id)
        if inc:
            inc.facts.append(fact)
            inc.timeline.append(
                TimelineEvent(
                    title="New Fact Verified",
                    description=fact.statement,
                    event_type="fact",
                    author=fact.speaker,
                )
            )
        return fact

    def add_hypothesis(self, incident_id: str, hypothesis: Hypothesis) -> Hypothesis:
        inc = self.get_incident(incident_id)
        if inc:
            inc.hypotheses.append(hypothesis)
            inc.timeline.append(
                TimelineEvent(
                    title="Hypothesis Recorded",
                    description=hypothesis.statement,
                    event_type="hypothesis",
                    author=hypothesis.speaker,
                )
            )
        return hypothesis

    def add_decision(self, incident_id: str, decision: Decision) -> Decision:
        inc = self.get_incident(incident_id)
        if inc:
            inc.decisions.append(decision)
            inc.timeline.append(
                TimelineEvent(
                    title="Decision Reached",
                    description=decision.outcome,
                    event_type="decision",
                    author=", ".join(decision.agreed_by) if decision.agreed_by else "Team",
                )
            )
        return decision

    def add_action(self, incident_id: str, action: ActionItem) -> ActionItem:
        inc = self.get_incident(incident_id)
        if inc:
            inc.actions.append(action)
            inc.timeline.append(
                TimelineEvent(
                    title=f"Action Assigned: {action.assignee}",
                    description=action.task,
                    event_type="action",
                    author="AI Commander",
                )
            )
        return action

    def toggle_action_status(self, incident_id: str, action_id: str, new_status: Optional[str] = None) -> Optional[ActionItem]:
        inc = self.get_incident(incident_id)
        if not inc:
            return None
        for act in inc.actions:
            if act.id == action_id:
                if new_status:
                    act.status = new_status
                else:
                    cycle = {"Pending": "In Progress", "In Progress": "Completed", "Completed": "Pending", "Blocked": "In Progress"}
                    act.status = cycle.get(act.status, "In Progress")
                return act
        return None

    def add_conflict(self, incident_id: str, conflict: ConflictAlert) -> ConflictAlert:
        inc = self.get_incident(incident_id)
        if inc:
            inc.conflicts.append(conflict)
            inc.timeline.append(
                TimelineEvent(
                    title="⚠️ Conflict Detected",
                    description=conflict.title,
                    event_type="conflict",
                    author="AI Commander",
                )
            )
        return conflict

    def resolve_conflict(self, incident_id: str, conflict_id: str, resolution_note: str = "") -> Optional[ConflictAlert]:
        inc = self.get_incident(incident_id)
        if not inc:
            return None
        for conf in inc.conflicts:
            if conf.id == conflict_id:
                conf.is_resolved = True
                conf.resolution_note = resolution_note or "Resolved by Incident Commander"
                conf.requires_confirmation = False
                inc.timeline.append(
                    TimelineEvent(
                        title="Conflict Resolved",
                        description=f"{conf.title}: {conf.resolution_note}",
                        event_type="decision",
                        author="Incident Commander",
                    )
                )
                return conf
        return None

    def confirm_critical_action(self, incident_id: str, action_id: str, approved: bool, commander_name: str = "Vaishnavi K P") -> Optional[CriticalAction]:
        inc = self.get_incident(incident_id)
        if not inc:
            return None
        for crit in inc.critical_actions:
            if crit.id == action_id:
                crit.status = "Approved" if approved else "Rejected"
                crit.approved_by = commander_name
                crit.executed_at = datetime.now(timezone.utc).strftime("%H:%M:%S") if approved else None
                inc.timeline.append(
                    TimelineEvent(
                        title=f"Critical Action {'APPROVED' if approved else 'REJECTED'}",
                        description=f"{crit.title} by {commander_name}",
                        event_type="mitigation" if approved else "decision",
                        author=commander_name,
                    )
                )
                if approved:
                    # Simulate immediate recovery in telemetry metrics
                    inc.telemetry.error_rate_pct = max(0.5, inc.telemetry.error_rate_pct * 0.15)
                    inc.telemetry.latency_p99_ms = max(180, int(inc.telemetry.latency_p99_ms * 0.3))
                    inc.state = "Mitigating"
                    inc.summary = f"Mitigation in progress: {crit.title} approved and applied. Telemetry recovering."
                return crit
        return None

    def add_transcript(self, incident_id: str, utterance: TranscriptUtterance) -> TranscriptUtterance:
        inc = self.get_incident(incident_id)
        if inc:
            inc.transcripts.append(utterance)
        return utterance

    def update_severity_state(self, incident_id: str, severity: Optional[str] = None, state: Optional[str] = None) -> Incident:
        inc = self.get_incident(incident_id)
        if inc:
            if severity:
                inc.severity = severity
            if state:
                inc.state = state
                if state == "Resolved":
                    inc.resolved_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
                    inc.telemetry.error_rate_pct = 0.05
                    inc.telemetry.latency_p99_ms = 95
                    inc.timeline.append(
                        TimelineEvent(
                            title="🎉 Incident Resolved",
                            description="All telemetry nominal. Incident Commander signed off.",
                            event_type="resolution",
                            author="Vaishnavi K P",
                        )
                    )
        return inc


incident_manager = IncidentManager()
