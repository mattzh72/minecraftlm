#!/bin/bash
# Build and run the Minecraft Schematic Generator

set -e

echo "Building frontend..."
cd frontend
npm run build
cd ..

echo "Starting server..."
cd core
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
