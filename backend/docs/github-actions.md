# GitHub Actions Setup

This repo has two workflows:

- `.github/workflows/ci.yml` runs checks for the React frontend, FastAPI backend, and WhatsApp Node service.
- `.github/workflows/deploy-render.yml` can trigger a Render backend deploy through a deploy hook.

## Required GitHub Secrets

Open GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret.

Add these:

```env
VITE_API_BASE_URL=https://your-backend-url
RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-your-id?key=your-key
```

`VITE_API_BASE_URL` is used only while building the frontend.

`RENDER_DEPLOY_HOOK_URL` is optional. Add it only if you deploy the backend on Render and want GitHub Actions to trigger deploys.

## Backend Runtime Secrets

Do not put backend runtime secrets in GitHub Actions unless the workflow is deploying the backend itself. Add these inside your hosting provider, such as Render, Heroku, or DigitalOcean:

```env
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
DB_HOST=
DB_NAME=postgres
DB_PORT=6543
DB_USER=
DB_PASSWORD=
DB_SSLMODE=require
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7
FRONTEND_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
WHATSAPP_CONTROL_URL=
```

## Important Security Step

If a real key or database password was ever pasted into chat, committed, or pushed, rotate it before deployment.

## How To Run

Push to GitHub:

```bash
git add .github backend/docs/github-actions.md
git commit -m "Add GitHub Actions CI"
git push
```

Then open GitHub -> Actions -> CI.

For Render deploys, open GitHub -> Actions -> Deploy Backend To Render -> Run workflow.
