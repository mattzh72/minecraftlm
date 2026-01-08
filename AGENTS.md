# Repository Guidelines

## Project Structure & Module Organization
- `backend/app` hosts FastAPI (routers in `api/routes`, agents in `agent/`, helpers in `services/`, schemas in `models/`); mirror that layout and add matching tests in `backend/tests/test_<topic>.py`.
- `frontend/src` is a Vite + React + TypeScript SPA with UI in `components/`, hooks in `hooks/`, Zustand slices in `store/`, math/render helpers in `lib/`, and textures under `src/assets` or `public/`.
- Rendering uses `@mattzh72/lodestone` from npm; no local renderer package build is required.

## Build, Test & Development Commands
- Install dependencies with `cd backend && uv sync` and `cd frontend && npm install` (legacy peer deps are enabled in `.npmrc`).
- `./run.sh` launches the full dev stack (Vite 5173, uvicorn 8000); use `uv run uvicorn app.main:app --reload` or `npm run dev` when touching a single side.
- Call out the commands you ran: `npm run build`, `npm run preview`, `npm run lint`, and `cd backend && uv run pytest`.

## Coding Style & Naming Conventions
- Python stays in snake_case, 4-space indents, and explicit type hints. Keep schemas in `app/models`, read config from `settings`, and park side effects inside services for easier mocking.
- React/TS uses PascalCase components, `use*` hooks, and colocated Zustand slices in `store/*.ts`. Tailwind utilities can stay inline, while shared tokens belong in `index.css` or `config.ts`. Run ESLint (`frontend/eslint.config.js`) before committing UI work.

## Testing Guidelines
- Pytest drives verification; reuse fixtures in `backend/tests/conftest.py`, mark async cases, and extend `test_integration_e2e.py` whenever agent workflows change.
- Renderer updates need relevant frontend/evaluation coverage, and frontend logic should gain colocated Vitest suites (`Component.test.tsx`). Run `uv run pytest` plus relevant npm scripts before a PR and mention coverage deltas for agent-critical paths.

## Commit & Pull Request Guidelines
- Match the existing history: concise, present-tense subjects (`Improve validator logging`, `Fix chat buffering`) and one logical change per commit.
- PRs outline intent, list validation commands, flag new env vars, and include screenshots or recordings for UI or renderer tweaks. Tag both backend and frontend reviewers when the work spans the stack.

## Security & Configuration Tips
- Copy `backend/.env.example` to `.env`, add one provider key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`), and keep secrets out of git. Read them through `settings`, not raw `os.getenv`.
- Limit logging of provider responses, redact sensitive payloads in event buffers or chat routes, and pin new dependencies in `uv.lock` or `package-lock.json` with a short justification.
