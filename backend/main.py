"""
Voice AI Incident Commander - FastAPI Backend
Manages Agora RTC Tokens & Agora Conversational AI Agent REST API endpoints.
Version 1.0.2
"""

import logging
import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agora_convo_ai import agora_convo_ai_manager
from agora_token import AgoraTokenBuilder

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("server")

load_dotenv()

app = FastAPI(
    title="EchoSphere Voice AI Incident Commander Backend",
    description="Agora RTC & Conversational AI Backend API",
    version="1.0.2",
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


class SettingsRequest(BaseModel):
    agora_app_id: Optional[str] = None
    agora_app_certificate: Optional[str] = None
    agora_customer_id: Optional[str] = None
    agora_customer_secret: Optional[str] = None
    agora_channel_name: Optional[str] = None


@app.get("/")
def root():
    return {
        "service": "EchoSphere Voice AI Incident Commander",
        "agora_conversational_ai": "enabled",
        "status": "online",
    }


@app.get("/api/health")
def health_check():
    """Check configuration and credential status without exposing secrets."""
    app_id = (agora_convo_ai_manager.app_id or os.getenv("AGORA_APP_ID", "")).strip()
    app_cert = (agora_convo_ai_manager.app_certificate or os.getenv("AGORA_APP_CERTIFICATE", "")).strip()
    customer_id = (agora_convo_ai_manager.customer_id or os.getenv("AGORA_CUSTOMER_ID", "")).strip()
    customer_secret = (agora_convo_ai_manager.customer_secret or os.getenv("AGORA_CUSTOMER_SECRET", "")).strip()
    channel_name = (agora_convo_ai_manager.channel_name or os.getenv("AGORA_CHANNEL_NAME", "incident-pay-2048")).strip()

    return {
        "status": "healthy",
        "agora_app_id": app_id,
        "agora_app_id_configured": bool(app_id),
        "agora_app_certificate_configured": bool(app_cert),
        "agora_convo_ai_configured": bool(customer_id and customer_secret),
        "channel_name": channel_name,
        "customer_id_set": bool(customer_id),
        "customer_secret_set": bool(customer_secret),
    }


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
    """Start the official Agora Conversational AI Agent in the specified channel."""
    logger.info(f"[AgentAPI] Starting Agora Conversational AI Agent in channel '{req.channel_name}'...")
    result = await agora_convo_ai_manager.start_agent(
        channel_name=req.channel_name,
        custom_prompt=req.custom_prompt,
    )
    return result


@app.post("/api/agora/agent/stop")
async def stop_agora_agent(req: AgentStopRequest):
    """Stop the official Agora Conversational AI Agent."""
    logger.info(f"[AgentAPI] Stopping Agora Conversational AI Agent in channel '{req.channel_name}'...")
    result = await agora_convo_ai_manager.stop_agent(
        channel_name=req.channel_name,
        agent_id=req.agent_id,
    )
    return result


@app.get("/api/agora/agent/status")
def get_agora_agent_status(channel_name: str = "incident-pay-2048"):
    """Get the running status of the Agora Conversational AI Agent."""
    return agora_convo_ai_manager.get_agent_status(channel_name=channel_name)


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
