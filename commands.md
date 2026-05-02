# AcadPulse Commands

Use these commands when setting up AcadPulse on a new machine or checking that each part of the project is working.

## 1. Clone And Enter Project

```powershell
git clone <your-repo-url>
cd acadpulse
```

Downloads the project and moves into the project folder.

## 2. Backend Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Creates a Python virtual environment and downloads all backend libraries.

```powershell
Copy-Item .env.example .env
```

Creates a local backend environment file for private API keys.

```powershell
notepad .env
```

Opens the backend environment file so you can paste your real Groq API key once.

If PowerShell blocks activation, run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Allows local PowerShell scripts like the Python virtual environment activator to run.

## 3. Backend Run And Check

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

If port 8000 is already in use, run:

```powershell
python -m uvicorn main:app --reload --port 8001
```

> Important: Start the backend from the activated `backend\venv` environment. If you see `ModuleNotFoundError: No module named 'google'` or `Internal Server Error` for `/gmail/fetch` or `/classroom/*`, it means the backend was started with the wrong Python environment.

Starts the FastAPI backend at `http://127.0.0.1:8000`.

```powershell
curl http://127.0.0.1:8000/health
```

Checks that the backend API is running.

```powershell
curl http://127.0.0.1:8000/test
```

Checks the simple FastAPI test endpoint.

```powershell
curl -X POST http://127.0.0.1:8000/receive-message -H "Content-Type: application/json" -d "{\"text\":\"Assignment due tonight\",\"sender\":\"923001234567\",\"group\":\"CS Section B\",\"timestamp\":\"2026-05-01T10:00:00Z\"}"
```

Tests that the backend can receive a WhatsApp-style message.

```powershell
$body = @{ prompt = "Say hello from AcadPulse" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/chat" -ContentType "application/json" -Body $body
```

Tests the Groq chatbot endpoint in PowerShell after the backend is running and `backend/.env` contains `GROQ_API_KEY`.

### Groq deadline extraction
```powershell
$body = @{ text = "Assignment due next Friday at 6pm" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/deadline" -ContentType "application/json" -Body $body
```

This calls the new deadline endpoint and returns extracted deadline details from the text.

### Analyze a message with Llama safely
```powershell
$body = @{ text = "Please help me find the exam date and summarize this message." } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/message/analyze" -ContentType "application/json" -Body $body
```

This sends the message text to the Groq Llama model for analysis and safety review.

If a prompt appears malicious, the backend will refuse the request until `confirm_malicious=true` is explicitly set.

### Enable Google Classroom API
1. Open the Google Cloud Console and select the project used for AcadPulse.
2. Go to "APIs & Services" > "Library".
3. Search for "Google Classroom API" and click "Enable".
4. Also ensure the "Gmail API" is enabled in the same project.
5. In "APIs & Services" > "Credentials", create an OAuth 2.0 Client ID for a Desktop application.
6. Download the JSON file and save it as `backend/credentials.json`.

> Note: Because this is a new unverified OAuth app, Google may show a warning page during login. If it appears, click **Advanced** and then **Continue** to proceed with the login.
> 
> If you want to avoid the warning, add your Google account as a test user in the OAuth consent screen for this project.

### Fetch Gmail emails
```powershell
curl http://127.0.0.1:8000/gmail/fetch
```

Checks Gmail fetching after `backend/credentials.json` is added and Google login is completed.

> Note: Make sure the backend server was started from the activated `backend\venv` environment using `python -m uvicorn main:app --reload`.

### Fetch Google Classroom courses
```powershell
curl http://127.0.0.1:8000/classroom/courses
```

Returns the current user’s courses from Google Classroom.

### Fetch announcements for a course
```powershell
curl http://127.0.0.1:8000/classroom/courses/<course_id>/announcements
```

Replace `<course_id>` with a course ID from the previous course list.

### Fetch coursework for a course
```powershell
curl http://127.0.0.1:8000/classroom/courses/<course_id>/coursework
```

Returns assignments and coursework items for the chosen course.

### Fetch all Classroom content
```powershell
curl http://127.0.0.1:8000/classroom/fetch
```

Returns courses plus announcements and coursework for each course.

## 4. Frontend Setup

```powershell
cd frontend
npm install
```

Downloads all frontend React/Vite libraries.

## 5. Frontend Run And Check

```powershell
cd frontend
npm run dev
```

Starts the React app locally, usually at `http://localhost:5173`.

```powershell
cd frontend
npm run build
```

Checks that the frontend can build for production.

```powershell
cd frontend
npm run preview
```

Runs the production build locally after `npm run build`.

### Check dashboard notification sync

```powershell
Invoke-RestMethod "http://127.0.0.1:8001/notifications?include_completed=false&limit=20" | ConvertTo-Json -Depth 6
```

Fetches the live notification list that now powers the dashboard task cards and notification stream.

### Create a manual task

```powershell
$body = @{
  title = "Prepare final presentation"
  course = "CS-401"
  description = "Finish slides and talking points"
  due_date = "2026-05-10"
  due_time = "23:59"
  type = "assignment"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8001/notifications/manual" -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
```

Creates a real manual notification, stores urgency when a deadline is provided, and returns the created notification row.

### Mark a notification complete

```powershell
$notificationId = "PUT-NOTIFICATION-ID-HERE"
$body = @{ completed = $true } | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri "http://127.0.0.1:8001/notifications/$notificationId/complete" -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```

Marks the selected notification as completed so it disappears from the default dashboard sync response.

### Desktop popup check

1. Open `http://127.0.0.1:5173/dashboard`
2. Allow browser notification permission when prompted
3. Create a manual task with a near deadline so it becomes `high` or `critical`
4. Refresh the dashboard if needed

You should receive a browser desktop notification for `high` and `critical` urgency tasks.

## 6. WhatsApp Setup

```powershell
cd whatsapp
npm install
```

Downloads all WhatsApp bot libraries.

## 7. WhatsApp Run And Check

```powershell
cd whatsapp
npm start
```

Starts the WhatsApp bot, shows a QR code for login, and asks which groups to monitor.

```powershell
cd whatsapp
npm run dev
```

Starts the WhatsApp bot in watch mode for development.

## 8. Full Project Run Order

Open three terminals and run these in order.

Terminal 1:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

Runs the backend API first so other services can send data to it.

Terminal 2:

```powershell
cd frontend
npm run dev
```

Runs the user dashboard.

Terminal 3:

```powershell
cd whatsapp
npm start
```

Runs the WhatsApp listener and sends selected group messages to the backend.

## 9. Required Secret Files

```text
backend/credentials.json
```

Needed for Gmail and Google Classroom OAuth. This file comes from Google Cloud Console and should not be committed.

```text
backend/token.json
```

Created automatically after the first successful Google login and should not be committed.

```text
backend/.env
```

Stores private API keys like `GROQ_API_KEY` and should not be committed.

```text
whatsapp/auth_info/
whatsapp/selected_groups.json
```

Created automatically by the WhatsApp bot after QR login and group selection and should not be committed.

## 10. Useful Future Commands

```powershell
git status --short
```

Shows which files were changed.

```powershell
git pull
```

Downloads the latest code from the remote repository.

```powershell
git add .
git commit -m "Describe your change"
git push
```

Saves and uploads your code changes.

```powershell
pip install <package-name>
pip freeze > requirements.txt
```

Adds a new backend Python library and updates the backend dependency list.

```powershell
npm install <package-name>
```

Adds a new frontend or WhatsApp Node.js library when run inside that package folder.

```powershell
npm audit
```

Checks Node.js packages for known security issues.

```powershell
pip list --outdated
```

Shows backend Python packages that have newer versions available.

## 11. Verification & Partner Demo Guide

Use these exact commands to prove the system is working. Run them from the project root (`d:\Acadpulse\acadpulse\`).

### Phase 1: Project Foundation

**Task #1: Folder Structure**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse
    ls
    ```
*   **Success:** `backend`, `frontend`, `whatsapp`, `ai`, and `docs` appear in the listing.

**Task #4: React App Shell**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse\frontend
    npm run dev
    ```
*   **Success:** Terminal shows `Local: http://localhost:5173` and `ready in`. Browser at `http://localhost:5173` loads the dashboard.
*   **Quick Fix:** If port 5173 is busy, run:
    ```powershell
    npx kill-port 5173
    ```

**Task #5: FastAPI Backend**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse\backend
    .\venv\Scripts\Activate.ps1
    python -m uvicorn main:app --reload
    ```
*   **Success:** Terminal shows `Uvicorn running on http://127.0.0.1:8000`.
*   **Verification:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/test | ConvertTo-Json
    ```
*   **Expected Output:**
    ```json
    {"status":"success","data":"FastAPI test endpoint working"}
    ```
*   **Quick Fix:** If port 8000 is in use, restart with:
    ```powershell
    python -m uvicorn main:app --reload --port 8001
    ```

**Task #6: Baileys Installation**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse\whatsapp
    npm list @whiskeysockets/baileys
    ```
*   **Success:** Output includes `@whiskeysockets/baileys@` and no `missing` warnings.
*   **Quick Fix:** Run:
    ```powershell
    npm install
    ```

**Task #2: PostgreSQL Install**
*   **Command:**
    ```powershell
    psql --version
    ```
*   **Success:** Output begins with `psql (PostgreSQL)`.
*   **Quick Fix:** Install PostgreSQL or add its `bin` folder to PATH.

**Task #3: DB Schema Created**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse
    Test-Path docs/database_schema.sql
    ```
*   **Success:** Output is `True`.
*   **Optional DB check:**
    ```powershell
    psql -U <user> -d <database> -c "\dt"
    ```
*   **Expected Output:** A list of tables matching the project schema.

### Phase 2: WhatsApp Bridge

**Task #7: QR Code Scanning**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse\whatsapp
    npm start
    ```
*   **Success:** A QR code appears in the terminal and, after scanning, the terminal says `WhatsApp connection established`.
*   **Quick Fix:** If `npm start` fails, run:
    ```powershell
    npm install
    ```

**Task #8: Receive & Log WhatsApp Messages**
*   **Prerequisite:** Backend running on `http://127.0.0.1:8000`.
*   **Command:** Send a WhatsApp message in one of the selected groups.
*   **Success:** Backend terminal prints `Received WhatsApp message from bot:` and the message payload.

**Task #9: Node.js → FastAPI REST Bridge**
*   **Command:**
    ```powershell
    $body = @{ text = "Test assignment due Monday"; sender = "923001234567"; group = "Test Group"; timestamp = "2026-05-01T12:00:00Z" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/receive-message" -ContentType "application/json" -Body $body
    ```
*   **Success:** Response contains `"status":"received"`.
*   **Full Bridge Success:** Real WhatsApp messages arriving at the bot also appear in the backend log with the same text.

### Phase 3: Google Integration

**Task #23: Google Cloud Project**
*   **Command:**
    ```powershell
    cd d:\Acadpulse\acadpulse\backend
    Test-Path credentials.json
    ```
*   **Success:** Output is `True`.

**Task #24: OAuth Login Flow**
*   **Command:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/gmail/fetch
    ```
*   **Success:** A browser opens for Google login if needed, then the command returns a JSON array of emails.
*   **If you see the Google warning page:** click **Advanced** and then **Continue** to proceed to the test app.
*   **Quick Fix:** Add your account as a test user in the Google Cloud Console OAuth consent screen if the warning is blocking login.
*   **Quick Fix:** Ensure `backend/credentials.json` exists and `backend/token.json` is writable.

**Task #26: Gmail to Classifier Stub**
*   **Command:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/gmail/fetch | ConvertTo-Json
    ```
*   **Success:** Output is a JSON array of email objects with keys `id`, `source`, `sender`, `subject`, `snippet`, and `received_at`.

**Task #25: Fetch Gmail Emails**
*   **Command:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/gmail/fetch | ConvertTo-Json
    ```
*   **Success:** Same as Task #26: a valid JSON email list is returned.

**Task #27: Enable Classroom API**
*   **Command:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/classroom/courses | ConvertTo-Json
    ```
*   **Success:** Output is a JSON object with a `courses` array.
*   **Quick Fix:** If you get a Classroom scope or API error, enable the Classroom API in Google Cloud Console and reauthenticate.

**Task #28: Fetch Classroom Content**
*   **Command:**
    ```powershell
    Invoke-RestMethod http://127.0.0.1:8000/classroom/fetch | ConvertTo-Json
    ```
*   **Success:** Output is a JSON object with a `classroom` array containing `course`, `announcements`, and `coursework`.

### Phase 4: Groq / Llama

**Task #16: Groq API Setup**
*   **Command:**
    ```powershell
    $body = @{ prompt = "Hello from AcadPulse" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/chat" -ContentType "application/json" -Body $body
    ```
*   **Success:** Response contains `"response":"` and an AI-generated reply.
*   **Quick Fix:** If you get a `GROQ_API_KEY` error, add `GROQ_API_KEY=...` to `backend/.env` and restart.

**Task #17: Groq Deadline Prompt**
*   **Command:**
    ```powershell
    $body = @{ text = "Submit project report on Friday" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/deadline" -ContentType "application/json" -Body $body
    ```
*   **Success:** Response contains `"deadline_extraction"` with a deadline summary.

**Task #18: Call Llama for Messages**
*   **Command:**
    ```powershell
    $body = @{ text = "Reminder: exam tomorrow" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/message/analyze" -ContentType "application/json" -Body $body
    ```
*   **Success:** Response contains `"analysis"` with an AI summary and safety review.
*   **Quick Fix:** If the backend reports missing Groq credentials, set `GROQ_API_KEY` in `backend/.env` and restart.
