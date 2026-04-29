# AcadPulse WhatsApp Service

Node.js service for linking WhatsApp Web through Baileys and printing raw
incoming WhatsApp group messages.

## Setup

```bash
npm install
node index.js
```

Scan the terminal QR code with WhatsApp. Auth credentials are stored in
`whatsapp/auth_info/`, which is ignored by git.

## What It Logs

For each group message, the listener prints the group ID, sender ID, extracted
message text or `Non-text message received`, timestamp, and the full raw Baileys
message object.
