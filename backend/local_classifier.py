import os
import re
from typing import Dict, Optional


LABELS = (
    "announcement",
    "assignment",
    "event",
    "quiz",
    "material",
    "exam_schedule",
    "noise",
)

KEYWORDS = {
    "assignment": {
        "strong": [
            "assignment",
            "homework",
            "submit",
            "submission",
            "project",
            "lab",
            "problem set",
            "due",
        ],
        "weak": [
            "deadline",
            "hand in",
            "upload",
            "deliverable",
            "report",
        ],
    },
    "quiz": {
        "strong": [
            "quiz",
            "mcq",
            "multiple choice",
            "short answer",
            "viva",
        ],
        "weak": [
            "test",
            "assessment",
            "paper pattern",
        ],
    },
    "event": {
        "strong": [
            "seminar",
            "workshop",
            "webinar",
            "orientation",
            "meeting",
            "session",
        ],
        "weak": [
            "lecture",
            "class at",
            "room changed",
            "venue",
            "join us",
        ],
    },
    "material": {
        "strong": [
            "slides",
            "notes",
            "reading",
            "resource",
            "material",
            "pdf",
            "document",
        ],
        "weak": [
            "chapter",
            "reference",
            "book",
            "files attached",
        ],
    },
    "exam_schedule": {
        "strong": [
            "exam schedule",
            "date sheet",
            "midterm schedule",
            "final exam schedule",
            "paper timing",
        ],
        "weak": [
            "exam timetable",
            "seating plan",
        ],
    },
    "announcement": {
        "strong": [
            "announcement",
            "notice",
            "important update",
            "reminder",
        ],
        "weak": [
            "inform",
            "cancelled",
            "postponed",
            "rescheduled",
            "kindly note",
        ],
    },
    "noise": {
        "strong": [
            "unsubscribe",
            "sale",
            "discount",
            "otp",
            "verification code",
        ],
        "weak": [
            "promotion",
            "offer",
            "newsletter",
        ],
    },
}


def _normalize(text: str) -> str:
    cleaned = str(text or "").lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _score_label(text: str, label: str) -> float:
    spec = KEYWORDS.get(label, {})
    score = 0.0

    for term in spec.get("strong", []):
        if term in text:
            score += 2.5

    for term in spec.get("weak", []):
        if term in text:
            score += 1.0

    if label in {"assignment", "quiz", "exam_schedule"} and re.search(r"\b(due|tomorrow|today|friday|monday|\d{1,2}:\d{2})\b", text):
        score += 0.75

    return score


def local_classifier_available() -> bool:
    return os.getenv("LOCAL_CLASSIFIER_ENABLED", "true").strip().lower() not in {"0", "false", "no"}


def classify_with_local_model(text: str) -> Optional[Dict[str, object]]:
    """Return a conservative local classification result or None.

    This intentionally avoids forcing a result on weak/ambiguous input so the
    existing fallback chain in main.py can continue unchanged.
    """
    if not local_classifier_available():
        return None

    normalized = _normalize(text)
    if not normalized:
        return None

    scores = {label: _score_label(normalized, label) for label in LABELS}
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_label, top_score = ranked[0]
    runner_up_score = ranked[1][1] if len(ranked) > 1 else 0.0

    minimum_score = float(os.getenv("LOCAL_CLASSIFIER_MIN_SCORE", "2.5"))
    minimum_margin = float(os.getenv("LOCAL_CLASSIFIER_MIN_MARGIN", "1.0"))

    if top_score < minimum_score:
        return None
    if (top_score - runner_up_score) < minimum_margin:
        return None

    confidence = min(0.99, 0.55 + (top_score * 0.08))
    return {
        "label": top_label,
        "score": round(confidence, 4),
        "source": "local_classifier_rules",
    }
