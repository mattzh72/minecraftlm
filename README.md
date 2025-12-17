# MinecraftLM

https://github.com/user-attachments/assets/cdeb2167-1383-44ba-887e-fa3545ea08cf

<div align="center">
<h3>An AI Builder for Minecraft • Create anything • World interactions</h3>
</div>

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/mattzh72/minecraft-schematic-gen?style=flat&logo=github)](https://github.com/mattzh72/minecraft-schematic-gen)

## Examples

<table>
  <tr>
    <td align="center">
      <img src="evaluation/screenshots/eval-002/2025-12-17-02.41.36.png" width="400"/><br/>
      <sub><b>"Build me a 747 airplane"</b></sub>
    </td>
    <td align="center">
      <img src="evaluation/screenshots/eval-004/2025-12-17-02.55.01.png" width="400"/><br/>
      <sub><b>"Build the Taj Mahal with gardens"</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="evaluation/screenshots/eval-015/2025-12-17-03.20.43.png" width="400"/><br/>
      <sub><b>"A windmill on a hill"</b></sub>
    </td>
    <td align="center">
      <img src="evaluation/screenshots/eval-003/2025-12-17-03.02.41.png" width="400"/><br/>
      <sub><b>"The Golden Gate Bridge"</b></sub>
    </td>
  </tr>
</table>

## Prerequisites

Before you begin, make sure you have:

- **Python 3.11+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** and npm — [nodejs.org](https://nodejs.org/)
- **uv** (Python package manager) — [docs.astral.sh/uv](https://docs.astral.sh/uv/)
- **API key** from one of: Anthropic, OpenAI, or Google

## Quick Start

```bash
git clone https://github.com/mattzh72/minecraft-schematic-gen
cd minecraft-schematic-gen

# Install backend dependencies
cd backend && uv sync && cd ..

# Install frontend dependencies (also builds the 3D renderer)
cd frontend && npm install && cd ..

# Configure your API key
cp backend/.env.example backend/.env
# Edit backend/.env and add your API key (see Configuration below)

# Run both servers
./run.sh
```

Open [localhost:5173](http://localhost:5173) and start building.

## How It Works

1. **You describe** what you want to build in plain English
2. **AI writes code** using our custom Minecraft SDK
3. **3D render** shows the result instantly in your browser

The AI agent iteratively refines its code until the structure compiles and looks right. Ask for changes like *"add a moat"* or *"make it taller"* and watch it update.

## Supported Models

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Sonnet 4.5, Claude Opus 4.5 |
| **OpenAI** | GPT-4.1, GPT-5 |
| **Google** | Gemini 3 Pro |

## Tech Stack

- **Frontend** — React, Vite, Tailwind CSS, WebGL
- **Backend** — FastAPI, Python
- **3D Renderer** — Deepslate (Minecraft voxel engine)
- **AI** — Multi-provider LLM support with agentic tool-calling loop

## Project Structure

```
minecraft-schematic-gen/
├── backend/                # FastAPI server
│   ├── app/
│   │   ├── agent/          # AI agent, LLM clients, tools
│   │   ├── api/            # REST endpoints
│   │   └── services/       # Session management, validation
│   └── pyproject.toml
├── frontend/               # React + Vite app
│   └── src/components/     # UI components
├── packages/
│   └── deepslate-opt/      # Forked Minecraft voxel renderer
├── evaluation/             # Test prompts and screenshots
└── run.sh                  # Dev server launcher
```

## Configuration

You only need **one** API key from any supported provider:

| Provider | Environment Variable | Get a Key |
|----------|---------------------|-----------|
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| Google | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |

Add your key to `backend/.env`:

```bash
# Only one of these is required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

## Star History

<a href="https://star-history.com/#mattzh72/minecraft-schematic-gen">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" width="100%" />
  </picture>
</a>

## License

MIT — see [LICENSE](LICENSE) for details.
