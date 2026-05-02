# AcadPulse Backend Project Changelog

## Scope
This document summarizes major backend changes, upgrades, and integrations implemented in the current project phase.

Date: 2026-05-02
Primary focus: unified ingestion and notification pipeline across Gmail, Google Classroom, and WhatsApp.

---

## 1. High-Level Improvements

### Unified ingestion architecture
- Standardized notification processing flow across multiple sources.
- Reused shared pipeline logic where possible instead of duplicating behavior.
- Preserved schema compatibility with the existing notifications table.

### Multi-source support
- Gmail ingestion upgraded with richer message processing.
- Google Classroom ingestion upgraded to production-style processing.
- WhatsApp ingestion rebuilt as modular async pipeline with buffering.

### Reliability and maintainability
- Added robust error handling and structured logging around ingestion stages.
- Improved retry/fallback behavior reuse through existing helpers.
- Kept endpoint contracts stable while upgrading internals.

---

## 2. Gmail Pipeline Upgrades

### Files touched
- backend/main.py
- backend/requirements.txt
- backend/GMAIL_CHANGELOG.md

### New/updated Gmail behavior
- Added async function classify_with_fallback(text).
  - Classification order: Hugging Face Inference API -> Groq fallback -> keyword stub.
  - Expected label set: announcement, assignment, event, quiz, noise.
- Added async function process_gmail_message(user_id, gmail_message).
  - Extracts message metadata, subject, sender, body, snippet, attachments metadata.
  - Skips no-reply@classroom.google.com messages to avoid duplication overlap.
  - Runs deduplication before insertion.
  - Reuses existing course mapping and deadline/urgency flow.
- Updated /gmail/fetch endpoint to call process_gmail_message per message.
  - Endpoint now returns aggregate processed IDs and counts.

### Gmail-specific notes
- Attachment handling currently stores metadata in memory/log context only.
- Attachment persistence remains marked as TODO.

---

## 3. Google Classroom Pipeline Upgrades

### Files touched
- backend/main.py

### New/updated Classroom behavior
- Upgraded /classroom/fetch internals (no new endpoint created).
- Added deterministic classifier for Classroom resources:
  - classify_classroom_resource(text, resource_type, work_type, has_attachments)
- Added Classroom attachment metadata helper:
  - extract_classroom_attachment_metadata(materials)
- Added async resource processor:
  - process_classroom_resource(user_id, resource, resource_type, local_course_id, course_name)

### Resource handling
- Processes ACTIVE courses only.
- Fetches and ingests:
  - announcements
  - coursework
  - courseWorkMaterials
- Explicitly skips coursework question types where configured.

### Category/deadline/urgency behavior
- Uses deterministic mapping first for assignment/quiz/material-sensitive handling.
- Uses shared classifiers/fallbacks where needed.
- Uses structured dueDate/dueTime when available.
- Falls back to hybrid text deadline extraction when needed.
- Updates urgency for deadline-bearing assignment/quiz notifications.

---

## 4. WhatsApp Production Pipeline Integration

### Files touched
- backend/whatsapp_pipeline.py (new)
- backend/main.py
- backend/db.py (minimal compatibility updates)

### New module
- Created modular WhatsApp pipeline in backend/whatsapp_pipeline.py.
- Public entrypoint:
  - process_whatsapp_message(payload) -> list[str]

### Core WhatsApp pipeline components
Implemented functions:
- normalize_whatsapp_payload(payload)
- get_whatsapp_source_mapping(user_id, chat_id)
- buffer_whatsapp_message(normalized_payload, mapping)
- flush_expired_buffers()
- process_buffered_batch(batch)
- classify_media_message(media_items, combined_text, ...)
- extract_media_context_text(media_items, ...)
- process_whatsapp_attachments(media_items)
- process_whatsapp_message(payload)

### Buffering and merge behavior
- Added in-memory async buffer keyed by:
  - (user_id, chat_id, sender_phone)
- Uses asyncio.Lock for thread-safe concurrent updates.
- Buffer window: 30 seconds (configurable via env).
- Merges related text/media into a single batch.
- Uses canonical message ID = first message ID in batch.
- Produces one notification per flushed batch.

### Filtering/ignore behavior
Silently discards unsupported/invalid events such as:
- self messages
- status broadcasts
- protocol/system payloads
- empty content
- revoked messages
- sticker-only messages

### Classification behavior
- Text-only batch:
  - Reuses shared run_pipeline where possible.
- Media batch:
  - Uses deterministic media classifier (no raw media sent to text model).
  - Uses caption/file metadata/context text for classification.

### Deadline and urgency behavior
- Deadline extraction for category set:
  - assignment, quiz, announcement, event
- Reuses extract_deadlines_hybrid for text/context parsing.
- Urgency level is derived when deadline exists for assignment/quiz.

### Endpoint integration
- /messages/incoming now delegates to process_whatsapp_message(payload).
- Returns:
  - success
  - notifications_created (list of IDs)
  - count
- API behavior remains stable while internals are upgraded.

### Background flusher integration
- Startup hook now starts WhatsApp buffer flusher.
- Shutdown hook now stops flusher safely.

---

## 5. Database Helper Updates

### File touched
- backend/db.py

### Changes
- insert_notification(...) updated to accept optional urgency_level argument.
  - Persists urgency_level at insert time when provided.
- notification_exists(...) updated to support optional user_id scope.
  - Backward-compatible behavior retained when user_id is not passed.

### Compatibility
- Existing callers continue working with default params.
- New WhatsApp deduplication uses user-scoped check path.

---

## 6. Dependency Updates

### File touched
- backend/requirements.txt

### Added/confirmed packages
- dateparser
- pytz
- rapidfuzz

These support hybrid deadline extraction, timezone handling, and fuzzy classification.

---

## 7. Shared Logic Reuse Summary

The following existing project functions/helpers were reused in upgraded pipelines:
- run_pipeline
- classify_course_for_message
- extract_deadlines_hybrid
- calculate_urgency
- notification_exists
- insert_notification
- normalize_received_at
- normalize_text

Design goal achieved: maximize reuse and avoid redundant reimplementation.

---

## 8. Operational Notes

### Google API auth prerequisites
- Gmail/Classroom ingestion requires backend/credentials.json and valid OAuth flow.
- token.json lifecycle applies after first successful auth.

### Logging and observability
- Added stage-level logging in key pipeline steps:
  - payload normalized
  - source resolved
  - buffered
  - flushed
  - classified
  - dedup skipped
  - inserted

### Current known TODO
- Attachments persistence is still metadata-only for now.
  - Upload/storage DB integration is intentionally deferred.

---

## 9. Verification Status

- Static diagnostics for modified files reported no errors after fixes:
  - backend/main.py
  - backend/whatsapp_pipeline.py
  - backend/db.py

- Runtime behavior still depends on environment readiness:
  - DB credentials
  - Google OAuth files
  - API keys

---

## 10. Quick Reference: Major Added Symbols

### In backend/main.py
- classify_with_fallback
- process_gmail_message
- classify_classroom_resource
- extract_classroom_attachment_metadata
- process_classroom_resource
- async /classroom/fetch integration updates
- async /messages/incoming delegation updates

### In backend/whatsapp_pipeline.py
- normalize_whatsapp_payload
- get_whatsapp_source_mapping
- buffer_whatsapp_message
- flush_expired_buffers
- process_buffered_batch
- classify_media_message
- extract_media_context_text
- process_whatsapp_attachments
- process_whatsapp_message
- start_whatsapp_buffer_flusher
- stop_whatsapp_buffer_flusher

### In backend/db.py
- insert_notification(..., urgency_level=None)
- notification_exists(..., user_id=None)

---

## 11. Outcome

The backend now has a more consistent, production-oriented ingestion layer across Gmail, Classroom, and WhatsApp while preserving existing API surfaces and schema compatibility.
