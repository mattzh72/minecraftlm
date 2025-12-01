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
# LLM Provider Configuration
LLM_PROVIDER=gemini          # Options: openai, anthropic, gemini
LLM_MODEL=                   # Optional - uses default for provider if not set

# API Keys (only need the one for your selected provider)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### Available Models

| Provider | Models | Default |
|----------|--------|---------|
| `openai` | `gpt-5`, `gpt-5.1`, `gpt-4.1`, `gpt-4o`, `gpt-4o-mini` | `gpt-4o` |
| `anthropic` | `claude-sonnet-4-20250514`, `claude-opus-4-20250514` | `claude-sonnet-4-20250514` |
| `gemini` | `gemini/gemini-2.5-pro`, `gemini/gemini-2.5-flash`, `gemini/gemini-2.0-flash` | `gemini/gemini-2.5-flash` |

## Running

```bash
uv run uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Send a message to the agent (SSE stream)
