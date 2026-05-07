"""
AcadPulse Attachment Pipeline
==============================
Handles attachment persistence for all three sources:

  Gmail     -> saves original Google Drive/Gmail link as file_path. No download.
  Classroom -> saves original Classroom/Drive link as file_path. No download.
  WhatsApp  -> receives base64 bytes already in the payload (downloaded by
               index.js), uploads to Supabase Storage, saves internal storage
               path as file_path. Signed URLs are generated on-demand at fetch
               time, never stored in the database.

Environment variables (in backend/.env):
  SUPABASE_URL               e.g. https://xyz.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  service-role secret (not anon key)
  SUPABASE_STORAGE_BUCKET    defaults to "attachments"
"""

import base64
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)

SUPABASE_URL: str = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET") or "attachments"


# ── Section 1: Supabase Storage helpers ───────────────────────────────────────

def _supabase_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }


def upload_to_supabase(storage_path: str, file_bytes: bytes, mime_type: str) -> bool:
    """Upload raw bytes to the private Supabase Storage bucket.

    Args:
        storage_path: Path inside bucket, e.g. "attachments/user123/notif456/file.pdf"
        file_bytes:   Raw file content.
        mime_type:    MIME type, e.g. "application/pdf".

    Returns:
        True on success, False on any error.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("Supabase not configured — skipping upload for %s", storage_path)
        return False

    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    headers = {
        **_supabase_headers(),
        "Content-Type": mime_type or "application/octet-stream",
    }
    try:
        response = httpx.put(url, content=file_bytes, headers=headers, timeout=30)
        if response.status_code in {200, 201}:
            logger.info("Uploaded to Supabase: %s (%d bytes)", storage_path, len(file_bytes))
            return True
        logger.warning(
            "Supabase upload failed %s — HTTP %d: %s",
            storage_path, response.status_code, response.text[:200],
        )
        return False
    except Exception as exc:
        logger.warning("Supabase upload exception for %s: %s", storage_path, exc)
        return False


def create_signed_url(storage_path: str, expires_in: int = 3600) -> Optional[str]:
    """Generate a temporary signed URL for a private Supabase Storage object.

    Args:
        storage_path: Internal path, e.g. "attachments/user123/notif456/file.pdf"
        expires_in:   Seconds until the URL expires. Default is 1 hour.

    Returns:
        A ready-to-use HTTPS URL, or None on failure.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None

    url = f"{SUPABASE_URL}/storage/v1/object/sign/{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    try:
        response = httpx.post(
            url,
            json={"expiresIn": expires_in},
            headers=_supabase_headers(),
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            signed_url = data.get("signedURL") or data.get("signedUrl")
            if signed_url:
                if signed_url.startswith("/"):
                    return SUPABASE_URL + signed_url
                return signed_url
        logger.warning(
            "Signed URL failed for %s — HTTP %d: %s",
            storage_path, response.status_code, response.text[:200],
        )
        return None
    except Exception as exc:
        logger.warning("Signed URL exception for %s: %s", storage_path, exc)
        return None


# ── Section 2: Helper to get notification metadata ────────────────────────────

def _get_notification_meta(notification_id) -> Optional[Dict[str, Any]]:
    """Fetch source_type and user_id for a notification row.
    Used to determine which handler to use and to build the Supabase path.
    """
    from db import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT source_type, user_id FROM notifications WHERE id = %s LIMIT 1;",
            (str(notification_id),),
        )
        row = cur.fetchone()
        return {"source_type": row[0], "user_id": str(row[1])} if row else None
    except Exception as exc:
        logger.warning("Could not fetch notification meta for %s: %s", notification_id, exc)
        return None
    finally:
        cur.close()
        conn.close()


# ── Section 3: Per-source processors ──────────────────────────────────────────

def _handle_gmail_attachment(attachment: Dict[str, Any], notification_id) -> None:
    """Gmail: save the Google Drive/Gmail link. No download needed."""
    from db import insert_attachment
    file_name = attachment.get("filename") or "attachment"
    file_type = attachment.get("file_type") or ""
    file_path = attachment.get("attachment_id") or ""
    if not file_path:
        logger.debug("Gmail attachment has no link, skipping: %s", file_name)
        return
    insert_attachment(notification_id, file_name, file_path, file_type)
    logger.info("Saved Gmail attachment link: %s", file_name)


def _handle_classroom_attachment(attachment: Dict[str, Any], notification_id) -> None:
    """Classroom: save the Classroom/Drive link. No download needed."""
    from db import insert_attachment
    file_name = attachment.get("filename") or "attachment"
    file_type = attachment.get("file_type") or ""
    file_path = attachment.get("attachment_id") or ""
    if not file_path:
        logger.debug("Classroom attachment has no link, skipping: %s", file_name)
        return
    insert_attachment(notification_id, file_name, file_path, file_type)
    logger.info("Saved Classroom attachment link: %s", file_name)


async def _handle_whatsapp_attachment(
    attachment: Dict[str, Any],
    notification_id,
    user_id: str,
) -> None:
    """WhatsApp: bytes already downloaded by index.js and sent as base64 in
    the attachment dict under the key 'media_data'. Upload to Supabase and
    save the internal storage path.

    Storage path format:
        attachments/{user_id}/{notification_id}/{file_name}

    If bytes are missing (download failed on Node side), the row is still
    saved with an empty file_path so the metadata record is not lost.
    """
    from db import insert_attachment

    file_name = (
        attachment.get("filename") or attachment.get("file_name") or "attachment"
    ).replace(" ", "_")
    file_type = (
        attachment.get("file_type") or attachment.get("mime_type") or "application/octet-stream"
    )
    media_data_b64 = attachment.get("media_data") or ""

    storage_path = ""

    if media_data_b64:
        try:
            file_bytes = base64.b64decode(media_data_b64)
            storage_path = f"attachments/{user_id}/{notification_id}/{file_name}"
            uploaded = upload_to_supabase(storage_path, file_bytes, file_type)
            if not uploaded:
                storage_path = ""
                logger.warning("Upload failed for %s, saving metadata only", file_name)
            else:
                logger.info("WhatsApp media uploaded: %s -> %s", file_name, storage_path)
        except Exception as exc:
            storage_path = ""
            logger.warning("Error processing WhatsApp bytes for %s: %s", file_name, exc)
    else:
        logger.info("No media bytes for %s, saving metadata only", file_name)

    insert_attachment(notification_id, file_name, storage_path, file_type)


# ── Section 4: get_attachment_url — the ONE function frontend calls via API ────

def get_attachment_url(file_path: str) -> Optional[str]:
    """Convert a stored file_path into a ready-to-use URL.

    This is the single function main.py uses when building the attachment
    response for the frontend. The frontend developer never needs to know
    anything about Supabase, signed URLs, or source types.

    How it works:
    - WhatsApp attachments have a file_path like "attachments/user/notif/file.pdf"
      (an internal Supabase path). This function calls create_signed_url() and
      returns a fresh temporary HTTPS link valid for 1 hour.
    - Gmail and Classroom attachments have a file_path that is already a Google
      URL (https://drive.google.com/... or https://mail.google.com/...).
      This function returns it directly — no signing needed.
    - Empty path returns None (attachment bytes were not available).

    Args:
        file_path: The value stored in attachments.file_path column.

    Returns:
        A ready-to-use URL string, or None if unavailable.
    """
    if not file_path:
        return None
    if file_path.startswith("attachments/"):
        # WhatsApp — internal Supabase path, needs a signed URL
        return create_signed_url(file_path)
    # Gmail / Classroom — already a usable Google URL
    return file_path


# ── Section 5: Public entrypoint (called by all three pipelines) ───────────────

async def process_attachments_stub(attachments: list, notification_id) -> None:
    """Process and persist attachments for any pipeline.

    Called by gmail_pipeline, classroom_pipeline, and whatsapp_pipeline
    immediately after insert_notification(). Detects source type from the
    DB row and routes to the correct handler.

    Args:
        attachments:     List of attachment metadata dicts from the pipeline.
        notification_id: UUID of the parent notification (already in DB).

    Returns:
        None. All errors are logged and swallowed — the pipeline never fails
        because of an attachment error.
    """
    if not attachments or not notification_id:
        return

    try:
        notif = _get_notification_meta(notification_id)
        if not notif:
            logger.warning("Notification %s not found, skipping attachments", notification_id)
            return

        source_type = (notif.get("source_type") or "").lower()
        user_id = notif.get("user_id") or "unknown"

        for attachment in attachments:
            try:
                if source_type == "gmail":
                    _handle_gmail_attachment(attachment, notification_id)
                elif source_type == "classroom":
                    _handle_classroom_attachment(attachment, notification_id)
                elif source_type == "whatsapp":
                    await _handle_whatsapp_attachment(attachment, notification_id, user_id)
                else:
                    from db import insert_attachment
                    insert_attachment(
                        notification_id,
                        attachment.get("filename") or attachment.get("file_name") or "attachment",
                        attachment.get("attachment_id") or attachment.get("file_path") or "",
                        attachment.get("file_type") or "",
                    )
            except Exception as exc:
                logger.warning(
                    "Error on attachment for notification %s: %s", notification_id, exc,
                )

    except Exception as exc:
        logger.warning("process_attachments_stub failed for %s: %s", notification_id, exc)