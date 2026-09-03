"""
Agora Conversational AI REST API v2 Manager
Deploys and manages cloud-based Agora AI Voice Agents directly inside Agora RTC voice channels.
"""

import base64
import json
import logging
import os
import time
from typing import Any, Dict, Optional
import httpx
from dotenv import load_dotenv

from agora_token import AgoraTokenBuilder

# Load .env on startup
load_dotenv()
logger = logging.getLogger("agora_convo_ai")

AGORA_CONVO_AI_BASE_URL = "https://api.agora.io/api/conversational-ai-agent/v2/projects"

INCIDENT_COMMANDER_SYSTEM_PROMPT = """You are Echo Commander, an AI Incident Commander participating in a live technical incident room.
Channel: Payment Service Outage (#PAY-2048).
Your mission:
1. Listen carefully to engineers and leads in real time over Agora voice.
2. Maintain situational awareness: organize facts, assumptions, and decisions.
3. If two engineers make contradictory statements (e.g., SRE says canary is healthy, but DBA reports 500 error spikes), immediately point out the discrepancy.
4. Keep spoken responses extremely short, concise, and professional (1-2 sentences max).
5. If someone suggests a high-risk action (database failover, pod rollback, DNS change), remind the room that Incident Commander confirmation is required before execution."""


class AgoraConvoAIManager:
    """Manages Agora Conversational AI Agent lifecycle using official Agora v2 REST API."""

    def __init__(self):
        self.app_id = os.getenv("AGORA_APP_ID", "").strip()
        self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE", "").strip()
        self.customer_id = os.getenv("AGORA_CUSTOMER_ID", "").strip()
        self.customer_secret = os.getenv("AGORA_CUSTOMER_SECRET", "").strip()
        self.agent_rtc_uid = int(os.getenv("AGORA_AGENT_RTC_UID", "9999"))
        self.channel_name = os.getenv("AGORA_CHANNEL_NAME", "incident-pay-2048").strip()

        # Track active agent state
        self.active_agent: Optional[Dict[str, Any]] = None

    def set_credentials(
        self,
        app_id: Optional[str] = None,
        app_certificate: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_secret: Optional[str] = None,
        channel_name: Optional[str] = None,
    ):
        """Update credentials in-memory immediately."""
        if app_id:
            self.app_id = app_id.strip()
            os.environ["AGORA_APP_ID"] = self.app_id
        if app_certificate:
            self.app_certificate = app_certificate.strip()
            os.environ["AGORA_APP_CERTIFICATE"] = self.app_certificate
        if customer_id:
            self.customer_id = customer_id.strip()
            os.environ["AGORA_CUSTOMER_ID"] = self.customer_id
        if customer_secret:
            self.customer_secret = customer_secret.strip()
            os.environ["AGORA_CUSTOMER_SECRET"] = self.customer_secret
        if channel_name:
            self.channel_name = channel_name.strip()
            os.environ["AGORA_CHANNEL_NAME"] = self.channel_name

        logger.info(
            f"[AgoraConvoAI] Credentials updated: AppID={bool(self.app_id)}, "
            f"CustomerID={bool(self.customer_id)}, CustomerSecret={bool(self.customer_secret)}"
        )

    def refresh_from_env(self):
        """Sync from environment variables without overriding non-empty in-memory values."""
        if not self.app_id:
            self.app_id = os.getenv("AGORA_APP_ID", "").strip()
        if not self.app_certificate:
            self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE", "").strip()
        if not self.customer_id:
            self.customer_id = os.getenv("AGORA_CUSTOMER_ID", "").strip()
        if not self.customer_secret:
            self.customer_secret = os.getenv("AGORA_CUSTOMER_SECRET", "").strip()
        if not self.channel_name:
            self.channel_name = os.getenv("AGORA_CHANNEL_NAME", "incident-pay-2048").strip()

    def _get_auth_header(self) -> Dict[str, str]:
        """Generate HTTP Basic Auth header."""
        if not self.customer_id or not self.customer_secret:
            return {}
        credentials = f"{self.customer_id}:{self.customer_secret}"
        encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    async def start_agent(
        self,
        channel_name: Optional[str] = None,
        custom_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Start an Agora Conversational AI Voice Agent in the specified channel.
        Calls Agora REST API: POST /api/conversational-ai-agent/v2/projects/{appid}/join
        """
        self.refresh_from_env()
        channel = channel_name or self.channel_name
        prompt = custom_prompt or INCIDENT_COMMANDER_SYSTEM_PROMPT

        if not self.app_id:
            return {
                "success": False,
                "status": "ERROR",
                "error": "AGORA_APP_ID is missing in backend/.env",
            }

        # Generate RTC publisher token for the AI agent (UID 9999)
        agent_token = AgoraTokenBuilder.build_token_with_uid(
            app_id=self.app_id,
            app_certificate=self.app_certificate,
            channel_name=channel,
            uid=self.agent_rtc_uid,
            role=AgoraTokenBuilder.ROLE_PUBLISHER,
            privilege_expired_ts=int(time.time()) + 86400,
        )

        logger.info(f"[AgoraConvoAI] Generated token for Agent UID {self.agent_rtc_uid} in channel '{channel}'")

        if not self.customer_id or not self.customer_secret:
            return {
                "success": False,
                "status": "MISSING_CREDENTIALS",
                "error": "AGORA_CUSTOMER_ID and AGORA_CUSTOMER_SECRET are required in backend/.env to start the cloud AI agent. Get them from Agora Console -> RESTful API.",
                "agora_app_id": self.app_id,
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
            }

        url = f"{AGORA_CONVO_AI_BASE_URL}/{self.app_id}/join"
        headers = self._get_auth_header()
        agent_name = f"EchoCommander_{int(time.time())}"

        # Use official Agora Conversational AI preset pipeline
        payload = {
            "name": agent_name,
            "preset": "deepgram_nova_2,openai_gpt_4o_mini,openai_tts_1",
            "properties": {
                "channel": channel,
                "token": agent_token,
                "agent_rtc_uid": str(self.agent_rtc_uid),
                "remote_rtc_uids": ["*"],
                "enable_string_uid": False,
                "idle_timeout": 300,
                "llm": {
                    "system_messages": [
                        {"role": "system", "content": prompt}
                    ],
                    "greeting_message": "Echo Incident Commander online. Listening to channel.",
                },
            },
        }

        logger.info(f"[AgoraConvoAI] Sending join request to Agora: {url}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                try:
                    data = response.json()
                except Exception:
                    data = {"raw_text": response.text}

                logger.info(f"[AgoraConvoAI] Agora join response (HTTP {response.status_code}): {data}")

                if response.status_code in [200, 201]:
                    agent_id = data.get("agent_id") or data.get("id") or agent_name
                    agent_status = data.get("status", "RUNNING")
                    self.active_agent = {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "channel_name": channel,
                        "agent_rtc_uid": self.agent_rtc_uid,
                        "status": agent_status,
                        "started_at": time.time(),
                        "create_ts": data.get("create_ts"),
                    }
                    return {
                        "success": True,
                        "status": agent_status,
                        "agent_id": agent_id,
                        "channel_name": channel,
                        "agent_rtc_uid": self.agent_rtc_uid,
                        "message": f"Agora Conversational AI Agent '{agent_id}' is {agent_status} in channel '{channel}'.",
                    }
                else:
                    detail = data.get("detail") or data.get("message") or data.get("error") or str(data)
                    reason = data.get("reason", "")
                    error_msg = f"{detail} ({reason})" if reason else str(detail)
                    return {
                        "success": False,
                        "status": "ERROR",
                        "status_code": response.status_code,
                        "error": error_msg,
                        "channel_name": channel,
                    }
        except httpx.TimeoutException:
            logger.error("[AgoraConvoAI] Join request to Agora timed out after 30s")
            return {
                "success": False,
                "status": "TIMEOUT",
                "error": "Agora cloud agent provisioning timed out. Please try again.",
                "channel_name": channel,
            }
        except Exception as e:
            logger.error(f"[AgoraConvoAI] Join request failed: {type(e).__name__} {e}")
            return {
                "success": False,
                "status": "FAILED",
                "error": f"{type(e).__name__}: {str(e) or 'Network/Connection error'}",
                "channel_name": channel,
            }

    async def stop_agent(self, channel_name: Optional[str] = None, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Stop/Disconnect an Agora Conversational AI Agent from the channel.
        Calls Agora REST API: POST /api/conversational-ai-agent/v2/projects/{appid}/agents/{agentId}/leave
        """
        self.refresh_from_env()
        channel = channel_name or self.channel_name
        target_agent_id = agent_id or (self.active_agent.get("agent_id") if self.active_agent else None)

        if not target_agent_id:
            self.active_agent = None
            return {"success": True, "message": "No active agent ID found."}

        if not self.customer_id or not self.customer_secret:
            self.active_agent = None
            return {"success": True, "status": "STOPPED", "message": "Cleared local agent session."}

        url = f"{AGORA_CONVO_AI_BASE_URL}/{self.app_id}/agents/{target_agent_id}/leave"
        headers = self._get_auth_header()

        logger.info(f"[AgoraConvoAI] Stopping agent {target_agent_id} via: {url}")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, headers=headers)
                self.active_agent = None
                return {
                    "success": True,
                    "status": "STOPPED",
                    "status_code": response.status_code,
                    "agent_id": target_agent_id,
                    "message": f"Agora Conversational AI Agent '{target_agent_id}' disconnected.",
                }
        except Exception as e:
            self.active_agent = None
            return {
                "success": False,
                "error": f"{type(e).__name__}: {str(e)}",
                "agent_id": target_agent_id,
            }

    def get_agent_status(self, channel_name: Optional[str] = None) -> Dict[str, Any]:
        """Get the current running status of the AI agent."""
        self.refresh_from_env()
        channel = channel_name or self.channel_name

        if self.active_agent and self.active_agent.get("channel_name") == channel:
            return {
                "is_active": True,
                **self.active_agent,
            }

        return {
            "is_active": False,
            "status": "IDLE",
            "channel_name": channel,
            "agent_rtc_uid": self.agent_rtc_uid,
            "credentials_configured": {
                "app_id_set": bool(self.app_id),
                "app_certificate_set": bool(self.app_certificate),
                "customer_id_set": bool(self.customer_id),
                "customer_secret_set": bool(self.customer_secret),
            },
        }


agora_convo_ai_manager = AgoraConvoAIManager()
