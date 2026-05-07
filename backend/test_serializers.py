from datetime import datetime

from main import _serialize_slot, parse_deadline_response, serialize_attachment_row


slot = _serialize_slot(
    {
        "id": "slot-1",
        "course_id": "course-1",
        "day_of_week": 2,
        "start_time": datetime(2026, 5, 7, 9, 30),
        "end_time": datetime(2026, 5, 7, 11, 0),
        "room_number": "Lab 2",
        "course_code": "CS101",
        "course_name": "Intro to Computing",
        "short_name": "Intro",
    }
)
assert slot == {
    "id": "slot-1",
    "course_id": "course-1",
    "day_of_week": 2,
    "start_time": "09:30",
    "end_time": "11:00",
    "room_number": "Lab 2",
    "course_code": "CS101",
    "course_name": "Intro to Computing",
    "short_name": "Intro",
}


attachment = serialize_attachment_row(
    {
        "id": "att-1",
        "notification_id": "notif-1",
        "file_name": "outline.pdf",
        "file_type": "application/pdf",
        "file_path": "https://example.com/outline.pdf",
    }
)
assert attachment == {
    "id": "att-1",
    "notification_id": "notif-1",
    "file_name": "outline.pdf",
    "file_type": "application/pdf",
    "file_path": "https://example.com/outline.pdf",
    "url": "https://example.com/outline.pdf",
}


parsed_deadline = parse_deadline_response('{"has_deadline": true, "deadline": "2026-05-09 17:00"}')
assert parsed_deadline["has_deadline"] is True
assert parsed_deadline["deadline"].year == 2026
assert parsed_deadline["deadline"].month == 5
assert parsed_deadline["deadline"].day == 9
assert parsed_deadline["deadline"].hour == 17
assert parsed_deadline["deadline"].minute == 0


assert parse_deadline_response('{"has_deadline": false, "deadline": null}') == {
    "has_deadline": False,
    "deadline": None,
}


print("Serializer and deadline parsing tests passed.")
