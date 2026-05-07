from main import (
    extract_deadlines_heuristic,
    get_unique_pending_whatsapp_user_id,
    whatsapp_status_state,
)


heuristic_deadlines = extract_deadlines_heuristic("We have to submit project till monday")
assert isinstance(heuristic_deadlines, list)
assert heuristic_deadlines, "Expected heuristic fallback to detect 'till monday'"
assert heuristic_deadlines[0].get("deadline_date"), "Expected a parsed deadline_date"


original_sessions = dict(whatsapp_status_state.get("sessions", {}))
try:
    whatsapp_status_state["sessions"] = {
        "user-a": {"pending_user_id": "user-a"},
    }
    assert get_unique_pending_whatsapp_user_id() == "user-a"

    whatsapp_status_state["sessions"] = {
        "user-a": {"pending_user_id": "user-a"},
        "user-b": {"pending_user_id": "user-b"},
    }
    assert get_unique_pending_whatsapp_user_id() is None
finally:
    whatsapp_status_state["sessions"] = original_sessions


print("Deadline heuristic and WhatsApp session-state tests passed.")
