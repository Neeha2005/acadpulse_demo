# AcadPulse Commands

Yeh file new machine par AcadPulse run karne ke liye easy step-by-step guide hai. Is guide ko Windows + PowerShell ke hisaab se likha gaya hai.

Important:
- Agar sirf app dekhni hai to `backend` aur `frontend` run karna kaafi hai.
- Agar WhatsApp integration bhi test karni hai to `whatsapp` folder bhi run karna hoga.
- `backend/.env` aur `backend/credentials.json` private files hain. Inko GitHub par commit nahi karna.

## 1. Machine Par Kya Installed Hona Chahiye

Sab se pehle yeh check karo ke machine par yeh cheezen installed hon:

- `git`
- `python` (best: Python 3.11 ya 3.12)
- `node`
- `npm`

Check karne ke commands:

```powershell
git --version
python --version
node --version
npm --version
```

Agar in mein se koi command kaam na kare to pehle us software ko install karo, phir next steps follow karo.

## 2. Project Download Karna

PowerShell kholo aur yeh commands run karo:

```powershell
git clone https://github.com/ayesha-71131/acadpulse.git
cd acadpulse
```

Is step ke baad tum project ke main folder ke andar aa jaogi.

Check karne ke liye:

```powershell
ls
```

Expected folders:

- `backend`
- `frontend`
- `whatsapp`
- `docs`

## 3. Backend Setup Karna

Backend Python par chalta hai. Isko ek dafa setup karna hota hai.

### Step 3.1: Backend folder mein jao

```powershell
cd backend
```

### Step 3.2: Virtual environment banao

```powershell
python -m venv venv
```

Is se `backend/venv` naam ka folder ban jayega.

### Step 3.3: Virtual environment activate karo

```powershell
.\venv\Scripts\Activate.ps1
```

Agar PowerShell block kare to yeh command ek dafa run karo:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Phir dobara run karo:

```powershell
.\venv\Scripts\Activate.ps1
```

Jab environment activate ho jaye to line ke start par `(venv)` dikhna chahiye.

### Step 3.4: Python packages install karo

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Is step mein thora time lag sakta hai.

## 4. Backend Environment File Banana

Backend ko `.env` file chahiye hoti hai.

### Step 4.1: Example file copy karo

```powershell
Copy-Item .env.example .env
```

### Step 4.2: `.env` open karo

```powershell
notepad .env
```

Ab is file mein real values daalni hongi.

Important fields:

- `DB_HOST`
- `DB_NAME`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSLMODE`
- `JWT_SECRET_KEY`
- `GROQ_API_KEY`
- `FRONTEND_URL`

Recommended values:

- `DB_SSLMODE=require`
- `FRONTEND_URL=http://localhost:5173`

Notes:
- Database credentials tum usi Supabase project ki use karogi jo app ke liye bana hua hai.
- `GROQ_API_KEY` chatbot aur deadline extraction ke liye chahiye hoti hai.
- Agar `.env` incomplete hui to backend start ho sakta hai, lekin bohat se endpoints error denge.

## 5. Google Integration Ke Liye Extra File

Agar Gmail ya Google Classroom bhi test karna hai to `backend/credentials.json` bhi chahiye.

Yeh file manually add karni hoti hai:

- Google Cloud Console se OAuth client JSON download karo
- us file ko rename karke `credentials.json` rakho
- usko `backend` folder ke andar paste karo

File path aise honi chahiye:

```text
backend/credentials.json
```

## 6. Backend Run Karna

Backend run karne ke liye:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

Expected result:

- terminal mein `Uvicorn running on http://127.0.0.1:8000` aayega

Agar port 8000 busy ho to:

```powershell
python -m uvicorn main:app --reload --port 8001
```

Lekin normal case mein `8000` hi use karo.

## 7. Backend Check Karna

Backend chalne ke baad naya PowerShell terminal kholo aur project folder mein aa kar yeh run karo:

```powershell
curl http://127.0.0.1:8000/health
```

Phir:

```powershell
curl http://127.0.0.1:8000/test
```

Agar response aa jaye to backend sahi chal raha hai.

FastAPI docs browser mein yahan open hongi:

```text
http://127.0.0.1:8000/docs
```

## 8. Frontend Setup Karna

Ab frontend setup karna hai.

Naya terminal kholo aur project root par aa jao:

```powershell
cd d:\Acadpulse\acadpulse
cd frontend
npm install
```

Is step mein JavaScript packages install hongi.

Optional:

```powershell
Copy-Item .env.example .env
```

Agar frontend `.env` ki zarurat ho to is file ko use kar sakti ho.

## 9. Frontend Run Karna

Frontend start karne ke liye:

```powershell
cd frontend
npm run dev
```

Expected result:

- terminal mein local URL show hogi, usually `http://localhost:5173`

Phir browser mein yeh kholo:

```text
http://localhost:5173
```

## 10. App Ko Proper Order Mein Kaise Run Karna Hai

Best practice yeh hai ke 2 ya 3 alag terminals kholi jayein.

### Terminal 1: Backend

```powershell
cd d:\Acadpulse\acadpulse\backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

### Terminal 2: Frontend

```powershell
cd d:\Acadpulse\acadpulse\frontend
npm run dev
```

### Terminal 3: WhatsApp (optional)

Yeh tabhi chalao jab WhatsApp integration bhi test karni ho.

```powershell
cd d:\Acadpulse\acadpulse\whatsapp
npm install
npm start
```

## 11. WhatsApp Integration Ka Simple Setup

WhatsApp service Node.js par chalti hai.

### Step 11.1: WhatsApp folder mein packages install karo

```powershell
cd whatsapp
npm install
```

### Step 11.2: Service start karo

```powershell
npm start
```

Expected result:

- terminal mein QR code aayega
- phone se WhatsApp linked devices mein ja kar QR scan karo
- login ke baad service selected groups monitor karegi

Important:
- Backend pehle se run hona chahiye
- warna WhatsApp messages API ko send nahi ho payenge

## 12. Gmail Aur Classroom Test Karna

Yeh tabhi kaam karega jab:

- backend run ho
- `backend/.env` correct ho
- `backend/credentials.json` موجود ho

Test commands:

### Gmail fetch

```powershell
curl http://127.0.0.1:8000/gmail/fetch
```

### Classroom courses

```powershell
curl http://127.0.0.1:8000/classroom/courses
```

### Classroom full fetch

```powershell
curl http://127.0.0.1:8000/classroom/fetch
```

Pehli dafa Google login khul sakta hai. Browser mein login complete karna hoga.

## 13. Chatbot Test Karna

Backend run ho aur `.env` mein `GROQ_API_KEY` set ho.

```powershell
$body = @{ prompt = "Say hello from AcadPulse" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/chat" -ContentType "application/json" -Body $body
```

Agar response aa jaye to chatbot sahi kaam kar raha hai.

## 14. Deadline Extraction Test Karna

```powershell
$body = @{ text = "Assignment due next Friday at 6pm" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/deadline" -ContentType "application/json" -Body $body
```

Is se backend message se deadline nikalne ki koshish karega.

## 15. Sab Se Short Version

Agar tumhari friend ko sirf project dekhna hai, to yeh minimum steps follow kare:

### One-time setup

```powershell
git clone https://github.com/ayesha-71131/acadpulse.git
cd acadpulse

cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Phir `.env` mein real credentials add kare.

```powershell
cd ..\frontend
npm install
```

### Har dafa run karne ke liye

Terminal 1:

```powershell
cd d:\Acadpulse\acadpulse\backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

Terminal 2:

```powershell
cd d:\Acadpulse\acadpulse\frontend
npm run dev
```

Phir browser mein:

```text
http://localhost:5173
```

## 16. Common Errors Aur Unka Easy Fix

### Error: `Activate.ps1 cannot be loaded`

Run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Error: `python` command not found

Python install nahi hai ya PATH mein add nahi hua. Python dobara install karo aur installation ke time `Add Python to PATH` select karo.

### Error: `node` ya `npm` not found

Node.js install nahi hai. Node.js LTS version install karo.

### Error: backend start ho raha hai lekin DB endpoints fail ho rahe hain

Check:

- `backend/.env` mein DB values sahi hain
- `DB_PASSWORD` missing nahi
- `DB_SSLMODE=require`

### Error: chatbot kaam nahi kar raha

Check:

- `GROQ_API_KEY` set hai
- backend restart kiya gaya hai after `.env` change

### Error: Google login kaam nahi kar raha

Check:

- `backend/credentials.json` correct jagah par hai
- Gmail API enabled hai
- Google Classroom API enabled hai
- test user allow kiya gaya hai

### Error: frontend open hota hai lekin data nahi aa raha

Check:

- backend chal raha hai
- frontend se pehle backend start kiya gaya hai
- browser console/network tab mein API errors dekh lo

## 17. Useful Commands

Project update lene ke liye:

```powershell
git pull
```

Changed files dekhne ke liye:

```powershell
git status --short
```

Frontend build check:

```powershell
cd frontend
npm run build
```

## 18. Private Files Jo Share Nahin Karne

In files ko public ya GitHub par upload nahi karna:

- `backend/.env`
- `backend/credentials.json`
- `backend/token.json`
- `whatsapp/auth_info/`
- `whatsapp/selected_groups.json`

## 19. Friend Ko Kya Dena Hoga

Agar tumhari friend ko project full run karna hai to usko yeh cheezen chahiye hongi:

- project code
- backend ke correct `.env` values
- agar Google features test karni hain to `backend/credentials.json`
- agar chatbot test karna hai to valid `GROQ_API_KEY`
- agar DB-based features test karni hain to working database credentials

In cheezon ke bina app partially chalegi, lekin full features kaam nahi karenge.
