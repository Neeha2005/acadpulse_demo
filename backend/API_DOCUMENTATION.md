# AcadPulse API - Groq Chatbot & Deadline Extraction Endpoints

## Overview
This document describes the newly implemented Groq-powered chatbot and deadline extraction endpoints.

## New Endpoints

### 1. POST `/chat`
Chat with the AI academic assistant.

**Request Body:**
```json
{
  "prompt": "What are my upcoming assignments?",
  "confirm_malicious": false
}
```

**Response (ChatResponse):**
```json
{
  "response": "I'd be happy to help you with your assignments...",
  "is_safe": true,
  "warning": null
}
```

**Features:**
- Safety checking for malicious/inappropriate content
- Requires confirmation if content is flagged
- Academic-focused responses

---

### 2. POST `/deadlines/extract`
Extract assignment deadlines from text (WhatsApp messages, emails, etc.)

**Request Body:**
```json
{
  "text": "Assignment 1 for CS101 is due on January 15, 2024. Math homework due February 1st.",
  "confirm_malicious": false
}
```

**Response (DeadlineResponse):**
```json
{
  "deadlines": [
    {
      "task": "Assignment 1",
      "course": "CS101",
      "deadline_date": "2024-01-15",
      "description": "Submit assignment"
    },
    {
      "task": "Homework",
      "course": "Math",
      "deadline_date": "2024-02-01",
      "description": "Complete homework"
    }
  ],
  "success": true,
  "message": "Successfully extracted 2 deadline(s)."
}
```

**Features:**
- Automatic deadline detection from unstructured text
- Returns structured JSON with task, course, date, and description
- Safety checking included

---

### 3. POST `/deadlines/extract-batch`
Extract deadlines from multiple text sources at once.

**Request Body:**
```json
[
  "CS101 Assignment due Jan 15",
  "Math 202 homework due Feb 1",
  "No deadlines here"
]
```

**Query Parameters:**
- `confirm_malicious` (boolean, optional): Skip safety checks for all texts

**Response:**
```json
{
  "success": true,
  "total_deadlines_extracted": 2,
  "results": [
    {
      "index": 0,
      "success": true,
      "deadlines": [...],
      "message": "Found 1 deadline(s)"
    },
    ...
  ]
}
```

---

## Helper Functions

### `check_message_safety(text: str) -> bool`
Checks if text contains malicious or inappropriate content using Groq AI.

### `extract_deadlines_from_text(text: str) -> list`
Extracts structured deadline information from text using Groq AI.

Returns a list of dictionaries with fields:
- `task`: Name/title of the assignment
- `course`: Course name/code
- `deadline_date`: Due date in ISO format
- `description`: Additional details

---

## Usage Examples

### Using Python Requests

```python
import requests

BASE_URL = "http://localhost:8000"

# Chat with bot
response = requests.post(f"{BASE_URL}/chat", json={
    "prompt": "When is my next assignment due?"
})
print(response.json())

# Extract deadlines
response = requests.post(f"{BASE_URL}/deadlines/extract", json={
    "text": "Reminder: CS101 Assignment 1 due Jan 15, 2024"
})
print(response.json())

# Batch extraction
response = requests.post(f"{BASE_URL}/deadlines/extract-batch", json=[
    "CS101 Assignment due Jan 15",
    "Math homework due Feb 1"
])
print(response.json())
```

### Using cURL

```bash
# Chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Help me with my studies"}'

# Deadline extraction
curl -X POST http://localhost:8000/deadlines/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Assignment due on January 15"}'

# Batch extraction
curl -X POST http://localhost:8000/deadlines/extract-batch \
  -H "Content-Type: application/json" \
  -d '["Text 1", "Text 2"]'
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid input)
- `500`: Internal server error
- `502`: Groq API error

Error responses include a `detail` field with more information.

---

## Configuration

Make sure to set the following environment variables in `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

Get your Groq API key from: https://groq.com

---

## Security Features

1. **Content Safety Checking**: All inputs are screened for malicious content
2. **Confirmation Required**: Flagged content requires explicit confirmation
3. **Rate Limiting**: Consider implementing rate limiting for production use
4. **Input Validation**: Pydantic models ensure proper input structure

---

## Future Enhancements

- [ ] Store extracted deadlines in database
- [ ] Add user-specific deadline tracking
- [ ] Integrate with Google Calendar
- [ ] Add reminder notifications
- [ ] Improve deadline parsing accuracy
- [ ] Add multi-language support
