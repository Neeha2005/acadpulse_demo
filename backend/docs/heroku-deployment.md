# Heroku Deployment

Use Heroku for the FastAPI backend. Keep the React frontend on Vercel and the database on Supabase.

## 1. Rotate Exposed Secrets

If `GROQ_API_KEY`, `DB_PASSWORD`, or `JWT_SECRET_KEY` were pasted into chat or pushed anywhere, rotate them before deploying.

## 2. Install And Login

```bash
heroku login
heroku --version
```

## 3. Create Heroku Backend App

From the repo root:

```bash
heroku create acadpulse-backend
```

If the name is taken, choose another:

```bash
heroku create acadpulse-backend-yourname
```

## 4. Set Config Vars

Set these in Heroku Dashboard -> App -> Settings -> Config Vars, or with CLI:

```bash
heroku config:set GROQ_API_KEY="your-new-groq-key" --app acadpulse-backend
heroku config:set GROQ_MODEL="llama-3.1-8b-instant" --app acadpulse-backend
heroku config:set DB_HOST="your-supabase-host" --app acadpulse-backend
heroku config:set DB_NAME="postgres" --app acadpulse-backend
heroku config:set DB_PORT="6543" --app acadpulse-backend
heroku config:set DB_USER="your-supabase-user" --app acadpulse-backend
heroku config:set DB_PASSWORD="your-new-supabase-password" --app acadpulse-backend
heroku config:set DB_SSLMODE="require" --app acadpulse-backend
heroku config:set JWT_SECRET_KEY="make-a-long-random-secret" --app acadpulse-backend
heroku config:set JWT_ALGORITHM="HS256" --app acadpulse-backend
heroku config:set JWT_EXPIRE_DAYS="7" --app acadpulse-backend
heroku config:set FRONTEND_URL="https://your-vercel-app.vercel.app" --app acadpulse-backend
```

For Google OAuth:

```bash
heroku config:set GOOGLE_CLIENT_ID="your-google-client-id" --app acadpulse-backend
heroku config:set GOOGLE_CLIENT_SECRET="your-google-client-secret" --app acadpulse-backend
heroku config:set GOOGLE_REDIRECT_URI="https://acadpulse-backend.herokuapp.com/auth/google/callback" --app acadpulse-backend
```

## 5. Deploy Only The Backend Folder

Because this repo is a monorepo, deploy the `backend/` folder as the Heroku app root:

```bash
git subtree push --prefix backend heroku main
```

If Heroku remote is missing:

```bash
heroku git:remote -a acadpulse-backend
git subtree push --prefix backend heroku main
```

## 6. Test Backend

```bash
heroku open --app acadpulse-backend
heroku logs --tail --app acadpulse-backend
```

Health URL:

```text
https://acadpulse-backend.herokuapp.com/health
```

## 7. Connect Frontend

In Vercel, set:

```env
VITE_API_BASE_URL=https://acadpulse-backend.herokuapp.com
```

Redeploy the frontend after setting it.

## 8. Google OAuth Console

In Google Cloud Console, add:

Authorized JavaScript origin:

```text
https://your-vercel-app.vercel.app
```

Authorized redirect URI:

```text
https://acadpulse-backend.herokuapp.com/auth/google/callback
```

## WhatsApp Note

Do not put the WhatsApp Baileys service on Heroku for final use unless you accept sessions being lost on restart. Heroku dynos have ephemeral disk. Use DigitalOcean student credit for the WhatsApp service when you need it always-on.
