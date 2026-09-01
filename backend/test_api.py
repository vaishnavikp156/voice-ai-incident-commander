import httpx
import json
import sys

BASE_URL = "http://localhost:8000"

def test_all():
    print("=== Testing Voice AI Incident Commander Endpoints ===")
    client = httpx.Client(timeout=10.0)
    
    # 1. Health
    r = client.get(f"{BASE_URL}/health")
    print(f"1. Health Check: {r.status_code} - {r.json()}")
    assert r.status_code == 200

    # 2. Get Incident
    r = client.get(f"{BASE_URL}/api/incidents/PAY-2048")
    print(f"2. Get Incident: {r.status_code} - Title: {r.json()['title']}, Severity: {r.json()['severity']}")
    assert r.status_code == 200
    inc = r.json()

    # 3. Agora Token Generation
    token_payload = {"channel_name": "incident-pay-2048", "uid": 12345, "role": 1}
    r = client.post(f"{BASE_URL}/api/agora/token", json=token_payload)
    print(f"3. Agora Token: {r.status_code} - Channel: {r.json()['channel_name']}, Token Generated: {bool(r.json()['token'])}")
    assert r.status_code == 200

    # 4. Analyze Utterance (Fact)
    utterance_fact = {
        "incident_id": "PAY-2048",
        "speaker": "Rahul Sharma",
        "role": "Lead SRE",
        "text": "Datadog logs confirm that 502 Bad Gateway errors on payment-api reached 52.4%."
    }
    r = client.post(f"{BASE_URL}/api/ai/analyze-utterance", json=utterance_fact)
    print(f"4. Fact Extraction: {r.status_code} - Tags: {r.json()['analysis']['tags']}")
    assert r.status_code == 200

    # 5. Analyze Utterance (Conflict Detection)
    utterance_conflict = {
        "incident_id": "PAY-2048",
        "speaker": "Priya Patel",
        "role": "Database Admin",
        "text": "Wait Rahul, the v2.4 pods are still active in traffic mesh routing, rollback is not complete."
    }
    r = client.post(f"{BASE_URL}/api/ai/analyze-utterance", json=utterance_conflict)
    print(f"5. Conflict Detection: {r.status_code} - Tags: {r.json()['analysis']['tags']}, AI Response: {r.json()['spoken_response']}")
    assert r.status_code == 200

    # 6. Spoken Briefing
    r = client.post(f"{BASE_URL}/api/ai/briefing?incident_id=PAY-2048")
    print(f"6. Spoken Briefing: {r.status_code} - Audio Text: {r.json()['spoken_text'][:90]}...")
    assert r.status_code == 200

    # 7. Action Item Toggle
    first_action_id = inc["actions"][0]["id"]
    r = client.post(f"{BASE_URL}/api/actions/PAY-2048/{first_action_id}/toggle", json={"new_status": "Completed"})
    print(f"7. Action Toggle: {r.status_code} - Action {first_action_id} Status: {r.json()['status']}")
    assert r.status_code == 200

    # 8. Human Confirmation for Critical Action
    crit_action_id = inc["critical_actions"][0]["id"]
    r = client.post(
        f"{BASE_URL}/api/actions/critical/PAY-2048/{crit_action_id}/confirm",
        json={"approved": True, "commander_name": "Vaishnavi K P"}
    )
    print(f"8. Critical Action Approval: {r.status_code} - Status: {r.json()['status']}, Approved By: {r.json()['approved_by']}")
    assert r.status_code == 200

    # 9. Integrations (Jira, Slack, PagerDuty)
    r_jira = client.post(f"{BASE_URL}/api/integrations/jira?incident_id=PAY-2048")
    print(f"9a. Jira Sync: {r_jira.status_code} - {r_jira.json()['issue_key']}")
    assert r_jira.status_code == 200

    r_slack = client.post(f"{BASE_URL}/api/integrations/slack?incident_id=PAY-2048&message=Live+War+Room+Update")
    print(f"9b. Slack Broadcast: {r_slack.status_code} - Channel: {r_slack.json()['channel']}")
    assert r_slack.status_code == 200

    r_pd = client.post(f"{BASE_URL}/api/integrations/pagerduty?incident_id=PAY-2048")
    print(f"9c. PagerDuty Escalation: {r_pd.status_code} - Incident ID: {r_pd.json()['incident_id']}")
    assert r_pd.status_code == 200

    # 10. Test Frontend Accessibility
    r_fe = client.get("http://localhost:5174/")
    print(f"10. Frontend Dev Server: {r_fe.status_code} - HTML length: {len(r_fe.text)} bytes")
    assert r_fe.status_code == 200

    print("\n[SUCCESS] ALL 10 TESTS PASSED SUCCESSFULLY! The Voice AI Incident Commander is fully operational.")

if __name__ == "__main__":
    test_all()
