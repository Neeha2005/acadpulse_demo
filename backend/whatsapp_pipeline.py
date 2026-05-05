import asyncio
import contextlib
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from db import get_db_connection, insert_notification, notification_exists
from notification_abbr import expand_abbreviations, detect_unknown_abbreviations


logger = logging.getLogger(__name__)

WHATSAPP_BUFFER_SECONDS = int(os.getenv("WHATSAPP_BUFFER_SECONDS", "30"))
WHATSAPP_FLUSH_INTERVAL_SECONDS = int(os.getenv("WHATSAPP_FLUSH_INTERVAL_SECONDS", "5"))

_BUFFER_LOCK = asyncio.Lock()
_WHATSAPP_BUFFER: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
_BUFFER_FLUSH_TASK: Optional[asyncio.Task] = None


def _main_helpers():
    """Import shared backend helpers lazily to avoid circular imports.

    Returns:
        A dictionary of helper callables from `main.py`.
    """
    from main import (
        calculate_urgency,
        classify_course_for_message,
        extract_deadlines_hybrid,
        normalize_received_at,
        normalize_text,
        parse_strict_deadline_datetime,
        run_pipeline,
    )

    return {
        "calculate_urgency": calculate_urgency,
        "classify_course_for_message": classify_course_for_message,
        "extract_deadlines_hybrid": extract_deadlines_hybrid,
        "normalize_received_at": normalize_received_at,
        "normalize_text": normalize_text,
        "parse_strict_deadline_datetime": parse_strict_deadline_datetime,
        "run_pipeline": run_pipeline,
    }


def _safe_text(value: Any) -> str:
    """Return a trimmed string representation for any value.

    Args:
        value: Any incoming value from the webhook payload.

    Returns:
        A trimmed string or an empty string.
    """
    if value is None:
        return ""
    return str(value).strip()


def _token_count(text: str) -> int:
    """Count simple whitespace-delimited tokens.

    Args:
        text: Text to inspect.

    Returns:
        Number of tokens.
    """
    return len([token for token in _safe_text(text).split() if token])


def _clean_jid(value: Optional[str]) -> str:
    """Normalize a WhatsApp JID or phone-like identifier.

    Args:
        value: Raw identifier from Baileys or the FastAPI bridge.

    Returns:
        A cleaned identifier without the domain suffix when possible.
    """
    if not value:
        return "unknown"
    cleaned = str(value).split("@")[0].split(":")[0]
    return cleaned or "unknown"


def _unwrap_baileys_message(message: Dict[str, Any]) -> Dict[str, Any]:
    """Unwrap nested Baileys message payloads.

    Args:
        message: Raw message content from Baileys.

    Returns:
        The innermost message object when supported wrappers are present.

    Example:
        content = _unwrap_baileys_message(message["message"])
    """
    current = message or {}
    for wrapper in ("ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2"):
        nested = current.get(wrapper, {}) if isinstance(current, dict) else {}
        if isinstance(nested, dict) and nested.get("message"):
            current = nested.get("message") or {}
    return current if isinstance(current, dict) else {}


def _detect_media_type(message_content: Dict[str, Any]) -> str:
    """Detect the normalized media type for a Baileys message payload.

    Args:
        message_content: Unwrapped message content.

    Returns:
        One of: text, document, image, video, audio, sticker, protocol, unknown.
    """
    if not isinstance(message_content, dict):
        return "unknown"

    if message_content.get("protocolMessage"):
        return "protocol"
    if message_content.get("stickerMessage"):
        return "sticker"
    if message_content.get("documentMessage"):
        return "document"
    if message_content.get("imageMessage"):
        return "image"
    if message_content.get("videoMessage"):
        return "video"
    if message_content.get("audioMessage"):
        return "audio"
    if message_content.get("extendedTextMessage") or message_content.get("conversation"):
        return "text"
    return "unknown"


def _extract_caption(message_content: Dict[str, Any], media_type: str) -> str:
    """Extract a caption or text body from a Baileys message.

    Args:
        message_content: Unwrapped message content.
        media_type: Media type detected by `_detect_media_type`.

    Returns:
        Clean caption/text if present, otherwise an empty string.
    """
    if media_type == "text":
        return _safe_text(message_content.get("conversation") or message_content.get("extendedTextMessage", {}).get("text"))

    for key in ("imageMessage", "videoMessage", "documentMessage", "audioMessage"):
        if message_content.get(key):
            payload = message_content.get(key) or {}
            return _safe_text(payload.get("caption") or payload.get("text"))
    return ""


def _extract_file_name(message_content: Dict[str, Any], media_type: str) -> str:
    """Extract a human-readable file name from a media message.

    Args:
        message_content: Unwrapped message content.
        media_type: Media type detected by `_detect_media_type`.

    Returns:
        File name when available, otherwise an empty string.
    """
    if media_type != "document":
        return ""

    document = message_content.get("documentMessage") or {}
    return _safe_text(document.get("fileName") or document.get("title"))


def _extract_mime_type(message_content: Dict[str, Any], media_type: str) -> str:
    """Extract the MIME type from a media message.

    Args:
        message_content: Unwrapped message content.
        media_type: Media type detected by `_detect_media_type`.

    Returns:
        MIME type string when available.
    """
    lookup_map = {
        "document": (message_content.get("documentMessage") or {}).get("mimetype"),
        "image": (message_content.get("imageMessage") or {}).get("mimetype"),
        "video": (message_content.get("videoMessage") or {}).get("mimetype"),
        "audio": (message_content.get("audioMessage") or {}).get("mimetype"),
        "sticker": "image/webp",
    }
    return _safe_text(lookup_map.get(media_type))


def _infer_media_kind(raw_kind: Any, mime_type: str = "", file_name: str = "") -> str:
    """Infer a normalized media kind from raw hints.

    Args:
        raw_kind: Media kind hint.
        mime_type: MIME type when available.
        file_name: File name when available.

    Returns:
        One of: text, document, image, video, audio, sticker, unknown.
    """
    kind = _safe_text(raw_kind).lower()
    mime = _safe_text(mime_type).lower()
    name = _safe_text(file_name).lower()

    if kind in {"text", "document", "image", "video", "audio", "sticker"}:
        return kind

    if mime.startswith("image/webp"):
        return "sticker"
    if mime.startswith("application/pdf") or mime.startswith("application/vnd.google-apps") or mime.startswith("application/msword"):
        return "document"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"

    if name.endswith((".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx")):
        return "document"
    if name.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")):
        return "image"
    if name.endswith((".mp4", ".mkv", ".mov", ".avi", ".webm")):
        return "video"
    if name.endswith((".mp3", ".wav", ".ogg", ".m4a", ".opus")):
        return "audio"

    return kind or "unknown"


def _extract_forwarded_flag(message_content: Dict[str, Any]) -> bool:
    """Detect whether the message was forwarded.

    Args:
        message_content: Unwrapped message content.

    Returns:
        True when the message appears to be forwarded.
    """
    for key in ("extendedTextMessage", "imageMessage", "videoMessage", "documentMessage", "audioMessage"):
        payload = message_content.get(key) or {}
        context_info = payload.get("contextInfo") or {}
        if context_info.get("isForwarded"):
            return True
    return False


def _looks_like_protocol_message(message_content: Dict[str, Any]) -> bool:
    """Return True for protocol/system messages that should be ignored.

    Args:
        message_content: Unwrapped message content.

    Returns:
        Boolean flag for protocol/system messages.
    """
    protocol_message = message_content.get("protocolMessage")
    return bool(protocol_message)


def normalize_whatsapp_payload(payload: dict) -> dict:
    """Normalize an incoming WhatsApp payload into a unified internal structure.

    The function accepts both:
    - raw Baileys payloads
    - the flattened FastAPI bridge payload currently emitted by `whatsapp/sender.js`

    Args:
        payload: Raw webhook payload or flattened bridge payload.

    Returns:
        A normalized dictionary containing:
        user_id, chat_id, chat_name, sender_name, sender_phone, message_id,
        timestamp, text, caption, media_type, mime_type, file_name,
        is_group, is_from_me, attachments, ignore, ignore_reason.

    Example:
        normalized = normalize_whatsapp_payload(payload)
    """
    helpers = _main_helpers()
    normalize_received_at = helpers["normalize_received_at"]

    raw_payload = payload or {}
    key_obj = raw_payload.get("key")
    key: Dict[str, Any] = key_obj if isinstance(key_obj, dict) else {}
    message_obj_raw = raw_payload.get("message")
    message_obj: Dict[str, Any] = message_obj_raw if isinstance(message_obj_raw, dict) else {}
    message_content = _unwrap_baileys_message(message_obj) if message_obj else {}
    if not message_content and isinstance(raw_payload.get("messages"), list):
        # Batch payloads are handled by `process_whatsapp_message`; this helper
        # normalizes a single message at a time.
        message_content = {}

    user_id = _safe_text(raw_payload.get("user_id") or raw_payload.get("userId") or raw_payload.get("user"))
    chat_id = _safe_text(
        raw_payload.get("chat_id")
        or raw_payload.get("group_id")
        or raw_payload.get("groupId")
        or key.get("remoteJid")
        or raw_payload.get("chat_id")
    )
    chat_name = _safe_text(raw_payload.get("chat_name") or raw_payload.get("group_name") or raw_payload.get("groupName") or chat_id)

    sender_phone = _safe_text(
        raw_payload.get("sender_phone")
        or raw_payload.get("sender")
        or key.get("participant")
        or key.get("remoteJid")
    )
    sender_name = _safe_text(raw_payload.get("sender_name") or raw_payload.get("senderName") or raw_payload.get("pushName") or sender_phone)

    message_id = _safe_text(
        raw_payload.get("message_id")
        or raw_payload.get("messageId")
        or raw_payload.get("id")
        or key.get("id")
    )
    timestamp_value = raw_payload.get("timestamp")
    if timestamp_value is None:
        timestamp_value = raw_payload.get("messageTimestamp") or key.get("messageTimestamp") or raw_payload.get("ts")
    timestamp = normalize_received_at(timestamp_value)

    is_from_me = bool(raw_payload.get("is_from_me") or raw_payload.get("fromMe") or key.get("fromMe"))
    is_group = bool(
        raw_payload.get("is_group")
        if raw_payload.get("is_group") is not None
        else (chat_id.endswith("@g.us") or str(raw_payload.get("group_type") or raw_payload.get("groupType") or "").lower() == "general")
    )
    if raw_payload.get("group_type") is not None:
        is_group = True

    media_type_hint = _safe_text(raw_payload.get("media_type") or raw_payload.get("mediaType") or _detect_media_type(message_content))
    caption = _safe_text(raw_payload.get("caption") or raw_payload.get("text") or _extract_caption(message_content, media_type_hint))
    text = _safe_text(raw_payload.get("text") or raw_payload.get("message_text") or raw_payload.get("messageText"))

    if not text and caption and media_type_hint == "text":
        text = caption
    if not text and media_type_hint == "text":
        text = _extract_caption(message_content, media_type_hint)

    file_name = _safe_text(raw_payload.get("file_name") or raw_payload.get("fileName") or _extract_file_name(message_content, media_type_hint))
    mime_type = _safe_text(raw_payload.get("mime_type") or raw_payload.get("mimeType") or _extract_mime_type(message_content, media_type_hint))
    media_type = _infer_media_kind(media_type_hint, mime_type=mime_type, file_name=file_name)

    attachments = _safe_list_media(raw_payload, message_content)

    ignore_reason = ""
    if is_from_me:
        ignore_reason = "from_self"
    elif chat_id in {"status@broadcast", "broadcast"} or str(chat_id).endswith("@broadcast"):
        ignore_reason = "status_broadcast"
    elif _looks_like_protocol_message(message_content):
        ignore_reason = "protocol_message"
    elif media_type == "sticker" and not text and not caption:
        ignore_reason = "sticker_only"
    elif not text and not caption and media_type in {"", "unknown"} and not attachments:
        ignore_reason = "empty_message"
    elif raw_payload.get("revoked") or raw_payload.get("is_revoked"):
        ignore_reason = "revoked_message"

    normalized = {
        "user_id": user_id,
        "chat_id": chat_id,
        "chat_name": chat_name,
        "sender_name": sender_name,
        "sender_phone": sender_phone,
        "message_id": message_id,
        "timestamp": timestamp,
        "text": text,
        "caption": caption,
        "media_type": media_type,
        "mime_type": mime_type,
        "file_name": file_name,
        "is_group": is_group,
        "is_from_me": is_from_me,
        "is_forwarded": _extract_forwarded_flag(message_content),
        "attachments": attachments,
        "ignore": bool(ignore_reason),
        "ignore_reason": ignore_reason,
        "raw_payload": raw_payload,
    }

    logger.info(
        "WhatsApp payload normalized",
        extra={
            "message_id": message_id,
            "chat_id": chat_id,
            "sender_phone": sender_phone,
            "media_type": media_type,
            "ignore_reason": ignore_reason or None,
        },
    )
    return normalized


def _safe_list_media(payload: Dict[str, Any], message_content: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Normalize a single incoming payload into a one-item media list when needed.

    Args:
        payload: Raw incoming payload.

    Returns:
        A list containing a single normalized media object when media exists.
    """
    message_content = message_content or {}
    media_type_hint = _safe_text(payload.get("media_type") or payload.get("mediaType") or _detect_media_type(message_content))
    file_name = _safe_text(payload.get("file_name") or payload.get("fileName") or _extract_file_name(message_content, media_type_hint))
    mime_type = _safe_text(payload.get("mime_type") or payload.get("mimeType") or _extract_mime_type(message_content, media_type_hint))
    media_type = _infer_media_kind(media_type_hint, mime_type=mime_type, file_name=file_name)
    caption = _safe_text(payload.get("caption") or payload.get("text") or _extract_caption(message_content, media_type))
    media_id = _safe_text(payload.get("media_id") or payload.get("mediaId") or payload.get("attachment_id") or payload.get("attachmentId") or payload.get("message_id") or payload.get("id"))

    has_explicit_media = bool(
        payload.get("media_type")
        or payload.get("mediaType")
        or payload.get("file_name")
        or payload.get("fileName")
        or payload.get("mime_type")
        or payload.get("mimeType")
        or payload.get("media_id")
        or payload.get("mediaId")
        or payload.get("attachment_id")
        or payload.get("attachmentId")
        or _detect_media_type(message_content) in {"document", "image", "video", "audio", "sticker"}
    )

    if not has_explicit_media:
        return []

    if not any([media_type, file_name, mime_type, caption]):
        return []

    return [
        {
            "filename": file_name,
            "file_type": mime_type,
            "attachment_id": media_id,
            "file_size": payload.get("file_size") or payload.get("fileSize"),
            "media_type": media_type,
            "caption": caption,
            "message_id": _safe_text(payload.get("message_id") or payload.get("messageId") or payload.get("id")),
        }
    ]


def _get_course_metadata(course_id: Optional[uuid.UUID]) -> Tuple[Optional[str], Optional[str]]:
    """Fetch course metadata for a given course ID.

    Args:
        course_id: Course UUID or None.

    Returns:
        Tuple of (course_name, course_code).
    """
    if not course_id:
        return None, None

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT course_name, course_code FROM courses WHERE id = %s",
            (course_id,),
        )
        row = cur.fetchone()
        if not row:
            return None, None
        return row[0], row[1]
    finally:
        cur.close()
        conn.close()


async def get_whatsapp_source_mapping(user_id: str, chat_id: str) -> dict:
    """Resolve WhatsApp group/source metadata from `course_source_mappings`.

    The function keeps the backend compatible with the current schema. If no
    mapping exists, it returns the chat metadata without creating any DB row.

    Args:
        user_id: AcadPulse user UUID.
        chat_id: WhatsApp chat or group identifier.

    Returns:
        Dictionary with source_id, mapped_course_id, is_course_specific,
        and optional course metadata.

    Example:
        mapping = await get_whatsapp_source_mapping(user_id, chat_id)
    """
    def _lookup() -> dict:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT course_id, source_reference_id
                FROM course_source_mappings
                WHERE user_id = %s
                  AND source_type = 'whatsapp'
                  AND source_reference_id = %s
                ORDER BY id DESC
                LIMIT 1;
                """,
                (user_id, chat_id),
            )
            row = cur.fetchone()
            return {
                "source_id": chat_id,
                "mapped_course_id": row[0] if row else None,
                "is_course_specific": bool(row and row[0]),
            }
        finally:
            cur.close()
            conn.close()

    mapping = await asyncio.to_thread(_lookup)
    course_name, course_code = _get_course_metadata(mapping.get("mapped_course_id")) if mapping.get("mapped_course_id") else (None, None)
    mapping["course_name"] = course_name
    mapping["course_code"] = course_code
    logger.info(
        "WhatsApp source resolved",
        extra={
            "user_id": user_id,
            "chat_id": chat_id,
            "mapped_course_id": str(mapping.get("mapped_course_id")) if mapping.get("mapped_course_id") else None,
            "is_course_specific": mapping.get("is_course_specific"),
        },
    )
    return mapping


def _buffer_key(normalized_payload: dict) -> Tuple[str, str, str]:
    """Build the stable buffer key used to merge related WhatsApp messages.

    Args:
        normalized_payload: Normalized message payload.

    Returns:
        Tuple key of (user_id, chat_id, sender_phone).
    """
    return (
        _safe_text(normalized_payload.get("user_id")),
        _safe_text(normalized_payload.get("chat_id")),
        _safe_text(normalized_payload.get("sender_phone")),
    )


def _new_buffer_entry(normalized_payload: dict, mapping: dict) -> dict:
    """Create a new in-memory buffer entry.

    Args:
        normalized_payload: Normalized payload to buffer.
        mapping: WhatsApp source mapping result.

    Returns:
        Newly created buffer entry.
    """
    text = _safe_text(normalized_payload.get("text") or normalized_payload.get("caption"))
    media_items = normalized_payload.get("attachments") or []
    combined_text = text
    if not combined_text and normalized_payload.get("media_type") and normalized_payload.get("caption"):
        combined_text = _safe_text(normalized_payload.get("caption"))

    return {
        "canonical_message_id": _safe_text(normalized_payload.get("message_id")),
        "message_ids": [_safe_text(normalized_payload.get("message_id"))],
        "combined_text": combined_text,
        "media_items": list(media_items),
        "first_timestamp": normalized_payload.get("timestamp"),
        "last_timestamp": normalized_payload.get("timestamp"),
        "normalized_payload": normalized_payload,
        "normalized_messages": [normalized_payload],
        "mapping": mapping,
    }


def _merge_buffer_entry(buffer_entry: dict, normalized_payload: dict) -> None:
    """Merge a new message into an existing buffer entry.

    Args:
        buffer_entry: Existing buffer batch.
        normalized_payload: New message to merge.
    """
    message_id = _safe_text(normalized_payload.get("message_id"))
    if message_id and message_id not in buffer_entry["message_ids"]:
        buffer_entry["message_ids"].append(message_id)

    current_text = _safe_text(normalized_payload.get("text") or normalized_payload.get("caption"))
    if current_text:
        if buffer_entry["combined_text"]:
            buffer_entry["combined_text"] += "\n\n" + current_text
        else:
            buffer_entry["combined_text"] = current_text

    if normalized_payload.get("attachments"):
        buffer_entry["media_items"].extend(normalized_payload.get("attachments") or [])

    buffer_entry["normalized_messages"].append(normalized_payload)
    buffer_entry["last_timestamp"] = normalized_payload.get("timestamp") or buffer_entry["last_timestamp"]


async def buffer_whatsapp_message(normalized_payload: dict, mapping: dict) -> List[dict]:
    """Store a normalized WhatsApp payload in the shared 30-second buffer.

    Messages are merged when they arrive within the buffer window and share the
    same (user_id, chat_id, sender_phone) key.

    Args:
        normalized_payload: Normalized WhatsApp message.
        mapping: Source mapping resolved for the message.

    Returns:
        A list of batches that became immediately expired and should be flushed.

    Example:
        expired_batches = await buffer_whatsapp_message(normalized, mapping)
    """
    key = _buffer_key(normalized_payload)
    now = normalized_payload.get("timestamp") or datetime.now(timezone.utc)
    expired_batches: List[dict] = []

    async with _BUFFER_LOCK:
        existing = _WHATSAPP_BUFFER.get(key)
        if existing:
            last_timestamp = existing.get("last_timestamp") or now
            age_seconds = (now - last_timestamp).total_seconds() if isinstance(now, datetime) and isinstance(last_timestamp, datetime) else 0
            if age_seconds > WHATSAPP_BUFFER_SECONDS:
                expired_batches.append(existing)
                _WHATSAPP_BUFFER[key] = _new_buffer_entry(normalized_payload, mapping)
            else:
                _merge_buffer_entry(existing, normalized_payload)
        else:
            _WHATSAPP_BUFFER[key] = _new_buffer_entry(normalized_payload, mapping)

    logger.info(
        "WhatsApp message buffered",
        extra={
            "message_id": normalized_payload.get("message_id"),
            "chat_id": normalized_payload.get("chat_id"),
            "sender_phone": normalized_payload.get("sender_phone"),
            "buffer_size": len(_WHATSAPP_BUFFER),
        },
    )
    return expired_batches


async def _collect_expired_batches() -> List[dict]:
    """Remove and return all buffer batches that have expired.

    Returns:
        Expired buffer entries ready to be processed.
    """
    now = datetime.now(timezone.utc)
    expired: List[dict] = []
    async with _BUFFER_LOCK:
        for key, batch in list(_WHATSAPP_BUFFER.items()):
            last_timestamp = batch.get("last_timestamp")
            if not isinstance(last_timestamp, datetime):
                continue
            if (now - last_timestamp).total_seconds() >= WHATSAPP_BUFFER_SECONDS:
                expired.append(batch)
                _WHATSAPP_BUFFER.pop(key, None)
    return expired


async def flush_expired_buffers() -> None:
    """Flush all WhatsApp buffer batches that have been idle for 30 seconds.

    This function is intentionally `None`-returning as requested. It is used by
    the background loop and may also be called opportunistically on webhook
    arrival to keep the pipeline moving.

    Example:
        await flush_expired_buffers()
    """
    expired_batches = await _collect_expired_batches()
    for batch in expired_batches:
        await process_buffered_batch(batch)


async def _flush_expired_buffers_collect() -> List[str]:
    """Flush expired buffers and collect the created notification IDs.

    Returns:
        List of created notification UUID strings.
    """
    created_ids: List[str] = []
    expired_batches = await _collect_expired_batches()
    for batch in expired_batches:
        notification_id = await process_buffered_batch(batch)
        if notification_id:
            created_ids.append(str(notification_id))
    return created_ids


async def _whatsapp_buffer_flush_loop() -> None:
    """Background loop that flushes expired WhatsApp buffers safely."""
    while True:
        try:
            await flush_expired_buffers()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WhatsApp buffer flush loop failed")
        await asyncio.sleep(WHATSAPP_FLUSH_INTERVAL_SECONDS)


async def start_whatsapp_buffer_flusher() -> None:
    """Start the background WhatsApp buffer flusher.

    Example:
        await start_whatsapp_buffer_flusher()
    """
    global _BUFFER_FLUSH_TASK
    if _BUFFER_FLUSH_TASK is None or _BUFFER_FLUSH_TASK.done():
        _BUFFER_FLUSH_TASK = asyncio.create_task(_whatsapp_buffer_flush_loop())


async def stop_whatsapp_buffer_flusher() -> None:
    """Stop the background WhatsApp buffer flusher.

    Example:
        await stop_whatsapp_buffer_flusher()
    """
    global _BUFFER_FLUSH_TASK
    if _BUFFER_FLUSH_TASK is not None:
        _BUFFER_FLUSH_TASK.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _BUFFER_FLUSH_TASK
        _BUFFER_FLUSH_TASK = None


def _priority(category: str) -> int:
    """Return a ranking score for deterministic category selection."""
    return {
        "assignment": 5,
        "quiz": 4,
        "event": 3,
        "announcement": 2,
        "material": 1,
        "noise": 0,
    }.get(category, 0)


def _keyword_category(text: str) -> Optional[str]:
    """Classify academic text using deterministic keywords only.

    Args:
        text: Search text.

    Returns:
        Matched category or None.
    """
    helpers = _main_helpers()
    normalize_text = helpers["normalize_text"]
    normalized = normalize_text(text)
    if not normalized:
        return None

    keyword_map = [
        ("assignment", ["assignment", "submit", "deadline", "hand in", "homework", "project", "lab", "problem set"]),
        ("quiz", ["quiz", "mcq", "multiple choice", "test", "exam", "short answer"]),
        ("event", ["event", "workshop", "seminar", "meeting", "webinar", "session", "lecture", "orientation"]),
        ("announcement", ["announcement", "notice", "reminder", "update", "information", "cancel", "postpone", "venue", "room"]),
        ("material", ["material", "slides", "slide", "notes", "pdf", "book", "document", "reading", "resource"]),
    ]
    for category, keywords in keyword_map:
        if any(keyword in normalized for keyword in keywords):
            return category
    return None


def classify_media_message(
    media_items: List[dict],
    combined_text: str,
    *,
    is_course_specific: bool,
    is_general_group: bool,
) -> str:
    """Deterministically classify a WhatsApp media batch.

    The classifier never sends raw media to an LLM. It uses captions, file
    names, MIME types, chat metadata, and group specificity to infer the most
    likely academic category.

    Args:
        media_items: Normalized media metadata list.
        combined_text: Text collected from message captions and text messages.
        is_course_specific: Whether the WhatsApp group is mapped to a course.
        is_general_group: Whether the chat is a general academic group.

    Returns:
        One of: announcement, assignment, quiz, material, event, noise.

    Example:
        category = classify_media_message(media_items, text, is_course_specific=True, is_general_group=False)
    """
    if not media_items:
        return "noise"

    combined_category = _keyword_category(combined_text or "")
    if combined_category:
        return combined_category

    candidates: List[str] = []
    for item in media_items:
        media_type = _infer_media_kind(
            item.get("media_type") or item.get("file_type"),
            mime_type=_safe_text(item.get("file_type")),
            file_name=_safe_text(item.get("filename")),
        )
        caption = _safe_text(item.get("caption"))
        file_name = _safe_text(item.get("filename"))
        context = " ".join(
            part for part in [caption, file_name, _safe_text(item.get("file_type"))] if part
        )
        token_count = _token_count(caption)
        keyword_category = _keyword_category(context)

        if media_type == "sticker":
            continue

        if token_count >= 4 and keyword_category:
            candidates.append(keyword_category)
            continue

        if media_type == "audio":
            if token_count < 4:
                candidates.append("announcement" if is_course_specific else "noise")
            else:
                candidates.append(keyword_category or ("announcement" if is_course_specific else "noise"))
            continue

        if media_type in {"document", "image", "video"}:
            if token_count < 4:
                if media_type == "document":
                    candidates.append("material" if is_course_specific or is_general_group else "noise")
                else:
                    candidates.append("material" if is_course_specific else "noise")
            else:
                candidates.append(keyword_category or ("material" if media_type == "document" else ("material" if is_course_specific else "noise")))
            continue

        if keyword_category:
            candidates.append(keyword_category)

    if candidates:
        return max(candidates, key=_priority)

    has_document = any(
        _infer_media_kind(
            item.get("media_type") or item.get("file_type"),
            mime_type=_safe_text(item.get("file_type")),
            file_name=_safe_text(item.get("filename")),
        ) == "document"
        for item in media_items
    )
    has_audio = any(
        _infer_media_kind(
            item.get("media_type") or item.get("file_type"),
            mime_type=_safe_text(item.get("file_type")),
            file_name=_safe_text(item.get("filename")),
        ) == "audio"
        for item in media_items
    )
    has_image_or_video = any(
        _infer_media_kind(
            item.get("media_type") or item.get("file_type"),
            mime_type=_safe_text(item.get("file_type")),
            file_name=_safe_text(item.get("filename")),
        ) in {"image", "video"}
        for item in media_items
    )

    if has_audio:
        return "announcement" if is_course_specific else "noise"
    if has_document:
        return "material"
    if has_image_or_video:
        return "material" if is_course_specific else "noise"
    return "noise"


def extract_media_context_text(
    media_items: List[dict],
    *,
    chat_name: Optional[str] = None,
    course_name: Optional[str] = None,
    combined_text: str = "",
) -> str:
    """Build a text-only context string from media metadata.

    Args:
        media_items: Normalized media metadata list.
        chat_name: WhatsApp chat/group name.
        course_name: Resolved course name when available.
        combined_text: Existing text already collected from the batch.

    Returns:
        A text-only context string that can be used for deadline extraction and
        safe downstream classification.

    Example:
        context = extract_media_context_text(media_items, chat_name="ML Section A")
    """
    lines: List[str] = []
    if combined_text.strip():
        lines.append(combined_text.strip())

    if course_name:
        lines.append(f"Course: {course_name}")
    if chat_name:
        lines.append(f"Group: {chat_name}")

    for item in media_items:
        parts = [
            f"Caption: {_safe_text(item.get('caption'))}" if _safe_text(item.get("caption")) else "",
            f"Filename: {_safe_text(item.get('filename'))}" if _safe_text(item.get("filename")) else "",
            f"MimeType: {_safe_text(item.get('file_type'))}" if _safe_text(item.get("file_type")) else "",
            f"MediaType: {_safe_text(item.get('media_type'))}" if _safe_text(item.get("media_type")) else "",
        ]
        item_text = "\n".join(part for part in parts if part)
        if item_text:
            lines.append(item_text)

    return "\n\n".join(lines).strip()


async def process_whatsapp_attachments(media_items: List[dict]) -> List[dict]:
    """Return metadata-only attachment objects for WhatsApp media.

    This is a stub for future storage integration. It preserves the structure
    needed for later upload/persistence without writing anything to Supabase.

    Args:
        media_items: Normalized media list from the buffered batch.

    Returns:
        List of attachment metadata dictionaries.

    Example:
        attachments = await process_whatsapp_attachments(media_items)
    """
    attachments = []
    for item in media_items or []:
        media_kind = _infer_media_kind(
            item.get("media_type") or item.get("file_type"),
            mime_type=_safe_text(item.get("file_type")),
            file_name=_safe_text(item.get("filename")),
        )
        attachments.append(
            {
                "filename": _safe_text(item.get("filename")),
                "file_type": _safe_text(item.get("file_type") or item.get("media_type")),
                "attachment_id": _safe_text(item.get("attachment_id") or item.get("message_id")),
                "file_size": item.get("file_size"),
                "caption": _safe_text(item.get("caption")),
                "media_type": media_kind,
            }
        )
    return attachments


async def process_buffered_batch(batch: dict) -> Optional[uuid.UUID]:
    """Process one buffered WhatsApp batch into exactly one notification.

    The batch can contain a single message or several messages merged during the
    30-second buffer window. The function performs course resolution,
    deterministic media classification, shared text pipeline classification,
    deadline extraction, urgency calculation, deduplication, and database
    insertion.

    Args:
        batch: Buffered WhatsApp batch produced by `buffer_whatsapp_message`.

    Returns:
        The inserted notification UUID, or None when the batch is discarded.

    Example:
        notification_id = await process_buffered_batch(batch)
    """
    try:
        helpers = _main_helpers()
        run_pipeline = helpers["run_pipeline"]
        classify_course_for_message = helpers["classify_course_for_message"]
        extract_deadlines_hybrid = helpers["extract_deadlines_hybrid"]
        calculate_urgency = helpers["calculate_urgency"]
        parse_strict_deadline_datetime = helpers["parse_strict_deadline_datetime"]
        normalize_received_at = helpers["normalize_received_at"]

        normalized_messages = batch.get("normalized_messages") or [batch.get("normalized_payload") or {}]
        if not normalized_messages:
            return None

        primary = normalized_messages[0]
        user_id = primary.get("user_id")
        chat_id = primary.get("chat_id")
        chat_name = primary.get("chat_name") or chat_id
        sender_name = primary.get("sender_name") or primary.get("sender_phone") or chat_name
        sender_phone = primary.get("sender_phone") or primary.get("sender") or chat_id
        canonical_message_id = _safe_text(batch.get("canonical_message_id") or primary.get("message_id"))
        first_timestamp = batch.get("first_timestamp") or primary.get("timestamp") or datetime.now(timezone.utc)
        combined_text = _safe_text(batch.get("combined_text"))
        
        # STEP 0: Expand abbreviations early
        expanded_combined_text = expand_abbreviations(combined_text, user_id)
        # Detect unknown abbreviations for future learning
        detect_unknown_abbreviations(combined_text, user_id)
        
        media_items = batch.get("media_items") or []
        mapping = batch.get("mapping") or {}
        mapped_course_id = mapping.get("mapped_course_id")
        is_course_specific = bool(mapping.get("is_course_specific"))
        source_id = _safe_text(mapping.get("source_id") or chat_id)
        course_name = mapping.get("course_name") or chat_name

        if not user_id or not canonical_message_id or not source_id:
            logger.info(
                "Skipping WhatsApp batch due to missing identifiers",
                extra={"user_id": user_id, "canonical_message_id": canonical_message_id, "source_id": source_id},
            )
            return None

        duplicate = await asyncio.to_thread(notification_exists, canonical_message_id, "whatsapp", user_id)
        if duplicate:
            logger.info(
                "Duplicate WhatsApp batch skipped",
                extra={
                    "user_id": user_id,
                    "chat_id": chat_id,
                    "canonical_message_id": canonical_message_id,
                },
            )
            return None

        attachments = await process_whatsapp_attachments(media_items)
        media_context_text = extract_media_context_text(
            attachments,
            chat_name=chat_name,
            course_name=course_name,
            combined_text=combined_text,
        )
        # Also expand abbreviations in media context if generated
        expanded_media_context_text = expand_abbreviations(media_context_text, user_id) if media_context_text else ""

        has_media = bool(attachments)
        is_general_group = not is_course_specific and bool(chat_id)

        if mapped_course_id:
            course_id = mapped_course_id
            resolved_course_name = course_name
            classification_result = {
                "course_id": str(mapped_course_id),
                "course_name": resolved_course_name,
                "confidence": 1.0,
                "method": "mapped_group",
                "requires_user_confirmation": False,
            }
            logger.info(
                "WhatsApp course resolved from mapping",
                extra={"chat_id": chat_id, "course_id": str(mapped_course_id)},
            )
        else:
            classification_result = await asyncio.to_thread(
                classify_course_for_message,
                expanded_combined_text or expanded_media_context_text,
                chat_name,
                user_id,
            )
            course_id = classification_result.get("course_id")
            resolved_course_name = classification_result.get("course_name") or course_name
            if not course_id:
                logger.info(
                    "Unmapped WhatsApp group discarded after course classification",
                    extra={"chat_id": chat_id, "chat_name": chat_name},
                )
                return None

        if has_media:
            category = classify_media_message(
                attachments,
                expanded_media_context_text,
                is_course_specific=is_course_specific or bool(mapped_course_id),
                is_general_group=is_general_group,
            )
            final_text = combined_text
            final_expanded_text = expanded_combined_text or expanded_media_context_text
        else:
            # We use the already expanded text for the unified pipeline
            pipeline_result = await asyncio.to_thread(
                run_pipeline,
                expanded_combined_text,
                None,
                "whatsapp",
                None,
                user_id,
            )
            category = _safe_text(pipeline_result.get("category"))
            if category == "noise":
                logger.info(
                    "Text-only WhatsApp batch classified as noise",
                    extra={"canonical_message_id": canonical_message_id, "chat_id": chat_id},
                )
                return None
            final_text = combined_text
            final_expanded_text = expanded_combined_text

        if category == "noise":
            logger.info(
                "WhatsApp batch classified as noise",
                extra={"canonical_message_id": canonical_message_id, "chat_id": chat_id},
            )
            return None

        deadline = None
        if category in {"assignment", "quiz", "announcement", "event"}:
            deadline_source_text = expanded_media_context_text if has_media else expanded_combined_text
            deadline_candidates = await asyncio.to_thread(extract_deadlines_hybrid, deadline_source_text)
            first_deadline = None
            for deadline_candidate in deadline_candidates or []:
                if isinstance(deadline_candidate, dict):
                    first_deadline = deadline_candidate.get("deadline_date")
                    if first_deadline:
                        break
            if first_deadline:
                deadline = parse_strict_deadline_datetime(first_deadline)

        urgency_level = None
        if category in {"assignment", "quiz"} and deadline is not None:
            urgency = calculate_urgency(deadline)
            urgency_level = urgency.get("label")

        notification_id = await asyncio.to_thread(
            insert_notification,
            user_id=user_id,
            source_type="whatsapp",
            external_id=canonical_message_id,
            sender=sender_name,
            text=final_text,
            category=category,
            received_at=normalize_received_at(first_timestamp),
            course_id=course_id,
            source_ref=source_id,
            deadline=deadline,
            urgency_level=urgency_level,
            expanded_text=final_expanded_text,
        )

        if not notification_id:
            logger.warning(
                "WhatsApp notification insert returned no ID",
                extra={"canonical_message_id": canonical_message_id, "chat_id": chat_id},
            )
            return None

        logger.info(
            "WhatsApp notification inserted",
            extra={
                "notification_id": str(notification_id),
                "canonical_message_id": canonical_message_id,
                "chat_id": chat_id,
                "category": category,
                "has_media": has_media,
                "attachment_count": len(attachments),
                "deadline_found": bool(deadline),
                "urgency_level": urgency_level,
            },
        )
        return notification_id

    except Exception:
        logger.exception("Error processing buffered WhatsApp batch")
        return None


async def process_whatsapp_message(payload: dict) -> List[str]:
    """Public WhatsApp pipeline entrypoint for webhook payloads.

    The function normalizes the payload, merges related messages into the
    in-memory 30-second buffer, flushes expired batches, and returns any
    notification IDs created as a result.

    Args:
        payload: Incoming Baileys payload or the flattened FastAPI bridge payload.

    Returns:
        List of created notification UUID strings. Empty list on ignored or
        failed payloads.

    Example:
        notification_ids = await process_whatsapp_message(payload)
    """
    try:
        if isinstance(payload, list):
            created_ids: List[str] = []
            for item in payload:
                created_ids.extend(await process_whatsapp_message(item))
            return created_ids

        if not isinstance(payload, dict):
            logger.info("WhatsApp payload ignored because it is not a dictionary")
            return []

        if isinstance(payload.get("messages"), list):
            created_ids: List[str] = []
            for item in payload.get("messages") or []:
                if isinstance(item, dict):
                    created_ids.extend(await process_whatsapp_message(item))
            return created_ids

        normalized = normalize_whatsapp_payload(payload)
        if normalized.get("ignore"):
            logger.info(
                "WhatsApp payload ignored",
                extra={
                    "message_id": normalized.get("message_id"),
                    "chat_id": normalized.get("chat_id"),
                    "reason": normalized.get("ignore_reason"),
                },
            )
            return []

        mapping = await get_whatsapp_source_mapping(
            _safe_text(normalized.get("user_id")),
            _safe_text(normalized.get("chat_id")),
        )
        normalized["chat_name"] = normalized.get("chat_name") or mapping.get("course_name") or normalized.get("chat_id")

        expired_batches = await buffer_whatsapp_message(normalized, mapping)
        created_ids: List[str] = []

        for batch in expired_batches:
            notification_id = await process_buffered_batch(batch)
            if notification_id:
                created_ids.append(str(notification_id))

        flushed_ids = await _flush_expired_buffers_collect()
        created_ids.extend(flushed_ids)

        logger.info(
            "WhatsApp payload processed",
            extra={
                "message_id": normalized.get("message_id"),
                "chat_id": normalized.get("chat_id"),
                "created_count": len(created_ids),
            },
        )
        return created_ids

    except Exception:
        logger.exception("Unhandled WhatsApp processing error")
        raise
