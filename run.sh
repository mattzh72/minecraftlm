#!/bin/bash
# Run the Minecraft Schematic Generator in development mode with hot reload

set -e

# Cleanup function to kill background processes
cleanup() {
    echo "Shutting down..."
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting frontend dev server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Starting backend dev server..."
cd backend
uv run uvicorn app.main:app --reload --reload-exclude 'storage/*' --host 0.0.0.0 --port 8000
