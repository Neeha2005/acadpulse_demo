"""
Phase 4 integration smoke tests for AcadPulse.

Run from PowerShell while FastAPI is already running:
    .\.venv\Scripts\python.exe .\test_phase4_integrations.py

The script intentionally prints responses instead of asserting hard pass/fail,
because Gmail/Classroom and chatbot tool calls depend on local OAuth/Groq/DB
credentials being available on the developer machine.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests


BASE_URL = os.getenv("ACADPULSE_API_URL", "http://127.0.0.1:8000").rstrip("/")
USER_ID = os.getenv("ACADPULSE_TEST_USER_ID", "1")
TIMEOUT_SECONDS = int(os.getenv("ACADPULSE_TEST_TIMEOUT", "45"))


def print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def print_response(label: str, response: requests.Response) -> Optional[Dict[str, Any]]:
    print(f"{label}: HTTP {response.status_code}")
    try:
        payload = response.json()
    except ValueError:
        print(response.text)
        return None

    print(payload)
    return payload


def api_get(path: str, **params: Any) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", params=params, timeout=TIMEOUT_SECONDS)


def api_post(path: str, payload: Dict[str, Any]) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", json=payload, timeout=TIMEOUT_SECONDS)


def find_notification(source_type: str, external_message_id: str) -> Optional[Dict[str, Any]]:
    response = api_get(
        "/notifications",
        user_id=USER_ID,
        include_completed="true",
        source_type=source_type,
        limit=200,
    )
    data = response.json()
    for item in data.get("notifications", []):
        if item.get("external_message_id") == external_message_id:
            return item
    return None


def wait_for_notification(source_type: str, external_message_id: str, seconds: int = 50) -> Optional[Dict[str, Any]]:
    deadline = time.time() + seconds
    while time.time() < deadline:
        item = find_notification(source_type, external_message_id)
        if item:
            return item
        time.sleep(3)
    return None


def test_whatsapp_to_dashboard() -> None:
    print_section("WA -> classify -> deadline -> dashboard")
    message_id = f"phase4-wa-{int(time.time())}"
    payload = {
        "user_id": USER_ID,
        "message_id": message_id,
        "chat_id": "phase4-test-group@g.us",
        "chat_name": "FAST NLP Group",
        "sender_phone": "923000000000",
        "sender_name": "Phase4 Tester",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "text": "NLP assignment submit tomorrow at 5pm. Urgent hai.",
        "is_group": True,
        "is_from_me": False,
    }

    print_response("POST /messages/incoming", api_post("/messages/incoming", payload))
    print("Polling /notifications because WhatsApp messages may flush from the 30s buffer...")
    item = wait_for_notification("whatsapp", message_id)

    if item:
        print("Dashboard notification found:")
        print({
            "id": item.get("id"),
            "source_type": item.get("source_type"),
            "category": item.get("category"),
            "deadline": item.get("deadline"),
            "urgency_label": item.get("urgency_label"),
            "external_message_id": item.get("external_message_id"),
        })
    else:
        print("No notification found before timeout. Check backend logs and WhatsApp buffer flusher.")


def test_gmail_and_classroom_fetch() -> None:
    print_section("Gmail + Classroom end-to-end")
    print_response("GET /gmail/fetch", api_get("/gmail/fetch", max_results=5))
    print_response("GET /classroom/fetch", api_get("/classroom/fetch"))


def test_chatbot_crud_notifications() -> None:
    print_section("Chatbot CRUD + notifications")
    history = []
    prompts = [
        "add karo kal 5 baje DB assignment",
        "sab pending assignments ki list do",
    ]

    for prompt in prompts:
        response = api_post(
            "/chat",
            {
                "prompt": prompt,
                "user_id": USER_ID,
                "history": history[-10:],
            },
        )
        data = print_response(f"POST /chat :: {prompt}", response) or {}
        history.append({"role": "user", "content": prompt})
        history.append({"role": "assistant", "content": str(data.get("response", ""))})


def main() -> None:
    print(f"AcadPulse Phase 4 smoke tests against {BASE_URL}")
    print_response("GET /test", api_get("/test"))
    test_whatsapp_to_dashboard()
    test_gmail_and_classroom_fetch()
    test_chatbot_crud_notifications()
    print("\nReview each printed response against expected source/category/deadline/action fields.")


if __name__ == "__main__":
    main()
