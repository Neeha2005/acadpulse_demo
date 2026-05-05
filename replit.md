# AcadPulse

A smart student dashboard that aggregates academic notifications from WhatsApp, Gmail, and Google Classroom into one unified interface with AI-powered classification and deadline extraction.

## Run & Operate

- **Frontend workflow:** `cd frontend && npm run dev` → port 5000 (webview)
- **Backend workflow:** `cd backend && python -m uvicorn main:app --host localhost --port 8000 --reload` → port 8000 (console)
- **Required env vars** (in `backend/.env`):
  - `GROQ_API_KEY` — from groq.com
  - `GROQ_MODEL` — e.g. `llama-3.1-8b-instant`
  - `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` — Supabase PostgreSQL credentials
  - `DB_SSLMODE` — `require` for Supabase, `prefer` for local (default: `prefer`)
  - `JWT_SECRET_KEY` — secret for JWT token signing
  - `FRONTEND_URL` — frontend base URL for CORS/redirects

## Stack

- **Frontend:** React 19 + Vite 8, React Router v7, lucide-react icons
- **Backend:** FastAPI + Uvicorn (Python 3.12), python-jose for JWT auth, bcrypt, psycopg2-binary
- **AI:** Groq LLaMA (deadline extraction + chatbot), XLM-RoBERTa classifier (optional local)
- **WhatsApp:** Node.js + Baileys (separate service in `whatsapp/`)
- **Database:** PostgreSQL (Supabase hosted)
- **ORM:** Raw psycopg2 with RealDictCursor

## Where things live

- `frontend/src/context/AppContext.jsx` — global state and API_BASE_URL
- `frontend/src/pages/` — all page components
- `backend/main.py` — FastAPI app (~4000 lines), all routes
- `backend/db.py` — all DB queries
- `backend/whatsapp_pipeline.py` — WhatsApp message processing
- `backend/.env.example` — environment variable template

## Architecture decisions

- Backend always runs on `localhost:8000`; frontend on `0.0.0.0:5000`
- CORS allows Replit proxy domains via regex pattern
- `DB_SSLMODE` is configurable (Supabase requires `require`, local prefers `prefer`)
- JWT auth with 7-day token expiry; tokens stored in localStorage on frontend
- WhatsApp integration is a separate Node.js process that POSTs to the FastAPI backend

## Product

- Unified notification inbox from WhatsApp groups, Gmail, and Google Classroom
- AI chatbot for deadline queries and task management (Roman Urdu support)
- Automatic urgency scoring based on deadline proximity
- Course mapping from WhatsApp group names to registered courses
- Onboarding flow for new student registration

## User preferences

_Populate as you build_

## Gotchas

- Backend requires Supabase credentials to function fully — without them, API starts but all DB endpoints return 500
- `sslmode=require` needed for Supabase; set `DB_SSLMODE=require` in `backend/.env`
- WhatsApp service (`whatsapp/`) is not configured as a workflow — run it manually when needed
- The `ai/` classifier directory contains training scripts only, not a running service

## Pointers

- API docs: `http://localhost:8000/docs` (FastAPI auto-docs)
- Backend env template: `backend/.env.example`
- Commands reference: `commands.md`
