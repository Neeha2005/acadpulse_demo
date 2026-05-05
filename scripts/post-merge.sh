#!/bin/bash
set -e

echo "=== Post-merge setup ==="

# Install frontend dependencies (non-interactive)
echo "[1/2] Installing frontend dependencies..."
cd frontend && npm install --yes 2>&1 | tail -5
cd ..

# Install backend Python dependencies if requirements.txt changed
echo "[2/2] Installing backend dependencies..."
cd backend && pip install -r requirements.txt -q 2>&1 | tail -5
cd ..

echo "=== Post-merge setup complete ==="
