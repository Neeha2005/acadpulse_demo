# AcadPulse WhatsApp Service

Read-only WhatsApp listener for AcadPulse. Each user links their own WhatsApp number through WhatsApp Web; the service listens for new group messages and forwards them to FastAPI at `/messages/incoming`.

## Safety Rules

- Keep `syncFullHistory: false`.
- Never send self-notification messages from this service.
- Never commit `sessions/`, `auth/`, `auth_info/`, queue files, or `.env`.
- Use a test number during development.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Open WhatsApp on your phone, go to Linked Devices, and scan the QR code printed in the terminal.

## Environment

```env
FASTAPI_URL=http://localhost:8000
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_USER_ID=test-user
NODE_PORT=3001
LOG_LEVEL=info
```

## Protections Implemented

- Uses `@whiskeysockets/baileys`.
- Wraps the socket with `baileys-antiban`.
- Uses stealth connect settings and delayed presence ramp.
- Stores credentials under `sessions/<userId>`.
- Ignores messages older than the connection timestamp.
- Processes only `notify` events.
- Skips messages sent by the linked account.
- Skips private/direct messages and only processes groups.
- Forwards messages to FastAPI without crashing if the backend is down.
- Monitors session health every five minutes and restarts dead sessions.
