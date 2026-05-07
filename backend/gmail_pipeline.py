import base64
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

from db import insert_notification, notification_exists

logger = logging.getLogger(__name__)


def _main_helpers() -> Dict[str, Any]:
    """Import shared backend helpers lazily to avoid circular imports.

    Returns:
        Dictionary of helper callables from `main.py`.
    """
    from main import (
        calculate_urgency,
        classify_course_for_message,
        classify_with_fallback,
        extract_primary_deadline_llm_first,
        normalize_received_at,
    )

    return {
        "calculate_urgency": calculate_urgency,
        "classify_course_for_message": classify_course_for_message,
        "classify_with_fallback": classify_with_fallback,
        "extract_primary_deadline_llm_first": extract_primary_deadline_llm_first,
        "normalize_received_at": normalize_received_at,
    }


def _safe_text(value: Any) -> str:
    """Return a trimmed string representation for any value.

    Args:
        value: Incoming Gmail field value.

    Returns:
        A trimmed string or an empty string.
    """
    if value is None:
        return ""
    return str(value).strip()


def clean_html(html_content: str) -> str:
    """Strip HTML tags and return readable plain text.

    Args:
        html_content: Raw HTML content extracted from a Gmail payload.

    Returns:
        Clean plain text.

    Example:
        text = clean_html("<p>Hello</p>")
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def decode_gmail_body(payload: Dict[str, Any]) -> str:
    """Recursively decode Gmail payload parts into plain text.

    Args:
        payload: Gmail message payload returned by the API.

    Returns:
        Decoded body text, or an empty string if no decodable body exists.

    Example:
        body_text = decode_gmail_body(message_payload)
    """
    if not payload:
        return ""

    parts = payload.get("parts", []) or []
    if parts:
        return "".join(decode_gmail_body(part) for part in parts)

    mime_type = payload.get("mimeType")
    if mime_type in ["text/plain", "text/html"]:
        data = payload.get("body", {}).get("data")
        if data:
            decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            return clean_html(decoded) if mime_type == "text/html" else decoded
    return ""


def get_header(headers: List[Dict[str, Any]], name: str) -> str:
    """Return a Gmail header value by name.

    Args:
        headers: Gmail header list.
        name: Header name to find.

    Returns:
        The matching header value, or an empty string.

    Example:
        subject = get_header(headers, "Subject")
    """
    for header in headers or []:
        if header.get("name", "").lower() == name.lower():
            return header.get("value", "")
    return ""


def extract_gmail_attachment_metadata(parts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collect Gmail attachment metadata without downloading files.

    Args:
        parts: Nested Gmail payload parts.

    Returns:
        A list of attachment metadata dictionaries with filename, file_type,
        attachment_id, and file_size.

    Example:
        attachments = extract_gmail_attachment_metadata(payload.get("parts", []))
    """
    attachments: List[Dict[str, Any]] = []
    for part in parts or []:
        filename = part.get("filename")
        body_info = part.get("body", {}) or {}
        mime_type = part.get("mimeType")
        attachment_id = body_info.get("attachmentId")
        file_size = body_info.get("size") or body_info.get("attachmentSize") or None

        if filename and attachment_id:
            attachments.append(
                {
                    "filename": filename,
                    "file_type": mime_type,
                    "attachment_id": attachment_id,
                    "file_size": file_size,
                }
            )

        nested_parts = part.get("parts") or []
        if nested_parts:
            attachments.extend(extract_gmail_attachment_metadata(nested_parts))

    return attachments


async def process_gmail_message(user_id: uuid.UUID, gmail_message: dict) -> Optional[uuid.UUID]:
    """Process a Gmail message into a notification row.

    Purpose:
        Decode the Gmail payload, filter non-academic mail, deduplicate the
        message, classify it, extract course and deadline metadata, insert a
        notification row, and hand attachment metadata to the attachment stub.

    Parameters:
        user_id: UUID of the user who owns the mailbox.
        gmail_message: Full Gmail API message object.

    Returns:
        The inserted notification UUID, or None when the message is skipped.

    Example:
        notif_id = await process_gmail_message(user_id, gmail_message)
    """
    try:
        helpers = _main_helpers()
        classify_course_for_message = helpers["classify_course_for_message"]
        classify_with_fallback = helpers["classify_with_fallback"]
        extract_primary_deadline_llm_first = helpers["extract_primary_deadline_llm_first"]
        normalize_received_at = helpers["normalize_received_at"]
        calculate_urgency = helpers["calculate_urgency"]

        msg_id = gmail_message.get("id")
        thread_id = gmail_message.get("threadId")
        internal_date = gmail_message.get("internalDate")
        snippet = gmail_message.get("snippet", "")
        label_ids = set(gmail_message.get("labelIds") or [])

        payload = gmail_message.get("payload", {}) or {}
        headers = payload.get("headers", []) or []
        subject = get_header(headers, "Subject")
        from_full = get_header(headers, "From")
        date_raw = get_header(headers, "Date")

        sender_match = re.search(r"^(?P<name>.*?)\s*<(?P<email>[^>]+)>$", from_full)
        if sender_match:
            sender_name = sender_match.group("name").strip() or sender_match.group("email").strip()
            sender_email = sender_match.group("email").strip()
        else:
            sender_name = from_full.strip()
            sender_email = from_full.strip()

        if isinstance(sender_email, str) and sender_email.lower() == "no-reply@classroom.google.com":
            logger.info("Skipping Google Classroom email %s from %s", msg_id, sender_email)
            return None

        if {"CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES"} & label_ids:
            return None

        sender_domain = sender_email.split("@")[-1].lower() if "@" in sender_email else ""
        blocked_domains = {
            "linkedin.com",
            "canva.com",
            "notion.so",
            "slack.com",
            "github.com",
            "twitter.com",
            "instagram.com",
            "facebook.com",
            "youtube.com",
            "spotify.com",
            "zoom.us",
        }
        if any(sender_domain == blocked or sender_domain.endswith(f".{blocked}") for blocked in blocked_domains):
            return None

        if notification_exists(msg_id, "gmail", user_id):
            return None

        body = decode_gmail_body(payload)
        cleaned_body = body.strip() if body else ""
        body_text = cleaned_body or snippet or ""

        attachments = extract_gmail_attachment_metadata(payload.get("parts", []))
        logger.info("Gmail %s has %d attachment(s)", msg_id, len(attachments))

        classification_text = subject + "\n\n" + body_text

        if attachments and not cleaned_body and not snippet.strip():
            category = "material"
        else:
            category = await classify_with_fallback(classification_text)
            if category == "noise":
                return None

        try:
            course_info = classify_course_for_message(
                f"{sender_name} {subject}\n\n{body_text}",
                sender_name,
                str(user_id),
            )
            course_id = course_info.get("course_id")
        except Exception as exc:
            logger.warning("Course classification failed for %s: %s", msg_id, exc)
            course_id = None

        notification_text = f"Subject: {subject}\n\n{body_text[:500]}..."
        received_at_value = normalize_received_at(date_raw or internal_date)

        deadline = None
        urgency_level = None
        if category in {"assignment", "quiz", "announcement", "event"}:
            deadline = extract_primary_deadline_llm_first(classification_text)
            if deadline and category in {"assignment", "quiz"}:
                urgency = calculate_urgency(deadline)
                urgency_level = urgency.get("label")

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
            deadline=deadline,
            urgency_level=urgency_level,
        )

        if not notif_id:
            logger.warning("Failed to insert notification for Gmail %s", msg_id)
            return None

        try:
            from attachments_pipeline import process_attachments_stub
            await process_attachments_stub(attachments, notif_id)
        except ImportError:
            logger.warning("attachments_pipeline not available")
        except Exception as exc:
            logger.warning("Error processing attachments for notification %s: %s", notif_id, exc)

        logger.info(
            "Processed Gmail message %s (thread %s) with %d attachment(s)",
            msg_id,
            thread_id,
            len(attachments),
        )

        return notif_id
    except Exception:
        logger.exception("Error processing Gmail message")
        return None
