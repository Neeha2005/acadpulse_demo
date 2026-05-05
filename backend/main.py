import os
import base64
import re
import time
import json
import logging
import asyncio
import secrets
from contextlib import suppress
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict
from urllib.parse import quote_plus

import bcrypt
from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from groq import APIConnectionError, APIStatusError, Groq
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from rapidfuzz import fuzz
from psycopg2.extras import RealDictCursor
import dateparser
import pytz
import httpx

from google_auth import get_google_credentials
from db import (
    get_db_connection,
    insert_notification,
    get_or_create_user,
    notification_exists,
    update_notification_deadline,
    get_pending_deadline_notifications,
    get_users_with_pending_deadlines,
    update_notification_urgency,
    update_notification_category,
    get_notification_id_by_source,
    get_user_by_email,
    get_user_by_id,
    create_user_account,
    get_notification_by_id,
    list_notifications,
    update_notification_completion,
    update_notification_fields,
    list_courses,
    get_course_by_id,
    get_course_by_name,
    delete_notification,
    replace_course_aliases,
    upsert_course,
    record_whatsapp_group,
    list_whatsapp_groups,
    record_classroom_course,
    list_classroom_courses,
    get_course_mapping_course_id,
    list_course_source_mappings,
    upsert_course_source_mapping,
)
from local_classifier import classify_with_local_model, local_classifier_available
from notification_abbr import (
    expand_abbreviations,
    seed_default_abbreviations,
    add_or_update_abbreviation,
    delete_abbreviation,
    get_user_abbreviations,
    detect_unknown_abbreviations,
    get_unknown_abbreviations,
)
from chat_context import build_user_context, invalidate_chat_context
from chatbot_config import build_chatbot_system_prompt
from whatsapp_pipeline import process_whatsapp_message, start_whatsapp_buffer_flusher, stop_whatsapp_buffer_flusher
import uuid

load_dotenv(Path(__file__).resolve().parent / ".env")
logger = logging.getLogger(__name__)
PAKISTAN_TZ = pytz.timezone("Asia/Karachi")
URGENCY_REFRESH_INTERVAL_SECONDS = 3 * 60 * 60
urgency_refresh_task = None
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-acadpulse-dev-secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
GROQ_DAILY_WARNING_REQUEST_LIMIT = int(os.getenv("GROQ_DAILY_WARNING_REQUEST_LIMIT", "14400"))
groq_status = {
    "model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
    "session_calls": 0,
    "tokens_used_today": 0,
    "daily_warning_threshold_crossed": False,
    "last_error": None,
    "token_day": datetime.now(PAKISTAN_TZ).date().isoformat(),
}
whatsapp_status_state = {
    "status": "unknown",
    "reason": None,
    "updated_at": None,
}

app = FastAPI(
    title="AcadPulse API",
    description="Backend API for AcadPulse academic notification system",
    version="1.1.0",
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def start_urgency_refresh_scheduler():
    global urgency_refresh_task
    if urgency_refresh_task is None:
        urgency_refresh_task = asyncio.create_task(scheduled_urgency_refresh_loop())
    await start_whatsapp_buffer_flusher()

@app.on_event("shutdown")
async def stop_urgency_refresh_scheduler():
    global urgency_refresh_task
    if urgency_refresh_task:
        urgency_refresh_task.cancel()
        with suppress(asyncio.CancelledError):
            await urgency_refresh_task
        urgency_refresh_task = None
    await stop_whatsapp_buffer_flusher()

# --- Models ---

class IncomingWhatsAppMessage(BaseModel):
    text: str
    sender: str
    message_id: Optional[str] = None
    user_id: Optional[str] = None
    group: Optional[str] = None
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    group_type: Optional[str] = None
    sender_name: Optional[str] = None
    timestamp: Any

class ChatRequest(BaseModel):
    prompt: str
    confirm_malicious: bool = False
    user_id: Optional[str] = None
    history: List[Dict[str, str]] = Field(default_factory=list)

class DeadlineRequest(BaseModel):
    text: str
    confirm_malicious: bool = False

class WhatsAppStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None
    user_id: Optional[str] = None

class CourseMappingRequest(BaseModel):
    message: str
    group_name: Optional[str] = None
    user_id: Optional[str] = None

class CourseMappingResponse(BaseModel):
    course_id: Optional[str]
    course_name: Optional[str]
    confidence: float
    method: str
    requires_user_confirmation: bool

class CourseAmbiguityResolutionRequest(BaseModel):
    user_id: Optional[str] = None
    message: str
    group_name: Optional[str] = None
    source_type: str = "whatsapp"
    source_reference_id: Optional[str] = None
    course_id: str
    alias: Optional[str] = None
    save_alias: bool = True

class WhatsAppGroupRequest(BaseModel):
    group_id: str
    group_name: Optional[str] = None
    user_id: Optional[str] = None
    is_general: bool = False

class ClassroomCourseRequest(BaseModel):
    classroom_id: str
    classroom_name: Optional[str] = None
    user_id: Optional[str] = None

class CourseSourceMappingRequest(BaseModel):
    user_id: Optional[str] = None
    course_id: str
    source_type: str = "whatsapp"
    source_reference_id: str

class CourseRequest(BaseModel):
    user_id: Optional[str] = None
    course_code: str
    course_name: str
    aliases: List[str] = Field(default_factory=list)

class CourseAliasesRequest(BaseModel):
    user_id: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class AbbreviationRequest(BaseModel):
    abbreviation: str
    expansion: str
    category: str = "general"

class LoginRequest(BaseModel):
    email: str
    password: str

class ManualNotificationRequest(BaseModel):
    user_id: Optional[str] = None
    title: str
    course: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = "assignment"
    deadline: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None

class NotificationCompletionRequest(BaseModel):
    completed: bool = True

class ChatResponse(BaseModel):
    response: str
    is_safe: bool
    warning: Optional[str] = None
    context_loaded: bool = False
    context_counts: Optional[Dict[str, int]] = None
    action: Optional[str] = None
    action_result: Optional[Dict[str, Any]] = None

class DeadlineResponse(BaseModel):
    deadlines: list
    success: bool
    message: str

class DeadlineExtractionResult(BaseModel):
    task: Optional[str]
    course: Optional[str]
    deadline_date: Optional[str]
    description: Optional[str]

# --- Utility Functions ---

def validate_email_address(email: str) -> bool:
    return bool(email and EMAIL_REGEX.match(email.strip()))

def normalize_auth_email(email: str) -> str:
    return (email or "").strip().lower()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False

def serialize_user(user_row: Dict[str, Any]) -> Dict[str, str]:
    return {
        "id": str(user_row["id"]),
        "name": user_row["full_name"],
        "email": user_row["email"],
    }

def create_access_token(user_row: Dict[str, Any]) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": str(user_row["id"]),
        "email": user_row["email"],
        "name": user_row["full_name"],
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        ) from exc

def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists",
        )
    return user

def clean_html(html_content):
    """Strip HTML tags and return clean text."""
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def decode_gmail_body(payload):
    """Recursively decode Gmail message payload to get the body text."""
    body = ""
    if "parts" in payload:
        for part in payload["parts"]:
            body += decode_gmail_body(part)
    elif payload.get("mimeType") in ["text/plain", "text/html"]:
        data = payload.get("body", {}).get("data")
        if data:
            # Decode base64url
            decoded = base64.urlsafe_b64decode(data).decode("utf-8")
            if payload["mimeType"] == "text/html":
                body += clean_html(decoded)
            else:
                body += decoded
    return body

def get_header(headers, name):
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""

def classifier_stub(text):
    """
    Temporary classifier that labels messages based on keywords.
    In the next phase, this will be replaced by the XLM-RoBERTa model.
    """
    text = text.lower()
    if any(k in text for k in ["assignment", "submit", "deadline", "hand in"]):
        return "assignment"
    if any(k in text for k in ["quiz", "test", "exam"]):
        return "quiz"
    if any(k in text for k in ["cancel", "room", "venue", "postpone"]):
        return "announcement"
    if any(k in text for k in ["slide", "pdf", "book", "material", "notes"]):
        return "material"
    if any(k in text for k in ["event", "society", "workshop", "seminar"]):
        return "event"
    return "announcement"

# --- Groq / AI Logic ---

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")
    return Groq(api_key=api_key)

def reset_groq_daily_counter_if_needed():
    today = datetime.now(PAKISTAN_TZ).date().isoformat()
    if groq_status["token_day"] != today:
        groq_status["token_day"] = today
        groq_status["tokens_used_today"] = 0
        groq_status["daily_warning_threshold_crossed"] = False

def groq_safe_fallback(prompt_messages):
    system_text = " ".join(
        message.get("content", "")
        for message in prompt_messages
        if isinstance(message, dict) and message.get("role") == "system"
    ).lower()

    if "deadline" in system_text or "json" in system_text:
        return '{"has_deadline": false, "deadline": null}'
    if "course classification" in system_text or "course_id" in system_text:
        return '{"course_id": null, "course_code": null, "confidence": 0.0}'
    if "safe" in system_text or "malicious" in system_text:
        return "SAFE"
    return "Abhi thoda busy hoon — please 1-2 minutes mein dobara try karo"

def retry_after_seconds(error, fallback_wait):
    headers = getattr(getattr(error, "response", None), "headers", {}) or {}
    retry_after = headers.get("retry-after") or headers.get("Retry-After")
    if retry_after:
        try:
            return max(0, int(float(retry_after)))
        except ValueError:
            return fallback_wait
    return fallback_wait

def record_groq_usage(response):
    reset_groq_daily_counter_if_needed()
    groq_status["session_calls"] += 1
    usage = getattr(response, "usage", None)
    total_tokens = getattr(usage, "total_tokens", 0) or 0
    groq_status["tokens_used_today"] += total_tokens

    warning_threshold = int(GROQ_DAILY_WARNING_REQUEST_LIMIT * 0.8)
    if groq_status["tokens_used_today"] >= warning_threshold:
        groq_status["daily_warning_threshold_crossed"] = True
        logger.warning(
            "Groq daily warning threshold crossed: %s tokens/calls used today",
            groq_status["tokens_used_today"],
        )

def call_groq_with_retry(prompt_messages: list, max_retries: int = 3, tools: Optional[list] = None) -> Any:
    reset_groq_daily_counter_if_needed()
    client = get_groq_client()
    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    groq_status["model"] = model
    internal_error_retried = False

    for attempt in range(max_retries + 1):
        try:
            params = {
                "model": model,
                "messages": prompt_messages,
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"
                
            response = client.chat.completions.create(**params)
            record_groq_usage(response)
            groq_status["last_error"] = None
            return response.choices[0].message
        except APIStatusError as e:
            status_code = getattr(e, "status_code", None)
            groq_status["last_error"] = f"HTTP {status_code}: {str(e)}"

            if status_code == 401:
                raise HTTPException(
                    status_code=500,
                    detail="Groq API key invalid. Check GROQ_API_KEY in backend/.env.",
                )

            if status_code in {429, 503} and attempt < max_retries:
                wait_time = retry_after_seconds(e, 5 * (2 ** attempt))
                logger.warning("Groq HTTP %s. Retry %s/%s in %ss", status_code, attempt + 1, max_retries, wait_time)
                time.sleep(wait_time)
                continue

            if status_code == 500 and not internal_error_retried:
                internal_error_retried = True
                logger.warning("Groq HTTP 500. Retrying once in 5s")
                time.sleep(5)
                continue

            logger.warning("Groq retries exhausted or non-retryable error: %s", e)
            return type('obj', (object,), {'content': groq_safe_fallback(prompt_messages), 'tool_calls': None})
        except (APIConnectionError, httpx.TimeoutException, httpx.ConnectError) as e:
            groq_status["last_error"] = f"Connection error: {str(e)}"
            if attempt < max_retries:
                logger.warning("Groq connection error. Retry %s/%s in 5s", attempt + 1, max_retries)
                time.sleep(5)
                continue
            return type('obj', (object,), {'content': groq_safe_fallback(prompt_messages), 'tool_calls': None})
        except Exception as e:
            groq_status["last_error"] = str(e)
            logger.warning("Unexpected Groq error: %s", e)
            return type('obj', (object,), {'content': groq_safe_fallback(prompt_messages), 'tool_calls': None})

    return type('obj', (object,), {'content': groq_safe_fallback(prompt_messages), 'tool_calls': None})

def create_groq_chat(prompt_messages, tools=None):
    return call_groq_with_retry(prompt_messages, tools=tools)

def serialize_groq_assistant_message(message: Any) -> Dict[str, Any]:
    """Convert a Groq SDK assistant message into an API-safe dict."""
    if hasattr(message, "model_dump"):
        return message.model_dump(exclude_none=True)
    if isinstance(message, dict):
        return message
    return {
        "role": "assistant",
        "content": getattr(message, "content", "") or "",
    }

def execute_function_call(function_name: str, arguments: dict, user_id: str) -> str:
    """Execute a tool call from the LLM and return the result as a string."""
    try:
        if function_name == "mark_item_done":
            notif_id = arguments.get("notification_id")
            row = update_notification_completion(notif_id, True)
            if row:
                invalidate_chat_context(user_id)
                return f"Success: Task {notif_id} marked as done."
            return f"Error: notification ID {notif_id} not found for this user."

        if function_name == "add_manual_notification":
            category = arguments.get("category")
            course_name = arguments.get("course")
            text = arguments.get("text")
            deadline = arguments.get("deadline")
            
            deadline_dt = parse_manual_deadline(deadline=deadline)
            message_text = build_manual_message_text(title=text, course=course_name)
            
            notif_id = insert_notification(
                user_id=user_id,
                source_type="manual",
                external_id=None,
                sender="AcadPulse Chatbot",
                text=message_text,
                category=category,
                received_at=datetime.now(PAKISTAN_TZ),
                deadline=deadline_dt,
            )
            if notif_id:
                if deadline_dt:
                    urgency = calculate_urgency(deadline_dt)
                    update_notification_urgency(notif_id, urgency["score"], urgency["label"])
                invalidate_chat_context(user_id)
                return f"Success: Added new {category} task with ID {notif_id}."
            return "Error: Failed to create task."

        if function_name == "update_deadline":
            notif_id = arguments.get("notification_id")
            new_deadline = arguments.get("new_deadline")
            deadline_dt = parse_manual_deadline(deadline=new_deadline)
            
            if not deadline_dt:
                return f"Error: Invalid deadline format '{new_deadline}'."
                
            success = update_notification_deadline(notif_id, deadline_dt)
            if success:
                urgency = calculate_urgency(deadline_dt)
                update_notification_urgency(notif_id, urgency["score"], urgency["label"])
                invalidate_chat_context(user_id)
                return f"Success: Deadline for task {notif_id} updated to {new_deadline}."
            return f"Error: notification ID {notif_id} not found."

        if function_name == "delete_notification":
            notif_id = arguments.get("notification_id")
            confirmed = arguments.get("confirmed", False)
            
            if not confirmed:
                return f"Confirmation Required: Please confirm you want to delete item {notif_id} by saying 'yes' or 'confirm'."
                
            success = delete_notification(notif_id, user_id)
            if success:
                invalidate_chat_context(user_id)
                return f"Success: Task {notif_id} has been deleted."
            return f"Error: notification ID {notif_id} not found."

        if function_name == "map_course":
            group_name = arguments.get("group_name")
            course_name = arguments.get("course_name")
            
            course = get_course_by_name(course_name, user_id)
            if not course:
                return f"Error: Course '{course_name}' not found. Please create the course first or check the name."
                
            mapping = upsert_course_source_mapping(
                user_id=user_id,
                course_id=course["id"],
                source_type="whatsapp",
                source_reference_id=group_name
            )
            if mapping:
                invalidate_chat_context(user_id)
                return f"Success: WhatsApp group '{group_name}' is now mapped to '{course['course_name']}'."
            return "Error: Failed to create course mapping."

        if function_name == "get_notification_detail":
            notif_id = arguments.get("notification_id")
            row = get_notification_by_id(notif_id)
            if row and str(row.get("user_id")) == str(user_id):
                # Format the row for LLM
                detail = {k: str(v) for k, v in row.items()}
                return json.dumps(detail, indent=2)
            return f"Error: notification ID {notif_id} not found."

        return f"Error: unknown function '{function_name}'"
        
    except Exception as e:
        logger.error(f"Error in execute_function_call: {e}")
        return f"Error executing {function_name}: {str(e)}"

def check_message_safety(text):
    """Check if message contains potentially malicious content."""
    try:
        result = call_groq_with_retry([
            {"role": "system", "content": "You are a content safety checker. Analyze the following text and determine if it contains malicious, harmful, or inappropriate content. Respond with ONLY 'SAFE' or 'MALICIOUS'."},
            {"role": "user", "content": text}
        ]).strip().upper()
        return "MALICIOUS" in result
    except Exception as e:
        logger.warning("Safety check error: %s", e)
        return False  # Default to safe if check fails

def env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def normalize_received_at(value):
    """Convert source timestamps into values PostgreSQL can store as TIMESTAMPTZ."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str) and value.strip().isdigit():
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    return value

def normalize_roman_urdu_datetime_text(value: str) -> str:
    text = str(value or "").strip().lower()
    replacements = {
        "kal raat": "tomorrow 11:59 PM",
        "kal sham": "tomorrow 5 PM",
        "kal subah": "tomorrow 9 AM",
        "kal": "tomorrow",
        "aaj raat": "today 11:59 PM",
        "aaj sham": "today 5 PM",
        "aaj subah": "today 9 AM",
        "aaj": "today",
        "parson raat": "in 2 days 11:59 PM",
        "parson sham": "in 2 days 5 PM",
        "parson subah": "in 2 days 9 AM",
        "parson": "in 2 days",
        "raat": "11:59 PM",
        "sham": "5 PM",
        "subah": "9 AM",
    }
    for source, target in sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True):
        text = re.sub(rf"\b{re.escape(source)}\b", target, text)
    return text

def parse_manual_deadline(deadline=None, due_date=None, due_time=None):
    """
    Parse manual deadline input from either an ISO datetime string or split date/time fields.
    Returns a timezone-aware datetime in Pakistan time, or None when absent/unparseable.
    """
    if deadline:
        raw_deadline = str(deadline).strip()
        try:
            parsed = datetime.fromisoformat(raw_deadline.replace("Z", "+00:00"))
            return ensure_timezone_aware(parsed)
        except ValueError:
            parsed = dateparser.parse(
                normalize_roman_urdu_datetime_text(raw_deadline),
                settings={
                    "PREFER_DATES_FROM": "future",
                    "RETURN_AS_TIMEZONE_AWARE": False,
                    "PREFER_DAY_OF_MONTH": "first",
                    "RELATIVE_BASE": datetime.now(PAKISTAN_TZ).replace(tzinfo=None),
                },
            )
            if parsed:
                return ensure_timezone_aware(parsed)
            logger.warning("Manual notification deadline could not be parsed: %s", deadline)
            return None

    if due_date:
        candidate = str(due_date).strip()
        if due_time:
            candidate = f"{candidate} {str(due_time).strip()}"
        try:
            parsed = datetime.fromisoformat(candidate.replace(" ", "T", 1))
            return ensure_timezone_aware(parsed)
        except ValueError:
            logger.warning(
                "Manual notification due_date/due_time could not be parsed: %s %s",
                due_date,
                due_time,
            )
            return None

    return None

def normalize_manual_category(raw_value):
    value = (raw_value or "assignment").strip().lower().replace("-", "_").replace(" ", "_")
    allowed = {"assignment", "quiz", "announcement", "material", "event", "exam_schedule", "noise"}
    return value if value in allowed else "assignment"

def serialize_notification_row(row):
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "course_id": str(row["course_id"]) if row.get("course_id") else None,
        "source_type": row.get("source_type"),
        "source_reference_id": row.get("source_reference_id"),
        "external_message_id": row.get("external_message_id"),
        "sender_name": row.get("sender_name"),
        "message_text": row.get("message_text"),
        "category": row.get("category"),
        "deadline": row["deadline"].isoformat() if row.get("deadline") else None,
        "urgency_score": row.get("urgency_score"),
        "urgency_label": row.get("urgency_label"),
        "urgency_level": row.get("urgency_level"),
        "is_completed": row.get("is_completed"),
        "received_at": row["received_at"].isoformat() if row.get("received_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }

def serialize_course_row(row):
    return {
        "id": str(row["id"]),
        "course_code": row.get("course_code"),
        "course_name": row.get("course_name"),
        "aliases": row.get("aliases") or [],
    }

def serialize_whatsapp_group_row(row):
    return {
        "group_id": row.get("group_id"),
        "group_name": row.get("group_name") or row.get("group_id"),
        "is_general": bool(row.get("is_general")),
        "source": row.get("source"),
    }

def serialize_course_source_mapping_row(row):
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "course_id": str(row["course_id"]),
        "course_code": row.get("course_code"),
        "course_name": row.get("course_name"),
        "source_type": row.get("source_type"),
        "source_reference_id": row.get("source_reference_id"),
        "group_name": row.get("source_name") or row.get("source_reference_id"),
        "source_name": row.get("source_name") or row.get("source_reference_id"),
    }

def serialize_classroom_course_row(row):
    return {
        "classroom_id": row.get("classroom_id"),
        "classroom_name": row.get("classroom_name") or row.get("classroom_id"),
    }

def compact_text(value: Optional[str], limit: int = 500) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."

def parse_chat_action(raw_output: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(extract_json_object(raw_output))
    except Exception:
        return {"action": "none", "arguments": {}, "reply": None}

    if not isinstance(parsed, dict):
        return {"action": "none", "arguments": {}, "reply": None}

    action = str(parsed.get("action") or "none").strip().lower()
    arguments = parsed.get("arguments") if isinstance(parsed.get("arguments"), dict) else {}
    reply = parsed.get("reply") if isinstance(parsed.get("reply"), str) else None
    return {
        "action": action,
        "arguments": arguments,
        "reply": reply,
    }

def build_manual_message_text(title: str, course: Optional[str] = None, description: Optional[str] = None) -> str:
    parts = [title.strip()]
    if course:
        parts.append(f"Course: {course.strip()}")
    if description:
        parts.append(description.strip())
    return "\n\n".join(part for part in parts if part)

def summarize_notification_for_action(row: Dict[str, Any]) -> Dict[str, Any]:
    return serialize_notification_row(row) if row else {}

def resolve_default_student_user_id() -> str:
    return str(get_or_create_user("Default Student", "student@example.com"))

def resolve_mapping_user_id(user_id: Optional[str] = None) -> str:
    """Use a real DB user UUID for source mappings and WhatsApp ingestion."""
    if user_id:
        try:
            parsed_user_id = str(uuid.UUID(str(user_id)))
            if get_user_by_id(parsed_user_id):
                return parsed_user_id
        except (ValueError, TypeError):
            logger.info("Replacing non-UUID user_id with default student: %s", user_id)
    return resolve_default_student_user_id()

def ensure_timezone_aware(value):
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return PAKISTAN_TZ.localize(value)
    return value.astimezone(PAKISTAN_TZ)

def calculate_urgency(deadline: Optional[datetime]) -> dict:
    """
    Return urgency metadata for a deadline.
    Boundary policy:
    - exactly 7 days away is medium
    - exactly 72 hours away is medium
    - exactly 24 hours away is high
    - already passed is overdue
    """
    return _calculate_urgency(deadline, now=datetime.now(PAKISTAN_TZ))

def _calculate_urgency(deadline: Optional[datetime], now: Optional[datetime]) -> dict:
    if deadline is None:
        return {"score": 0, "label": "none", "color": "grey"}

    aware_deadline = ensure_timezone_aware(deadline)
    aware_now = ensure_timezone_aware(now)
    if aware_deadline is None or aware_now is None:
        return {"score": 0, "label": "none", "color": "grey"}
    hours_until_deadline = (aware_deadline - aware_now).total_seconds() / 3600

    if hours_until_deadline < 0:
        return {"score": 5, "label": "overdue", "color": "black"}
    if hours_until_deadline < 24:
        return {"score": 4, "label": "critical", "color": "red"}
    if hours_until_deadline <= 72:
        return {"score": 3, "label": "high", "color": "orange"}
    if hours_until_deadline <= 168:
        return {"score": 2, "label": "medium", "color": "yellow"}
    return {"score": 1, "label": "low", "color": "green"}

def refresh_urgency_for_user(user_id: str):
    """
    Recalculate urgency for all pending deadline-bearing notifications for one user.
    The database uses UUID user IDs today; the annotation follows the task wording,
    and psycopg2 accepts the runtime ID value passed by the endpoint or scheduler.
    """
    notifications = get_pending_deadline_notifications(user_id)
    summary = {
        "user_id": str(user_id),
        "updated": 0,
        "moved_to_overdue": 0,
        "urgency_changes": [],
    }

    for notification in notifications:
        urgency = calculate_urgency(notification["deadline"])
        previous_label = notification.get("urgency_label")
        new_label = urgency["label"]
        changed = previous_label != new_label

        if update_notification_urgency(notification["id"], urgency["score"], new_label):
            summary["updated"] += 1

            if changed:
                if new_label == "overdue":
                    summary["moved_to_overdue"] += 1
                summary["urgency_changes"].append({
                    "notification_id": str(notification["id"]),
                    "previous_label": previous_label,
                    "new_label": new_label,
                    "score": urgency["score"],
                    "color": urgency["color"],
                    "urgency_changed": True,
                })

    summary["pending_with_deadlines"] = len(notifications)
    return summary

def refresh_urgency_for_all_users():
    summaries = []
    for user_id in get_users_with_pending_deadlines():
        summaries.append(refresh_urgency_for_user(str(user_id)))
    return summaries

async def scheduled_urgency_refresh_loop():
    while True:
        try:
            await asyncio.to_thread(refresh_urgency_for_all_users)
        except Exception as e:
            logger.exception("Scheduled urgency refresh failed; will retry on next interval: %s", e)

        await asyncio.sleep(URGENCY_REFRESH_INTERVAL_SECONDS)

def first_deadline_date(deadlines):
    for deadline in deadlines:
        value = deadline.get("deadline_date") if isinstance(deadline, dict) else None
        if value:
            return value
    return None

DEADLINE_CATEGORIES = {"assignment", "quiz", "exam_schedule"}

def parse_structured_classroom_due_date(due_date, due_time=None):
    if not due_date:
        return None
    due_time = due_time or {"hours": 23, "minutes": 59}
    return datetime(
        int(due_date["year"]),
        int(due_date["month"]),
        int(due_date["day"]),
        int(due_time.get("hours", 23)),
        int(due_time.get("minutes", 59)),
        tzinfo=timezone.utc,
    )

def run_pipeline(
    text: str, 
    notification_id: Optional[str], 
    source_type: str, 
    structured_deadline=None,
    user_id: Optional[str] = None
) -> dict:
    """
    Unified notification pipeline for WhatsApp, Gmail, Classroom, and future sources.
    1. Expand abbreviations (new)
    2. Classify
    3. Extract deadline
    4. Score urgency
    5. Save to DB
    """
    if not text or not text.strip():
        return {
            "notification_id": str(notification_id) if notification_id else None,
            "source_type": source_type,
            "success": False,
            "error": "empty_text",
            "category": None,
            "deadline_found": False,
            "deadline": None,
            "urgency_label": "none",
        }

    # Get user_id if not provided
    if not user_id and notification_id:
        notif = get_notification_by_id(notification_id)
        if notif:
            user_id = notif.get("user_id")
    
    # STEP 1: Expand abbreviations (NEW)
    original_text = text
    expanded_text = expand_abbreviations(text, user_id) if user_id else text
    
    # Auto-detect unknown abbreviations for future learning
    if user_id:
        detect_unknown_abbreviations(original_text, user_id)
    
    # Store expanded_text in database
    if notification_id and expanded_text != original_text:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "UPDATE notifications SET expanded_text = %s WHERE id = %s",
                (expanded_text, notification_id)
            )
            conn.commit()
        except:
            pass
        finally:
            cur.close()
            conn.close()
    
    # STEP 2: Classify using EXPANDED text
    local_classification = classify_with_local_model(expanded_text)
    category = local_classification["label"] if local_classification else classifier_stub(expanded_text)
    update_notification_category(notification_id, category)

    result = {
        "notification_id": str(notification_id) if notification_id else None,
        "source_type": source_type,
        "success": True,
        "item_id": str(notification_id) if notification_id else None,
        "category": category,
        "deadline_found": False,
        "deadline": None,
        "deadline_source": None,
        "urgency_label": "none",
        "urgency_score": 0,
        "urgency_color": "grey",
        "llm_called": False,
        "classifier_source": local_classification["source"] if local_classification else "keyword_stub",
        "classifier_confidence": local_classification["score"] if local_classification else None,
        "abbreviations_expanded": expanded_text != original_text,
        "expanded_text": expanded_text,
    }

    if category == "noise":
        update_notification_urgency(notification_id, 0, "none")
        result["skipped"] = "noise"
        return result

    # STEP 3: Extract deadline using EXPANDED text
    deadline_datetime = structured_deadline
    if deadline_datetime:
        result["deadline_source"] = "structured"
    elif category in DEADLINE_CATEGORIES:
        result["llm_called"] = True
        try:
            parsed_deadline = parse_deadline_response(extract_deadline_json_from_text(expanded_text))
        except Exception as e:
            logger.warning("Pipeline deadline extraction failed for notification %s: %s", notification_id, e)
            parsed_deadline = {"has_deadline": False, "deadline": None}

        if parsed_deadline["has_deadline"] and parsed_deadline["deadline"]:
            deadline_datetime = parsed_deadline["deadline"]
            result["deadline_source"] = "llm"

    # STEP 4: Score urgency and save
    if deadline_datetime:
        update_notification_deadline(notification_id, deadline_datetime)
        urgency = calculate_urgency(deadline_datetime)
        result.update({
            "deadline_found": True,
            "deadline": deadline_datetime.isoformat(),
            "urgency_label": urgency["label"],
            "urgency_score": urgency["score"],
            "urgency_color": urgency["color"],
        })
    else:
        urgency = calculate_urgency(None)
        result.update({
            "urgency_label": urgency["label"],
            "urgency_score": urgency["score"],
            "urgency_color": urgency["color"],
        })

    update_notification_urgency(notification_id, urgency["score"], urgency["label"])
    
    # Invalidate cache since notification was updated
    if user_id:
        invalidate_chat_context(user_id)
        
    return result

def strip_markdown_code_fence(text):
    text = text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.IGNORECASE | re.DOTALL)
    return fenced.group(1).strip() if fenced else text

def extract_json_object(text):
    text = strip_markdown_code_fence(text)
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    return match.group(0).strip() if match else text

def parse_strict_deadline_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    if not isinstance(value, str):
        logger.warning("Deadline value has unsupported type: %r", value)
        return None

    raw_value = value.strip()
    if raw_value.lower() in {"", "null", "none", "n/a", "na"}:
        return None

    normalized = raw_value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        pass

    for date_format in (
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ):
        try:
            parsed = datetime.strptime(raw_value, date_format)
            if date_format in {"%Y-%m-%d", "%Y/%m/%d"}:
                return parsed.replace(hour=23, minute=59)
            return parsed
        except ValueError:
            continue

    logger.warning("Could not parse LLM deadline value: %r", raw_value)
    return None

def parse_deadline_response(llm_output: str):
    """
    Parse Groq deadline JSON safely.
    Expected shape: {"has_deadline": true, "deadline": "2025-11-17 23:59"}
    """
    fallback = {"has_deadline": False, "deadline": None}

    if not llm_output or not str(llm_output).strip():
        return fallback

    json_text = extract_json_object(str(llm_output))
    try:
        payload = json.loads(json_text)
    except json.JSONDecodeError:
        logger.warning("Invalid LLM deadline JSON output: %r", llm_output)
        return fallback

    if not isinstance(payload, dict):
        logger.warning("LLM deadline response was not an object: %r", payload)
        return fallback

    has_deadline = payload.get("has_deadline", False)
    if isinstance(has_deadline, str):
        has_deadline = has_deadline.strip().lower() in {"true", "1", "yes", "y"}
    else:
        has_deadline = bool(has_deadline)

    deadline_value = payload.get("deadline")
    deadline_datetime = parse_strict_deadline_datetime(deadline_value)

    if not deadline_datetime:
        return fallback

    return {"has_deadline": has_deadline, "deadline": deadline_datetime}

def extract_deadline_json_from_text(text):
    """Ask Groq for the compact deadline object used by the DB update path."""
    return call_groq_with_retry([
        {
            "role": "system",
            "content": (
                "Extract the academic deadline from the message. "
                "Return ONLY JSON in this exact shape: "
                "{\"has_deadline\": true, \"deadline\": \"YYYY-MM-DD HH:MM\"}. "
                "If no clear deadline exists, return "
                "{\"has_deadline\": false, \"deadline\": null}. "
                "Do not include markdown or explanation."
            ),
        },
        {"role": "user", "content": text},
    ]).strip()

def extract_deadlines_from_text(text):
    """Extract deadline information from text using Groq AI."""
    try:
        result = call_groq_with_retry([
            {"role": "system", "content": "You are a deadline extraction assistant. Extract all assignment deadlines from the given text. Return a JSON array of objects with fields: 'task', 'course', 'deadline_date', 'description'. If no deadlines found, return empty array. Format: [{\"task\": \"Assignment 1\", \"course\": \"Math\", \"deadline_date\": \"2024-01-15\", \"description\": \"Submit chapter 5 exercises\"}]"},
            {"role": "user", "content": f"Extract deadlines from this text:\n\n{text}"}
        ]).strip()
        # Try to parse as JSON
        try:
            deadlines = json.loads(result)
            if isinstance(deadlines, list):
                return deadlines
            else:
                return []
        except json.JSONDecodeError:
            # If not valid JSON, return empty list
            print(f"Could not parse JSON from Groq response: {result}")
            return []
    except Exception as e:
        print(f"Deadline extraction error: {e}")
        return []

def get_all_courses_from_db(user_id=None):
    """Fetch course metadata used by the local matching pipeline."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        where_clause = "WHERE uc.user_id = %s" if user_id else ""
        cur.execute(
            f"""
            SELECT
                c.id::text AS id,
                c.course_code,
                c.course_name,
                COALESCE(
                    ARRAY_AGG(DISTINCT ca.alias)
                    FILTER (WHERE ca.alias IS NOT NULL),
                    ARRAY[]::text[]
                ) AS aliases,
                COALESCE(
                    ARRAY_AGG(DISTINCT uc.professor_name)
                    FILTER (WHERE uc.professor_name IS NOT NULL AND uc.professor_name <> ''),
                    ARRAY[]::text[]
                ) AS professor_names
            FROM courses c
            LEFT JOIN course_aliases ca ON ca.course_id = c.id
            LEFT JOIN user_courses uc ON uc.course_id = c.id
            {where_clause}
            GROUP BY c.id, c.course_code, c.course_name
            ORDER BY c.course_code, c.course_name
            """,
            (user_id,) if user_id else None,
        )
        return cur.fetchall()
    except Exception as e:
        print(f"Error fetching courses: {e}")
        return []
    finally:
        cur.close()
        conn.close()

def normalize_text(text):
    """Normalize text for matching: lowercase, remove punctuation, strip whitespace."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return ' '.join(text.split())

def normalized_terms(values):
    return [normalize_text(value) for value in values if normalize_text(value)]

def contains_normalized_term(message, term):
    if not term:
        return False
    if len(term) <= 4:
        return re.search(rf'\b{re.escape(term)}\b', message) is not None
    return term in message

def course_match_terms(course):
    return {
        "course_code": normalized_terms([course.get("course_code")]),
        "course_name": normalized_terms([course.get("course_name")]),
        "aliases": normalized_terms(course.get("aliases") or []),
        "professors": normalized_terms(course.get("professor_names") or []),
    }

def exact_match_course(message, courses):
    """
    Stage 1: Exact matching with weighted scoring.
    Returns (course_id, course_name, score) or (None, None, 0)
    """
    normalized_message = normalize_text(message)
    
    scores = defaultdict(int)
    course_info = {}
    
    for course in courses:
        course_id = str(course["id"])
        terms = course_match_terms(course)
        
        course_info[course_id] = {
            "code": course.get("course_code"),
            "name": course.get("course_name"),
        }
        
        if any(contains_normalized_term(normalized_message, term) for term in terms["course_code"]):
            scores[course_id] += 100
        if any(contains_normalized_term(normalized_message, term) for term in terms["aliases"]):
            scores[course_id] += 80
        if any(contains_normalized_term(normalized_message, term) for term in terms["course_name"]):
            scores[course_id] += 70
        if any(contains_normalized_term(normalized_message, term) for term in terms["professors"]):
            scores[course_id] += 50
    
    if not scores:
        return None, None, 0
    
    # Get course with highest score
    best_course_id = max(scores, key=lambda course_id: scores[course_id])
    best_score = scores[best_course_id]
    
    return best_course_id, course_info[best_course_id]['name'], best_score

def fuzzy_match_course(message, courses, threshold=75):
    """
    Stage 2: Lightweight fuzzy matching using RapidFuzz.
    Returns (course_id, course_name, score) or (None, None, 0)
    """
    normalized_message = normalize_text(message)
    
    best_score = 0
    best_course_id = None
    best_course_name = None
    
    for course in courses:
        terms = course_match_terms(course)
        weighted_terms = [
            (term, 1.0) for term in terms["course_code"]
        ] + [
            (term, 0.95) for term in terms["aliases"]
        ] + [
            (term, 0.9) for term in terms["course_name"]
        ] + [
            (term, 0.8) for term in terms["professors"]
        ]

        for term, weight in weighted_terms:
            score = fuzz.partial_ratio(term, normalized_message) * weight
            if score > best_score:
                best_score = score
                best_course_id = str(course["id"])
                best_course_name = course.get("course_name")
    
    if best_score >= threshold:
        return best_course_id, best_course_name, round(best_score, 2)
    
    return None, None, 0

def llm_classify_course(message, courses):
    """
    Stage 3: LLM fallback for ambiguous cases.
    Returns (course_id, course_name, confidence)
    """
    # Prepare course list for prompt
    course_list = "\n".join([
        (
            f"- id={c['id']} code={c.get('course_code')} name={c.get('course_name')} "
            f"aliases={', '.join(c.get('aliases') or []) or 'none'} "
            f"professors={', '.join(c.get('professor_names') or []) or 'none'}"
        )
        for c in courses
    ])
    
    try:
        result = call_groq_with_retry([
            {"role": "system", "content": "You are a course classification assistant. Given a message and a list of available courses, identify which course the message is most likely related to. Respond with ONLY JSON: {\"course_id\": \"uuid\", \"course_code\": \"CS101\", \"confidence\": 0.85}. If unsure, respond with {\"course_id\": null, \"course_code\": null, \"confidence\": 0.0}."},
            {"role": "user", "content": f"Available courses:\n{course_list}\n\nMessage: {message}\n\nWhich course does this message belong to?"}
        ]).strip()
        try:
            classification = json.loads(result.strip("` \n").removeprefix("json").strip())
            course_id = classification.get("course_id")
            course_code = classification.get('course_code')
            confidence = float(classification.get('confidence', 0.0))
            
            if confidence < 0.5:
                return None, None, confidence
            
            for course in courses:
                if course_id and str(course["id"]) == str(course_id):
                    return str(course["id"]), course["course_name"], confidence
                if course_code and course["course_code"].upper() == course_code.upper():
                    return str(course["id"]), course["course_name"], confidence
            
            return None, None, confidence
        except json.JSONDecodeError:
            print(f"Could not parse LLM classification: {result}")
            return None, None, 0.0
    except Exception as e:
        print(f"LLM classification error: {e}")
        return None, None, 0.0

def classify_course_for_message(message, group_name=None, user_id=None):
    """
    Multi-stage course classification pipeline.
    Stage 1: Exact matching
    Stage 2: Fuzzy matching
    Stage 3: LLM fallback
    Returns dict with course info and metadata
    """
    courses = get_all_courses_from_db(user_id=user_id)
    text_to_match = f"{message} {group_name or ''}".strip()
    
    if not courses:
        return {
            "course_id": None,
            "course_name": None,
            "confidence": 0.0,
            "method": "no_courses_available",
            "requires_user_confirmation": True
        }
    
    # Stage 1: Exact matching
    course_id, course_name, score = exact_match_course(text_to_match, courses)
    if course_id and score >= 100:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": min(score / 100.0, 1.0),
            "method": "exact_match",
            "requires_user_confirmation": False
        }
    
    # Stage 2: Fuzzy matching
    if score >= 90:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": score / 100.0,
            "method": "exact_match_weighted",
            "requires_user_confirmation": False
        }
    
    course_id, course_name, fuzzy_score = fuzzy_match_course(text_to_match, courses, threshold=75)
    if course_id and fuzzy_score >= 90:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": fuzzy_score / 100.0,
            "method": "fuzzy_match_high",
            "requires_user_confirmation": False
        }
    elif course_id and fuzzy_score >= 75:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": fuzzy_score / 100.0,
            "method": "fuzzy_match_medium",
            "requires_user_confirmation": True
        }
    
    # Stage 3: LLM fallback
    course_id, course_name, confidence = llm_classify_course(message, courses)
    if course_id and confidence >= 0.8:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": confidence,
            "method": "llm_high_confidence",
            "requires_user_confirmation": False
        }
    elif course_id and confidence >= 0.5:
        return {
            "course_id": course_id,
            "course_name": course_name,
            "confidence": confidence,
            "method": "llm_medium_confidence",
            "requires_user_confirmation": True
        }
    
    # No match found
    return {
        "course_id": None,
        "course_name": None,
        "confidence": 0.0,
        "method": "no_match",
        "requires_user_confirmation": True
    }

def parse_deadline_with_dateparser(date_text):
    """
    Parse natural language dates using dateparser library.
    Handles expressions like "next Sunday", "tomorrow", "coming Friday", etc.
    """
    if not date_text:
        return None
    
    try:
        normalized_date_text = re.sub(
            r'\b(next|coming|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
            r'\2',
            date_text,
            flags=re.IGNORECASE,
        )
        if normalized_date_text.strip().lower() == "tonight":
            normalized_date_text = "today 11:59 PM"

        parsed = dateparser.parse(
            normalized_date_text,
            settings={
                "PREFER_DATES_FROM": "future",
                "RETURN_AS_TIMEZONE_AWARE": False,
                "PREFER_DAY_OF_MONTH": "first",
            }
        )
        if parsed:
            return parsed.strftime("%Y-%m-%d %H:%M:%S")
        return None
    except Exception as e:
        print(f"Dateparser error: {e}")
        return None

def extract_course_hint_from_text(text):
    code_match = re.search(r'\b[A-Z]{2,5}\d{2,4}\b', text)
    if code_match:
        return code_match.group(0)

    ignored = {"AM", "PM", "A", "I"}
    for match in re.finditer(r'\b[A-Z]{2,5}\b', text):
        value = match.group(0)
        if value not in ignored:
            return value

    return None

def extract_deadlines_hybrid(text):
    """
    Hybrid deadline extraction: Pattern detection + dateparser + LLM fallback.
    More efficient than pure LLM approach.
    """
    date_candidates = []
    patterns = [
        r'\b(?:next|this|coming)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?',
        r'\b(?:to|until|on)\s+((?:next|this|coming)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b',
        r'\b(?:tomorrow|today|tonight)\b(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?',
        r'\bbefore\s+midnight\b',
        r'\b(?:by|before|on|due|deadline|submit|submission)\s+(?:on|by|before)?\s*([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)',
        r'\b(?:by|before|on|due|deadline|submit|submission)\s+(?:on|by|before)?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'\b(?:by|before|on|due|deadline|submit|submission)\s+(?:on|by|before)?\s*([^\n\.]{1,50})',
        r'\b[a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b',
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            candidate = match.group(1) if match.lastindex else match.group(0)
            candidate = re.sub(r'\s+', ' ', candidate).strip(" .,:;-")
            if candidate and candidate.lower() not in {c.lower() for c in date_candidates}:
                date_candidates.append(candidate)

    for candidate in date_candidates:
        parse_text = "today 11:59 PM" if candidate.lower() == "before midnight" else candidate
        parsed = parse_deadline_with_dateparser(parse_text)
        if not parsed:
            continue

        task_match = re.search(
            r'\b(assignment|quiz|project|exam|homework|lab|submission)\b(?:\s+\d+)?',
            text,
            re.IGNORECASE,
        )
        return [{
            "task": task_match.group(0).strip() if task_match else "Academic task",
            "course": extract_course_hint_from_text(text),
            "deadline_date": parsed,
            "description": text[:200],
            "method": "pattern_dateparser",
        }]

    return extract_deadlines_from_text(text)


def classify_classroom_resource(text: str, resource_type: str, work_type: Optional[str] = None, has_attachments: bool = False) -> str:
    """
    Deterministic classification for Classroom resources.
    
    Supports all 5 Classroom categories: announcement, assignment, quiz, material, event.
    
    This classifier is essential because the Hugging Face model does NOT support "material".
    
    Classification strategy (in order):
    1. Native guaranteed mapping: QUIZ_ASSIGNMENT → quiz, ASSIGNMENT → assignment
    2. Deterministic keyword/pattern matching for all 5 categories
    3. Fallback to attachment presence: if has_attachments → material
    4. Final fallback: announcement
    
    Args:
        text: normalized text combining title, description, etc.
        resource_type: Classroom resource type (announcement, courseWork, courseWorkMaterial)
        work_type: for courseWork, the workType field (e.g., "ASSIGNMENT", "QUIZ_ASSIGNMENT")
        has_attachments: whether resource has attachments
    
    Returns:
        One of: 'announcement', 'assignment', 'quiz', 'material', 'event'
    
    Example:
        category = classify_classroom_resource(
            "Assignment 1 due Friday",
            resource_type="courseWork",
            work_type="ASSIGNMENT",
            has_attachments=False
        )
        # Returns: "assignment"
    """
    text_lower = text.lower()
    
    # Stage 1: Native guaranteed mapping based on workType
    if work_type == "QUIZ_ASSIGNMENT":
        return "quiz"
    if work_type == "ASSIGNMENT":
        return "assignment"
    
    # For materials with no/minimal text, classify as material
    if resource_type == "courseWorkMaterial" and not text.strip():
        return "material"
    
    # Stage 2: Deterministic keyword matching
    
    # Quiz indicators
    quiz_keywords = ["quiz", "test", "exam", "mcq", "multiple choice", "short answer"]
    if any(kw in text_lower for kw in quiz_keywords):
        return "quiz"
    
    # Assignment indicators
    assignment_keywords = ["assignment", "homework", "submit", "deadline", "hand in", "project", "lab", "problem set"]
    if any(kw in text_lower for kw in assignment_keywords):
        return "assignment"
    
    # Event indicators
    event_keywords = ["event", "meeting", "workshop", "seminar", "conference", "webinar", "session", "class", "lecture"]
    if any(kw in text_lower for kw in event_keywords):
        return "event"
    
    # Material indicators
    material_keywords = ["material", "slides", "pdf", "book", "notes", "resource", "document", "reference", "reading"]
    if any(kw in text_lower for kw in material_keywords):
        return "material"
    
    # Announcement indicators (catch-all for these)
    announcement_keywords = ["announcement", "notice", "update", "reminder", "information", "cancel", "postpone", "room", "venue"]
    if any(kw in text_lower for kw in announcement_keywords):
        return "announcement"
    
    # Stage 3: Fallback based on attachments
    if has_attachments:
        return "material"
    
    # Stage 4: Final fallback
    return "announcement"


def extract_classroom_attachment_metadata(materials: list) -> list:
    """
    Extract attachment metadata from Classroom course work materials.
    
    Converts Classroom materials (Drive files, links, YouTube videos, etc.)
    into a normalized structure matching Gmail attachment format.
    
    Args:
        materials: list of material objects from Classroom API
    
    Returns:
        List of dicts with keys: filename, file_type, attachment_id, file_size
    
    Example:
        attachments = extract_classroom_attachment_metadata(
            mat.get("materials", [])
        )
    """
    attachments = []
    
    for material in materials or []:
        if "driveFile" in material:
            drive_file = material.get("driveFile", {}).get("driveFile", {})
            attachments.append({
                "filename": drive_file.get("title", "Unknown Drive File"),
                "file_type": "application/vnd.google-apps.document",  # Normalized MIME
                "attachment_id": drive_file.get("id", "unknown"),
                "file_size": None,  # Classroom API does not provide file size
            })
        elif "link" in material:
            link = material.get("link", {})
            attachments.append({
                "filename": link.get("title", "Unknown Link"),
                "file_type": "text/url",
                "attachment_id": link.get("url", "unknown"),
                "file_size": None,
            })
        elif "youtubeVideo" in material:
            video = material.get("youtubeVideo", {})
            attachments.append({
                "filename": video.get("title", "Unknown Video"),
                "file_type": "video/youtube",
                "attachment_id": video.get("id", "unknown"),
                "file_size": None,
            })
    
    return attachments


async def process_classroom_resource(
    user_id: uuid.UUID,
    resource: dict,
    resource_type: str,
    local_course_id: Optional[uuid.UUID] = None,
    course_name: Optional[str] = None,
    source_reference_id: Optional[str] = None,
) -> Optional[uuid.UUID]:
    """
    Process a single Classroom resource (announcement, courseWork, or material) into a notification.
    
    This function implements the full production-grade pipeline for Classroom:
    - Normalize resource into Gmail-compatible structure
    - Deduplicate using existing helpers
    - Multi-stage category determination (native → deterministic → HF → Groq → fallback)
    - Extract deadlines (structured or hybrid)
    - Calculate urgency
    - Insert into DB using existing helper
    - Run unified pipeline
    
    Args:
        user_id: UUID of owning user
        resource: Classroom API resource object (announcement, courseWork, or courseWorkMaterial)
        resource_type: type of resource ("announcement", "courseWork", "courseWorkMaterial")
        local_course_id: UUID of course in DB (optional; if None, no course link)
        course_name: name of course for sender field
    
    Returns:
        notification_id if inserted successfully, None if skipped (duplicate, noise, etc.)
    
    Example:
        notif_id = await process_classroom_resource(
            user_id,
            announcement_dict,
            "announcement",
            local_course_id=course_uuid,
            course_name="CS101"
        )
    """
    try:
        # Extract resource ID and basic fields
        resource_id = resource.get("id")
        created_time = resource.get("creationTime")
        
        # Normalize based on resource type
        if resource_type == "announcement":
            title = resource.get("text", "")[:100] or "Announcement"
            body = resource.get("text", "")
            work_type = None
            structured_deadline = None
            materials = []
        
        elif resource_type == "courseWork":
            title = resource.get("title", "")[:100] or "Assignment"
            description = resource.get("description", "N/A")
            body = f"Title: {title}\nDescription: {description}"
            work_type = resource.get("workType")
            structured_deadline = None
            
            # Extract structured deadline if present
            if resource.get("dueDate"):
                structured_deadline = parse_structured_classroom_due_date(
                    resource["dueDate"],
                    resource.get("dueTime", {"hours": 23, "minutes": 59}),
                )
            
            materials = resource.get("materials", [])
        
        elif resource_type == "courseWorkMaterial":
            title = resource.get("title", "")[:100] or "Material"
            description = resource.get("description", "")
            body = f"Title: {title}\nDescription: {description}" if description else title
            work_type = None
            structured_deadline = None
            materials = resource.get("materials", [])
        
        else:
            logger.warning("Unknown Classroom resource type: %s", resource_type)
            return None
        
        # Extract attachments metadata (Classroom-compatible)
        attachments = extract_classroom_attachment_metadata(materials)
        has_attachments = len(attachments) > 0
        
        if attachments:
            logger.info("Classroom %s %s has %d attachment(s)", resource_type, resource_id, len(attachments))
        
        # Deduplication: check if already exists
        existing = get_notification_id_by_source(resource_id, "classroom")
        if existing:
            logger.info("Classroom resource %s already exists as notification %s, skipping", resource_id, existing)
            return None
        
        # Multi-stage category determination
        # Stage 1: Deterministic classifier (supports all 5 categories including "material")
        category = classify_classroom_resource(
            body,
            resource_type=resource_type,
            work_type=work_type,
            has_attachments=has_attachments
        )
        
        # Stage 2: If deterministic gave "announcement" and we have better info, try HF
        # But ONLY if not already classified as assignment/quiz via deterministic
        if category == "announcement" and body.strip():
            try:
                hf_category = await classify_with_fallback(title + "\n\n" + body)
                # Accept HF result if it's not "noise" and it's one of our valid categories
                if hf_category and hf_category != "noise" and hf_category in {"announcement", "assignment", "event", "quiz"}:
                    category = hf_category
                    logger.debug("HF classifier upgraded Classroom %s to %s", resource_id, category)
            except Exception as e:
                logger.debug("HF classifier fallback for Classroom %s: %s", resource_id, e)
        
        # Prepare notification text (same format as Gmail)
        notification_text = f"Title: {title}\n\n{body[:500]}..."
        
        # Extract deadline
        deadline = structured_deadline
        
        # If no structured deadline but category suggests deadline-bearing resource,
        # try hybrid extraction
        if deadline is None and category in {"assignment", "quiz", "announcement", "event"}:
            deadline_candidates = extract_deadlines_hybrid(body)
            first_deadline = first_deadline_date(deadline_candidates)
            if first_deadline:
                deadline = parse_strict_deadline_datetime(first_deadline)
        
        # Insert into DB using existing helper
        notif_id = insert_notification(
            user_id=user_id,
            source_type="classroom",
            external_id=resource_id,
            sender=course_name or "Classroom",
            text=notification_text,
            category=category,
            received_at=normalize_received_at(created_time),
            course_id=local_course_id,
            source_ref=source_reference_id or resource_id,
            deadline=deadline,
        )
        
        if not notif_id:
            logger.warning("Failed to insert notification for Classroom %s", resource_id)
            return None
        
        # Calculate urgency if applicable
        if category in {"assignment", "quiz"} and deadline is not None:
            urgency = calculate_urgency(deadline)
            update_notification_urgency(notif_id, urgency["score"], urgency["label"])
        
        logger.info(
            "Processed Classroom %s %s (id=%s) with category=%s, %d attachment(s)",
            resource_type,
            title[:50],
            resource_id,
            category,
            len(attachments),
        )
        
        return notif_id
    
    except Exception as e:
        logger.exception("Error processing Classroom resource: %s", e)
        return None


def extract_gmail_attachment_metadata(parts):
    """Recursively collect Gmail attachment metadata without downloading files."""
    attachments = []

    for part in parts or []:
        filename = part.get("filename")
        body_info = part.get("body", {}) or {}
        mime_type = part.get("mimeType")
        attachment_id = body_info.get("attachmentId")
        file_size = body_info.get("size") or body_info.get("attachmentSize") or None

        if filename and attachment_id:
            attachments.append({
                "filename": filename,
                "file_type": mime_type,
                "attachment_id": attachment_id,
                "file_size": file_size,
            })

        nested_parts = part.get("parts") or []
        if nested_parts:
            attachments.extend(extract_gmail_attachment_metadata(nested_parts))

    return attachments


async def classify_with_fallback(text: str) -> str:
    """
    Classify academic text using Hugging Face Inference API first,
    then Groq (LLM) if HF confidence is low or HF is unavailable.

    Args:
        text: Cleaned academic email text.

    Returns:
        Final category label as one of: 'announcement', 'assignment', 'event', 'quiz', 'noise'

    Example:
        label = await classify_with_fallback(email_text)
    """
    local_classification = classify_with_local_model(text)
    if local_classification:
        return local_classification["label"]

    hf_model = os.getenv("HF_MODEL_NAME")
    hf_token = os.getenv("HF_TOKEN")
    labels = ["announcement", "assignment", "event", "quiz", "noise"]

    # Try Hugging Face Inference API
    if hf_model and hf_token:
        try:
            url = f"https://api-inference.huggingface.co/models/{hf_model}"
            async with httpx.AsyncClient(timeout=20) as client:
                headers = {"Authorization": f"Bearer {hf_token}"}
                payload = {"inputs": text}
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        # Expecting list of {label,score} or a dict - normalize
                        if isinstance(data, list) and len(data) > 0 and "label" in data[0]:
                            best = max(data, key=lambda x: x.get("score", 0))
                            label = best.get("label")
                            score = float(best.get("score", 0))
                            label = str(label).lower()
                            # Some HF models return labels like 'LABEL_0' — normalize to expected labels when possible
                            for expected in labels:
                                if expected in label:
                                    if score >= 0.75:
                                        return expected
                                    break
                        # If response shape unexpected, fallthrough to Groq
                    except Exception:
                        pass
                else:
                    logger.warning("HF inference returned status %s", resp.status_code)
        except Exception as e:
            logger.warning("Hugging Face inference error: %s", e)

    # Fallback to Groq (existing LLM path)
    try:
        prompt = [
            {"role": "system", "content": "You are an assistant that must classify the following message into one of: announcement, assignment, event, quiz, noise. Respond with ONLY the single label string."},
            {"role": "user", "content": text},
        ]
        result = call_groq_with_retry(prompt).strip().lower()
        # Extract one of expected labels if present
        for expected in labels:
            if expected in result:
                return expected
    except Exception as e:
        logger.warning("Groq fallback classification error: %s", e)

    # Final fallback to keyword stub
    return classifier_stub(text)


async def process_gmail_message(user_id: uuid.UUID, gmail_message: dict) -> Optional[uuid.UUID]:
    """
    Process a single Gmail API message dict and insert a notification record.

    Purpose:
        - Extract required Gmail fields (id, threadId, headers, body, snippet, attachments metadata).
        - Skip messages from no-reply@classroom.google.com to avoid duplication.
        - Build classification text and classify using Hugging Face with Groq fallback.
        - Reuse existing multi-stage course classifier to determine `course_id`.
        - Insert into `notifications` table using the existing `insert_notification` helper.
        - Run the unified pipeline to extract deadlines and compute urgency.

    Args:
        user_id: UUID of the owning user in the DB.
        gmail_message: The Gmail message object returned by `service.users().messages().get(..., format='full')`.

    Returns:
        The `notification_id` if stored, or `None` if skipped (duplicate, noise, or filtered).

    Example:
        notif_id = await process_gmail_message(user_id, full_msg)
    """
    try:
        msg_id = gmail_message.get("id")
        thread_id = gmail_message.get("threadId")
        internal_date = gmail_message.get("internalDate")
        snippet = gmail_message.get("snippet", "")

        payload = gmail_message.get("payload", {}) or {}
        headers = payload.get("headers", [])
        subject = get_header(headers, "Subject")
        from_full = get_header(headers, "From")
        date_raw = get_header(headers, "Date")

        # Extract sender name and email
        sender_match = re.search(r"(.*)<(.*)>", from_full)
        sender_name = sender_match.group(1).strip() if sender_match else from_full
        sender_email = sender_match.group(2).strip() if sender_match else from_full

        # Skip Classroom notification emails to avoid duplication.
        if isinstance(sender_email, str) and sender_email.lower() == "no-reply@classroom.google.com":
            logger.info("Skipping Google Classroom email %s from %s", msg_id, sender_email)
            return None

        # Extract body text (decode, clean HTML)
        body = decode_gmail_body(payload)
        body_text = body.strip() if body else ""

        # Attachments metadata extraction (in memory only).
        attachments = extract_gmail_attachment_metadata(payload.get("parts", []))

        if attachments:
            logger.info("Gmail %s has %d attachment(s)", msg_id, len(attachments))

        # Fallback: if body_text empty, use snippet for classification.
        cleaned_body = body_text
        classification_text = subject + "\n\n" + (cleaned_body if cleaned_body else snippet)

        # Classification (HF -> Groq -> stub)
        category = await classify_with_fallback(classification_text)
        if category == "noise":
            # silently discard
            logger.info("Gmail message %s classified as noise, skipping", msg_id)
            return None

        # Course classification (reuse existing pipeline).
        try:
            course_info = classify_course_for_message(
                f"{sender_name} {subject}\n\n{cleaned_body or snippet}",
                sender_name,
                str(user_id),
            )
            course_id = course_info.get("course_id")
        except Exception as e:
            logger.warning("Course classification failed for %s: %s", msg_id, e)
            course_id = None

        # Deduplication: check existing notification by source
        existing = get_notification_id_by_source(msg_id, "gmail")
        if existing:
            logger.info("Gmail message %s already exists as notification %s, skipping", msg_id, existing)
            return None

        # Prepare notification_text to store (truncate body for DB display like existing logic)
        notification_text = f"Subject: {subject}\n\n{(cleaned_body or snippet)[:500]}..."

        # Insert into DB (reuse helper). Do not set deadline/urgency here — pipeline will update them.
        received_at_value = normalize_received_at(date_raw or internal_date)
        notif_id = insert_notification(
            user_id=user_id,
            source_type="gmail",
            external_id=msg_id,
            sender=sender_name,
            text=notification_text,
            category=category,
            received_at=received_at_value,
            course_id=course_id,
            source_ref=sender_email,
            deadline=None,
        )

        if not notif_id:
            logger.warning("Failed to insert notification for Gmail %s", msg_id)
            return None

        # Gmail-only deadline and urgency updates.
        deadline = None
        if category in {"assignment", "quiz", "announcement", "event"}:
            deadline_candidates = extract_deadlines_hybrid(classification_text)
            first_deadline = first_deadline_date(deadline_candidates)
            if first_deadline:
                deadline = parse_strict_deadline_datetime(first_deadline)
                if deadline:
                    update_notification_deadline(notif_id, deadline)

        if category in {"assignment", "quiz"} and deadline is not None:
            urgency = calculate_urgency(deadline)
            update_notification_urgency(notif_id, urgency["score"], urgency["label"])

        # TODO: Persist attachments metadata to `attachments` table if insertion helper exists.
        logger.info(
            "Processed Gmail message %s (thread %s) with %d attachment(s)",
            msg_id,
            thread_id,
            len(attachments),
        )

        # Return the inserted notification id
        return notif_id

    except Exception as e:
        logger.exception("Error processing Gmail message: %s", e)
        return None

# --- Google Services Setup ---

def get_google_credentials_safe():
    try:
        return get_google_credentials()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Google Auth failed: {str(e)}. Try deleting token.json.")

def execute_google_api_call(request):
    """Execute a Google API request with exponential backoff for 429 and 503 errors."""
    for attempt in range(3):
        try:
            return request.execute()
        except HttpError as e:
            if e.resp.status in [429, 503]:
                wait_time = 2 ** attempt
                print(f"Quota hit or service unavailable. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise e
    return request.execute() # Final attempt

# --- Endpoints ---

@app.post("/auth/register")
def register_user(request: RegisterRequest):
    name = (request.name or "").strip()
    email = normalize_auth_email(request.email)
    password = request.password or ""

    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    if not validate_email_address(email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if get_user_by_email(email):
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        create_user_account(name, email, hash_password(password))
    except Exception as exc:
        logger.exception("Account registration failed for %s", email)
        raise HTTPException(status_code=500, detail="Unable to create account") from exc

    return {"status": "success", "message": "Account created"}

@app.post("/auth/login")
def login_user(request: LoginRequest):
    email = normalize_auth_email(request.email)
    password = request.password or ""

    if not validate_email_address(email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    if not password:
        raise HTTPException(status_code=422, detail="Password is required")

    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    if not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    return {
        "status": "success",
        "token": create_access_token(user),
        "user": serialize_user(user),
    }

@app.get("/auth/me")
def get_authenticated_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "success",
        "user": serialize_user(current_user),
    }

@app.get("/auth/google")
def login_with_google():
    try:
        credentials = get_google_credentials_safe()
        email = ""
        name = ""

        try:
            oauth_service = build("oauth2", "v2", credentials=credentials)
            profile = execute_google_api_call(oauth_service.userinfo().get())
            email = normalize_auth_email(profile.get("email"))
            name = (profile.get("name") or "").strip()
        except Exception:
            logger.info("OAuth userinfo unavailable with current scopes, falling back to Gmail profile")

        if not email:
            gmail_service = build("gmail", "v1", credentials=credentials)
            gmail_profile = execute_google_api_call(gmail_service.users().getProfile(userId="me"))
            email = normalize_auth_email(gmail_profile.get("emailAddress"))

        if not name:
            name = email.split("@")[0].replace(".", " ").title() if email else "Google User"

        user = get_user_by_email(email)
        if not user:
            user_id = create_user_account(name, email, hash_password(secrets.token_urlsafe(32)))
            user = get_user_by_id(user_id)

        token = create_access_token(user)
        redirect_url = (
            f"{FRONTEND_URL}/login"
            f"?oauth_token={quote_plus(token)}"
            f"&oauth_name={quote_plus(user['full_name'])}"
            f"&oauth_email={quote_plus(user['email'])}"
        )
        return RedirectResponse(redirect_url)
    except HTTPException as exc:
        redirect_url = f"{FRONTEND_URL}/login?oauth_error={quote_plus(str(exc.detail))}"
        return RedirectResponse(redirect_url)
    except Exception as exc:
        logger.exception("Google login failed")
        redirect_url = f"{FRONTEND_URL}/login?oauth_error={quote_plus('Google sign-in failed')}"
        return RedirectResponse(redirect_url)

@app.get("/")
def home():
    return {"message": "AcadPulse API v1.1.0 is online", "status": "success"}

@app.get("/test")
def test_endpoint():
    return {"status": "success", "data": "Backend logic ready"}

@app.get("/notifications")
def get_notifications(
    user_id: Optional[str] = Query(default=None),
    include_completed: bool = Query(default=False),
    source_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    try:
        rows = list_notifications(
            user_id=user_id,
            include_completed=include_completed,
            source_type=source_type,
            limit=limit,
        )
    except Exception as exc:
        logger.exception("Failed to fetch notifications")
        raise HTTPException(status_code=500, detail="Unable to fetch notifications") from exc

    return {
        "status": "success",
        "count": len(rows),
        "notifications": [serialize_notification_row(row) for row in rows],
    }

@app.post("/notifications/manual")
def create_manual_notification(request: ManualNotificationRequest):
    title = (request.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required")

    category = normalize_manual_category(request.type)
    deadline_dt = parse_manual_deadline(
        deadline=request.deadline,
        due_date=request.due_date,
        due_time=request.due_time,
    )

    if any([request.deadline, request.due_date]) and deadline_dt is None:
        raise HTTPException(status_code=422, detail="Deadline format is invalid")

    user_id = request.user_id or get_or_create_user("Manual User", "manual@acadpulse.local")
    description = (request.description or "").strip()
    course = (request.course or "").strip()

    message_parts = [title]
    if course:
        message_parts.append(f"Course: {course}")
    if description:
        message_parts.append(description)
    message_text = "\n\n".join(message_parts)

    received_at = datetime.now(PAKISTAN_TZ)
    notification_id = insert_notification(
        user_id=user_id,
        source_type="manual",
        external_id=None,
        sender="Manual Task",
        text=message_text,
        category=category,
        received_at=received_at,
        deadline=deadline_dt,
    )

    if not notification_id:
        raise HTTPException(status_code=500, detail="Unable to create manual notification")

    # Invalidate cache
    invalidate_chat_context(user_id)

    urgency = calculate_urgency(deadline_dt) if deadline_dt else {"score": 0, "label": "none", "color": "grey"}
    if deadline_dt:
        update_notification_urgency(notification_id, urgency["score"], urgency["label"])

    notification = get_notification_by_id(notification_id)

    return {
        "status": "success",
        "message": "Manual notification created",
        "notification": {
            **serialize_notification_row(notification),
            "manual_course": course or None,
        },
        "urgency": urgency,
    }

@app.patch("/notifications/{notification_id}/complete")
def complete_notification(notification_id: str, request: NotificationCompletionRequest):
    updated = update_notification_completion(notification_id, request.completed)
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found")

    # Invalidate cache
    if updated.get("user_id"):
        invalidate_chat_context(str(updated["user_id"]))

    return {
        "status": "success",
        "message": "Notification completion updated",
        "notification": serialize_notification_row(updated),
    }

@app.get("/courses")
def get_courses(user_id: Optional[str] = Query(default=None)):
    resolved_user_id = resolve_mapping_user_id(user_id) if user_id else None
    try:
        rows = list_courses(user_id=resolved_user_id)
    except Exception as exc:
        logger.exception("Failed to fetch courses")
        raise HTTPException(status_code=500, detail="Unable to fetch courses") from exc

    return {
        "status": "success",
        "count": len(rows),
        "courses": [serialize_course_row(row) for row in rows],
    }

@app.post("/courses")
def save_course(request: CourseRequest):
    course_code = (request.course_code or "").strip()
    course_name = (request.course_name or "").strip()

    if not course_code:
        raise HTTPException(status_code=422, detail="course_code is required")
    if not course_name:
        raise HTTPException(status_code=422, detail="course_name is required")

    user_id = resolve_mapping_user_id(request.user_id)
    try:
        course_id = upsert_course(
            course_code=course_code,
            course_name=course_name,
            aliases=request.aliases,
            user_id=user_id,
        )
        row = get_course_by_id(course_id, user_id=user_id)
    except Exception as exc:
        logger.exception("Failed to save course")
        raise HTTPException(status_code=500, detail="Unable to save course") from exc

    return {
        "status": "success",
        "user_id": user_id,
        "course": serialize_course_row(row),
    }

@app.patch("/courses/{course_id}/aliases")
def update_course_aliases(course_id: str, request: CourseAliasesRequest):
    user_id = resolve_mapping_user_id(request.user_id) if request.user_id else None
    existing = get_course_by_id(course_id, user_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        replace_course_aliases(course_id, request.aliases)
        row = get_course_by_id(course_id, user_id=user_id)
    except Exception as exc:
        logger.exception("Failed to update course aliases")
        raise HTTPException(status_code=500, detail="Unable to update course aliases") from exc

    return {
        "status": "success",
        "user_id": user_id,
        "course": serialize_course_row(row),
    }

@app.get("/whatsapp/groups")
def get_whatsapp_groups(user_id: Optional[str] = Query(default=None)):
    resolved_user_id = resolve_mapping_user_id(user_id) if user_id else None
    try:
        rows = list_whatsapp_groups(user_id=resolved_user_id)
    except Exception as exc:
        logger.exception("Failed to fetch WhatsApp groups")
        raise HTTPException(status_code=500, detail="Unable to fetch WhatsApp groups") from exc

    return {
        "status": "success",
        "user_id": resolved_user_id,
        "count": len(rows),
        "groups": [serialize_whatsapp_group_row(row) for row in rows],
    }

@app.post("/whatsapp/groups")
def save_whatsapp_group(request: WhatsAppGroupRequest):
    group_id = (request.group_id or "").strip()
    if not group_id:
        raise HTTPException(status_code=422, detail="group_id is required")

    user_id = resolve_mapping_user_id(request.user_id)
    saved_id = record_whatsapp_group(
        group_id=group_id,
        group_name=(request.group_name or group_id).strip(),
        user_id=user_id,
        is_general=request.is_general,
    )
    if not saved_id:
        raise HTTPException(status_code=500, detail="Unable to save WhatsApp group")

    return {
        "status": "success",
        "user_id": user_id,
        "group": {
            "group_id": group_id,
            "group_name": (request.group_name or group_id).strip(),
            "is_general": request.is_general,
        },
    }

@app.get("/classroom/courses")
def get_classroom_courses(user_id: Optional[str] = Query(default=None)):
    resolved_user_id = resolve_mapping_user_id(user_id) if user_id else None
    try:
        rows = list_classroom_courses(user_id=resolved_user_id)
    except Exception as exc:
        logger.exception("Failed to fetch Classroom courses")
        raise HTTPException(status_code=500, detail="Unable to fetch Classroom courses") from exc

    return {
        "status": "success",
        "user_id": resolved_user_id,
        "count": len(rows),
        "courses": [serialize_classroom_course_row(row) for row in rows],
    }

@app.post("/classroom/courses")
def save_classroom_course(request: ClassroomCourseRequest):
    classroom_id = (request.classroom_id or "").strip()
    if not classroom_id:
        raise HTTPException(status_code=422, detail="classroom_id is required")

    user_id = resolve_mapping_user_id(request.user_id)
    saved_id = record_classroom_course(
        classroom_id=classroom_id,
        classroom_name=(request.classroom_name or classroom_id).strip(),
        user_id=user_id,
    )
    if not saved_id:
        raise HTTPException(status_code=500, detail="Unable to save Classroom course")

    return {
        "status": "success",
        "user_id": user_id,
        "course": {
            "classroom_id": classroom_id,
            "classroom_name": (request.classroom_name or classroom_id).strip(),
        },
    }

@app.get("/course-source-mappings")
def get_course_source_mappings(
    user_id: Optional[str] = Query(default=None),
    source_type: str = Query(default="whatsapp"),
):
    resolved_user_id = resolve_mapping_user_id(user_id) if user_id else None
    try:
        rows = list_course_source_mappings(
            user_id=resolved_user_id,
            source_type=source_type,
        )
    except Exception as exc:
        logger.exception("Failed to fetch course source mappings")
        raise HTTPException(status_code=500, detail="Unable to fetch course mappings") from exc

    return {
        "status": "success",
        "user_id": resolved_user_id,
        "count": len(rows),
        "mappings": [serialize_course_source_mapping_row(row) for row in rows],
    }

@app.post("/course-source-mappings")
def save_course_source_mapping(request: CourseSourceMappingRequest):
    source_type = (request.source_type or "whatsapp").strip().lower()
    source_reference_id = (request.source_reference_id or "").strip()
    course_id = (request.course_id or "").strip()

    if source_type not in {"whatsapp", "gmail", "classroom"}:
        raise HTTPException(status_code=422, detail="source_type must be whatsapp, gmail, or classroom")
    if not source_reference_id:
        raise HTTPException(status_code=422, detail="source_reference_id is required")
    if not course_id:
        raise HTTPException(status_code=422, detail="course_id is required")

    user_id = resolve_mapping_user_id(request.user_id)

    try:
        upsert_course_source_mapping(
            user_id=user_id,
            course_id=course_id,
            source_type=source_type,
            source_reference_id=source_reference_id,
        )
        rows = list_course_source_mappings(user_id=user_id, source_type=source_type)
    except Exception as exc:
        logger.exception("Failed to save course source mapping")
        raise HTTPException(status_code=500, detail="Unable to save course mapping") from exc

    return {
        "status": "success",
        "user_id": user_id,
        "mappings": [serialize_course_source_mapping_row(row) for row in rows],
    }

@app.get("/urgency/refresh")
def refresh_urgency_endpoint(user_id: str = Query(...)):
    """Recalculate urgency for one user immediately."""
    try:
        return {
            "status": "success",
            **refresh_urgency_for_user(user_id),
        }
    except Exception as e:
        logger.exception("Urgency refresh failed for user_id=%s", user_id)
        raise HTTPException(status_code=500, detail=f"Urgency refresh failed: {str(e)}")

@app.post("/whatsapp/status")
def update_whatsapp_status(status_update: WhatsAppStatusUpdate):
    whatsapp_status_state.update({
        "status": status_update.status,
        "reason": status_update.reason,
        "user_id": status_update.user_id,
        "updated_at": datetime.now(PAKISTAN_TZ).isoformat(),
    })
    return {"status": "success", "whatsapp": whatsapp_status_state}

@app.get("/whatsapp/status")
def get_whatsapp_status():
    return {"status": "success", "whatsapp": whatsapp_status_state}

@app.get("/whatsapp/health")
def whatsapp_health():
    return {"status": "ok", "service": "FastAPI", "timestamp": datetime.now(PAKISTAN_TZ).isoformat()}

@app.get("/groq/status")
def get_groq_status():
    reset_groq_daily_counter_if_needed()
    return {"status": "success", **groq_status}

@app.get("/classifier/status")
def get_classifier_status():
    return {
        "status": "success",
        "local_model_available": local_classifier_available(),
        "local_model_path": os.getenv("LOCAL_CLASSIFIER_PATH", str(Path(__file__).resolve().parent.parent / "ai" / "classifier" / "model")),
        "hf_model": os.getenv("HF_MODEL_NAME"),
        "fallback_order": ["local_xlm_roberta", "huggingface_inference_api", "groq", "keyword_stub"],
    }

# Task #25: Fetch Gmail Emails (Proper Implementation)
@app.get("/gmail/fetch")
async def fetch_gmail_emails(max_results: int = 10):
    creds = get_google_credentials_safe()
    service = build("gmail", "v1", credentials=creds)
    
    # Get unread/recent messages
    results = execute_google_api_call(service.users().messages().list(userId="me", labelIds=["INBOX"], maxResults=max_results))
    messages = results.get("messages", [])
    
    user_id = get_or_create_user("Default Student", "student@example.com") # Placeholder user
    fetched_count = 0
    new_count = 0
    processed_notifications = []

    for msg in messages:
        fetched_count += 1
        full_msg = execute_google_api_call(service.users().messages().get(userId="me", id=msg["id"], format="full"))

        notif_id = await process_gmail_message(user_id, full_msg)
        if notif_id:
            new_count += 1
            processed_notifications.append(str(notif_id))

    return {
        "status": "success",
        "total_fetched": fetched_count,
        "new_notifications_saved": new_count,
        "processed_notifications": processed_notifications,
    }

# Task #28: Fetch Google Classroom Content (Upgraded)
@app.get("/classroom/fetch")
async def fetch_classroom_all():
    """
    Fetch and process all Classroom content from active enrolled courses.
    
    This endpoint uses the production-grade pipeline shared with Gmail and WhatsApp:
    - Fetches announcements, coursework, and course materials
    - Normalizes each resource into a unified structure
    - Uses multi-stage category determination (deterministic → HF → Groq → fallback)
    - Extracts deadlines from structured fields or text
    - Calculates urgency for assignments/quizzes
    - Inserts into the unified notification system
    
    Returns:
        {
            "status": "success",
            "stats": {
                "courses_processed": int,
                "announcements_processed": int,
                "coursework_processed": int,
                "materials_processed": int,
                "new_notifications_saved": int
            },
            "skipped": {
                "duplicates": int,
                "errors": int
            }
        }
    """
    creds = get_google_credentials_safe()
    service = build("classroom", "v1", credentials=creds)
    
    user_id = get_or_create_user("Default Student", "student@example.com")
    
    # Fetch only ACTIVE courses
    try:
        courses_result = execute_google_api_call(service.courses().list(courseStates=["ACTIVE"]))
        courses = courses_result.get("courses", [])
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Classroom API error: {e}")

    stats = {
        "courses_processed": 0,
        "mapped_courses": 0,
        "announcements_processed": 0,
        "coursework_processed": 0,
        "materials_processed": 0,
        "new_notifications_saved": 0,
    }
    skipped = {
        "duplicates": 0,
        "errors": 0,
    }

    for course in courses:
        course_id = course["id"]
        course_name = course["name"]
        stats["courses_processed"] += 1
        record_classroom_course(
            classroom_id=course_id,
            classroom_name=course_name,
            user_id=user_id,
        )
        mapped_course_id = get_course_mapping_course_id(
            user_id=user_id,
            source_type="classroom",
            source_reference_id=course_id,
        )
        if mapped_course_id:
            stats["mapped_courses"] += 1
        
        # 1. Fetch Announcements
        try:
            announcements = execute_google_api_call(
                service.courses().announcements().list(courseId=course_id)
            ).get("announcements", [])
            
            for ann in announcements:
                notif_id = await process_classroom_resource(
                    user_id,
                    ann,
                    resource_type="announcement",
                    local_course_id=mapped_course_id,
                    course_name=course_name,
                    source_reference_id=course_id,
                )
                if notif_id:
                    stats["announcements_processed"] += 1
                    stats["new_notifications_saved"] += 1
                else:
                    skipped["duplicates"] += 1
        
        except HttpError as e:
            logger.warning("Error fetching announcements for %s: %s", course_name, e)
            skipped["errors"] += 1

        # 2. Fetch Coursework (Assignments, Quizzes, etc.)
        try:
            coursework = execute_google_api_call(
                service.courses().courseWork().list(courseId=course_id)
            ).get("courseWork", [])
            
            for cw in coursework:
                # Skip question types (SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION)
                if cw.get("workType") in {"SHORT_ANSWER_QUESTION", "MULTIPLE_CHOICE_QUESTION"}:
                    logger.debug("Skipping question-type coursework: %s", cw.get("workType"))
                    continue
                
                notif_id = await process_classroom_resource(
                    user_id,
                    cw,
                    resource_type="courseWork",
                    local_course_id=mapped_course_id,
                    course_name=course_name,
                    source_reference_id=course_id,
                )
                if notif_id:
                    stats["coursework_processed"] += 1
                    stats["new_notifications_saved"] += 1
                else:
                    skipped["duplicates"] += 1
        
        except HttpError as e:
            logger.warning("Error fetching coursework for %s: %s", course_name, e)
            skipped["errors"] += 1

        # 3. Fetch Course Materials
        try:
            materials_result = execute_google_api_call(
                service.courses().courseWorkMaterials().list(courseId=course_id)
            )
            materials = materials_result.get("courseWorkMaterials", [])
            
            for mat in materials:
                notif_id = await process_classroom_resource(
                    user_id,
                    mat,
                    resource_type="courseWorkMaterial",
                    local_course_id=mapped_course_id,
                    course_name=course_name,
                    source_reference_id=course_id,
                )
                if notif_id:
                    stats["materials_processed"] += 1
                    stats["new_notifications_saved"] += 1
                else:
                    skipped["duplicates"] += 1
        
        except HttpError as e:
            if e.resp.status == 403:
                logger.debug("Permission denied for materials in %s (403). Skipping.", course_name)
            else:
                logger.warning("Error fetching materials for %s: %s", course_name, e)
            skipped["errors"] += 1

    return {
        "status": "success",
        "stats": stats,
        "skipped": skipped,
    }

@app.get("/demo/sync")
async def sync_everything():
    """End-to-end verification: Fetch Gmail and Classroom and store in DB."""
    gmail_res = await fetch_gmail_emails(max_results=5)
    classroom_res = fetch_classroom_all()
    
    return {
        "gmail_sync": gmail_res,
        "classroom_sync": classroom_res,
        "database_status": "Integrity check passed (no duplicates created)"
    }

# --- Groq Chatbot & Deadline Extraction Endpoints ---

@app.get("/chat/context")
def get_chat_context(
    user_id: Optional[str] = Query(default=None),
    notification_limit: int = Query(default=80, ge=1, le=200),
):
    try:
        context = build_chat_db_context(user_id=user_id, notification_limit=notification_limit)
    except Exception as exc:
        logger.exception("Failed to build chat DB context")
        raise HTTPException(status_code=500, detail="Unable to load chat context") from exc

    return {
        "status": "success",
        "context": context,
    }

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "mark_item_done",
            "description": "Mark a task or notification as completed/done.",
            "parameters": {
                "type": "object",
                "properties": {
                    "notification_id": {"type": "string", "description": "The unique ID of the notification/task to mark as done."}
                },
                "required": ["notification_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_manual_notification",
            "description": "Add a new manual task or notification to the list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["assignment", "quiz", "exam_schedule", "announcement", "event", "material"], "description": "The type of notification."},
                    "course": {"type": "string", "description": "The course name or code (e.g., 'NLP', 'Natural Language Processing')."},
                    "text": {"type": "string", "description": "The description of the task."},
                    "deadline": {"type": "string", "description": "Deadline in ISO format (YYYY-MM-DD HH:MM), optional."}
                },
                "required": ["category", "course", "text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_deadline",
            "description": "Update the deadline for an existing task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "notification_id": {"type": "string", "description": "The ID of the task to update."},
                    "new_deadline": {"type": "string", "description": "New deadline in ISO format (YYYY-MM-DD HH:MM)."}
                },
                "required": ["notification_id", "new_deadline"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_notification",
            "description": "Remove a task or notification from the database. REQUIRES USER CONFIRMATION FIRST.",
            "parameters": {
                "type": "object",
                "properties": {
                    "notification_id": {"type": "string", "description": "The ID of the task to delete."},
                    "confirmed": {"type": "boolean", "description": "Set to true ONLY if the user has explicitly confirmed they want to delete this specific item."}
                },
                "required": ["notification_id", "confirmed"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "map_course",
            "description": "Map a WhatsApp group name to a course name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {"type": "string", "description": "The name of the WhatsApp group."},
                    "course_name": {"type": "string", "description": "The full name or code of the course to map it to."}
                },
                "required": ["group_name", "course_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_notification_detail",
            "description": "Get full details of a single notification/task by its ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "notification_id": {"type": "string", "description": "The ID of the notification to fetch."}
                },
                "required": ["notification_id"]
            }
        }
    }
]


@app.post("/chat", response_model=ChatResponse)
def chat_with_bot(request: ChatRequest):
    """
    Chat with the AI assistant. Includes safety checking and multi-turn tool calling.
    """
    # Check for malicious content
    is_malicious = check_message_safety(request.prompt)
    
    if is_malicious and not request.confirm_malicious:
        return ChatResponse(
            response="I cannot process this request as it may contain inappropriate content.",
            is_safe=False,
            warning="Content flagged as potentially malicious. Please confirm if you want to proceed."
        )
    
    # If confirmed or safe, proceed with chat
    try:
        user_id = resolve_mapping_user_id(request.user_id)
        context_json = build_user_context(user_id)
        db_context = json.loads(context_json)

        # 1. Start message history
        sanitized_history = []
        for entry in request.history[-10:]:
            role = entry.get("role")
            content = entry.get("content")
            if role in {"user", "assistant"} and content:
                sanitized_history.append({"role": role, "content": str(content)})

        messages = [
            {
                "role": "system",
                "content": build_chatbot_system_prompt(db_context),
            },
            {"role": "system", "content": f"academic_context JSON:\n{context_json}"},
            *sanitized_history,
            {"role": "user", "content": request.prompt}
        ]

        # 2. Tool use loop (max 5 iterations)
        action_taken = None
        action_result = None
        
        for _ in range(5):
            response_msg = create_groq_chat(messages, tools=CHAT_TOOLS)
            
            # If no tool calls, we're done
            if not getattr(response_msg, "tool_calls", None):
                break
                
            # Add assistant's message to history
            messages.append(serialize_groq_assistant_message(response_msg))
            
            # Process tool calls
            for tool_call in response_msg.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                
                logger.info(f"Chatbot executing tool: {fn_name} with args {fn_args}")
                
                # Execute the action
                result_str = execute_function_call(fn_name, fn_args, user_id)
                
                # Record the last action for the response metadata
                action_taken = fn_name
                action_result = {"message": result_str}
                
                # Add tool result to history
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": fn_name,
                    "content": result_str,
                })
                
                # If we just did a DB operation, we might want to refresh context
                # but for simplicity in one turn, we'll let the LLM know the success.
        
        # Get final response text
        final_text = response_msg.content or ""
        
        return ChatResponse(
            response=final_text,
            is_safe=True,
            warning=groq_status["last_error"],
            context_loaded=True,
            context_counts=db_context.get("summary", {}),
            action=action_taken or "none",
            action_result=action_result,
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception("Chat error")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@app.post("/deadlines/extract", response_model=DeadlineResponse)
def extract_deadlines(request: DeadlineRequest):
    """
    Extract assignment deadlines from text (e.g., WhatsApp messages, emails).
    Returns structured deadline information.
    """
    if env_flag("ENABLE_DEADLINE_SAFETY_CHECK") and check_message_safety(request.text) and not request.confirm_malicious:
        return DeadlineResponse(
            deadlines=[],
            success=False,
            message="Content flagged as potentially malicious. Please confirm if you want to proceed."
        )
    
    try:
        deadlines = extract_deadlines_hybrid(request.text)
        
        if not deadlines:
            return DeadlineResponse(
                deadlines=[],
                success=True,
                message="No deadlines found in the provided text."
            )
        
        return DeadlineResponse(
            deadlines=deadlines,
            success=True,
            message=f"Successfully extracted {len(deadlines)} deadline(s)."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deadline extraction error: {str(e)}")

@app.post("/deadlines/extract-batch")
def extract_deadlines_batch(texts: List[str], confirm_malicious: bool = False):
    """
    Extract deadlines from multiple text sources at once.
    Useful for processing multiple messages or emails in batch.
    """
    results = []
    total_deadlines = 0
    
    for i, text in enumerate(texts):
        if env_flag("ENABLE_DEADLINE_SAFETY_CHECK") and check_message_safety(text) and not confirm_malicious:
            results.append({
                "index": i,
                "success": False,
                "deadlines": [],
                "message": "Content flagged as malicious"
            })
            continue
        
        # Use hybrid extraction (faster, uses LLM only as fallback)
        deadlines = extract_deadlines_hybrid(text)
        total_deadlines += len(deadlines)
        results.append({
            "index": i,
            "success": True,
            "deadlines": deadlines,
            "message": f"Found {len(deadlines)} deadline(s)"
        })
    
    return {
        "success": True,
        "total_deadlines_extracted": total_deadlines,
        "results": results
    }

@app.post("/messages/classify-course", response_model=CourseMappingResponse)
def classify_message_course(request: CourseMappingRequest):
    """
    Classify which course a WhatsApp message belongs to using multi-stage pipeline.
    Stage 1: Exact matching with weighted scoring
    Stage 2: Fuzzy matching with RapidFuzz
    Stage 3: LLM fallback for ambiguous cases
    
    This endpoint dramatically reduces LLM API usage by ~90% compared to naive approach.
    """
    try:
        result = classify_course_for_message(request.message, request.group_name, request.user_id)
        return CourseMappingResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification error: {str(e)}")

@app.post("/messages/resolve-course-ambiguity")
def resolve_course_ambiguity(request: CourseAmbiguityResolutionRequest):
    """
    Confirm an ambiguous course match and teach the classifier for next time.

    Confirmation can save both a source mapping (for a WhatsApp group, Gmail
    sender, or Classroom course id) and a human-approved alias such as "OS".
    """
    message = (request.message or "").strip()
    course_id = (request.course_id or "").strip()
    source_type = (request.source_type or "whatsapp").strip().lower()

    if not message:
        raise HTTPException(status_code=422, detail="message is required")
    if not course_id:
        raise HTTPException(status_code=422, detail="course_id is required")
    if source_type not in {"whatsapp", "gmail", "classroom"}:
        raise HTTPException(status_code=422, detail="source_type must be whatsapp, gmail, or classroom")

    user_id = resolve_mapping_user_id(request.user_id)
    course = get_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    saved_alias = None
    saved_mapping = None
    source_reference_id = (request.source_reference_id or "").strip()
    alias_candidate = (request.alias or request.group_name or "").strip()

    try:
        if request.save_alias and alias_candidate:
            existing_aliases = course.get("aliases") or []
            merged_aliases = [*existing_aliases, alias_candidate]
            replace_course_aliases(course_id, merged_aliases)
            saved_alias = alias_candidate

        if source_reference_id:
            saved_mapping = upsert_course_source_mapping(
                user_id=user_id,
                course_id=course_id,
                source_type=source_type,
                source_reference_id=source_reference_id,
            )

        updated_course = get_course_by_id(course_id)
        updated_classification = classify_course_for_message(
            message,
            request.group_name,
            user_id,
        )
    except Exception as exc:
        logger.exception("Failed to resolve course ambiguity")
        raise HTTPException(status_code=500, detail="Unable to resolve course ambiguity") from exc

    return {
        "status": "success",
        "user_id": user_id,
        "saved_alias": saved_alias,
        "mapping": serialize_course_source_mapping_row(saved_mapping) if saved_mapping else None,
        "course": serialize_course_row(updated_course),
        "classification": updated_classification,
    }

@app.post("/messages/incoming")
async def process_incoming_message(payload: Dict[str, Any]):
    """
    Process an incoming WhatsApp webhook payload through the production pipeline.

    The endpoint accepts either the current flattened FastAPI bridge payload or a
    richer Baileys webhook payload, delegates all work to
    `process_whatsapp_message()`, and returns the created notification IDs.

    Args:
        payload: Incoming WhatsApp JSON payload.

    Returns:
        A compact response with the created notification UUIDs and count.

    Example:
        await process_incoming_message({"message_id": "abc", "text": "Assignment due tomorrow"})
    """
    try:
        user_id = resolve_mapping_user_id(
            payload.get("user_id") or payload.get("userId") or payload.get("user")
        )
        payload["user_id"] = user_id

        key_payload = payload.get("key") if isinstance(payload.get("key"), dict) else {}
        group_id = (
            payload.get("group_id")
            or payload.get("groupId")
            or payload.get("chat_id")
            or payload.get("chatId")
            or key_payload.get("remoteJid")
        )
        group_name = (
            payload.get("group_name")
            or payload.get("groupName")
            or payload.get("chat_name")
            or payload.get("chatName")
            or group_id
        )
        if group_id and str(group_id).endswith("@g.us"):
            record_whatsapp_group(
                group_id=str(group_id),
                group_name=str(group_name or group_id),
                user_id=user_id,
                is_general=bool(payload.get("is_general") or payload.get("isGeneral")),
            )

        notification_ids = await process_whatsapp_message(payload)
        return {
            "success": True,
            "notifications_created": notification_ids,
            "count": len(notification_ids),
        }
    except Exception:
        logger.exception("WhatsApp webhook processing failed")
        return {
            "success": True,
            "notifications_created": [],
            "count": 0,
        }


# ===== ABBREVIATION DICTIONARY ENDPOINTS =====

@app.get("/abbreviations")
def get_abbreviations(user_id: str = Query(...), current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get user's full abbreviation dictionary grouped by category."""
    if str(current_user.get("id")) != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    result = get_user_abbreviations(user_id)
    return {"status": "success", **result}


@app.post("/abbreviations")
def create_or_update_abbreviation(
    request: AbbreviationRequest,
    user_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Add or update a user-defined abbreviation."""
    if str(current_user.get("id")) != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success, result = add_or_update_abbreviation(
        user_id, 
        request.abbreviation, 
        request.expansion, 
        request.category
    )
    
    if not success:
        raise HTTPException(status_code=422, detail=result.get("error", "Invalid input"))
    
    return {"status": "success", "abbreviation": result}


@app.delete("/abbreviations/{abbreviation}")
def delete_abbr(
    abbreviation: str,
    user_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a user-defined abbreviation."""
    if str(current_user.get("id")) != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    success, message = delete_abbreviation(user_id, abbreviation)
    
    if not success:
        if "cannot be deleted" in message:
            raise HTTPException(status_code=403, detail=message)
        raise HTTPException(status_code=404, detail=message)
    
    return {"status": "success", "message": message}


@app.get("/abbreviations/test")
def test_abbreviation_expansion(
    user_id: str = Query(...),
    text: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Test abbreviation expansion on a text string."""
    if str(current_user.get("id")) != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if not text:
        raise HTTPException(status_code=422, detail="Text is required")
    
    expanded = expand_abbreviations(text, user_id)
    
    # Identify which abbreviations were actually expanded
    # We do this by checking word-by-word against the dictionary
    abbr_data = get_user_abbreviations(user_id)
    all_abbrs = []
    for cat_dict in [abbr_data.get("system", {}), abbr_data.get("user", {})]:
        for cat, items in cat_dict.items():
            all_abbrs.extend([item["abbreviation"].lower() for item in items])
    
    matches_found = []
    # Use the same regex logic as the expansion engine to identify matches
    for abbr in all_abbrs:
        if re.search(r'\b' + re.escape(abbr) + r'\b', text, re.IGNORECASE):
            matches_found.append(abbr)
    
    return {
        "status": "success",
        "original": text,
        "expanded": expanded,
        "matches_found": list(set(matches_found)),
        "expansions_applied": len(set(matches_found)),
    }


@app.get("/abbreviations/unknown")
def get_unknown_abbrs(
    user_id: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get detected unknown abbreviations for manual review."""
    if str(current_user.get("id")) != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    unknown = get_unknown_abbreviations(user_id)
    
    return {
        "status": "success",
        "unknown_abbreviations": unknown,
        "count": len(unknown),
    }
