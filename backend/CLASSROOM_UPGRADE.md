# Classroom Pipeline Upgrade — Production Integration

This file documents the upgrade of the Google Classroom fetch pipeline to use the same production-grade infrastructure as Gmail and WhatsApp.

## Overview
The `/classroom/fetch` endpoint has been completely refactored to:
- Reuse all existing helpers (no duplicate logic)
- Support all 5 notification categories (announcement, assignment, quiz, material, event)
- Implement deterministic classification for Classroom-specific "material" category
- Multi-stage fallback for ambiguous resources (deterministic → HF → Groq → fallback)
- Extract deadlines from structured fields and text
- Calculate urgency for deadline-bearing resources
- Use unified DB insertion and deduplication logic

## New Functions

### 1. `def classify_classroom_resource(text, resource_type, work_type, has_attachments) -> str`
**Purpose:** Deterministic classifier for Classroom resources supporting all 5 categories.

**Why deterministic is critical:** The existing Hugging Face model does NOT support the "material" category. Classroom resources must be classified locally before attempting HF.

**Classification stages:**
1. **Native mapping:** QUIZ_ASSIGNMENT → `quiz`, ASSIGNMENT → `assignment`
2. **Keyword matching:** Extract announcements, assignments, quizzes, events, materials from text
3. **Attachment heuristic:** If has_attachments and no other signals → `material`
4. **Final fallback:** `announcement`

**Returns:** one of `['announcement', 'assignment', 'quiz', 'material', 'event']`

### 2. `def extract_classroom_attachment_metadata(materials) -> list`
**Purpose:** Extract attachment metadata from Classroom materials (Drive files, links, videos).

**Normalized output:** matches Gmail attachment structure:
- filename
- file_type
- attachment_id
- file_size (Classroom API does not provide; set to None)

**Supports:**
- Google Drive files
- URLs/links
- YouTube videos

### 3. `async def process_classroom_resource(user_id, resource, resource_type, local_course_id, course_name) -> Optional[UUID]`
**Purpose:** Full production pipeline for a single Classroom resource.

**Input:**
- `user_id` — UUID of owning user
- `resource` — Classroom API object (announcement, courseWork, or courseWorkMaterial)
- `resource_type` — type: "announcement", "courseWork", or "courseWorkMaterial"
- `local_course_id` — optional UUID linking to course in DB
- `course_name` — course name for sender field

**Process flow:**
1. Extract and normalize resource fields (title, description, body, timestamps)
2. Extract attachments metadata
3. Deduplicate using `get_notification_id_by_source()`
4. Classify using 4-stage pipeline:
   - Stage 1: `classify_classroom_resource()` (deterministic, supports all 5 categories)
   - Stage 2: `classify_with_fallback()` (HF Inference API → Groq → stub; ignores noise)
   - Stage 3: N/A (deterministic + HF sufficient)
   - Stage 4: Fallback to attachment presence or announcement
5. Extract deadline:
   - For assignments/quizzes: use structured `dueDate`/`dueTime` if present
   - Fallback: `extract_deadlines_hybrid()` for text-based deadline hints
   - Materials: deadline always None
6. Insert into DB via `insert_notification()`
7. Calculate urgency for assignments/quizzes with deadline
8. Log resource processing

**Returns:** notification_id if inserted, None if skipped

**Reuses:** 
- `get_notification_id_by_source()` — deduplication
- `insert_notification()` — DB insertion
- `parse_structured_classroom_due_date()` — deadline parsing
- `extract_deadlines_hybrid()` — text deadline extraction
- `calculate_urgency()` — urgency computation
- `update_notification_urgency()` — urgency persistence
- `classify_with_fallback()` — secondary classification
- `normalize_received_at()` — timestamp normalization

### 4. Updated Endpoint: `@app.get("/classroom/fetch")`
**Made async** to support concurrent message processing.

**Fetch behavior:**
- Fetch only ACTIVE courses (via `courseStates=["ACTIVE"]`)
- For each course, fetch:
  - Announcements
  - CourseWork (excluding SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION)
  - CourseWorkMaterials
- Pass each resource to `process_classroom_resource()`
- Aggregate stats and skip counters

**Returns:**
```json
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
```

## Integration Points

### Reused Infrastructure
- **DB helpers:** `insert_notification()`, `get_notification_id_by_source()`, `get_or_create_user()`, `update_notification_urgency()`
- **Classification:** `classify_with_fallback()` (HF → Groq → stub)
- **Deadline extraction:** `extract_deadlines_hybrid()` (patterns + dateparser + Groq)
- **Urgency:** `calculate_urgency()`
- **API utilities:** `execute_google_api_call()`, `get_google_credentials_safe()`
- **Normalization:** `normalize_received_at()`, `parse_structured_classroom_due_date()`

### Category Support
Only these 5 categories:
- `announcement` — default for general notifications
- `assignment` — coursework with workType="ASSIGNMENT"
- `quiz` — coursework with workType="QUIZ_ASSIGNMENT"
- `material` — course materials, Drive files, links, videos
- `event` — detected via keyword matching

### Explicitly Ignored
- Question types (SHORT_ANSWER_QUESTION, MULTIPLE_CHOICE_QUESTION)
- Private student messages
- Archived courses (only ACTIVE fetched)
- Classroom's own internal duplicate emails (no-reply@classroom.google.com)

## Validation Status
- **Static checks:** No errors (verified via `get_errors` tool)
- **Integration:** Fully compatible with existing Gmail and WhatsApp pipelines
- **Type hints:** Async/await properly used; type annotations complete

## Testing & Verification
1. **Server health:**
   ```
   Invoke-RestMethod http://127.0.0.1:8000/test
   ```

2. **Full Classroom sync (requires Google OAuth credentials):**
   ```
   Invoke-RestMethod http://127.0.0.1:8000/classroom/fetch
   ```

3. **Verify DB (check inserted notifications):**
   ```sql
   SELECT id, source_type, category, deadline, urgency_level, received_at 
   FROM notifications 
   WHERE source_type = 'classroom'
   ORDER BY created_at DESC LIMIT 10;
   ```

## Known Behaviors
- **Placeholder user:** Classroom fetch creates/uses "Default Student"; should be tied to authenticated user in production
- **Attachment persistence:** Metadata collected but not inserted to `attachments` table (awaiting insertion helper)
- **Course linking:** `local_course_id` optional; current implementation does not link to DB courses
- **Question types skipped:** SHORT_ANSWER_QUESTION and MULTIPLE_CHOICE_QUESTION are explicitly ignored (not notification-worthy)

## Comparison with Previous Implementation

| Aspect | Old | New |
|--------|-----|-----|
| Category logic | keyword stub only | 4-stage (deterministic → HF → Groq → fallback) |
| Material support | Hardcoded "material" | Deterministic keyword matching |
| HF classifier | Not used | Used as Stage 2 (ignoring noise) |
| Deadline extraction | Structured only | Structured + hybrid text extraction |
| Urgency calculation | Not implemented | Full urgency scoring for assignments/quizzes |
| Deduplication | Manual `get_notification_id_by_source()` | Reused same logic as Gmail |
| Attachment metadata | String concatenation | Structured extraction (Drive, links, videos) |
| Code reuse | Minimal | Maximal (no duplicate logic) |
| Error handling | print() statements | Proper logging with `logger` |
| Async support | None | Full async for concurrent processing |

## Next Steps
1. Test `/classroom/fetch` end-to-end with Google Classroom OAuth credentials
2. Verify notifications inserted with correct categories, deadlines, and urgency
3. Monitor logs for classification accuracy
4. If needed: add DB helper for attachment persistence
5. Consider tying fetch to authenticated user (not placeholder)

---
**Date:** May 2, 2026  
**Status:** Ready for testing (awaiting Google OAuth credentials)  
**Compatibility:** Fully integrated with Gmail, WhatsApp, and unified notification system
