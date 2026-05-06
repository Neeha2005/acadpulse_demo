from datetime import datetime

from main import (
    _is_clear_deterministic_chat_action,
    classifier_stub_with_confidence,
    detect_roman_urdu_chat_action,
    parse_manual_deadline,
)


CONTEXT = {
    "courses": [
        {
            "course_code": "CS301",
            "course_name": "Operating Systems",
            "aliases": ["OS", "Ops Sys"],
        },
        {
            "course_code": "CS201",
            "course_name": "Data Structures",
            "aliases": ["DSA", "DS"],
        },
    ],
}


def test_roman_urdu_create_assignment():
    action = detect_roman_urdu_chat_action("kal OS assignment add kar do", CONTEXT)

    assert action["action"] == "create_task"
    assert action["arguments"]["category"] == "assignment"
    assert action["arguments"]["course"] == "CS301"
    assert action["arguments"]["deadline"] == "tomorrow"


def test_roman_urdu_create_quiz_with_time():
    action = detect_roman_urdu_chat_action("DSA quiz kal raat 11pm add kar do", CONTEXT)

    assert action["action"] == "create_task"
    assert action["arguments"]["category"] == "quiz"
    assert action["arguments"]["course"] == "CS201"
    assert action["arguments"]["deadline"] == "tomorrow 11pm"


def test_roman_urdu_list_pending_tasks():
    action = detect_roman_urdu_chat_action("meri pending assignments dikhao", CONTEXT)

    assert action["action"] == "list_tasks"
    assert action["arguments"]["include_completed"] is False


def test_roman_urdu_complete_task_with_uuid():
    action = detect_roman_urdu_chat_action(
        "task 11111111-1111-1111-1111-111111111111 complete kar do",
        CONTEXT,
    )

    assert action["action"] == "complete_task"
    assert action["arguments"]["notification_id"] == "11111111-1111-1111-1111-111111111111"


def test_roman_urdu_manual_deadline_parsing():
    parsed = parse_manual_deadline(deadline="kal raat")

    assert isinstance(parsed, datetime)
    assert parsed.tzinfo is not None


def test_classifier_recognizes_roman_urdu_assignment():
    result = classifier_stub_with_confidence("OS assignment kal raat 11 baje submit karni hai")

    assert result["label"] == "assignment"
    assert result["confidence"] >= 0.8


def test_classifier_recognizes_exam_schedule_over_general_words():
    result = classifier_stub_with_confidence("Final exam date sheet upload ho gai hai")

    assert result["label"] == "exam_schedule"


def test_deterministic_create_requires_clear_add_intent():
    action = detect_roman_urdu_chat_action("assignment deadline extend ho gayi hai", CONTEXT)

    assert action["action"] == "create_task"
    assert _is_clear_deterministic_chat_action("assignment deadline extend ho gayi hai", action) is False
