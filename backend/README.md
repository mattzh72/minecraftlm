# Backend

FastAPI backend for the Minecraft Schematic Generator.

## Setup

```bash
cd backend
uv sync
```

## Configuration

Create a `.env` file in the backend directory:

```bash
# API Keys (only need the one for your model's provider)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### Available Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-4.1` |
| Anthropic | `claude-opus-4-5-20251124`, `claude-sonnet-4-5-20250929` |
| Gemini | `gemini/gemini-3-pro`, `gemini/gemini-3-pro-preview` |

## Running

```bash
uv run uvicorn app.main:app --reload --reload-exclude 'storage/*'
```

The API will be available at `http://localhost:8000`.

## API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Send a message to the agent (SSE stream)
