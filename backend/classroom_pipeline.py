import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db import insert_notification, notification_exists

logger = logging.getLogger(__name__)


def _main_helpers() -> Dict[str, Any]:
    """Import shared backend helpers lazily to avoid circular imports.

    Returns:
        Dictionary of helper callables from `main.py`.
    """
    from main import (
        calculate_urgency,
        classify_keyword,
        classify_with_fallback,
        extract_primary_deadline_llm_first,
        normalize_received_at,
    )

    return {
        "calculate_urgency": calculate_urgency,
        "classify_keyword": classify_keyword,
        "classify_with_fallback": classify_with_fallback,
        "extract_primary_deadline_llm_first": extract_primary_deadline_llm_first,
        "normalize_received_at": normalize_received_at,
    }


def parse_structured_classroom_due_date(due_date, due_time=None):
    """Convert Google Classroom due date/time into a UTC datetime.

    Args:
        due_date: Classroom dueDate object.
        due_time: Optional Classroom dueTime object.

    Returns:
        A timezone-aware datetime in UTC, or None when no due date exists.

    Example:
        deadline = parse_structured_classroom_due_date(resource.get("dueDate"), resource.get("dueTime"))
    """
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


def extract_classroom_attachment_metadata(materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract Classroom attachment metadata in Gmail-compatible shape.

    Args:
        materials: Classroom materials list.

    Returns:
        A list of attachment metadata dictionaries.

    Example:
        attachments = extract_classroom_attachment_metadata(resource.get("materials", []))
    """
    attachments: List[Dict[str, Any]] = []
    for material in materials or []:
        if "driveFile" in material:
            drive_file = material.get("driveFile", {}).get("driveFile", {})
            attachments.append(
                {
                    "filename": drive_file.get("title", "Unknown Drive File"),
                    "file_type": drive_file.get("mimeType", "application/vnd.google-apps.document"),
                    "attachment_id": drive_file.get("id", "unknown"),
                    "file_size": None,
                }
            )
        elif "link" in material:
            link = material.get("link", {})
            attachments.append(
                {
                    "filename": link.get("title", "Unknown Link"),
                    "file_type": "text/url",
                    "attachment_id": link.get("url", "unknown"),
                    "file_size": None,
                }
            )
        elif "youtubeVideo" in material:
            video = material.get("youtubeVideo", {})
            attachments.append(
                {
                    "filename": video.get("title", "Unknown Video"),
                    "file_type": "video/youtube",
                    "attachment_id": video.get("id", "unknown"),
                    "file_size": None,
                }
            )
    return attachments


async def process_classroom_resource(
    user_id: uuid.UUID,
    resource: dict,
    resource_type: str,
    local_course_id: Optional[uuid.UUID] = None,
    course_name: Optional[str] = None,
    source_reference_id: Optional[str] = None,
) -> Optional[uuid.UUID]:
    """Process one Classroom resource into a notification row.

    Purpose:
        Normalize Classroom resources, classify them using a staged approach,
        extract deadlines, deduplicate, and write into the notification schema.

    Parameters:
        user_id: UUID of the owning user.
        resource: Classroom API resource object.
        resource_type: One of announcement, courseWork, courseWorkMaterial.
        local_course_id: Optional mapped course UUID.
        course_name: Human-readable course name for the sender field.
        source_reference_id: Optional external course id reference.

    Returns:
        The inserted notification UUID, or None if the resource is skipped.

    Example:
        notif_id = await process_classroom_resource(user_id, resource, "courseWork")
    """
    try:
        helpers = _main_helpers()
        calculate_urgency = helpers["calculate_urgency"]
        classify_keyword = helpers["classify_keyword"]
        classify_with_fallback = helpers["classify_with_fallback"]
        extract_primary_deadline_llm_first = helpers["extract_primary_deadline_llm_first"]
        normalize_received_at = helpers["normalize_received_at"]

        # Step 1: Field extraction based on resource_type
        if resource_type == "announcement":
            resource_id = resource.get("id")
            body = resource.get("text", "")
            subject = "Announcement"
            work_type = None
            structured_deadline = None
            materials = []
        elif resource_type == "courseWork":
            resource_id = resource.get("id")
            subject = resource.get("title", "")
            body = resource.get("description", "")
            work_type = resource.get("workType")
            structured_deadline = None
            if resource.get("dueDate"):
                structured_deadline = parse_structured_classroom_due_date(
                    resource["dueDate"],
                    resource.get("dueTime"),
                )
            materials = resource.get("materials", [])
        elif resource_type == "courseWorkMaterial":
            resource_id = resource.get("id")
            subject = resource.get("title", "")
            body = resource.get("description", "")
            work_type = None
            structured_deadline = None
            materials = resource.get("materials", [])
        else:
            logger.warning("Unknown Classroom resource type: %s", resource_type)
            return None

        message_text = f"Subject: {subject}\n\n{body[:500]}"
        received_at = normalize_received_at(resource.get("creationTime"))

        # Step 2: Deduplication (must happen before classification or API calls)
        if notification_exists(resource_id, "classroom", user_id):
            logger.debug("Classroom resource %s already exists for user %s, skipping", resource_id, user_id)
            return None

        # Step 3: Attachment extraction
        attachments = extract_classroom_attachment_metadata(materials)
        if attachments:
            logger.info("Classroom %s %s has %d attachment(s)", resource_type, resource_id, len(attachments))

        # Step 4: Category determination (staged approach)
        category = None

        # Stage A: Native guaranteed mapping
        if work_type == "QUIZ_ASSIGNMENT":
            category = "quiz"
        elif work_type == "ASSIGNMENT":
            category = "assignment"
        elif resource_type == "courseWorkMaterial" and not (body or "").strip():
            category = "material"

        # Stage B: Keyword classifier with confidence
        if category is None:
            keyword_category, confidence = classify_keyword(message_text)
            if keyword_category == "material":
                category = "material"
            elif confidence >= 0.85:
                category = keyword_category
            # else: confidence < 0.85, proceed to Stage C

        # Stage C: HF classifier via classify_with_fallback
        if category is None:
            try:
                hf_result = await classify_with_fallback(message_text)
                if hf_result != "noise":
                    category = hf_result
                else:
                    # noise: discard resource
                    logger.debug("Classroom resource %s classified as noise, skipping", resource_id)
                    return None
            except Exception as exc:
                logger.debug("HF classifier failed for Classroom %s: %s, using fallback", resource_id, exc)
                category = None

        # Stage D: Final fallback (edge case)
        if category is None:
            if attachments:
                category = "material"
            else:
                category = "announcement"

        # Step 5: Deadline extraction
        deadline = None
        if category != "material":
            if structured_deadline is not None:
                deadline = structured_deadline
            elif category in {"assignment", "quiz", "announcement", "event"}:
                deadline = extract_primary_deadline_llm_first(message_text)

        # Step 6: Urgency calculation
        urgency_level = None
        if category in {"assignment", "quiz"} and deadline is not None:
            urgency = calculate_urgency(deadline)
            urgency_level = urgency["label"]

        # Step 7: Insert notification (single DB write with deadline and urgency_level)
        notification_id = insert_notification(
            user_id=user_id,
            source_type="classroom",
            external_id=resource_id,
            sender=course_name or "Classroom",
            text=message_text,
            category=category,
            received_at=received_at,
            course_id=local_course_id,
            source_ref=source_reference_id or resource_id,
            deadline=deadline,
            urgency_level=urgency_level,
        )

        if not notification_id:
            logger.warning("Failed to insert notification for Classroom %s", resource_id)
            return None

        # Step 8: Attachments stub
        try:
            from attachments_pipeline import process_attachments_stub
            await process_attachments_stub(attachments, notification_id)
        except ImportError:
            logger.warning("attachments_pipeline not available")
        except Exception as exc:
            logger.warning("Error processing attachments for notification %s: %s", notification_id, exc)

        # Step 9: Return notification_id
        logger.info(
            "Processed Classroom %s %s (id=%s) with category=%s, deadline=%s, urgency_level=%s",
            resource_type,
            subject[:50],
            resource_id,
            category,
            deadline,
            urgency_level,
        )
        return notification_id

    except Exception:
        logger.exception("Error processing Classroom resource")
        return None
