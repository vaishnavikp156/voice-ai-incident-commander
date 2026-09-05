"""
Voice AI Incident Commander - FastAPI Backend
Manages Agora RTC Tokens & Agora Conversational AI Agent REST API endpoints.
Provides Multi-Person Incident Room engine with shared intelligence and persistent transcripts.
Version 1.1.0
"""

import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agora_convo_ai import agora_convo_ai_manager
from agora_token import AgoraTokenBuilder
from integrations import (
    jira_service,
    slack_service,
    pagerduty_service,
    monitoring_service,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("server")

load_dotenv()

app = FastAPI(
    title="EchoSphere Voice AI Incident Commander Backend",
    description="Agora RTC & Conversational AI Multi-Person Incident Backend API",
    version="1.1.0",
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def update_env_file(updates: Dict[str, str]):
    """Persist credential updates safely to backend/.env without wiping existing keys."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    existing_keys = set()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key, _ = stripped.split("=", 1)
            key = key.strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}\n")
                existing_keys.add(key)
                continue
        new_lines.append(line)

    for key, val in updates.items():
        if key not in existing_keys:
            new_lines.append(f"{key}={val}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    logger.info(f"[Settings] Persisted {list(updates.keys())} to {env_path}")


# Request Models
class TokenRequest(BaseModel):
    channel_name: str = "incident-pay-2048"
    uid: int = 0
    role: int = 1


class AgentStartRequest(BaseModel):
    channel_name: str = "incident-pay-2048"
    custom_prompt: Optional[str] = None


class AgentStopRequest(BaseModel):
    channel_name: str = "incident-pay-2048"
    agent_id: Optional[str] = None


class IncidentNewRequest(BaseModel):
    channel_name: Optional[str] = None


class IncidentJoinRequest(BaseModel):
    code: str
    uid: int
    display_name: str = "Engineer"
    role: Optional[str] = "Incident Responder"


class ActionUpdateRequest(BaseModel):
    code: Optional[str] = None
    channel_name: Optional[str] = None
    action_id: str
    status: str = "Completed"


class SettingsRequest(BaseModel):
    agora_app_id: Optional[str] = None
    agora_app_certificate: Optional[str] = None
    agora_customer_id: Optional[str] = None
    agora_customer_secret: Optional[str] = None
    agora_channel_name: Optional[str] = None


class JiraIssueCreateRequest(BaseModel):
    summary: str
    description: Optional[str] = ""
    issue_type: Optional[str] = "Task"
    priority: Optional[str] = "High"
    labels: Optional[List[str]] = None
    incident_id: Optional[str] = None


class SlackBroadcastRequest(BaseModel):
    incident_id: Optional[str] = None
    room_code: Optional[str] = None
    custom_note: Optional[str] = None


class PagerDutyTriggerRequest(BaseModel):
    incident_id: Optional[str] = None
    summary: str
    severity: Optional[str] = "critical"


class MonitoringCorrelateRequest(BaseModel):
    incident_id: Optional[str] = None
    metric_name: str
    metric_value: str
    source: Optional[str] = "Telemetry APM"


@app.get("/")
def root():
    active_inc = agora_convo_ai_manager.get_incident()
    return {
        "service": "EchoSphere Voice AI Incident Commander",
        "agora_conversational_ai": "enabled",
        "status": "online",
        "active_incident_id": active_inc.get("incident_id"),
        "active_channel_name": active_inc.get("channel_name"),
    }


@app.get("/api/health")
def health_check():
    """Check configuration and credential status without exposing secrets."""
    app_id = (agora_convo_ai_manager.app_id or os.getenv("AGORA_APP_ID", "")).strip()
    app_cert = (agora_convo_ai_manager.app_certificate or os.getenv("AGORA_APP_CERTIFICATE", "")).strip()
    customer_id = (agora_convo_ai_manager.customer_id or os.getenv("AGORA_CUSTOMER_ID", "")).strip()
    customer_secret = (agora_convo_ai_manager.customer_secret or os.getenv("AGORA_CUSTOMER_SECRET", "")).strip()

    active_inc = agora_convo_ai_manager.get_incident()

    return {
        "status": "healthy",
        "agora_app_id": app_id,
        "agora_app_id_configured": bool(app_id),
        "agora_app_certificate_configured": bool(app_cert),
        "agora_convo_ai_configured": bool(customer_id and customer_secret),
        "channel_name": active_inc.get("channel_name"),
        "incident_id": active_inc.get("incident_id"),
        "room_code": active_inc.get("room_code"),
        "customer_id_set": bool(customer_id),
        "customer_secret_set": bool(customer_secret),
    }


@app.get("/api/integrations/status")
def get_integrations_status():
    """Get connection and configuration status across Jira, Slack, PagerDuty, and Monitoring."""
    return {
        "jira": jira_service.get_status(),
        "slack": slack_service.get_status(),
        "pagerduty": pagerduty_service.get_status(),
        "monitoring": monitoring_service.get_status(),
    }


@app.post("/api/integrations/jira/issue")
async def create_jira_issue(req: JiraIssueCreateRequest):
    """Create an issue in Jira Cloud from an incident action item or summary."""
    return await jira_service.create_issue(
        summary=req.summary,
        description=req.description or req.summary,
        issue_type=req.issue_type or "Task",
        priority=req.priority or "High",
        labels=req.labels,
        incident_id=req.incident_id,
    )


@app.post("/api/integrations/slack/broadcast")
async def broadcast_slack_update(req: SlackBroadcastRequest):
    """Broadcast current incident situation update to configured Slack channel."""
    incident = agora_convo_ai_manager.get_incident(req.incident_id or req.room_code)
    snapshot = agora_convo_ai_manager.get_incident_record_snapshot(incident.get("incident_id"))

    key_facts = [f.get("text", "") for f in snapshot.get("facts", [])]
    active_actions = snapshot.get("actions", [])
    conflicts = [c.get("text", "") for c in snapshot.get("conflicts", [])]
    unresolved_risks = snapshot.get("unresolved_risks", [])

    summary = req.custom_note or snapshot.get("current_understanding") or "Active incident triage in progress."

    return await slack_service.broadcast_incident_update(
        incident_id=snapshot.get("incident_id", "INC-UNKNOWN"),
        room_code=snapshot.get("room_code", "UNKNOWN"),
        status=snapshot.get("status", "Active"),
        summary=summary,
        key_facts=key_facts,
        active_actions=active_actions,
        conflicts=conflicts,
        unresolved_risks=unresolved_risks,
    )


@app.post("/api/integrations/pagerduty/trigger")
async def trigger_pagerduty_incident(req: PagerDutyTriggerRequest):
    """Trigger or synchronize a PagerDuty incident event."""
    return await pagerduty_service.trigger_event(
        incident_id=req.incident_id or "INC-UNKNOWN",
        summary=req.summary,
        severity=req.severity or "critical",
    )


@app.get("/api/integrations/monitoring/metrics")
def get_monitoring_metrics():
    """Get system telemetry metrics (live if configured, or explicitly tagged DEMO/SIMULATED)."""
    return monitoring_service.get_current_metrics()


@app.post("/api/integrations/monitoring/correlate")
def correlate_monitoring_signal(req: MonitoringCorrelateRequest):
    """
    Correlate a monitoring metric signal into the incident room as a verified technical fact and timeline milestone.
    """
    incident = agora_convo_ai_manager.get_incident(req.incident_id)
    signal_fact = f"Telemetry Signal: {req.metric_name} reported at {req.metric_value} (Source: {req.source})"

    # Record as fact if not duplicate
    facts = incident.setdefault("facts", [])
    if not any(req.metric_name.lower() in f.get("text", "").lower() for f in facts):
        fact_id = f"fact-mon-{len(facts)+1}"
        now_ts = datetime.now().strftime("%H:%M:%S")
        facts.append({
            "id": fact_id,
            "text": signal_fact,
            "timestamp": now_ts,
            "speaker": "Monitoring",
        })
        incident.setdefault("timeline", []).append({
            "id": f"evt-mon-{int(time.time()*1000)}",
            "item_id": fact_id,
            "type": "fact",
            "text": signal_fact,
            "event": signal_fact,
            "timestamp": now_ts,
            "status": "Confirmed",
        })
        incident["last_updated"] = time.time()
        agora_convo_ai_manager._reconcile_incident_items(incident)
        agora_convo_ai_manager._save_persisted_incidents()

    return agora_convo_ai_manager.get_incident_record_snapshot(incident.get("incident_id"))


@app.post("/api/agora/token")
def get_agora_token(req: TokenRequest):
    """
    Generate Agora RTC Token for browser client using verified App ID & Certificate.
    """
    app_id = (agora_convo_ai_manager.app_id or os.getenv("AGORA_APP_ID", "")).strip()
    app_cert = (agora_convo_ai_manager.app_certificate or os.getenv("AGORA_APP_CERTIFICATE", "")).strip()

    if not app_id:
        raise HTTPException(
            status_code=400,
            detail="AGORA_APP_ID is not configured in backend/.env",
        )

    token = AgoraTokenBuilder.build_token_with_uid(
        app_id=app_id,
        app_certificate=app_cert,
        channel_name=req.channel_name,
        uid=req.uid,
        role=req.role,
    )

    logger.info(f"[TokenAPI] Generated RTC token for UID={req.uid} in channel '{req.channel_name}'")

    return {
        "app_id": app_id,
        "channel_name": req.channel_name,
        "uid": req.uid,
        "token": token,
        "is_mock": not bool(app_id),
    }


@app.post("/api/agora/agent/start")
async def start_agora_agent(req: AgentStartRequest):
    """Start the official Agora Conversational AI Agent in the specified room."""
    logger.info(f"[AgentAPI] Starting Agora Conversational AI Agent in channel '{req.channel_name}'...")
    result = await agora_convo_ai_manager.start_agent(
        channel_name=req.channel_name,
        custom_prompt=req.custom_prompt,
    )
    return result


@app.post("/api/agora/agent/stop")
async def stop_agora_agent(req: AgentStopRequest):
    """
    Stop the official Agora Conversational AI Agent.
    Preserves all extracted intelligence, timeline, and transcript records.
    """
    logger.info(f"[AgentAPI] Stop requested for channel '{req.channel_name}' (agent_id={req.agent_id})")
    result = await agora_convo_ai_manager.stop_agent(
        channel_name=req.channel_name,
        agent_id=req.agent_id,
    )
    inc_snapshot = result.get("incident", {})
    logger.info(f"[AgentAPI] Stop API completed for channel '{req.channel_name}': status={result.get('status')}, incident_agent_status={inc_snapshot.get('agent_status')}")
    return result


@app.get("/api/agora/agent/status")
def get_agora_agent_status(channel_name: Optional[str] = None):
    """Get the running status of the Agora Conversational AI Agent."""
    return agora_convo_ai_manager.get_agent_status(channel_name=channel_name)


@app.get("/api/agora/agent/history")
async def get_agora_agent_history(channel_name: Optional[str] = None):
    """Fetch raw conversation turns from the active Agora Conversational AI agent."""
    return await agora_convo_ai_manager.get_agent_history(channel_name=channel_name)


@app.get("/api/incident/intelligence")
async def get_incident_intelligence(
    channel_name: Optional[str] = None,
    incident_id: Optional[str] = None,
):
    """
    Extract structured incident intelligence (Facts, Hypotheses, Decisions, Actions, Conflicts)
    and conversation transcript for a specific incident room.
    """
    return await agora_convo_ai_manager.get_incident_intelligence(
        channel_name=channel_name,
        incident_id=incident_id,
    )


@app.get("/api/incident/current")
def get_current_incident(identifier: Optional[str] = None):
    """Get snapshot of current persistent incident record."""
    return agora_convo_ai_manager.get_incident_record_snapshot(identifier=identifier)


@app.get("/api/incident/lookup/{code}")
def lookup_incident_by_code(code: str):
    """Lookup incident room metadata by room code or channel name."""
    incident = agora_convo_ai_manager.get_incident(code)
    return agora_convo_ai_manager.get_incident_record_snapshot(incident.get("incident_id"))


@app.post("/api/incident/new")
def create_new_incident(req: IncidentNewRequest = IncidentNewRequest()):
    """
    Start a fresh incident record with a unique room code and clean board/notes.
    Does NOT affect Agora credentials or active RTC join.
    """
    logger.info(f"[IncidentAPI] Initiating new incident (channel={req.channel_name})")
    return agora_convo_ai_manager.create_new_incident(channel_name=req.channel_name)


@app.post("/api/incident/join")
def join_incident_room(req: IncidentJoinRequest):
    """
    Register a participant's presence and display name in an incident room.
    """
    logger.info(f"[IncidentAPI] User '{req.display_name}' (UID {req.uid}) joining room '{req.code}'")
    agora_convo_ai_manager.register_participant(
        identifier=req.code,
        uid=req.uid,
        display_name=req.display_name,
        role=req.role or "Incident Responder",
    )
    incident = agora_convo_ai_manager.get_incident(req.code)
    return agora_convo_ai_manager.get_incident_record_snapshot(incident.get("incident_id"))


@app.post("/api/incident/action/update")
def update_action_status(req: ActionUpdateRequest):
    """
    Update the status of an assigned action item (e.g. Completed).
    Preserves action in persistent record and updates timeline.
    """
    identifier = req.code or req.channel_name
    logger.info(f"[IncidentAPI] Updating action '{req.action_id}' status to '{req.status}' for room '{identifier}'")
    return agora_convo_ai_manager.update_action_status(
        identifier=identifier,
        action_id=req.action_id,
        status=req.status,
    )


@app.post("/api/settings")
def update_settings(req: SettingsRequest):
    """Update Agora credentials at runtime and persist non-empty values."""
    updates = {}
    if req.agora_app_id and req.agora_app_id.strip():
        updates["AGORA_APP_ID"] = req.agora_app_id.strip()
    if req.agora_app_certificate and req.agora_app_certificate.strip():
        updates["AGORA_APP_CERTIFICATE"] = req.agora_app_certificate.strip()
    if req.agora_customer_id and req.agora_customer_id.strip():
        updates["AGORA_CUSTOMER_ID"] = req.agora_customer_id.strip()
    if req.agora_customer_secret and req.agora_customer_secret.strip():
        updates["AGORA_CUSTOMER_SECRET"] = req.agora_customer_secret.strip()
    if req.agora_channel_name and req.agora_channel_name.strip():
        updates["AGORA_CHANNEL_NAME"] = req.agora_channel_name.strip()

    if updates:
        update_env_file(updates)

    agora_convo_ai_manager.set_credentials(
        app_id=req.agora_app_id if req.agora_app_id and req.agora_app_id.strip() else None,
        app_certificate=req.agora_app_certificate if req.agora_app_certificate and req.agora_app_certificate.strip() else None,
        customer_id=req.agora_customer_id if req.agora_customer_id and req.agora_customer_id.strip() else None,
        customer_secret=req.agora_customer_secret if req.agora_customer_secret and req.agora_customer_secret.strip() else None,
        channel_name=req.agora_channel_name if req.agora_channel_name and req.agora_channel_name.strip() else None,
    )

    return {
        "status": "updated",
        "app_id_set": bool(agora_convo_ai_manager.app_id),
        "app_cert_set": bool(agora_convo_ai_manager.app_certificate),
        "customer_id_set": bool(agora_convo_ai_manager.customer_id),
        "customer_secret_set": bool(agora_convo_ai_manager.customer_secret),
        "convo_ai_ready": bool(agora_convo_ai_manager.customer_id and agora_convo_ai_manager.customer_secret),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
