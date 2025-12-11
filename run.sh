#!/bin/bash
# Run the Minecraft Schematic Generator in development mode with hot reload
# Usage: ./run.sh [dev]
#   dev - Run with deepslate-opt in watch mode

set -e

# Cleanup function to kill background processes
cleanup() {
    echo "Shutting down..."
    kill $FRONTEND_PID 2>/dev/null || true
    kill $DEEPSLATE_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check if dev mode is enabled
if [ "$1" = "dev" ]; then
    echo "Starting deepslate-opt in watch mode..."
    cd packages/deepslate-opt
    npm run dev &
    DEEPSLATE_PID=$!
    cd ../..
fi

echo "Starting frontend dev server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Starting backend dev server..."
cd backend
uv run uvicorn app.main:app --reload --reload-exclude 'storage/*' --host 0.0.0.0 --port 8000
