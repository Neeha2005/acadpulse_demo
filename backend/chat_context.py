"""
Chatbot Context Builder for AcadPulse
Loads student data from PostgreSQL and formats it as JSON context for the LLM.
Includes 5-minute in-memory caching and token management.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from db import get_chatbot_context_data

logger = logging.getLogger(__name__)
PAKISTAN_TZ = __import__('pytz').timezone("Asia/Karachi")

# In-memory cache: {user_id: (timestamp, context_json_string)}
_chat_context_cache: Dict[str, tuple[datetime, str]] = {}
CACHE_TTL_MINUTES = 5

def _truncate_text(text: Optional[str], limit: int = 120) -> str:
    """Truncate text to limit characters."""
    if not text:
        return ""
    text = " ".join(text.split()) # Normalize whitespace
    if len(text) <= limit:
        return text
    return text[:limit-3] + "..."

def _calculate_hours_remaining(deadline: Optional[datetime]) -> Optional[float]:
    """Calculate hours remaining until deadline."""
    if not deadline:
        return None
    
    # Ensure deadline is timezone-aware
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
        
    now = datetime.now(timezone.utc)
    diff = deadline - now
    hours = diff.total_seconds() / 3600
    return round(hours, 1)

def build_user_context(user_id: str, force_refresh: bool = False) -> str:
    """
    Build a formatted JSON string containing the student's academic context.
    
    Rules:
    - Cached for 5 minutes per user_id.
    - Truncates notification text to 120 chars.
    - Calculates hours_remaining for deadlines.
    - Token management: prioritizes items to stay under 2000 tokens.
    - Fallback context returned if database is unreachable.
    """
    now = datetime.now(timezone.utc)
    
    # Check cache
    if not force_refresh and user_id in _chat_context_cache:
        cached_time, cached_json = _chat_context_cache[user_id]
        if (now - cached_time).total_seconds() < CACHE_TTL_MINUTES * 60:
            return cached_json

    try:
        data = get_chatbot_context_data(user_id)
        
        # Format items according to Task #45 requirements
        context = {
            "student": data["student"],
            "summary": data["summary"],
            "courses": data["courses"],
            "overdue_items": [],
            "urgent_items": [],
            "pending_items": [],
            "todays_announcements": [],
            "timetable_today": []
        }

        for item in data.get("overdue_items") or []:
            context["overdue_items"].append({
                "id": str(item["id"]),
                "category": item["category"],
                "course": item["course"],
                "text": _truncate_text(item["text"]),
                "deadline": item["deadline"].strftime("%Y-%m-%d %H:%M") if item["deadline"] else None,
                "urgency": item["urgency"],
                "hours_remaining": _calculate_hours_remaining(item["deadline"]),
                "source": item["source"]
            })

        # Process urgent items
        for item in data["urgent_items"]:
            context["urgent_items"].append({
                "id": str(item["id"]),
                "category": item["category"],
                "course": item["course"],
                "text": _truncate_text(item["text"]),
                "deadline": item["deadline"].strftime("%Y-%m-%d %H:%M") if item["deadline"] else None,
                "urgency": item["urgency"],
                "hours_remaining": _calculate_hours_remaining(item["deadline"]),
                "source": item["source"]
            })

        # Process pending items
        for item in data["pending_items"]:
            context["pending_items"].append({
                "id": str(item["id"]),
                "category": item["category"],
                "course": item["course"],
                "text": _truncate_text(item["text"]),
                "deadline": item["deadline"].strftime("%Y-%m-%d %H:%M") if item["deadline"] else None,
                "urgency": item["urgency"],
                "hours_remaining": _calculate_hours_remaining(item["deadline"]),
                "source": item["source"]
            })

        # Process announcements
        for item in data["announcements"]:
            context["todays_announcements"].append({
                "id": str(item["id"]),
                "course": item["course"],
                "text": _truncate_text(item["text"]),
                "received_at": item["received_at"].strftime("%H:%M")
            })

        # Process timetable
        for item in data["timetable"]:
            context["timetable_today"].append({
                "course_code": item["course_code"],
                "course_name": item["course_name"],
                "start": item["start_time"].strftime("%H:%M"),
                "end": item["end_time"].strftime("%H:%M"),
                "room": item["room_number"]
            })

        # Token management (rough estimate: 4 chars per token)
        # Target < 2000 tokens -> < 8000 characters
        context_json = json.dumps(context, ensure_ascii=False)
        
        while len(context_json) > 8000:
            # Prioritize: urgent_items > pending_items > announcements > timetable
            # Drop from bottom up
            if context["timetable_today"]:
                context["timetable_today"].pop()
            elif context["todays_announcements"]:
                context["todays_announcements"].pop()
            elif context["pending_items"]:
                context["pending_items"].pop()
            elif context["overdue_items"]:
                context["overdue_items"].pop()
            elif context["urgent_items"]:
                # If even urgent items are too many, we just have to truncate more
                context["urgent_items"].pop()
            else:
                break
            context_json = json.dumps(context, ensure_ascii=False)

        # Update cache
        _chat_context_cache[user_id] = (now, context_json)
        return context_json

    except Exception as e:
        logger.error(f"Error building chatbot context for user {user_id}: {e}")
        # Fallback context
        fallback = {
            "error": "Database temporarily unavailable",
            "student": {"name": "Scholar", "university": "FAST", "degree": "BS Computer Science", "semester": "5th"}
        }
        return json.dumps(fallback)

def invalidate_chat_context(user_id: str):
    """Invalidate the chatbot context cache for a user."""
    if user_id in _chat_context_cache:
        del _chat_context_cache[user_id]
        logger.debug(f"Invalidated chat context cache for user {user_id}")
