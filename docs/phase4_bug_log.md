# Phase 4 Bug Log

Date: 2026-05-05

## Fixed

- Gmail ingestion inserted notifications but did not call the shared `run_pipeline()` path. Fixed by adding a category override to `run_pipeline()` and calling it from `process_gmail_message()`.
- WhatsApp FastAPI webhook returned `success: true` even when an unexpected processing exception happened. Fixed so `/messages/incoming` now returns HTTP 500 with `success: false`, allowing the Node bridge to retry.
- Node bridge retried failed FastAPI deliveries but silently dropped messages after max retries. Fixed by logging dropped message IDs after the retry limit.

## Verification Needed On Local Machine

- Gmail end-to-end fetch requires valid `backend/credentials.json`, `backend/token.json`, and Gmail API access.
- Classroom end-to-end fetch requires Google Classroom API access on the same OAuth token.
- Chatbot CRUD verification requires `GROQ_API_KEY` and the database schema migrations applied.
- WhatsApp dashboard verification depends on the backend process running long enough for the 30-second WhatsApp message buffer to flush.

## Commands

```powershell
cd D:\Acadpulse\acadpulse\backend
.\.venv\Scripts\python.exe .\test_phase4_integrations.py
```

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/messages/incoming -ContentType "application/json" -Body '{"user_id":"1","message_id":"manual-wa-smoke-1","chat_id":"manual-smoke@g.us","chat_name":"FAST NLP Group","sender_phone":"923000000000","sender_name":"Tester","timestamp":"2026-05-05T12:00:00Z","text":"NLP assignment due tomorrow at 5pm","is_group":true,"is_from_me":false}'
```
