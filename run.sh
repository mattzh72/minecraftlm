#!/bin/bash
# Run the Minecraft Schematic Generator

set -e

# Parse arguments
RELOAD_ARGS=""
if [[ "$1" == "--reload" ]]; then
    RELOAD_ARGS="--reload --reload-exclude 'storage/*'"
    echo "Hot reload enabled"
fi

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
uv run uvicorn app.main:app $RELOAD_ARGS --host 0.0.0.0 --port 8000
