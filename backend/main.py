"""
Voice AI Incident Commander - Backend API & WebSocket Server
Handles Agora RTC Voice Tokens, Real-Time AI Intelligence Processing,
WebSocket broadcasting, and incident management.
"""

from datetime import datetime, timezone
import json
import os
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from agora_token import AgoraTokenBuilder
from ai_engine import ai_engine
from incident_manager import (
    ActionItem,
    ConflictAlert,
    CriticalAction,
    Decision,
    Fact,
    Hypothesis,
    Incident,
    TimelineEvent,
    TranscriptUtterance,
    incident_manager,
)
from integrations import integrations_service

load_dotenv()

app = FastAPI(
    title="Voice AI Incident Commander API",
    description="Real-Time Voice AI Incident Commander Backend (Agora Hackathon 2026 - EchoSphere / LogicLoop)",
    version="2.0.0",
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket Connection Manager for live real-time sync
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, incident_id: str, websocket: WebSocket):
        await websocket.accept()
        if incident_id not in self.active_connections:
            self.active_connections[incident_id] = []
        self.active_connections[incident_id].append(websocket)

    def disconnect(self, incident_id: str, websocket: WebSocket):
        if incident_id in self.active_connections:
            if websocket in self.active_connections[incident_id]:
                self.active_connections[incident_id].remove(websocket)

    async def broadcast(self, incident_id: str, message: Dict[str, Any]):
        if incident_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[incident_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)
            for dead in dead_connections:
                self.active_connections[incident_id].remove(dead)


manager = ConnectionManager()


# Request / Response Schemas
class TokenRequest(BaseModel):
    channel_name: str = "incident-pay-2048"
    uid: int = 0
    user_account: Optional[str] = None
    role: int = 1


class UtteranceRequest(BaseModel):
    incident_id: str = "PAY-2048"
    speaker: str
    role: str = "Team Member"
    text: str


class ActionToggleRequest(BaseModel):
    new_status: Optional[str] = None


class ConflictResolveRequest(BaseModel):
    resolution_note: str = "Resolved by Incident Commander"


class CriticalConfirmRequest(BaseModel):
    approved: bool
    commander_name: str = "Vaishnavi K P"


class CriticalProposeRequest(BaseModel):
    title: str
    description: str
    command_preview: str = ""
    service: str = "Payment Service"
    risk_level: str = "Critical"
    requested_by: str = "AI Commander"


class IncidentStateUpdateRequest(BaseModel):
    severity: Optional[str] = None
    state: Optional[str] = None
    summary: Optional[str] = None


class SettingsUpdateRequest(BaseModel):
    agora_app_id: Optional[str] = None
    agora_app_certificate: Optional[str] = None
    gemini_api_key: Optional[str] = None


@app.get("/")
def root():
    return {
        "service": "Voice AI Incident Commander",
        "track": "Voice AI Incident Commander",
        "team": "LogicLoop / EchoSphere",
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "agora_configured": bool(os.getenv("AGORA_APP_ID")),
        "gemini_configured": bool(ai_engine.api_key),
    }


# Agora Token Endpoint
@app.post("/api/agora/token")
def get_agora_token(req: TokenRequest):
    """Generate Agora RTC Token for real-time voice channel."""
    app_id = os.getenv("AGORA_APP_ID", "")
    app_certificate = os.getenv("AGORA_APP_CERTIFICATE", "")

    if req.user_account:
        token = AgoraTokenBuilder.build_token_with_user_account(
            app_id=app_id,
            app_certificate=app_certificate,
            channel_name=req.channel_name,
            user_account=req.user_account,
            role=req.role,
        )
    else:
        token = AgoraTokenBuilder.build_token_with_uid(
            app_id=app_id,
            app_certificate=app_certificate,
            channel_name=req.channel_name,
            uid=req.uid,
            role=req.role,
        )

    return {
        "token": token,
        "app_id": app_id or "demo_agora_app_id",
        "channel_name": req.channel_name,
        "uid": req.uid,
        "is_mock": not bool(app_id),
    }


# Incident State Endpoints
@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str):
    inc = incident_manager.get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc


@app.post("/api/incidents/{incident_id}/state")
async def update_incident_state(incident_id: str, req: IncidentStateUpdateRequest):
    inc = incident_manager.update_severity_state(incident_id, severity=req.severity, state=req.state)
    if req.summary:
        inc.summary = req.summary

    await manager.broadcast(
        incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump(),
        },
    )
    return inc


# AI Intelligence & Utterance Analysis Endpoint
@app.post("/api/ai/analyze-utterance")
async def analyze_utterance(req: UtteranceRequest):
    """
    Process spoken speech from incident call.
    Extracts Facts, Hypotheses, Decisions, Actions, and Contradictions in real-time.
    """
    inc = incident_manager.get_incident(req.incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Run AI Analysis
    analysis = await ai_engine.analyze_utterance(
        incident=inc,
        speaker=req.speaker,
        role=req.role,
        text=req.text,
    )

    tags = analysis.get("tags", ["general"])

    # Record transcript utterance
    transcript_item = TranscriptUtterance(
        speaker=req.speaker,
        role=req.role,
        text=req.text,
        tags=tags,
    )
    incident_manager.add_transcript(req.incident_id, transcript_item)

    # 1. Fact extraction
    if analysis.get("fact"):
        fact_data = analysis["fact"]
        new_fact = Fact(
            statement=fact_data["statement"],
            evidence=fact_data.get("evidence", f"Spoken by {req.speaker}"),
            speaker=req.speaker,
            category=fact_data.get("category", "system"),
        )
        incident_manager.add_fact(req.incident_id, new_fact)

    # 2. Hypothesis extraction
    if analysis.get("hypothesis"):
        hypo_data = analysis["hypothesis"]
        new_hypo = Hypothesis(
            statement=hypo_data["statement"],
            probability_pct=hypo_data.get("probability_pct", 75),
            speaker=req.speaker,
        )
        incident_manager.add_hypothesis(req.incident_id, new_hypo)

    # 3. Decision extraction
    if analysis.get("decision"):
        dec_data = analysis["decision"]
        new_dec = Decision(
            outcome=dec_data["outcome"],
            rationale=dec_data.get("rationale", ""),
            agreed_by=dec_data.get("agreed_by", [req.speaker]),
        )
        incident_manager.add_decision(req.incident_id, new_dec)

    # 4. Action extraction
    if analysis.get("action"):
        act_data = analysis["action"]
        new_act = ActionItem(
            task=act_data["task"],
            assignee=act_data.get("assignee", req.speaker),
            role=act_data.get("role", req.role),
            priority=act_data.get("priority", "High"),
            due_in_min=act_data.get("due_in_min", 15),
        )
        incident_manager.add_action(req.incident_id, new_act)

    # 5. Conflict extraction
    if analysis.get("conflict"):
        conf_data = analysis["conflict"]
        new_conf = ConflictAlert(
            title=conf_data.get("title", "Conflicting Information Detected"),
            description=conf_data.get("description", ""),
            speaker_a=conf_data.get("speaker_a", "Previous Speaker"),
            claim_a=conf_data.get("claim_a", ""),
            speaker_b=conf_data.get("speaker_b", req.speaker),
            claim_b=conf_data.get("claim_b", req.text),
            severity=conf_data.get("severity", "High"),
            requires_confirmation=True,
        )
        incident_manager.add_conflict(req.incident_id, new_conf)

    # 6. Critical Action Proposal
    if analysis.get("critical_action_proposal"):
        crit_data = analysis["critical_action_proposal"]
        new_crit = CriticalAction(
            title=crit_data.get("title", "Critical Action Proposed"),
            description=crit_data.get("description", ""),
            command_preview=crit_data.get("command_preview", ""),
            risk_level=crit_data.get("risk_level", "Critical"),
            requested_by=req.speaker,
        )
        inc.critical_actions.append(new_crit)
        inc.timeline.append(
            TimelineEvent(
                title="Critical Action Queued for Human Confirmation",
                description=new_crit.title,
                event_type="action",
                author="AI Commander",
            )
        )

    # AI voice response if present
    ai_response_text = analysis.get("ai_response")
    if ai_response_text:
        ai_utterance = TranscriptUtterance(
            speaker="Echo Commander",
            role="Voice AI Commander",
            text=ai_response_text,
            tags=["ai_commander"],
            is_ai=True,
        )
        incident_manager.add_transcript(req.incident_id, ai_utterance)

    # Broadcast updated full state over WebSocket
    await manager.broadcast(
        req.incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump(),
            "latest_analysis": analysis,
            "spoken_response": ai_response_text,
        },
    )

    return {
        "analysis": analysis,
        "incident": inc,
        "spoken_response": ai_response_text,
    }


# Spoken Incident Briefing
@app.post("/api/ai/briefing")
async def get_spoken_briefing(incident_id: str = "PAY-2048"):
    inc = incident_manager.get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    briefing = await ai_engine.generate_spoken_briefing(inc)

    # Add as transcript and timeline event
    ai_item = TranscriptUtterance(
        speaker="Echo Commander",
        role="Voice AI Commander",
        text=briefing["spoken_text"],
        tags=["ai_briefing"],
        is_ai=True,
    )
    incident_manager.add_transcript(incident_id, ai_item)
    inc.timeline.append(
        TimelineEvent(
            title="Spoken Briefing Delivered",
            description="AI Commander delivered spoken alignment update to team",
            event_type="fact",
            author="Echo Commander",
        )
    )

    await manager.broadcast(
        incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump(),
            "spoken_briefing": briefing["spoken_text"],
        },
    )

    return briefing


# Action Status Toggle
@app.post("/api/actions/{incident_id}/{action_id}/toggle")
async def toggle_action(incident_id: str, action_id: str, req: ActionToggleRequest):
    act = incident_manager.toggle_action_status(incident_id, action_id, req.new_status)
    if not act:
        raise HTTPException(status_code=404, detail="Action not found")

    inc = incident_manager.get_incident(incident_id)
    await manager.broadcast(
        incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump() if inc else None,
        },
    )
    return act


# Conflict Resolution
@app.post("/api/conflicts/{incident_id}/{conflict_id}/resolve")
async def resolve_conflict(incident_id: str, conflict_id: str, req: ConflictResolveRequest):
    conf = incident_manager.resolve_conflict(incident_id, conflict_id, req.resolution_note)
    if not conf:
        raise HTTPException(status_code=404, detail="Conflict not found")

    inc = incident_manager.get_incident(incident_id)
    await manager.broadcast(
        incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump() if inc else None,
        },
    )
    return conf


# Human Confirmation for Critical Actions
@app.post("/api/actions/critical/{incident_id}/{action_id}/confirm")
async def confirm_critical_action(incident_id: str, action_id: str, req: CriticalConfirmRequest):
    crit = incident_manager.confirm_critical_action(
        incident_id=incident_id,
        action_id=action_id,
        approved=req.approved,
        commander_name=req.commander_name,
    )
    if not crit:
        raise HTTPException(status_code=404, detail="Critical action not found")

    inc = incident_manager.get_incident(incident_id)
    await manager.broadcast(
        incident_id,
        {
            "type": "INCIDENT_UPDATED",
            "incident": inc.model_dump() if inc else None,
            "critical_action_event": {
                "action_id": action_id,
                "approved": req.approved,
                "title": crit.title,
            },
        },
    )
    return crit


# Integrations Endpoints
@app.post("/api/integrations/jira")
async def sync_jira_ticket(incident_id: str = "PAY-2048"):
    inc = incident_manager.get_incident(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    res = await integrations_service.sync_jira(inc.id, inc.title, inc.severity, inc.summary)
    return res


@app.post("/api/integrations/slack")
async def post_slack_message(message: str, incident_id: str = "PAY-2048", channel: str = ""):
    res = await integrations_service.post_slack(channel, message, incident_id)
    return res


@app.post("/api/integrations/pagerduty")
async def trigger_pagerduty_escalation(incident_id: str = "PAY-2048"):
    inc = incident_manager.get_incident(incident_id)
    service = inc.service if inc else "Payment Service"
    res = await integrations_service.trigger_pagerduty(incident_id, service, "Critical")
    return res


# Dynamic Settings Update (Agora Keys / Gemini API Key)
@app.post("/api/settings")
def update_settings(req: SettingsUpdateRequest):
    if req.agora_app_id is not None:
        os.environ["AGORA_APP_ID"] = req.agora_app_id
    if req.agora_app_certificate is not None:
        os.environ["AGORA_APP_CERTIFICATE"] = req.agora_app_certificate
    if req.gemini_api_key is not None:
        ai_engine.set_api_key(req.gemini_api_key)
        os.environ["GEMINI_API_KEY"] = req.gemini_api_key

    return {
        "status": "updated",
        "agora_app_id_set": bool(os.getenv("AGORA_APP_ID")),
        "gemini_api_key_set": bool(ai_engine.api_key),
    }


# WebSocket Route for bidirectional live incident war room sync
@app.websocket("/ws/incident/{incident_id}")
async def websocket_endpoint(websocket: WebSocket, incident_id: str):
    await manager.connect(incident_id, websocket)
    try:
        # Send initial full incident state immediately on connection
        inc = incident_manager.get_incident(incident_id)
        if inc:
            await websocket.send_json({
                "type": "INITIAL_STATE",
                "incident": inc.model_dump(),
            })

        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                # Handle client-side events like speaker talking status or live audio ping
                if payload.get("type") == "SPEAKER_TALKING":
                    await manager.broadcast(incident_id, payload)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(incident_id, websocket)