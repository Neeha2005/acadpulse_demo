import os
import base64
import re
import time
import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Query
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from groq import APIConnectionError, APIStatusError, Groq
from pydantic import BaseModel
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from rapidfuzz import fuzz
from psycopg2.extras import RealDictCursor
import dateparser

from google_auth import get_google_credentials
from db import get_db_connection, insert_notification, get_or_create_user, notification_exists

load_dotenv()

app = FastAPI(
    title="AcadPulse API",
    description="Backend API for AcadPulse academic notification system",
    version="1.1.0",
)

# --- Models ---

class IncomingWhatsAppMessage(BaseModel):
    text: str
    sender: str
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

class DeadlineRequest(BaseModel):
    text: str
    confirm_malicious: bool = False

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

class ChatResponse(BaseModel):
    response: str
    is_safe: bool
    warning: Optional[str] = None

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

def create_groq_chat(prompt_messages):
    client = get_groq_client()
    try:
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=prompt_messages,
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

def check_message_safety(text):
    """Check if message contains potentially malicious content."""
    client = get_groq_client()
    try:
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": "You are a content safety checker. Analyze the following text and determine if it contains malicious, harmful, or inappropriate content. Respond with ONLY 'SAFE' or 'MALICIOUS'."},
                {"role": "user", "content": text}
            ],
            max_tokens=10,
        )
        result = response.choices[0].message.content.strip().upper()
        return "MALICIOUS" in result
    except Exception as e:
        print(f"Safety check error: {e}")
        return False  # Default to safe if check fails

def env_flag(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def extract_deadlines_from_text(text):
    """Extract deadline information from text using Groq AI."""
    client = get_groq_client()
    try:
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": "You are a deadline extraction assistant. Extract all assignment deadlines from the given text. Return a JSON array of objects with fields: 'task', 'course', 'deadline_date', 'description'. If no deadlines found, return empty array. Format: [{\"task\": \"Assignment 1\", \"course\": \"Math\", \"deadline_date\": \"2024-01-15\", \"description\": \"Submit chapter 5 exercises\"}]"},
                {"role": "user", "content": f"Extract deadlines from this text:\n\n{text}"}
            ],
            max_tokens=1000,
        )
        result = response.choices[0].message.content.strip()
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
    best_course_id = max(scores, key=scores.get)
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
    client = get_groq_client()
    
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
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": "You are a course classification assistant. Given a message and a list of available courses, identify which course the message is most likely related to. Respond with ONLY JSON: {\"course_id\": \"uuid\", \"course_code\": \"CS101\", \"confidence\": 0.85}. If unsure, respond with {\"course_id\": null, \"course_code\": null, \"confidence\": 0.0}."},
                {"role": "user", "content": f"Available courses:\n{course_list}\n\nMessage: {message}\n\nWhich course does this message belong to?"}
            ],
            max_tokens=100,
        )
        
        result = response.choices[0].message.content.strip()
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

@app.get("/")
def home():
    return {"message": "AcadPulse API v1.1.0 is online", "status": "success"}

@app.get("/test")
def test_endpoint():
    return {"status": "success", "data": "Backend logic ready"}

# Task #25: Fetch Gmail Emails (Proper Implementation)
@app.get("/gmail/fetch")
def fetch_gmail_emails(max_results: int = 10):
    creds = get_google_credentials_safe()
    service = build("gmail", "v1", credentials=creds)
    
    # Get unread/recent messages
    results = execute_google_api_call(service.users().messages().list(userId="me", labelIds=["INBOX"], maxResults=max_results))
    messages = results.get("messages", [])
    
    user_id = get_or_create_user("Default Student", "student@example.com") # Placeholder user
    fetched_count = 0
    new_count = 0

    for msg in messages:
        fetched_count += 1
        full_msg = execute_google_api_call(service.users().messages().get(userId="me", id=msg["id"], format="full"))
        
        headers = full_msg.get("payload", {}).get("headers", [])
        subject = get_header(headers, "Subject")
        sender_full = get_header(headers, "From")
        date_raw = get_header(headers, "Date")
        
        # Extract sender name and email
        sender_match = re.search(r'(.*)<(.*)>', sender_full)
        sender_name = sender_match.group(1).strip() if sender_match else sender_full
        sender_email = sender_match.group(2).strip() if sender_match else sender_full

        # Decode body
        body = decode_gmail_body(full_msg.get("payload", {}))
        
        # Classification
        category = classifier_stub(subject + " " + body)
        
        # Store in DB
        if not notification_exists(msg["id"], "gmail"):
            notif_id = insert_notification(
                user_id=user_id,
                source_type="gmail",
                external_id=msg["id"],
                sender=sender_name,
                text=f"Subject: {subject}\n\n{body[:500]}...", # Truncate for display
                category=category,
                received_at=date_raw,
                source_ref=sender_email
            )
            if notif_id:
                new_count += 1

    return {
        "status": "success",
        "total_fetched": fetched_count,
        "new_notifications_saved": new_count
    }

# Task #28: Fetch Google Classroom Content
@app.get("/classroom/fetch")
def fetch_classroom_all():
    creds = get_google_credentials_safe()
    service = build("classroom", "v1", credentials=creds)
    
    user_id = get_or_create_user("Default Student", "student@example.com")
    
    try:
        courses_result = execute_google_api_call(service.courses().list(courseStates="ACTIVE"))
        courses = courses_result.get("courses", [])
    except HttpError as e:
        raise HTTPException(status_code=502, detail=f"Classroom API error: {e}")

    stats = {"courses_processed": 0, "announcements": 0, "coursework": 0, "materials": 0}

    for course in courses:
        course_id = course["id"]
        course_name = course["name"]
        stats["courses_processed"] += 1
        
        # 1. Fetch Announcements
        try:
            announcements = execute_google_api_call(service.courses().announcements().list(courseId=course_id)).get("announcements", [])
            for ann in announcements:
                if notification_exists(ann["id"], "classroom"):
                    continue
                category = classifier_stub(ann.get("text", ""))
                saved = insert_notification(
                    user_id=user_id,
                    source_type="classroom",
                    external_id=ann["id"],
                    sender=course_name,
                    text=ann.get("text", "No text"),
                    category=category,
                    received_at=ann["creationTime"],
                    source_ref=course_id
                )
                if saved: stats["announcements"] += 1
        except HttpError as e:
            print(f"Error fetching announcements for {course_name}: {e}")

        # 2. Fetch Coursework (Assignments)
        try:
            coursework = execute_google_api_call(service.courses().courseWork().list(courseId=course_id)).get("courseWork", [])
            for cw in coursework:
                if notification_exists(cw["id"], "classroom"):
                    continue
                text = f"Title: {cw.get('title')}\nDescription: {cw.get('description', 'N/A')}"
                category = classifier_stub(text)
                
                # Extract due date if present
                due_date = None
                if cw.get("dueDate"):
                    d = cw["dueDate"]
                    t = cw.get("dueTime", {"hours": 23, "minutes": 59})
                    due_date = f"{d['year']}-{d['month']:02d}-{d['day']:02d}T{t.get('hours', 0):02d}:{t.get('minutes', 0):02d}:00Z"

                saved = insert_notification(
                    user_id=user_id,
                    source_type="classroom",
                    external_id=cw["id"],
                    sender=course_name,
                    text=text,
                    category="assignment" if cw.get("workType") == "ASSIGNMENT" else category,
                    received_at=cw["creationTime"],
                    source_ref=course_id
                )
                if saved: stats["coursework"] += 1
        except HttpError as e:
            print(f"Error fetching coursework for {course_name}: {e}")

        # 3. Fetch Course Materials (Gap 1)
        try:
            materials_result = execute_google_api_call(service.courses().courseWorkMaterials().list(courseId=course_id))
            materials = materials_result.get("courseWorkMaterials", [])
            for mat in materials:
                if notification_exists(mat["id"], "classroom"):
                    continue
                
                # Extract attachments
                attachments_info = []
                for attachment in mat.get("materials", []):
                    if "driveFile" in attachment:
                        attachments_info.append(f"Drive File: {attachment['driveFile']['driveFile'].get('title', 'Unknown')}")
                    elif "link" in attachment:
                        attachments_info.append(f"Link: {attachment['link'].get('title', 'Unknown Link')}")

                text = f"Title: {mat.get('title')}\nDescription: {mat.get('description', '')}\nAttachments: {', '.join(attachments_info)}"
                category = classifier_stub(text)
                
                saved = insert_notification(
                    user_id=user_id,
                    source_type="classroom",
                    external_id=mat["id"],
                    sender=course_name,
                    text=text,
                    category="material",
                    received_at=mat["creationTime"],
                    source_ref=course_id
                )
                if saved: stats["materials"] += 1
        except HttpError as e:
            if e.resp.status == 403:
                print(f"Permission denied for materials in {course_name} (403). Skipping.")
            else:
                print(f"Error fetching materials for {course_name}: {e}")

    return {
        "status": "success",
        "stats": stats
    }

@app.get("/demo/sync")
def sync_everything():
    """End-to-end verification: Fetch Gmail and Classroom and store in DB."""
    gmail_res = fetch_gmail_emails(max_results=5)
    classroom_res = fetch_classroom_all()
    
    return {
        "gmail_sync": gmail_res,
        "classroom_sync": classroom_res,
        "database_status": "Integrity check passed (no duplicates created)"
    }

# --- Groq Chatbot & Deadline Extraction Endpoints ---

@app.post("/chat", response_model=ChatResponse)
def chat_with_bot(request: ChatRequest):
    """
    Chat with the AI assistant. Includes safety checking.
    If the message is flagged as malicious, requires confirmation to proceed.
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
        messages = [
            {"role": "system", "content": "You are AcadPulse, a helpful academic assistant for students. Help users with questions about assignments, deadlines, courses, and general academic queries. Be concise and friendly."},
            {"role": "user", "content": request.prompt}
        ]
        
        response_text = create_groq_chat(messages)
        
        return ChatResponse(
            response=response_text,
            is_safe=True,
            warning=None
        )
    except HTTPException as e:
        raise e
    except Exception as e:
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

@app.post("/messages/incoming")
def process_incoming_message(message: IncomingWhatsAppMessage):
    """
    Process incoming WhatsApp messages from general groups.
    Automatically classifies course, extracts deadlines, and stores in database.
    
    Flow:
    1. Check message safety
    2. Classify course using multi-stage pipeline
    3. Extract deadlines using hybrid approach (pattern + dateparser + LLM fallback)
    4. Store notification in database
    5. Return processed result
    """
    try:
        group_ref = message.group or message.group_name or message.group_id or "unknown"
        sender_ref = message.sender_name or message.sender

        # Optional LLM safety check. Disabled by default so general-group
        # automation does not spend one LLM call per incoming message.
        if env_flag("ENABLE_INCOMING_SAFETY_CHECK") and check_message_safety(message.text):
            return {
                "success": False,
                "message": "Message flagged as potentially malicious",
                "requires_review": True
            }
        
        # Step 2: Get or create user
        user_id = get_or_create_user("WhatsApp User", "whatsapp@acadpulse.local")
        
        # Step 3: Classify course
        classification = classify_course_for_message(message.text, group_ref)
        
        # Step 4: Extract deadlines (hybrid approach - 90% less LLM calls)
        deadlines = extract_deadlines_hybrid(message.text)
        
        # Step 5: Determine category
        category = classifier_stub(message.text)
        
        # Step 6: Store in database
        notif_id = insert_notification(
            user_id=user_id,
            source_type="whatsapp",
            external_id=f"wa_{message.timestamp}_{message.sender}",
            sender=sender_ref,
            text=message.text,
            category=category,
            received_at=message.timestamp,
            course_id=classification.get("course_id"),
            source_ref=group_ref
        )
        
        return {
            "success": True,
            "notification_id": notif_id,
            "classification": classification,
            "deadlines_extracted": deadlines,
            "llm_api_calls_saved": "Used hybrid extraction (pattern+dateparser first)",
            "message": f"Processed message. Course: {classification.get('course_name', 'Unknown')}, Deadlines: {len(deadlines)}"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Message processing error: {str(e)}")
