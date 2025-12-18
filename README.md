# MinecraftLM <small>An Agentic System for Generative 3D Voxel Worlds</small>

<div align="center">

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/mattzh72/minecraft-schematic-gen?style=flat&logo=github)](https://github.com/mattzh72/minecraft-schematic-gen)
[![Discord](https://img.shields.io/discord/1451023766153855081?logo=discord&label=Discord&color=5865F2)](https://discord.gg/UNfAA4bte2)
</div>

Project Team: [Matt Zhou](https://x.com/Mattzh1314), [Johnathan Chiu](https://x.com/johnathanchewy), [Preston Bourne](https://x.com/prestonb0urne), [Avinash Jain](https://x.com/avinashj_)

https://github.com/user-attachments/assets/cdeb2167-1383-44ba-887e-fa3545ea08cf

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Agent Design Capabilities](#agent-design-capabilities)
  - [Procedural Terrain & Nature](#procedural-terrain--nature)
  - [Voxel Art & Object Synthesis](#voxel-art--object-synthesis)
  - [Architectural Generation](#architectural-generation)
- [Interactive Scene Experience](#interactive-scene-experience)
  - [Navigation Controls](#navigation-controls)
  - [Dynamic Lighting System](#dynamic-lighting-system)
- [Technical Architecture](#technical-architecture)
- [Configuration](#configuration)
- [License](#license)

---

## Overview

MinecraftLM is an agentic AI system that synthesizes 3D voxel structures from natural language descriptions. Unlike template-based generators, the system employs a code-generation architecture where a language model writes procedural Python code against a purpose-built SDK, enabling compositional reasoning over spatial relationships, material selection, and structural coherence.

The agent operates in an iterative refinement loop—generating code, validating compilation, and self-correcting until the structure satisfies both syntactic constraints and semantic intent. Multi-turn conversations enable progressive scene elaboration: users can request additions, modifications, or refinements while the agent maintains spatial continuity across the existing structure.

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

---

## Quick Start

### Prerequisites

- **Python 3.11+** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **uv** (Python package manager) — [docs.astral.sh/uv](https://docs.astral.sh/uv/)
- **API key** from Anthropic, OpenAI, or Google

### Installation

```bash
git clone https://github.com/mattzh72/minecraft-schematic-gen
cd minecraft-schematic-gen

# Backend
cd backend && uv sync && cd ..

# Frontend (also builds the 3D renderer)
cd frontend && npm install && cd ..

# Configure API key
cp backend/.env.example backend/.env
# Edit backend/.env with your key (see Configuration)

# Launch
./run.sh
```

Open [localhost:5173](http://localhost:5173) and start building.

---

## Agent Design Capabilities

The agent generates structures by writing Python code against a spatial SDK—enabling compositional reasoning over geometry, materials, and spatial relationships that would be impossible with templates.

### Procedural Terrain & Nature

The SDK includes a terrain system built on Perlin noise with domain warping:

- **Landforms**: Mountains with snow caps, ridges, plateaus, valleys, gorges, craters
- **Water**: Oceans, lakes, rivers with proper underwater layers and beach transitions
- **Vegetation**: Procedural trees and flora placement

```python
terrain = create_terrain(256, 256, water_level=65, seed=42)
terrain.add_mountain(180, 128, radius=40, height=55, snow=True)
terrain.add_lake(80, 80, radius=30, depth=12)
terrain.generate()
```

Structures can be dropped onto terrain with automatic foundation fill, maintaining spatial continuity.

### Voxel Art & Object Synthesis

The SDK provides a Three.js-style scene graph for composing objects hierarchically:

- **Vehicles**: Aircraft with fuselage geometry, wing profiles, engine nacelles
- **Organic forms**: Animal sculptures, statues, botanical arrangements  
- **Functional objects**: Furniture, mechanical contraptions, sports equipment

The agent understands real-world topology—a 747 isn't just a cylinder with wings, but a structure with nose taper, cockpit angles, tail geometry, and engine placement.

<!-- TODO: Add GIF showcasing voxel art generation process -->

### Architectural Generation

Architecture requires integrating structure, interiors, and details:

- **Structure**: Walls with apertures, various roof geometries, multi-story construction
- **Interiors**: Room partitioning, furniture, lighting fixtures
- **Styles**: Classical monuments, infrastructure, vernacular buildings, modern forms

**Multi-turn coherence**: When adding elements to existing scenes, the agent maintains spatial relationships—new gardens connect to houses via continuous terrain, not floating islands.

<!-- TODO: Add GIF of multi-turn building session with interior walkthrough -->

---

## Interactive Scene Experience

Structures render in a real-time WebGL viewer with camera controls and physics-based exploration.

### Navigation Controls

**Orbit Mode**: Left-drag to rotate, right-drag to pan, scroll to zoom.

**First-Person Mode**: Click the footprints icon to walk through your creation. Full collision detection—walk through doorways, climb stairs, explore interiors.

| Control | Action |
|---------|--------|
| `W/S` | Forward / Back |
| `A/D` | Strafe |
| `Space` | Jump |
| `Mouse` | Look |
| `Esc` | Exit |

<!-- TODO: Add GIF of first-person exploration through a detailed interior -->

### Dynamic Lighting System

Three presets alter scene atmosphere:

| Preset | Effect |
|--------|--------|
| **Day** | Bright neutral light, soft shadows |
| **Sunset** | Golden hour with orange key light, purple shadows, bloom |
| **Night** | Moonlight with starfield; emissive blocks (glowstone, lanterns, torches) cast warm light |

<!-- TODO: Add GIF comparing same scene across day/sunset/night lighting -->

---

## Technical Architecture

```
minecraft-schematic-gen/
├── backend/                    # FastAPI server
│   ├── app/
│   │   ├── agent/              # Agentic generation system
│   │   │   ├── llms/           # Multi-provider LLM clients
│   │   │   ├── minecraft/      # Voxel SDK & terrain system
│   │   │   │   ├── sdk.py      # Scene graph, Block, Object3D
│   │   │   │   ├── terrain/    # Procedural terrain generation
│   │   │   │   └── docs/       # SDK documentation (agent context)
│   │   │   └── tools/          # Code editing tools for agent
│   │   ├── api/                # REST endpoints
│   │   └── services/           # Session & validation services
│   └── pyproject.toml
├── frontend/                   # React + Vite application
│   └── src/
│       ├── components/         # UI components
│       └── hooks/              # WebGL rendering, physics, controls
├── packages/
│   └── deepslate-opt/          # Forked Minecraft voxel renderer
└── evaluation/                 # Benchmark prompts & screenshots
```

**Supported Models:**

| Provider | Models |
|----------|--------|
| **Anthropic** | Claude Sonnet 4.5, Claude Opus 4.5 |
| **OpenAI** | GPT-4.1, GPT-5 |
| **Google** | Gemini 3 Pro |

---

## Configuration

You need **one** API key from any supported provider:

| Provider | Environment Variable | Get a Key |
|----------|---------------------|-----------|
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| Google | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |

Add to `backend/.env`:

```bash
# Only one required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

---

## Star History

<a href="https://star-history.com/#mattzh72/minecraft-schematic-gen">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" width="100%" />
  </picture>
</a>

---

## License

MIT — see [LICENSE](LICENSE) for details.
