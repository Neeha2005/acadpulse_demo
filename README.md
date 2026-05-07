# AcadPulse

AcadPulse is split for deployment into three services:

- `backend/` - FastAPI API and database logic
- `frontend/` - React + Vite web app
- `whatsapp/` - Node.js WhatsApp bridge

Everything else in the repository should be support files only. Build output, local virtual environments, logs, and temporary research assets do not belong in the deployable repo.

## Deploy Structure

Use separate free hosting targets for each service:

1. `backend/` on a Python host such as Render.
2. `frontend/` on a static host such as Vercel or Netlify.
3. `whatsapp/` on a Node host such as Render.

Each service keeps its own dependencies and environment variables inside its folder.
