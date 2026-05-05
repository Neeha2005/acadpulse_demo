#!/bin/bash
cd backend && python -m uvicorn main:app --host localhost --port 8005 --reload &
cd frontend && npm run dev
