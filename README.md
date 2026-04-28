# AcadPulse — Unified Student Assistant

A smart dashboard that aggregates academic notifications from WhatsApp,
Gmail, and Google Classroom into one place.

## Stack
- **Frontend:** React
- **Backend:** FastAPI (Python)
- **WhatsApp:** Node.js + Baileys
- **AI:** XLM-RoBERTa (classifier) + Groq LLaMA (deadline extraction, chatbot)
- **Database:** PostgreSQL

## Structure
acadpulse/
├── frontend/      React app
├── backend/       FastAPI backend
├── whatsapp/      Node.js Baileys integration
├── ai/
│   ├── classifier/   Fine-tuning scripts
│   └── dataset/      Training data (gitignored)
└── docs/          API contracts, schema, notes