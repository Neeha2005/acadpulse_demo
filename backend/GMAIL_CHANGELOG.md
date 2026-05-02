# Gmail Ingestion Pipeline — Implementation Summary

This file documents the Gmail ingestion feature added to the AcadPulse backend, including pipeline implementation, integration, dependencies, and current status.

## Files Modified
- `backend/main.py` — added `classify_with_fallback()`, `process_gmail_message()`, wired `/gmail/fetch` endpoint
- `backend/requirements.txt` — added `dateparser`, `pytz`, `rapidfuzz`
- **Status:** No errors found in static validation (via get_errors tool)

## Architecture Overview
The Gmail ingestion pipeline is a multi-stage processing chain:
1. **Fetch** — `/gmail/fetch` endpoint retrieves Gmail messages via Google API
2. **Per-message processing** — each message is passed to `process_gmail_message()`
3. **Classification** — HF Inference API → Groq LLM → keyword stub fallback
4. **Course mapping** — exact/fuzzy/LLM multi-stage classifier
5. **Deduplication** — checks if message already exists in DB
6. **Storage** — inserts into `notifications` table via `insert_notification()`
7. **Pipeline** — runs deadline extraction and urgency computation
8. **Persistence** — saves to DB; attachments metadata collected but not persisted (TODO)

## New Functions

### 1. `async def classify_with_fallback(text: str) -> str`
- **Purpose:** Classify academic text using HF Inference API first, then Groq LLM, finally keyword classifier.
- **Input:** cleaned email text (subject + body)
- **Output:** one of `['announcement', 'assignment', 'event', 'quiz', 'noise']`
- **Fallback chain:**
  - Hugging Face Inference API (if `HF_MODEL_NAME` & `HF_TOKEN` set; score threshold 0.75)
  - Groq LLM (via `call_groq_with_retry`)
  - Keyword-based `classifier_stub()` (final fallback)
- **Logs:** warnings for HF/Groq errors; silently falls back to next stage

### 2. `async def process_gmail_message(user_id: uuid.UUID, gmail_message: dict) -> Optional[uuid.UUID]`
- **Purpose:** Complete Gmail message processing: extraction → classification → course mapping → dedup → insert → pipeline.
- **Inputs:**
  - `user_id` — UUID of owning user
  - `gmail_message` — full Gmail API message object (format='full')
- **Steps:**
  1. Extract fields: `id`, `threadId`, `internalDate`, `payload.headers` (Subject, From, Date), snippet
  2. Decode body via `decode_gmail_body()` (handles multipart, MIME types, HTML sanitization)
  3. Extract attachments metadata (filename, file_type, attachment_id, file_size) — no download
  4. **Skip Classroom emails:** if From is `no-reply@classroom.google.com`, return None
  5. **Classification:** build text as `subject + "\n\n" + body_or_snippet`, call `classify_with_fallback()`
  6. **Silent discard:** if category is `noise`, log and return None
  7. **Course mapping:** reuse `classify_course_for_message()` (exact → fuzzy → LLM stages)
  8. **Deduplication:** call `get_notification_id_by_source(msg_id, "gmail")`, skip if exists
  9. **Insert:** call `insert_notification()` with all extracted fields (deadline=None initially)
  10. **Pipeline:** call `run_pipeline()` to extract deadlines, compute urgency, update DB
  11. **Return:** notification_id if inserted, None if skipped
- **Logging:** INFO level for skipped (Classroom, noise, duplicate), WARNING for errors
- **TODO:** attachment persistence to `attachments` table (awaiting insertion helper)

### 3. Endpoint: `@app.get("/gmail/fetch")`
- **Made async** to support concurrent message processing
- **Parameters:** `max_results: int = 10` (max messages to fetch per call)
- **Flow:**
  1. Get Google credentials via `get_google_credentials_safe()`
  2. Build Gmail API service
  3. List messages from INBOX with `maxResults`
  4. For each message, fetch full message object (format='full')
  5. Call `await process_gmail_message()` for each
  6. Collect processed notification IDs
- **Returns:** `{"status": "success", "total_fetched": int, "new_notifications_saved": int, "processed_notifications": [ids]}`
- **Error handling:** re-raises Google Auth errors via `get_google_credentials_safe()`

## Integration with Existing Components
- **DB Helpers:** reuse `insert_notification()`, `get_notification_id_by_source()`, `update_notification_deadline()`, `update_notification_urgency()`, `get_or_create_user()`
- **Pipelines:** reuse `run_pipeline()` (shared by WhatsApp, Classroom, Gmail)
- **Course classifier:** reuse `classify_course_for_message()` (3-stage: exact → fuzzy → LLM)
- **Deadline extraction:** reuse `extract_deadlines_hybrid()` (patterns + dateparser + Groq fallback)
- **Groq integration:** reuse `call_groq_with_retry()` with token tracking and daily limits

## Dependencies Added to `requirements.txt`
- `dateparser>=1.1.1` — natural language date parsing (e.g., "next Friday")
- `pytz>=2024.1` — timezone handling for Pakistan time
- `rapidfuzz>=2.16.1` — fuzzy string matching for course classification

## Environment Variables
- `HF_MODEL_NAME` — Hugging Face model ID (optional; if missing, skips HF and uses Groq)
- `HF_TOKEN` — Hugging Face Inference API token (optional; required if `HF_MODEL_NAME` set)
- `GROQ_API_KEY` — Groq API key (required; existing)
- Database env vars (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT) — required for insert operations

## Validation Status
- **Static checks:** No errors (verified via `get_errors` tool)
- **Type hints:** fully annotated; async/await used correctly
- **Integration:** ready for runtime testing

## Runtime Requirements Before First Call
1. **Google OAuth credentials:** Save `backend/credentials.json` (download from Google Cloud Console)
2. **Gmail API enabled** in Google Cloud project
3. **Groq API key** set in `.env`
4. **Database configured** and connected (PostgreSQL with Supabase or local)
5. Optionally: HF credentials if using HF classification

## Testing & Verification Steps
1. **Server health:**
   ```
   Invoke-RestMethod http://127.0.0.1:8000/test
   ```
2. **Deadline extraction (no DB/Gmail needed):**
   ```
   curl -X POST http://127.0.0.1:8000/deadlines/extract \
     -H "Content-Type: application/json" \
     -d '{"text":"Submit report by next Friday"}'
   ```
3. **WhatsApp pipeline (tests run_pipeline without Gmail):**
   ```
   curl -X POST http://127.0.0.1:8000/messages/incoming \
     -H "Content-Type: application/json" \
     -d '{"text":"Assignment due tomorrow", "sender":"prof@example.com", ...}'
   ```
4. **Gmail fetch (requires credentials.json + DB):**
   ```
   Invoke-RestMethod http://127.0.0.1:8000/gmail/fetch
   ```
   On first run: opens OAuth consent browser flow, creates `token.json`

## Known Limitations / TODOs
- **Attachment persistence:** metadata collected but not inserted to `attachments` table (awaiting insertion helper)
- **Classroom email skip:** hardcoded check for `no-reply@classroom.google.com`; may need updates if Google changes this address
- **Placeholder user:** `/gmail/fetch` creates/uses "Default Student" user; should be tied to authenticated user in production

## Next Steps
1. Provide `backend/credentials.json` (Google OAuth client secret)
2. Run `/gmail/fetch` to trigger OAuth flow and test end-to-end
3. Verify notifications inserted into DB with correct deadlines/urgency
4. If needed: enable attachment persistence (add DB helper for `attachments` table)
5. Add HF classification credentials if using Hugging Face models

---
**Last Updated:** May 2, 2026  
**Status:** Ready for runtime testing (awaiting Google OAuth credentials)
