from datetime import datetime, timedelta

import pytz

from main import _calculate_urgency


PKT = pytz.timezone("Asia/Karachi")
NOW = PKT.localize(datetime(2026, 5, 2, 12, 0))


assert _calculate_urgency(None, NOW) == {
    "score": 0,
    "label": "none",
    "color": "grey",
}

assert _calculate_urgency(NOW + timedelta(days=8), NOW) == {
    "score": 1,
    "label": "low",
    "color": "green",
}

assert _calculate_urgency(NOW + timedelta(days=7), NOW) == {
    "score": 2,
    "label": "medium",
    "color": "yellow",
}

assert _calculate_urgency(NOW + timedelta(hours=24), NOW) == {
    "score": 3,
    "label": "high",
    "color": "orange",
}

assert _calculate_urgency(NOW + timedelta(hours=23, minutes=59), NOW) == {
    "score": 4,
    "label": "critical",
    "color": "red",
}

assert _calculate_urgency(NOW - timedelta(minutes=1), NOW) == {
    "score": 5,
    "label": "overdue",
    "color": "black",
}

naive_pkt_deadline = datetime(2026, 5, 9, 12, 0)
assert _calculate_urgency(naive_pkt_deadline, NOW) == {
    "score": 2,
    "label": "medium",
    "color": "yellow",
}

print("All urgency tests passed.")
