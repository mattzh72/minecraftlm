# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MinecraftLM is an AI-powered application that generates 3D Minecraft structures from natural language descriptions. Users type prompts like "build me a medieval castle with towers" and an agentic AI writes Python code using a custom Minecraft SDK to generate the structures, which are then rendered in a 3D viewer.

## Development Commands

### Quick Start
```bash
./run.sh              # Starts both frontend (port 5173) and backend (port 8000) with hot reload
```

### Backend (Python/FastAPI)
```bash
cd backend
uv sync               # Install dependencies
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000  # Run dev server
uv run pytest         # Run all tests
uv run pytest tests/test_harness.py  # Run a single test file
uv run pytest -m "not integration"   # Skip integration tests (require API keys)
```

### Frontend (React/Vite)
```bash
cd frontend
npm install           # Install deps (also builds deepslate-opt package)
npm run dev           # Start dev server
npm run build         # Production build
npm run lint          # ESLint
```

### deepslate-opt Package
```bash
cd packages/deepslate-opt
npm install && npm run build  # Build the rendering library
npm run test          # Run vitest tests
```

## Architecture

### Backend (`backend/app/`)
- **`main.py`**: FastAPI entry point, serves API routes and optional static frontend build
- **`agent/harness.py`**: Core agentic loop (`MinecraftSchematicAgent`) that orchestrates LLM calls, tool execution, and streaming responses
- **`agent/llms/`**: LLM provider adapters (Anthropic, OpenAI, Gemini) with unified streaming interface
- **`agent/tools/`**: Tool implementations (`read_code`, `edit_code`) and registry for agent tool calls
- **`agent/minecraft/sdk.py`**: Python SDK (`Scene`, `Object3D`, `Block`, `BlockCatalog`) that agents use to build structures
- **`agent/minecraft/docs/`**: SDK documentation embedded in system prompts for the agent
- **`agent/prompts/`**: System prompt templates with SDK doc placeholders
- **`services/`**: Session management, code execution sandbox, validation, event buffering

### Frontend (`frontend/src/`)
- **`components/SessionPage.tsx`**: Main page with chat panel and 3D viewer
- **`components/ChatPanel.tsx`**: Streaming chat interface showing agent activity
- **`components/MinecraftViewer.jsx`**: Three.js-based 3D renderer using deepslate-opt
- **`hooks/`**: React hooks for streaming SSE, session state, and schematic data
- **`store/`**: Zustand stores for global state

### deepslate-opt (`packages/deepslate-opt/`)
Optimized fork of [misode/deepslate](https://github.com/misode/deepslate) for Minecraft rendering. Provides NBT parsing, block rendering, and Three.js integration. The frontend imports this as a local dependency.

## Key Patterns

### Agent Loop Flow
1. User message → `MinecraftSchematicAgent.run()` in `harness.py`
2. LLM generates response with optional tool calls (streaming)
3. Tools execute (read/edit code using the Minecraft SDK)
4. Code runs in sandbox → produces `structure` dict
5. Structure streams to frontend → rendered in 3D viewer
6. Loop continues until agent responds without tool calls or hits max turns

### Minecraft SDK Usage
Agents write Python code that uses the SDK to build structures:
```python
catalog = BlockCatalog()
scene = Scene()
block = Block("minecraft:stone", size=(10, 5, 10), catalog=catalog)
block.position.set(0, 0, 0)
scene.add(block)
structure = scene.to_structure()  # Runtime reads this variable
```

### Streaming Architecture
- Backend uses SSE (Server-Sent Events) via FastAPI
- Events: `thought`, `text_delta`, `tool_call`, `tool_result`, `complete`
- Frontend hooks consume these streams to update UI in real-time

## Testing

Integration tests (marked with `@pytest.mark.integration`) require API keys configured in `backend/.env`. Use `-m "not integration"` to skip them during local development without keys.
