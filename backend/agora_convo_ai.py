"""
Agora Conversational AI REST API v2 Manager & Multi-Person Incident Room Engine
Deploys and manages cloud-based Agora AI Voice Agents directly inside Agora RTC voice channels.
Supports multi-participant incident rooms, shared incident intelligence, persistent transcripts,
and safe multi-incident tracking across the incident lifecycle.
"""

import base64
import json
import logging
import os
import random
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv

from agora_token import AgoraTokenBuilder

# Load .env on startup
load_dotenv()
logger = logging.getLogger("agora_convo_ai")

AGORA_CONVO_AI_BASE_URL = "https://api.agora.io/api/conversational-ai-agent/v2/projects"

INCIDENT_COMMANDER_SYSTEM_PROMPT = """You are Echo Commander, an elite real-time AI Incident Commander in an active technical outage room.

Your mission is to maintain shared situational awareness with the entire response team in this channel.
Speak in concise, natural, professional English (1 to 2 sentences max).

STRICT CLASSIFICATION PRIORITY FOR INCIDENT INTELLIGENCE:
CONFLICT > DECISION > ACTION > HYPOTHESIS > FACT

When acknowledging or summarizing what the team says, classify the real conversation information into inline tags with strict mutual exclusivity:
- [CONFLICT: <exact contradictory claims or discrepancy between reports/metrics>]
- [DECISION: <exact agreed decision made by the commander or team>]
- [ACTION: @<Owner/Role> - <exact task to execute>]
- [HYPOTHESIS: <exact unverified theory or assumption expressed>]
- [FACT: <exact confirmed, non-contradictory technical observation>]

STRICT RULES:
1. CLASSIFICATION PRIORITY: If a statement describes contradictory claims or conflicting metrics (e.g., "DBA reports connection timeouts but monitoring dashboard shows normal database latency"), classify it ONLY as [CONFLICT: ...]. NEVER duplicate a conflicting statement as a [FACT: ...].
2. Extract the ACTUAL SPECIFIC DETAILS spoken in the channel by ANY participant.
3. If any participant reports a verified system status (e.g. "The payment database is down.", "API latency spiked to 4 seconds", "Database connection pool exhausted"), record it with [FACT: <statement>] and confirm it concisely.
4. NEVER use generic placeholder words like "confirmed technical fact", "theory or assumption", "agreed decision", "task description", or "contradictory statements".
5. NEVER invent or hallucinate facts that the team did not mention.
6. If no fact/hypothesis/decision/action/conflict was mentioned in the current turn, do NOT output that tag.
7. Do NOT generate repeated unprompted idle messages such as "No updates received. Monitoring for any incoming information." Only speak when acknowledging participants or when an incident update occurs.

EXAMPLES OF REALISTIC OUTPUT:
- User says: "The payment database is down."
  You reply: "[FACT: The payment database is down] Understood. Logged payment database outage as a primary fact."
- User says: "Database connection pool is exhausted on us-west-2."
  You reply: "[FACT: Database connection pool is exhausted on us-west-2] Understood. I have logged the database pool exhaustion."
- User says: "Could this be caused by a memory leak in the authentication service?"
  You reply: "[HYPOTHESIS: A memory leak may be affecting the authentication service] Noted as an active hypothesis to investigate."
- User says: "Let's freeze production deployments."
  You reply: "[DECISION: Freeze production deployments] Confirmed. Production deployment freeze is locked."
- User says: "SRE, drain the affected pods."
  You reply: "[ACTION: @SRE - Drain the affected pods] Action item assigned to SRE to drain pods."
- User says: "DBA reports connection timeouts but the monitoring dashboard shows normal database latency."
  You reply: "[CONFLICT: DBA reports connection timeouts while monitoring shows normal latency] Discrepancy flagged between DBA reports and monitoring dashboard."

Keep all spoken responses brief, natural, direct, and helpful."""

# Blacklist of placeholder phrases that should never appear on the board
PLACEHOLDER_BLACKLIST = {
    "confirmed technical fact",
    "theory or assumption",
    "agreed decision",
    "contradictory statements",
    "task description",
    "insert actual fact",
    "insert actual theory",
    "insert actual decision",
    "insert actual task",
    "insert actual discrepancy",
    "placeholder",
    "exact confirmed technical observation stated by team",
    "exact unverified theory or assumption expressed",
    "exact agreed decision made by the commander or team",
    "exact task to execute",
    "exact contradictory claims between team members",
    "exact confirmed, non-contradictory technical observation",
    "exact contradictory claims or discrepancy between reports/metrics",
}

# Idle / status messages from assistant that should not clutter Spoken Conversation
IDLE_STATUS_PATTERNS = [
    r"^no\s+updates\s+received",
    r"^continuing\s+to\s+monitor",
    r"^monitoring\s+for\s+(?:any\s+)?(?:incoming\s+)?(?:information|updates)",
    r"^monitoring\s+the\s+channel",
    r"^standby\s+for\s+(?:any\s+)?(?:information|updates)",
    r"^standing\s+by\s+for\s+(?:any\s+)?updates",
    r"^standing\s+by\b",
    r"^no\s+new\s+information\s+reported",
    r"^awaiting\s+(?:any\s+)?updates",
    r"^listening\s+for\s+updates",
]


def is_idle_status_message(text: str) -> bool:
    """
    Check if a message is an automated repetitive idle monitoring string.
    Never suppresses responses that contain structured tags or actual answers to participant speech.
    """
    if not text:
        return False
    # Real responses with tags are never idle
    if re.search(r"\[(FACT|HYPOTHESIS|DECISION|ACTION|CONFLICT):", text, re.IGNORECASE):
        return False
    clean = re.sub(r"[^\w\s]", "", text.strip().lower())
    for pat in IDLE_STATUS_PATTERNS:
        if re.search(pat, clean):
            return True
    return False


def is_valid_intel_text(text: str) -> bool:
    """Check if extracted text is valid and not a generic placeholder."""
    if not text or len(text.strip()) < 3:
        return False
    clean = text.strip().lower()
    for blacklisted in PLACEHOLDER_BLACKLIST:
        if blacklisted in clean:
            return False
    return True


def is_semantically_overlapping(text_a: str, text_b: str) -> bool:
    """
    Check if two statements are semantically duplicate or substantially overlap in meaning.
    """
    clean_a = re.sub(r"[^\w\s]", "", text_a.lower()).strip()
    clean_b = re.sub(r"[^\w\s]", "", text_b.lower()).strip()
    if not clean_a or not clean_b:
        return False
    if clean_a == clean_b or clean_a in clean_b or clean_b in clean_a:
        return True

    words_a = {w for w in clean_a.split() if len(w) > 3}
    words_b = {w for w in clean_b.split() if len(w) > 3}
    if not words_a or not words_b:
        return False

    overlap = words_a.intersection(words_b)
    # If 50% or more significant keywords match with the smaller statement
    min_len = min(len(words_a), len(words_b))
    if min_len > 0 and len(overlap) / min_len >= 0.5:
        return True
    return False


def is_similar_to_existing(new_text: str, existing_texts: set) -> bool:
    """Check if new_text is semantically or lexically similar to any item in existing_texts."""
    clean_new = re.sub(r"[^\w\s]", "", new_text.lower()).strip()
    if clean_new in existing_texts:
        return True
    for existing in existing_texts:
        if is_semantically_overlapping(new_text, existing):
            return True
    return False


def is_similar_to_any(new_text: str, *text_sets: set) -> bool:
    """Check if new_text is semantically or lexically similar to any item in one or more sets of existing texts."""
    for text_set in text_sets:
        if is_similar_to_existing(new_text, text_set):
            return True
    return False


class AgoraConvoAIManager:
    """Manages Agora Conversational AI Agents and multi-person Incident Rooms with shared intelligence."""

    def __init__(self):
        self.app_id = os.getenv("AGORA_APP_ID", "").strip()
        self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE", "").strip()
        self.customer_id = os.getenv("AGORA_CUSTOMER_ID", "").strip()
        self.customer_secret = os.getenv("AGORA_CUSTOMER_SECRET", "").strip()
        self.agent_rtc_uid = int(os.getenv("AGORA_AGENT_RTC_UID", "9999"))
        self.default_channel_name = os.getenv("AGORA_CHANNEL_NAME", "incident-pay-2048").strip()

        # Track active agents by channel name
        self.active_agents: Dict[str, Dict[str, Any]] = {}

        # Persistent storage file path
        self.storage_file = os.path.join(os.path.dirname(__file__), "incident_data.json")

        # In-memory Multi-Incident Store
        self.incidents: Dict[str, Dict[str, Any]] = {}
        self.active_incident_id: str = "INC-2048"

        self._load_persisted_incidents()

    def _generate_room_code(self) -> str:
        """Generate a clean, shareable 4-digit room code e.g. 4827."""
        return f"{random.randint(1000, 9999)}"

    def _create_fresh_incident_record(self, channel_name: Optional[str] = None, room_code: Optional[str] = None) -> Dict[str, Any]:
        """Create a new pristine incident record with multi-person room support."""
        code = room_code or self._generate_room_code()
        incident_id = f"INC-{code}"
        channel = channel_name or f"incident-{code}"
        now_dt = datetime.now()

        record = {
            "incident_id": incident_id,
            "room_code": code,
            "channel_name": channel,
            "started_at": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "Active",
            "agent_status": "IDLE",
            "agent_id": None,
            "facts": [],
            "hypotheses": [],
            "decisions": [],
            "actions": [],
            "conflicts": [],
            "transcript": [],
            "timeline": [
                {
                    "timestamp": now_dt.strftime("%H:%M:%S"),
                    "event": f"Incident room {incident_id} created on channel '{channel}'",
                    "type": "system",
                }
            ],
            "participants": [],
            "total_items": 0,
            "last_updated": time.time(),
        }
        return record

    def _load_persisted_incidents(self):
        """Load multiple incident records from JSON file if present."""
        if os.path.exists(self.storage_file):
            try:
                with open(self.storage_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                    if isinstance(data, dict):
                        # Modern multi-incident format
                        if "incidents" in data and isinstance(data["incidents"], dict):
                            self.incidents = data["incidents"]
                            self.active_incident_id = data.get("active_incident_id") or next(iter(self.incidents.keys()), "INC-2048")

                            # Reconcile priority and deduplicate across all loaded incidents
                            for inc in self.incidents.values():
                                self._reconcile_incident_items(inc)

                            # Restore active_agents in-memory map for any active incident records
                            for inc in self.incidents.values():
                                inc_agent_id = inc.get("agent_id")
                                inc_channel = inc.get("channel_name")
                                inc_status = inc.get("agent_status")
                                if inc_agent_id and inc_channel and inc_status in ["RUNNING", "JOINING"]:
                                    self.active_agents[inc_channel] = {
                                        "agent_id": inc_agent_id,
                                        "channel_name": inc_channel,
                                        "agent_rtc_uid": self.agent_rtc_uid,
                                        "status": inc_status,
                                    }
                            logger.info(f"[AgoraConvoAI] Loaded {len(self.incidents)} persisted incidents from {self.storage_file} (Active Agents in memory: {len(self.active_agents)})")
                            return

                        # Legacy single-incident format backward compatibility
                        elif "incident_id" in data:
                            inc_id = data.get("incident_id")
                            self._reconcile_incident_items(data)
                            self.incidents[inc_id] = data
                            self.active_incident_id = inc_id
                            logger.info(f"[AgoraConvoAI] Converted legacy incident {inc_id} to multi-incident store.")
                            return
            except Exception as e:
                logger.warning(f"[AgoraConvoAI] Failed to load persisted incidents: {e}")

        # If no valid data on disk, initialize default incident
        default_inc = self._create_fresh_incident_record(channel_name=self.default_channel_name, room_code="2048")
        self.incidents[default_inc["incident_id"]] = default_inc
        self.active_incident_id = default_inc["incident_id"]
        self._save_persisted_incidents()

    def _reconcile_incident_items(self, incident: Dict[str, Any]):
        """
        Enforce strict classification priority across incident items:
        CONFLICT > DECISION > ACTION > HYPOTHESIS > FACT
        Removes any lower-priority duplicate or overlapping items and cleans up repetitive idle messages.
        """
        conflicts = incident.setdefault("conflicts", [])
        decisions = incident.setdefault("decisions", [])
        actions = incident.setdefault("actions", [])
        hypotheses = incident.setdefault("hypotheses", [])
        facts = incident.setdefault("facts", [])

        # Priority 1: CONFLICTS
        seen_conflicts = set()
        dedup_conflicts = []
        for c in conflicts:
            txt = c.get("text", "")
            if is_valid_intel_text(txt) and not is_similar_to_existing(txt, seen_conflicts):
                seen_conflicts.add(txt.lower())
                dedup_conflicts.append(c)
        incident["conflicts"] = dedup_conflicts

        # Priority 2: DECISIONS (Must not duplicate conflicts)
        seen_decisions = set()
        dedup_decisions = []
        for d in decisions:
            txt = d.get("text", "")
            if is_valid_intel_text(txt) and not is_similar_to_any(txt, seen_conflicts, seen_decisions):
                seen_decisions.add(txt.lower())
                dedup_decisions.append(d)
        incident["decisions"] = dedup_decisions

        # Priority 3: ACTIONS (Must not duplicate conflicts or decisions)
        seen_actions = set()
        dedup_actions = []
        for a in actions:
            txt = a.get("text", "")
            if is_valid_intel_text(txt) and not is_similar_to_any(txt, seen_conflicts, seen_decisions, seen_actions):
                seen_actions.add(txt.lower())
                dedup_actions.append(a)
        incident["actions"] = dedup_actions

        # Priority 4: HYPOTHESES (Must not duplicate conflicts, decisions, or actions)
        seen_hypotheses = set()
        dedup_hypotheses = []
        for h in hypotheses:
            txt = h.get("text", "")
            if is_valid_intel_text(txt) and not is_similar_to_any(txt, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses):
                seen_hypotheses.add(txt.lower())
                dedup_hypotheses.append(h)
        incident["hypotheses"] = dedup_hypotheses

        # Priority 5: FACTS (Must not duplicate conflicts, decisions, actions, or hypotheses)
        seen_facts = set()
        dedup_facts = []
        for f in facts:
            txt = f.get("text", "")
            if is_valid_intel_text(txt) and not is_similar_to_any(txt, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses, seen_facts):
                seen_facts.add(txt.lower())
                dedup_facts.append(f)
        incident["facts"] = dedup_facts

        # Suppress repetitive idle messages from transcript
        transcript = incident.setdefault("transcript", [])
        cleaned_transcript = []
        for turn in transcript:
            content = turn.get("content", "")
            raw = turn.get("raw_content", "")
            role = turn.get("role", "")
            if role in ["assistant", "bot", "ai"] and (is_idle_status_message(content) or is_idle_status_message(raw)):
                continue
            cleaned_transcript.append(turn)
        incident["transcript"] = cleaned_transcript

        # Update total_items
        incident["total_items"] = len(dedup_conflicts) + len(dedup_decisions) + len(dedup_actions) + len(dedup_hypotheses) + len(dedup_facts)

    def _save_persisted_incidents(self):
        """Save all incidents and active room pointer to JSON file."""
        try:
            payload = {
                "active_incident_id": self.active_incident_id,
                "incidents": self.incidents,
            }
            with open(self.storage_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            logger.warning(f"[AgoraConvoAI] Failed to persist incident store: {e}")

    def get_incident(self, identifier: Optional[str] = None) -> Dict[str, Any]:
        """
        Lookup incident by incident_id (e.g. 'INC-4827' or '4827') or channel_name (e.g. 'incident-4827').
        Falls back to active incident or creates on the fly for custom channels.
        """
        if not identifier:
            if self.active_incident_id in self.incidents:
                inc = self.incidents[self.active_incident_id]
                self._reconcile_incident_items(inc)
                return inc
            if self.incidents:
                inc = next(iter(self.incidents.values()))
                self._reconcile_incident_items(inc)
                return inc
            new_inc = self._create_fresh_incident_record()
            self.incidents[new_inc["incident_id"]] = new_inc
            self.active_incident_id = new_inc["incident_id"]
            self._save_persisted_incidents()
            return new_inc

        clean_id = identifier.strip()

        # 1. Match by exact incident_id
        if clean_id in self.incidents:
            self.active_incident_id = clean_id
            inc = self.incidents[clean_id]
            self._reconcile_incident_items(inc)
            return inc

        # 2. Match by normalized "INC-" prefix
        norm_inc = f"INC-{clean_id.replace('INC-', '').replace('inc-', '')}"
        if norm_inc in self.incidents:
            self.active_incident_id = norm_inc
            inc = self.incidents[norm_inc]
            self._reconcile_incident_items(inc)
            return inc

        # 3. Match by channel_name
        for inc in self.incidents.values():
            if inc.get("channel_name") == clean_id:
                self.active_incident_id = inc.get("incident_id")
                self._reconcile_incident_items(inc)
                return inc

        # 4. Match by room_code
        for inc in self.incidents.values():
            if inc.get("room_code") == clean_id:
                self.active_incident_id = inc.get("incident_id")
                self._reconcile_incident_items(inc)
                return inc

        # 5. If joining an unrecorded channel/code, provision it automatically
        if clean_id.startswith("incident-"):
            code = clean_id.replace("incident-", "")
            new_inc = self._create_fresh_incident_record(channel_name=clean_id, room_code=code)
        else:
            code = clean_id.replace("INC-", "").replace("inc-", "")
            new_inc = self._create_fresh_incident_record(channel_name=f"incident-{code}", room_code=code)

        self.incidents[new_inc["incident_id"]] = new_inc
        self.active_incident_id = new_inc["incident_id"]
        self._save_persisted_incidents()
        return new_inc

    def create_new_incident(self, channel_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a fresh incident room with unique room code and channel name.
        Does NOT delete prior incidents or reset credentials.
        """
        new_inc = self._create_fresh_incident_record(channel_name=channel_name)
        self.incidents[new_inc["incident_id"]] = new_inc
        self.active_incident_id = new_inc["incident_id"]
        self._save_persisted_incidents()
        logger.info(f"[AgoraConvoAI] Created new incident: {new_inc['incident_id']} on channel '{new_inc['channel_name']}'")
        return self.get_incident_record_snapshot(new_inc["incident_id"])

    def register_participant(
        self,
        identifier: str,
        uid: int,
        display_name: str,
        role: str = "Engineer",
    ) -> Dict[str, Any]:
        """
        Register / update a participant's display name and presence in an incident room.
        """
        incident = self.get_incident(identifier)
        participants = incident.setdefault("participants", [])

        # Upsert participant by UID
        found = False
        for p in participants:
            if p.get("uid") == uid:
                p["display_name"] = display_name
                p["role"] = role
                p["last_seen"] = time.time()
                found = True
                break

        if not found:
            participants.append({
                "uid": uid,
                "display_name": display_name,
                "role": role,
                "joined_at": datetime.now().strftime("%H:%M:%S"),
                "last_seen": time.time(),
            })
            incident.setdefault("timeline", []).append({
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "event": f"{display_name} ({role}) joined the incident room",
                "type": "participant",
            })

        self._save_persisted_incidents()
        return {
            "incident_id": incident.get("incident_id"),
            "channel_name": incident.get("channel_name"),
            "participants": participants,
        }

    def get_incident_record_snapshot(self, identifier: Optional[str] = None) -> Dict[str, Any]:
        """Return clean incident snapshot with computed counts."""
        incident = self.get_incident(identifier)

        facts = incident.get("facts", [])
        hypotheses = incident.get("hypotheses", [])
        decisions = incident.get("decisions", [])
        actions = incident.get("actions", [])
        conflicts = incident.get("conflicts", [])
        transcript = incident.get("transcript", [])
        timeline = incident.get("timeline", [])
        participants = incident.get("participants", [])

        total = len(facts) + len(hypotheses) + len(decisions) + len(actions) + len(conflicts)
        incident["total_items"] = total

        # Check if AI agent is active for this channel
        channel = incident.get("channel_name")
        active_agent = self.active_agents.get(channel)
        target_agent_id = (active_agent.get("agent_id") if active_agent else None) or incident.get("agent_id")
        saved_status = incident.get("agent_status", "IDLE")

        if active_agent:
            agent_status = active_agent.get("status", "RUNNING")
        elif target_agent_id and saved_status in ["RUNNING", "JOINING"]:
            agent_status = saved_status
            self.active_agents[channel] = {
                "agent_id": target_agent_id,
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
                "status": saved_status,
            }
        else:
            agent_status = saved_status

        return {
            "incident_id": incident.get("incident_id"),
            "room_code": incident.get("room_code", incident.get("incident_id", "").replace("INC-", "")),
            "channel_name": channel,
            "started_at": incident.get("started_at"),
            "status": incident.get("status", "Active"),
            "agent_status": agent_status,
            "facts": facts,
            "hypotheses": hypotheses,
            "decisions": decisions,
            "actions": actions,
            "conflicts": conflicts,
            "transcript": transcript,
            "timeline": timeline,
            "participants": participants,
            "total_items": total,
            "dialogue_turns_count": len(transcript),
            "agent_id": target_agent_id if agent_status in ["RUNNING", "JOINING"] else None,
            "last_updated": incident.get("last_updated", time.time()),
        }

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
            self.default_channel_name = channel_name.strip()
            os.environ["AGORA_CHANNEL_NAME"] = self.default_channel_name

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
        if not self.default_channel_name:
            self.default_channel_name = os.getenv("AGORA_CHANNEL_NAME", "incident-pay-2048").strip()

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
        Guarantees SINGLE SHARED AI AGENT per channel/incident room (no duplicate bots).
        """
        self.refresh_from_env()
        incident = self.get_incident(channel_name)
        channel = incident.get("channel_name")
        prompt = custom_prompt or INCIDENT_COMMANDER_SYSTEM_PROMPT

        # Check if an agent is already active in this channel
        if channel in self.active_agents:
            existing = self.active_agents[channel]
            return {
                "success": True,
                "status": existing.get("status", "RUNNING"),
                "agent_id": existing.get("agent_id"),
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
                "message": f"Agora Conversational AI Agent '{existing.get('agent_id')}' is already live in room '{incident.get('incident_id')}'.",
                "incident_id": incident.get("incident_id"),
            }

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
                "error": "AGORA_CUSTOMER_ID and AGORA_CUSTOMER_SECRET are required in backend/.env to start the cloud AI agent.",
                "agora_app_id": self.app_id,
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
            }

        url = f"{AGORA_CONVO_AI_BASE_URL}/{self.app_id}/join"
        headers = self._get_auth_header()
        agent_name = f"EchoCommander_{int(time.time())}"

        incident["status"] = "Active"
        incident["agent_status"] = "JOINING"
        self._save_persisted_incidents()

        # Official Agora Conversational AI preset pipeline with multi-participant listening
        payload = {
            "name": agent_name,
            "preset": "deepgram_nova_2,openai_gpt_4o_mini,openai_tts_1",
            "properties": {
                "channel": channel,
                "token": agent_token,
                "agent_rtc_uid": str(self.agent_rtc_uid),
                "remote_rtc_uids": ["*"],  # Listens to all human participants in the room
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
                    agent_info = {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "channel_name": channel,
                        "agent_rtc_uid": self.agent_rtc_uid,
                        "status": agent_status,
                        "started_at": time.time(),
                        "create_ts": data.get("create_ts"),
                    }
                    self.active_agents[channel] = agent_info

                    incident["agent_status"] = agent_status
                    incident["agent_id"] = agent_id
                    incident.setdefault("timeline", []).append({
                        "timestamp": datetime.now().strftime("%H:%M:%S"),
                        "event": f"Echo AI Voice Agent ({agent_id}) joined incident room",
                        "type": "agent",
                    })
                    self._save_persisted_incidents()

                    return {
                        "success": True,
                        "status": agent_status,
                        "agent_id": agent_id,
                        "channel_name": channel,
                        "agent_rtc_uid": self.agent_rtc_uid,
                        "message": f"Agora Conversational AI Agent '{agent_id}' is {agent_status} in channel '{channel}'.",
                        "incident_id": incident.get("incident_id"),
                    }
                else:
                    incident["agent_status"] = "ERROR"
                    self._save_persisted_incidents()
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
            incident["agent_status"] = "TIMEOUT"
            self._save_persisted_incidents()
            return {
                "success": False,
                "status": "TIMEOUT",
                "error": "Agora cloud agent provisioning timed out. Please try again.",
                "channel_name": channel,
            }
        except Exception as e:
            logger.error(f"[AgoraConvoAI] Join request failed: {type(e).__name__} {e}")
            incident["agent_status"] = "FAILED"
            self._save_persisted_incidents()
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
        Crucially: Preserves the incident record, cards, and conversation transcript!
        """
        self.refresh_from_env()
        incident = self.get_incident(channel_name)
        channel = incident.get("channel_name")

        active_agent = self.active_agents.get(channel)
        target_agent_id = agent_id or (active_agent.get("agent_id") if active_agent else None) or incident.get("agent_id")

        logger.info(f"[AgoraConvoAI] Stop requested for channel '{channel}', incident '{incident.get('incident_id')}' (agent_id={target_agent_id})")

        # Perform one final intelligence & history extraction before disconnecting
        try:
            if target_agent_id and channel in self.active_agents:
                history = await self.get_agent_history(channel_name=channel)
                contents = history.get("contents", [])
                if contents:
                    self._merge_agora_history_contents(incident, contents)
        except Exception as e:
            logger.warning(f"[AgoraConvoAI] Final history sync before stop failed: {e}")

        # Update incident agent status to STOPPED while preserving all record data
        incident["agent_status"] = "STOPPED"
        incident["status"] = "Recorded"
        incident.setdefault("timeline", []).append({
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "event": "Echo AI Voice Agent stopped. Incident record and notes preserved.",
            "type": "system",
        })
        self.active_agents.pop(channel, None)
        if channel_name and channel_name != channel:
            self.active_agents.pop(channel_name, None)
        self._save_persisted_incidents()

        if not target_agent_id:
            logger.info(f"[AgoraConvoAI] Stop completed for channel '{channel}': No active cloud agent ID. Local state marked STOPPED.")
            return {
                "success": True,
                "status": "STOPPED",
                "message": "No active cloud agent ID found. Local state marked stopped.",
                "incident": self.get_incident_record_snapshot(incident.get("incident_id")),
            }

        if not self.customer_id or not self.customer_secret:
            logger.info(f"[AgoraConvoAI] Stop completed for channel '{channel}': Cleared local agent session.")
            return {
                "success": True,
                "status": "STOPPED",
                "message": "Cleared local agent session.",
                "incident": self.get_incident_record_snapshot(incident.get("incident_id")),
            }

        url = f"{AGORA_CONVO_AI_BASE_URL}/{self.app_id}/agents/{target_agent_id}/leave"
        headers = self._get_auth_header()

        logger.info(f"[AgoraConvoAI] Sending leave request for agent '{target_agent_id}' on channel '{channel}' via Agora REST API")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, headers=headers)
                logger.info(f"[AgoraConvoAI] Agora leave API returned HTTP {response.status_code} for agent '{target_agent_id}' on channel '{channel}'")
                return {
                    "success": True,
                    "status": "STOPPED",
                    "status_code": response.status_code,
                    "agent_id": target_agent_id,
                    "message": f"Agora Conversational AI Agent '{target_agent_id}' disconnected. Incident data preserved.",
                    "incident": self.get_incident_record_snapshot(incident.get("incident_id")),
                }
        except Exception as e:
            logger.error(f"[AgoraConvoAI] Leave request error for agent '{target_agent_id}': {type(e).__name__} {e}")
            return {
                "success": True,  # Local state is cleanly STOPPED even if Agora network leave errored
                "status": "STOPPED",
                "error": f"{type(e).__name__}: {str(e)}",
                "agent_id": target_agent_id,
                "incident": self.get_incident_record_snapshot(incident.get("incident_id")),
            }

    async def get_agent_history(self, channel_name: Optional[str] = None, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch the live conversation history / transcript directly from Agora Conversational AI REST API v2.
        Calls Agora REST API: GET /api/conversational-ai-agent/v2/projects/{appid}/agents/{agentId}/history
        """
        self.refresh_from_env()
        incident = self.get_incident(channel_name)
        channel = incident.get("channel_name")

        active_agent = self.active_agents.get(channel)
        target_agent_id = agent_id or (active_agent.get("agent_id") if active_agent else None) or incident.get("agent_id")

        if not target_agent_id or not self.customer_id or not self.customer_secret or not self.app_id:
            return {
                "agent_id": target_agent_id,
                "channel": channel,
                "contents": [],
                "status": "IDLE" if not target_agent_id else "UNKNOWN",
            }

        url = f"{AGORA_CONVO_AI_BASE_URL}/{self.app_id}/agents/{target_agent_id}/history"
        headers = self._get_auth_header()

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    # 2. The raw Agora History API response
                    logger.info(f"[HISTORY RAW] Raw Agora History API response for channel '{channel}' (agent {target_agent_id}): {json.dumps(data)}")
                    return data
                else:
                    logger.warning(f"[AgoraConvoAI] History API returned status {response.status_code}: {response.text}")
                    return {
                        "agent_id": target_agent_id,
                        "channel": channel,
                        "contents": [],
                        "status": "ERROR",
                        "status_code": response.status_code,
                    }
        except Exception as e:
            logger.error(f"[AgoraConvoAI] Failed to fetch agent history: {e}")
            return {
                "agent_id": target_agent_id,
                "channel": channel,
                "contents": [],
                "error": str(e),
            }

    async def get_incident_intelligence(self, channel_name: Optional[str] = None, incident_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract structured Incident Intelligence (Facts, Hypotheses, Decisions, Actions, Conflicts)
        and Conversation Transcript from real Agora History API and merge into persistent Incident Record.
        """
        identifier = channel_name or incident_id
        incident = self.get_incident(identifier)
        channel = incident.get("channel_name")

        logger.info(f"[HISTORY] Looking up active agent for channel '{channel}' (Incident: {incident.get('incident_id')})")

        # Resolve active agent ID from memory or persisted record
        active_agent = self.active_agents.get(channel)
        target_agent_id = (active_agent.get("agent_id") if active_agent else None) or incident.get("agent_id")
        agent_status = (active_agent.get("status") if active_agent else None) or incident.get("agent_status", "IDLE")

        if target_agent_id and agent_status in ["RUNNING", "JOINING"]:
            logger.info(f"[HISTORY] Agent resolved: {target_agent_id} (status: {agent_status})")
            # Ensure in-memory cache is populated
            if channel not in self.active_agents:
                self.active_agents[channel] = {
                    "agent_id": target_agent_id,
                    "channel_name": channel,
                    "agent_rtc_uid": self.agent_rtc_uid,
                    "status": agent_status,
                }

            history = await self.get_agent_history(channel_name=channel, agent_id=target_agent_id)
            contents = history.get("contents", [])

            # 3. The number of conversation turns returned
            logger.info(f"[HISTORY TURNS] Number of conversation turns returned: {len(contents)}")

            # 1 & 4. The exact user transcript received and extracted from the history
            user_texts = [
                (t.get("content") or t.get("text") or t.get("message") or "").strip()
                for t in contents
                if str(t.get("role", "")).lower() == "user"
            ]
            user_transcripts = [
                {"role": t.get("role"), "content": t.get("content"), "speech_start_ms": t.get("speech_start_ms")}
                for t in contents
                if str(t.get("role", "")).lower() == "user"
            ]
            logger.info(f"[HISTORY USER TRANSCRIPT] Exact user transcript received by backend: {json.dumps(user_transcripts)}")
            logger.info(f"[HISTORY USER TEXT] Exact user text extracted from history: {user_texts}")

            # 5. The exact text sent to the intelligence extraction function
            all_turn_summaries = [
                f"[{t.get('role', 'unknown').upper()}] {(t.get('content') or t.get('text') or '').strip()}"
                for t in contents
            ]
            logger.info(f"[INTELLIGENCE EXTRACTION INPUT] Exact text sent to intelligence extraction ({len(contents)} turns): {json.dumps(all_turn_summaries)}")

            if contents:
                self._merge_agora_history_contents(incident, contents)

            # Check if agent stopped on Agora cloud side
            if history.get("status") == "STOPPED" or (history.get("status") == "ERROR" and history.get("status_code") == 404):
                if incident.get("agent_status") in ["RUNNING", "JOINING"]:
                    incident["agent_status"] = "STOPPED"
                    self.active_agents.pop(channel, None)
                    self._save_persisted_incidents()
        else:
            logger.info(f"[HISTORY] No active agent ID resolved for channel '{channel}' (Agent Status: {agent_status})")

        incident["last_updated"] = time.time()
        return self.get_incident_record_snapshot(incident.get("incident_id"))

    def _merge_agora_history_contents(self, incident: Dict[str, Any], contents: List[Dict[str, Any]]):
        """
        Merge raw conversation turns and extracted intelligence from Agora History into persistent incident record.
        Strictly enforces classification priority: CONFLICT > DECISION > ACTION > HYPOTHESIS > FACT.
        Guarantees de-duplication, suppresses repetitive idle status messages, and maintains timestamps.
        """
        existing_facts = incident.setdefault("facts", [])
        existing_hypotheses = incident.setdefault("hypotheses", [])
        existing_decisions = incident.setdefault("decisions", [])
        existing_actions = incident.setdefault("actions", [])
        existing_conflicts = incident.setdefault("conflicts", [])
        existing_transcript = incident.setdefault("transcript", [])
        existing_timeline = incident.setdefault("timeline", [])

        # Track existing texts across all categories
        seen_conflicts = {c.get("text", "").lower() for c in existing_conflicts}
        seen_decisions = {d.get("text", "").lower() for d in existing_decisions}
        seen_actions = {a.get("text", "").lower() for a in existing_actions}
        seen_hypotheses = {h.get("text", "").lower() for h in existing_hypotheses}
        seen_facts = {f.get("text", "").lower() for f in existing_facts}

        # Track existing timeline entries to avoid duplicate events
        seen_timeline_keys = {
            f"{t.get('type')}:{re.sub(r'\s+', ' ', t.get('text', t.get('event', ''))).strip().lower()}"
            for t in existing_timeline
        }

        def add_timeline_evt(ev_type: str, ev_text: str, ev_ts: str, owner: Optional[str] = None, status: Optional[str] = None, item_id: Optional[str] = None):
            clean_ev = re.sub(r"\s+", " ", ev_text).strip()
            key = f"{ev_type}:{clean_ev.lower()}"
            if key not in seen_timeline_keys and len(clean_ev) >= 2:
                seen_timeline_keys.add(key)
                existing_timeline.append({
                    "id": f"evt-{int(time.time()*1000)}-{len(existing_timeline)+1}",
                    "item_id": item_id,
                    "type": ev_type,
                    "text": clean_ev,
                    "event": clean_ev,  # Backward compatibility
                    "timestamp": ev_ts,
                    "owner": owner,
                    "status": status,
                })

        # Track existing transcripts to avoid duplicate turns
        seen_turns = {
            f"{t.get('role')}:{re.sub(r'\s+', ' ', t.get('content', '')).strip().lower()}"
            for t in existing_transcript
        }

        # Pass 1: Parse and record conversation turns into Transcript (filtering out repetitive idle messages)
        for turn in contents:
            role = str(turn.get("role", "unknown")).lower()
            raw_content = (turn.get("content") or turn.get("text") or turn.get("message") or "").strip()
            speech_ms = turn.get("speech_start_ms") or turn.get("speech_ms") or turn.get("start_ms")

            if not raw_content:
                continue

            # Task 4: Suppress repetitive idle messages from assistant
            if role in ["assistant", "bot", "ai"] and is_idle_status_message(raw_content):
                continue

            if speech_ms and speech_ms > 0:
                ts_formatted = datetime.fromtimestamp(speech_ms / 1000.0).strftime("%H:%M")
                ts_sec = datetime.fromtimestamp(speech_ms / 1000.0).strftime("%H:%M:%S")
            else:
                ts_formatted = datetime.now().strftime("%H:%M")
                ts_sec = datetime.now().strftime("%H:%M:%S")

            # Clean display text for notes: strip internal bracketed tags for pleasant reading
            display_content = re.sub(r"\[(FACT|HYPOTHESIS|DECISION|ACTION|CONFLICT):[^\]]+\]", "", raw_content).strip()
            if not display_content:
                display_content = raw_content

            clean_normalized = re.sub(r"\s+", " ", display_content).strip().lower()
            turn_key = f"{role}:{clean_normalized}"

            if turn_key not in seen_turns and len(display_content) >= 2:
                seen_turns.add(turn_key)
                existing_transcript.append({
                    "role": role,
                    "content": display_content,
                    "raw_content": raw_content,
                    "timestamp": ts_formatted,
                    "timestamp_sec": ts_sec,
                })

        # Pass 2: Extract structured intelligence from Assistant tags in strict priority order:
        # CONFLICT > DECISION > ACTION > HYPOTHESIS > FACT
        for turn in contents:
            role = str(turn.get("role", "unknown")).lower()
            text = (turn.get("content") or turn.get("text") or turn.get("message") or "").strip()
            speech_ms = turn.get("speech_start_ms") or turn.get("speech_ms") or turn.get("start_ms")

            if speech_ms and speech_ms > 0:
                ts_sec = datetime.fromtimestamp(speech_ms / 1000.0).strftime("%H:%M:%S")
            else:
                ts_sec = datetime.now().strftime("%H:%M:%S")

            if not text or role not in ["assistant", "bot", "ai"]:
                continue

            # 1. CONFLICTS: [CONFLICT: ...] (Priority 1)
            for conf_text in re.findall(r"\[CONFLICT:\s*([^\]]+)\]", text, re.IGNORECASE):
                clean = re.sub(r"\s+", " ", conf_text).strip()
                if is_valid_intel_text(clean) and not is_similar_to_existing(clean, seen_conflicts):
                    seen_conflicts.add(clean.lower())
                    conf_id = f"conf-{len(existing_conflicts)+1}"
                    existing_conflicts.append({
                        "id": conf_id,
                        "text": clean,
                        "timestamp": ts_sec,
                        "severity": "High",
                        "speaker": role,
                    })
                    add_timeline_evt("conflict", clean, ts_sec, item_id=conf_id)
                    logger.info(f"[INTELLIGENCE EXTRACT] Logged CONFLICT: '{clean}'")

            # 2. DECISIONS: [DECISION: ...] (Priority 2 - Must not duplicate conflicts)
            for dec_text in re.findall(r"\[DECISION:\s*([^\]]+)\]", text, re.IGNORECASE):
                clean = re.sub(r"\s+", " ", dec_text).strip()
                if is_valid_intel_text(clean) and not is_similar_to_any(clean, seen_conflicts, seen_decisions):
                    seen_decisions.add(clean.lower())
                    dec_id = f"dec-{len(existing_decisions)+1}"
                    existing_decisions.append({
                        "id": dec_id,
                        "text": clean,
                        "status": "Confirmed",
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("decision", clean, ts_sec, status="Confirmed", item_id=dec_id)
                    logger.info(f"[INTELLIGENCE EXTRACT] Logged DECISION: '{clean}'")

            # 3. ACTIONS: [ACTION: ...] (Priority 3 - Must not duplicate conflicts/decisions)
            for act_text in re.findall(r"\[ACTION:\s*([^\]]+)\]", text, re.IGNORECASE):
                clean = re.sub(r"\s+", " ", act_text).strip()
                if not is_valid_intel_text(clean):
                    continue

                owner = "Unassigned"
                action_desc = clean

                if "@" in clean and "-" in clean:
                    parts = clean.split("-", 1)
                    owner = parts[0].replace("@", "").strip()
                    action_desc = parts[1].strip()
                elif "@" in clean:
                    match = re.match(r"@([A-Za-z0-9_-]+)\s*(.*)", clean)
                    if match:
                        owner = match.group(1).strip()
                        action_desc = match.group(2).strip()
                elif ":" in clean and len(clean.split(":", 1)[0].split()) <= 2:
                    parts = clean.split(":", 1)
                    owner = parts[0].replace("@", "").strip()
                    action_desc = parts[1].strip()

                action_desc = re.sub(r"\s+", " ", action_desc).strip()
                if is_valid_intel_text(action_desc) and not is_similar_to_any(action_desc, seen_conflicts, seen_decisions, seen_actions):
                    seen_actions.add(action_desc.lower())
                    act_id = f"act-{len(existing_actions)+1}"
                    existing_actions.append({
                        "id": act_id,
                        "text": action_desc,
                        "owner": owner,
                        "status": "Pending",
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("action", action_desc, ts_sec, owner=owner, status="Pending", item_id=act_id)
                    logger.info(f"[INTELLIGENCE EXTRACT] Logged ACTION: '@{owner} - {action_desc}'")

            # 4. HYPOTHESES: [HYPOTHESIS: ...] (Priority 4 - Must not duplicate higher priority)
            for hypo_text in re.findall(r"\[HYPOTHESIS:\s*([^\]]+)\]", text, re.IGNORECASE):
                clean = re.sub(r"\s+", " ", hypo_text).strip()
                if is_valid_intel_text(clean) and not is_similar_to_any(clean, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses):
                    seen_hypotheses.add(clean.lower())
                    hypo_id = f"hypo-{len(existing_hypotheses)+1}"
                    existing_hypotheses.append({
                        "id": hypo_id,
                        "text": clean,
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("hypothesis", clean, ts_sec, item_id=hypo_id)
                    logger.info(f"[INTELLIGENCE EXTRACT] Logged HYPOTHESIS: '{clean}'")

            # 5. FACTS: [FACT: ...] (Priority 5 - Lowest priority, strictly non-duplicate)
            for fact_text in re.findall(r"\[FACT:\s*([^\]]+)\]", text, re.IGNORECASE):
                clean = re.sub(r"\s+", " ", fact_text).strip()
                if is_valid_intel_text(clean) and not is_similar_to_any(clean, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses, seen_facts):
                    seen_facts.add(clean.lower())
                    fact_id = f"fact-{len(existing_facts)+1}"
                    existing_facts.append({
                        "id": fact_id,
                        "text": clean,
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("fact", clean, ts_sec, item_id=fact_id)
                    logger.info(f"[INTELLIGENCE EXTRACT] Logged FACT: '{clean}'")

        # Pass 3: Extract structured intelligence from direct User speech (Secondary fallback)
        # Process in strict priority order: CONFLICT > DECISION > ACTION > HYPOTHESIS > FACT
        for turn in contents:
            role = str(turn.get("role", "unknown")).lower()
            text = (turn.get("content") or turn.get("text") or turn.get("message") or "").strip()
            speech_ms = turn.get("speech_start_ms") or turn.get("speech_ms") or turn.get("start_ms")

            if speech_ms and speech_ms > 0:
                ts_sec = datetime.fromtimestamp(speech_ms / 1000.0).strftime("%H:%M:%S")
            else:
                ts_sec = datetime.now().strftime("%H:%M:%S")

            if not text or role != "user":
                continue

            clean_user = re.sub(r"\s+", " ", text).strip()
            if not is_valid_intel_text(clean_user):
                continue

            user_lower = clean_user.lower()

            # Priority 1: Direct Conflict in user speech
            # e.g. "The DBA reports connection timeouts but the monitoring dashboard shows normal database latency."
            conflict_patterns = [
                r"^(.+)\s+(?:reports?\s+.+\s+)?(?:but|whereas|however)\s+(?:the\s+)?(?:monitoring|dashboard|metrics|team|logs)\s+(.+)$",
                r"^(?:there\s+is\s+a\s+)?(?:conflict|discrepancy|inconsistency|mismatch)\s+(?:between|with|in)\s+(.+)$",
                r"^(.+)\s+reports?\s+(.+)\s+but\s+(.+)$",
            ]
            conflict_matched = False
            for pat in conflict_patterns:
                m = re.match(pat, clean_user, re.IGNORECASE)
                if m or ("reports" in user_lower and "but" in user_lower) or ("discrepancy" in user_lower) or ("inconsistent" in user_lower):
                    conf_clean = clean_user.rstrip(".").strip()
                    if is_valid_intel_text(conf_clean) and not is_similar_to_existing(conf_clean, seen_conflicts):
                        seen_conflicts.add(conf_clean.lower())
                        conf_id = f"conf-{len(existing_conflicts)+1}"
                        existing_conflicts.append({
                            "id": conf_id,
                            "text": conf_clean,
                            "timestamp": ts_sec,
                            "severity": "High",
                            "speaker": role,
                        })
                        add_timeline_evt("conflict", conf_clean, ts_sec, item_id=conf_id)
                        logger.info(f"[INTELLIGENCE DIRECT USER CONFLICT] Extracted CONFLICT from user turn: '{conf_clean}'")
                    conflict_matched = True
                    break

            if conflict_matched:
                continue

            # Priority 2: Direct Decision in user speech
            decision_patterns = [
                r"^let(?:'s|\s+us)\s+(freeze|rollback|halt|stop|switch|reroute|scale|deploy|disable|lock|postpone|abort)\s+(.+)$",
                r"^(?:we\s+decided\s+to|decision\s*:\s*)(.+)$",
            ]
            dec_matched = False
            for pat in decision_patterns:
                m = re.match(pat, clean_user, re.IGNORECASE)
                if m:
                    dec_text = clean_user
                    if "let" in user_lower and len(m.groups()) == 2:
                        verb = m.group(1).capitalize()
                        rest = m.group(2).strip()
                        dec_text = f"{verb} {rest}"
                    elif len(m.groups()) == 1:
                        dec_text = m.group(1).strip()

                    dec_clean = re.sub(r"\s+", " ", dec_text).rstrip(".").strip()
                    if is_valid_intel_text(dec_clean) and not is_similar_to_any(dec_clean, seen_conflicts, seen_decisions):
                        seen_decisions.add(dec_clean.lower())
                        dec_id = f"dec-{len(existing_decisions)+1}"
                        existing_decisions.append({
                            "id": dec_id,
                            "text": dec_clean,
                            "status": "Confirmed",
                            "timestamp": ts_sec,
                            "speaker": role,
                        })
                        add_timeline_evt("decision", dec_clean, ts_sec, status="Confirmed", item_id=dec_id)
                        logger.info(f"[INTELLIGENCE DIRECT USER DECISION] Extracted DECISION from user turn: '{dec_clean}'")
                    dec_matched = True
                    break

            if dec_matched:
                continue

            # Priority 3: Direct Action in user speech
            action_patterns = [
                r"^(?:@)?(SRE|DevOps|DBA|Backend|Frontend|Infra|Security|Lead|Team)[,\s:]+(.+)$",
                r"^(?:please\s+)?(?:have\s+)?(SRE|DevOps|DBA|Backend|Infra)\s+(.+)$",
            ]
            act_matched = False
            for pat in action_patterns:
                m = re.match(pat, clean_user, re.IGNORECASE)
                if m:
                    owner = m.group(1).strip()
                    task = m.group(2).strip()
                    task_clean = re.sub(r"\s+", " ", task).rstrip(".").strip()
                    if is_valid_intel_text(task_clean) and not is_similar_to_any(task_clean, seen_conflicts, seen_decisions, seen_actions):
                        seen_actions.add(task_clean.lower())
                        act_id = f"act-{len(existing_actions)+1}"
                        existing_actions.append({
                            "id": act_id,
                            "text": task_clean,
                            "owner": owner.upper(),
                            "status": "Pending",
                            "timestamp": ts_sec,
                            "speaker": role,
                        })
                        add_timeline_evt("action", task_clean, ts_sec, owner=owner.upper(), status="Pending", item_id=act_id)
                        logger.info(f"[INTELLIGENCE DIRECT USER ACTION] Extracted ACTION from user turn: '@{owner.upper()} - {task_clean}'")
                    act_matched = True
                    break

            if act_matched:
                continue

            # Priority 4: Direct Hypothesis in user speech
            if user_lower.startswith(("could this be caused by", "is it possible that", "i suspect that", "i think", "we think", "maybe the", "might be a", "perhaps")) or "may be responsible" in user_lower or "might be responsible" in user_lower or "could be responsible" in user_lower:
                hypo_clean = clean_user.rstrip("?").strip()
                if is_valid_intel_text(hypo_clean) and not is_similar_to_any(hypo_clean, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses):
                    seen_hypotheses.add(hypo_clean.lower())
                    hypo_id = f"hypo-{len(existing_hypotheses)+1}"
                    existing_hypotheses.append({
                        "id": hypo_id,
                        "text": hypo_clean,
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("hypothesis", hypo_clean, ts_sec, item_id=hypo_id)
                    logger.info(f"[INTELLIGENCE DIRECT USER HYPOTHESIS] Extracted HYPOTHESIS from user turn: '{hypo_clean}'")
                continue

            # Priority 5: Direct Fact in user speech (Strictly non-duplicate with any higher priority category)
            if any(kw in user_lower for kw in ["is exhausted", "error rate is", "spiked to", "latency is", "down in", "500 errors on", "out of memory", "is down", "database is down", "payment database is down", "database down", "outage on", "crashed", "failed", "unreachable", "service down", "api down", "database"]):
                fact_clean = clean_user.rstrip(".").strip()
                if is_valid_intel_text(fact_clean) and not is_similar_to_any(fact_clean, seen_conflicts, seen_decisions, seen_actions, seen_hypotheses, seen_facts):
                    seen_facts.add(fact_clean.lower())
                    fact_id = f"fact-{len(existing_facts)+1}"
                    existing_facts.append({
                        "id": fact_id,
                        "text": fact_clean,
                        "timestamp": ts_sec,
                        "speaker": role,
                    })
                    add_timeline_evt("fact", fact_clean, ts_sec, item_id=fact_id)
                    logger.info(f"[INTELLIGENCE DIRECT USER FACT] Extracted FACT from user turn: '{fact_clean}'")

        # Run final reconciliation pass
        self._reconcile_incident_items(incident)
        self._save_persisted_incidents()
        logger.info(f"[INTELLIGENCE SUMMARY] Facts={len(incident.get('facts', []))} Hypotheses={len(incident.get('hypotheses', []))} Decisions={len(incident.get('decisions', []))} Actions={len(incident.get('actions', []))} Conflicts={len(incident.get('conflicts', []))}")
        logger.info(f"[INTELLIGENCE TIMELINE] Total timeline events={len(incident.get('timeline', []))}")

    def update_action_status(self, identifier: Optional[str], action_id: str, status: str = "Completed") -> Dict[str, Any]:
        """
        Mark an action status (e.g. Completed or Pending).
        Preserves action in persistent incident record and updates/adds timeline record.
        """
        incident = self.get_incident(identifier)
        actions = incident.setdefault("actions", [])
        now_ts = datetime.now().strftime("%H:%M:%S")
        updated = False

        for act in actions:
            if act.get("id") == action_id or act.get("text", "").lower() == action_id.lower():
                act["status"] = status
                act["updated_at"] = now_ts
                updated = True

                # Also update corresponding timeline items
                for evt in incident.setdefault("timeline", []):
                    if evt.get("item_id") == act.get("id") or (evt.get("type") == "action" and evt.get("text", "").lower() == act.get("text", "").lower()):
                        evt["status"] = status

                # Add a clear action status update entry to the timeline
                clean_owner = act.get("owner", "Unassigned")
                action_text = act.get("text", "")
                status_text = f"Action {status} (@{clean_owner}): {action_text}"
                incident["timeline"].append({
                    "id": f"evt-{int(time.time()*1000)}-act-update",
                    "item_id": act.get("id"),
                    "type": "action",
                    "text": status_text,
                    "event": status_text,
                    "timestamp": now_ts,
                    "owner": clean_owner,
                    "status": status,
                })
                break

        if updated:
            incident["last_updated"] = time.time()
            self._save_persisted_incidents()
            logger.info(f"[AgoraConvoAI] Action '{action_id}' marked {status} for incident '{incident.get('incident_id')}'")

        return self.get_incident_record_snapshot(incident.get("incident_id"))

    def get_agent_status(self, channel_name: Optional[str] = None) -> Dict[str, Any]:
        """Get the current running status of the AI agent for a specific room."""
        self.refresh_from_env()
        incident = self.get_incident(channel_name)
        channel = incident.get("channel_name")

        active_agent = self.active_agents.get(channel)
        target_agent_id = (active_agent.get("agent_id") if active_agent else None) or incident.get("agent_id")
        saved_status = incident.get("agent_status", "IDLE")

        if active_agent and active_agent.get("status") in ["RUNNING", "JOINING"]:
            return {
                "is_active": True,
                **active_agent,
                "incident_id": incident.get("incident_id"),
                "room_code": incident.get("room_code"),
            }
        elif target_agent_id and saved_status in ["RUNNING", "JOINING"]:
            self.active_agents[channel] = {
                "agent_id": target_agent_id,
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
                "status": saved_status,
            }
            return {
                "is_active": True,
                "agent_id": target_agent_id,
                "channel_name": channel,
                "agent_rtc_uid": self.agent_rtc_uid,
                "status": saved_status,
                "incident_id": incident.get("incident_id"),
                "room_code": incident.get("room_code"),
            }

        return {
            "is_active": False,
            "status": "IDLE" if saved_status == "IDLE" else saved_status,
            "channel_name": channel,
            "agent_rtc_uid": self.agent_rtc_uid,
            "incident_id": incident.get("incident_id"),
            "room_code": incident.get("room_code"),
            "incident_status": incident.get("status", "Active"),
            "credentials_configured": {
                "app_id_set": bool(self.app_id),
                "app_certificate_set": bool(self.app_certificate),
                "customer_id_set": bool(self.customer_id),
                "customer_secret_set": bool(self.customer_secret),
            },
        }


agora_convo_ai_manager = AgoraConvoAIManager()

