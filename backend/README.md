# Backend

FastAPI service for AcadPulse.

## Deploy

- Entry point: `main:app`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Dependencies: `requirements.txt`

## Notes

- Keep secrets in environment variables, not committed files.
- Database schema and backend deployment notes live under `backend/docs/`.
- `requirements-ml.txt` is optional and only needed if you later deploy the local classifier stack.
