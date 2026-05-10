import os
import sys
from typing import Dict, List

import requests


BASE_URL = os.getenv("ACADPULSE_API_URL", "http://127.0.0.1:8001")
USER_ID = os.getenv("ACADPULSE_TEST_USER_ID")
TIMEOUT_SECONDS = int(os.getenv("ACADPULSE_CHAT_TEST_TIMEOUT", "60"))

TEST_CASES: List[Dict[str, str]] = [
    {
        "query": "kya hai aaj due?",
        "expected": "Should list today's due items from context with notification IDs.",
    },
    {
        "query": "NLP assignment mark as done",
        "expected": "Should call mark_item_done if one clear NLP assignment is present; otherwise ask which item.",
    },
    {
        "query": "kitne assignments pending hain?",
        "expected": "Should count pending assignment items from context.",
    },
    {
        "query": "OS quiz kab hai?",
        "expected": "Should find the OS quiz deadline from context and include its notification ID.",
    },
    {
        "query": "add karo kal 5 baje DB assignment",
        "expected": "Should call add_manual_notification for a DB assignment due tomorrow at 5.",
    },
    {
        "query": "deadline extend ho gayi NLP ki, ab Sunday hai",
        "expected": "Should ask which NLP item before calling update_deadline.",
    },
    {
        "query": "sab kuch batao jo this week due hai",
        "expected": "Should list all items due within the next 7 days with IDs.",
    },
    {
        "query": "yeh item 12 delete karo",
        "expected": "Should ask for confirmation before deleting item 12.",
    },
    {
        "query": "haan delete karo",
        "expected": "Should execute delete only if prior context clearly identified the item and confirmation is valid.",
    },
    {
        "query": "koi cancelled class hai aaj?",
        "expected": "Should check today's announcements from context for cancelled classes.",
    },
    {
        "query": "mera schedule kya hai aaj?",
        "expected": "Should show today's timetable from context.",
    },
    {
        "query": "overdue kuch hai?",
        "expected": "Should check context for overdue items.",
    },
    {
        "query": "koi urgent task hai?",
        "expected": "Should answer from urgent/overdue context directly without leaking raw function syntax.",
    },
    {
        "query": "kitne urgent tasks hain?",
        "expected": "Should return a deterministic urgent count from context.",
    },
    {
        "query": "konsa urgent cheez hai?",
        "expected": "Should list urgent items or the single urgent item naturally, without pseudo tool markup.",
    },
    {
        "query": "FAST NLP group ko NLP course se map karo",
        "expected": "Should call map_course for the FAST NLP group and NLP course if the course exists.",
    },
    {
        "query": "item 5 ka detail batao",
        "expected": "Should call get_notification_detail for item 5 or ask for the full notification ID if needed.",
    },
    {
        "query": "sab pending assignments ki list do",
        "expected": "Should return a formatted list of pending assignments with IDs and deadlines.",
    },
]


def send_chat(query: str) -> Dict:
    payload = {"prompt": query}
    if USER_ID:
        payload["user_id"] = USER_ID

    response = requests.post(
        f"{BASE_URL}/chat",
        json=payload,
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    print(f"AcadPulse chatbot test suite")
    print(f"POST {BASE_URL}/chat")
    if USER_ID:
        print(f"Using user_id={USER_ID}")
    print()

    failures = 0

    for index, case in enumerate(TEST_CASES, start=1):
        print(f"=== {index:02d}. {case['query']} ===")
        print(f"Expected: {case['expected']}")

        try:
            data = send_chat(case["query"])
        except Exception as exc:
            failures += 1
            print(f"ERROR: {exc}")
            print()
            continue

        print(f"Safe: {data.get('is_safe')}")
        print(f"Action: {data.get('action')}")
        if data.get("action_result"):
            print(f"Action result: {data.get('action_result')}")
        print(f"Response: {data.get('response')}")
        print()

    if failures:
        print(f"Completed with {failures} request failure(s).")
        return 1

    print("Completed all chatbot requests. Review responses against expected behavior above.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
