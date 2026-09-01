"""
AI Incident Intelligence Engine
Extracts structured intelligence (Facts, Hypotheses, Decisions, Actions, Conflicts)
from live multi-speaker conversation transcripts using Gemini API or high-precision NLP fallback.
"""

import json
import os
import re
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv

from incident_manager import (
    ActionItem,
    ConflictAlert,
    CriticalAction,
    Decision,
    Fact,
    Hypothesis,
    Incident,
    TranscriptUtterance,
)

load_dotenv()


class AIEngine:
    """Gemini-powered & rule-enhanced Incident Intelligence parser."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

    def set_api_key(self, key: str):
        self.api_key = key.strip()

    async def analyze_utterance(
        self,
        incident: Incident,
        speaker: str,
        role: str,
        text: str,
    ) -> Dict[str, Any]:
        """
        Analyze a spoken transcript turn and extract incident items.
        Returns extracted items and classification tags.
        """
        # If Gemini API key is available, try LLM extraction
        if self.api_key:
            try:
                llm_result = await self._call_gemini_analysis(incident, speaker, role, text)
                if llm_result:
                    return llm_result
            except Exception as e:
                print(f"[AIEngine] Gemini API call fallback triggered: {e}")

        # High-precision heuristic NLP analysis
        return self._heuristic_analysis(incident, speaker, role, text)

    async def _call_gemini_analysis(
        self,
        incident: Incident,
        speaker: str,
        role: str,
        text: str,
    ) -> Optional[Dict[str, Any]]:
        """Call Gemini Flash API for incident extraction."""
        prompt = f"""
You are the AI Incident Commander for a high-pressure technical incident war room.
Incident: #{incident.id} - {incident.title} (Severity: {incident.severity}, State: {incident.state})
Active Facts: {[f.statement for f in incident.facts[-4:]]}
Active Hypotheses: {[h.statement for h in incident.hypotheses[-3:]]}
Active Actions: {[a.task for a in incident.actions[-3:]]}

A team member just said:
Speaker: {speaker} ({role})
Utterance: "{text}"

Extract any structured incident intelligence from this utterance.
Respond STRICTLY with valid JSON matching this schema:
{{
  "tags": ["fact" | "hypothesis" | "decision" | "action" | "conflict" | "general"],
  "ai_response": "Brief 1-sentence spoken response from AI commander if appropriate, or null",
  "fact": {{ "statement": "...", "evidence": "...", "category": "metrics|network|database|app" }} or null,
  "hypothesis": {{ "statement": "...", "probability_pct": 75 }} or null,
  "decision": {{ "outcome": "...", "rationale": "..." }} or null,
  "action": {{ "task": "...", "assignee": "{speaker}", "role": "{role}", "priority": "Critical|High|Medium" }} or null,
  "conflict": {{ "title": "...", "description": "...", "speaker_a": "...", "claim_a": "...", "speaker_b": "{speaker}", "claim_b": "..." }} or null,
  "critical_action_proposal": {{ "title": "...", "description": "...", "command_preview": "...", "risk_level": "Critical" }} or null
}}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1},
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(content)
        return None

    def _heuristic_analysis(
        self,
        incident: Incident,
        speaker: str,
        role: str,
        text: str,
    ) -> Dict[str, Any]:
        """Ultra-robust local incident pattern analyzer."""
        lower = text.lower()
        tags = []
        result: Dict[str, Any] = {
            "tags": [],
            "ai_response": None,
            "fact": None,
            "hypothesis": None,
            "decision": None,
            "action": None,
            "conflict": None,
            "critical_action_proposal": None,
        }

        # 1. Conflict & Contradiction Detection
        if any(w in lower for w in ["still active", "not rolled back", "still receiving", "disagree", "wait rahul", "wait priya", "contradict", "no restarts occurred"]):
            tags.append("conflict")
            result["conflict"] = {
                "title": "Conflicting Information Detected",
                "description": f"{speaker} reported data contradicting prior claims: '{text}'",
                "speaker_a": "Previous Speaker",
                "claim_a": "Service / DB action was reported complete.",
                "speaker_b": speaker,
                "claim_b": text,
                "severity": "High",
                "requires_confirmation": True,
            }
            result["ai_response"] = f"Warning: Conflicting status detected from {speaker}. Commander confirmation is required before proceeding."

        # 2. Critical Action / Remediation Proposals
        if any(w in lower for w in ["rollback", "failover", "reboot cluster", "purge cache", "scale down", "drain traffic"]):
            if any(w in lower for w in ["recommend", "should we", "need to", "let's run", "propose"]):
                tags.append("action")
                result["critical_action_proposal"] = {
                    "title": f"Execute {'Rollback' if 'rollback' in lower else 'Failover'} Action",
                    "description": f"Proposed by {speaker}: {text}",
                    "command_preview": "kubectl rollout undo deployment/service -n prod",
                    "risk_level": "Critical",
                }
                result["ai_response"] = f"Understood. Critical action proposed by {speaker}. Awaiting human commander confirmation."

        # 3. Action Items
        if any(w in lower for w in ["i will", "i'll", "assign", "investigating", "checking", "working on", "action item", "can you verify", "please check"]):
            tags.append("action")
            task_desc = text
            assignee = speaker
            for p in incident.participants:
                if p.name.split()[0].lower() in lower and p.name != speaker:
                    assignee = p.name
                    break
            result["action"] = {
                "task": task_desc.replace("I will ", "").replace("I'll ", "").capitalize(),
                "assignee": assignee,
                "role": role,
                "priority": "Critical" if "immediately" in lower or "critical" in lower else "High",
                "due_in_min": 10,
            }

        # 4. Facts (metrics, error rates, verified evidence)
        if any(w in lower for w in ["%", "error rate", "latency", "status code", "logs show", "confirmed", "verified", "502", "504", "datadog", "grafana"]):
            tags.append("fact")
            result["fact"] = {
                "statement": text,
                "evidence": f"Reported by {speaker} ({role}) from telemetry logs",
                "category": "metrics" if "%" in text or "error" in lower else "system",
            }

        # 5. Hypotheses (suspected causes, theories)
        elif any(w in lower for w in ["suspect", "might be", "could be", "hypothesis", "probably", "seems like", "root cause might", "gateway is down"]):
            tags.append("hypothesis")
            result["hypothesis"] = {
                "statement": text,
                "probability_pct": 80 if "likely" in lower or "suspect" in lower else 60,
                "status": "Active",
            }

        # 6. Decisions (agreements, throttling, signoffs)
        elif any(w in lower for w in ["let's throttle", "agreed", "we decided", "commander approved", "let's go with", "decision:"]):
            tags.append("decision")
            result["decision"] = {
                "outcome": text,
                "rationale": f"Consensus led by {speaker}",
                "agreed_by": [speaker],
            }

        if not tags:
            tags.append("general")

        result["tags"] = tags
        return result

    async def generate_spoken_briefing(self, incident: Incident) -> Dict[str, str]:
        """Generate a concise, 30-second spoken status update for the incident team."""
        facts_summary = "; ".join([f.statement for f in incident.facts[-2:]]) if incident.facts else "Metrics under review."
        hypo_summary = incident.hypotheses[-1].statement if incident.hypotheses else "Investigating root cause."
        pending_actions = len([a for a in incident.actions if a.status != "Completed"])
        conflicts_count = len([c for c in incident.conflicts if not c.is_resolved])

        conflict_note = f"Warning: {conflicts_count} active conflict requires commander confirmation." if conflicts_count > 0 else "No unresolved conflicts."

        spoken_text = (
            f"Commander Briefing for incident {incident.id}. "
            f"Status is {incident.severity}, state is {incident.state}. "
            f"Key facts: {facts_summary}. "
            f"Leading hypothesis: {hypo_summary}. "
            f"{pending_actions} active action items in progress. "
            f"{conflict_note}"
        )

        return {
            "spoken_text": spoken_text,
            "bullet_points": [
                f"Incident #{incident.id} ({incident.severity} - {incident.state})",
                f"Facts: {facts_summary}",
                f"Hypothesis: {hypo_summary}",
                f"Actions: {pending_actions} active task(s)",
                conflict_note,
            ],
        }


ai_engine = AIEngine()
