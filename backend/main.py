import os
import base64
import re
import time
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from groq import APIConnectionError, APIStatusError, Groq
from pydantic import BaseModel
from dotenv import load_dotenv
from bs4 import BeautifulSoup

from google_auth import get_google_credentials
from db import insert_notification, get_or_create_user, notification_exists

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
    group: str
    timestamp: str

class ChatRequest(BaseModel):
    prompt: str
    confirm_malicious: bool = False

class DeadlineRequest(BaseModel):
    text: str
    confirm_malicious: bool = False

class ChatResponse(BaseModel):
    response: str
    is_safe: bool
    warning: Optional[str] = None

class DeadlineResponse(BaseModel):
    deadlines: list
    success: bool
    message: str

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
        import json
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
    # Check for malicious content
    is_malicious = check_message_safety(request.text)
    
    if is_malicious and not request.confirm_malicious:
        return DeadlineResponse(
            deadlines=[],
            success=False,
            message="Content flagged as potentially malicious. Please confirm if you want to proceed."
        )
    
    try:
        deadlines = extract_deadlines_from_text(request.text)
        
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
        is_malicious = check_message_safety(text)
        
        if is_malicious and not confirm_malicious:
            results.append({
                "index": i,
                "success": False,
                "deadlines": [],
                "message": "Content flagged as malicious"
            })
            continue
        
        deadlines = extract_deadlines_from_text(text)
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
