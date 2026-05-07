# API Contract

## WhatsApp → FastAPI
POST /messages/incoming

{
  "group_id": "120363...",
  "group_name": "CS Section B",
  "sender": "923001234567",
  "sender_name": "kainat CR",
  "text": "Assignment submit karo Sunday tak",
  "timestamp": 1718200000
}

## FastAPI Response
{ "status": "received", "message_id": "uuid" }

## Stored Messages
GET /messages?limit=50

{
  "messages": [
    {
      "id": "uuid",
      "group_id": "120363...",
      "group_name": "CS Section B",
      "sender": "923001234567",
      "sender_name": "kainat CR",
      "text": "Assignment submit karo Sunday tak",
      "timestamp": 1718200000
    }
  ]
}
