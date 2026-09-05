import asyncio
from agora_convo_ai import AgoraConvoAIManager, is_idle_status_message

def test_idle_status_message():
    assert is_idle_status_message("No updates received. Monitoring for any incoming information.") is True
    assert is_idle_status_message("I'm here and ready to assist.") is True
    assert is_idle_status_message("Ready to receive updates.") is True
    assert is_idle_status_message("I'm waiting for input.") is True
    assert is_idle_status_message("Please share when ready.") is True
    assert is_idle_status_message("Standing by for updates.") is True
    assert is_idle_status_message("Waiting for your input.") is True
    assert is_idle_status_message("I am here to help.") is True
    assert is_idle_status_message("Feel free to share when ready.") is True
    
    # Real incident responses must NOT be suppressed
    assert is_idle_status_message("[FACT: The payment database is down] Understood.") is False
    assert is_idle_status_message("[HYPOTHESIS: Deployment caused database failure] Noted.") is False
    assert is_idle_status_message("[DECISION: Freeze all production deployments] Confirmed.") is False
    assert is_idle_status_message("[ACTION: @SRE - Restart replica] Assigned.") is False
    assert is_idle_status_message("[CONFLICT: DBA reports timeouts while monitoring normal] Flagged.") is False
    assert is_idle_status_message("The database pool has 2 active connections remaining.") is False

def test_clean_new_incident_timeline():
    manager = AgoraConvoAIManager()
    fresh = manager.create_new_incident(channel_name="incident-test-9999")
    
    assert fresh["incident_id"].startswith("INC-")
    assert fresh["participants"] == []
    assert len(fresh["timeline"]) == 1
    assert "Incident room" in fresh["timeline"][0]["event"]
    assert "created on channel" in fresh["timeline"][0]["event"]

    # Register participant
    res = manager.register_participant("incident-test-9999", 12345, "Alex", "SRE Lead")
    inc = manager.get_incident("incident-test-9999")
    
    assert len(inc["participants"]) == 1
    assert inc["participants"][0]["display_name"] == "Alex"
    assert inc["participants"][0]["role"] == "SRE Lead"
    assert len(inc["timeline"]) == 2
    assert "Alex (SRE Lead) joined the incident room" in inc["timeline"][1]["event"]

if __name__ == "__main__":
    test_idle_status_message()
    test_clean_new_incident_timeline()
    print("All backend improvement tests passed!")
