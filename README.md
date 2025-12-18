<div align="center">

# MinecraftLM

</div>

<div align="center">
<h3>Build 3D Worlds from Text — No Code Required</h3>

Project Team: [Matt Zhou](https://x.com/Mattzh1314), [Johnathan Chiu](https://x.com/johnathanchewy), [Preston Bourne](https://x.com/prestonb0urne), [Avinash Jain](https://x.com/avinashj_)

[![BSD4 License](https://img.shields.io/badge/License-BSD4-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/mattzh72/minecraft-schematic-gen?style=flat&logo=github)](https://github.com/mattzh72/minecraft-schematic-gen)
[![Discord](https://img.shields.io/discord/1451023766153855081?logo=discord&label=Discord&color=5865F2)](https://discord.gg/UNfAA4bte2)
</div>


https://github.com/user-attachments/assets/cdeb2167-1383-44ba-887e-fa3545ea08cf


## Table of Contents

- [What is MinecraftLM?](#what-is-minecraftlm)
- [What You Can Build](#what-you-can-build)
- [Quick Start](#quick-start)
- [How to Use the App](#how-to-use-the-app)
- [Features](#features)
  - [Navigation Controls](#navigation-controls)
  - [Lighting Presets](#lighting-presets)
  - [Multi-Turn Building](#multi-turn-building)
- [Configuration](#configuration)
- [Technical Details](#technical-details)

## What is MinecraftLM?

MinecraftLM lets you create 3D structures in Minecraft just by describing them. Type "build me a medieval castle with towers" and watch as an AI agent writes code, validates it, and generates your structure in real-time. Keep the conversation going to add gardens, modify interiors, or place your castle on procedural terrain—the agent maintains context across turns and ensures everything connects spatially.

**No templates, no limits**—the AI writes procedural code to understand spatial relationships, materials, and architectural concepts, giving you the freedom to build anything you can imagine.

## What You Can Build

MinecraftLM can create a wide range of structures—from realistic landmarks to fantasy worlds to functional objects. Here are some examples:

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

### Buildings & Architecture
Build anything from a cozy cottage to a Gothic cathedral. The agent understands architectural concepts like walls, roofs, windows, doors, and can create multi-story structures with furnished interiors.

**Try prompts like:**
- "A medieval castle with four corner towers and a courtyard"
- "A modern glass skyscraper with a rooftop garden"
- "A Japanese temple with cherry blossom trees"

<!-- TODO: Add screenshot of architectural structure with interior view -->

### Vehicles & Objects
Create vehicles with realistic proportions and details—aircraft with proper wing geometry, ships with deck structures, or cars with wheels and windows.

**Try prompts like:**
- "A pirate ship with sails and cannons"
- "A steam locomotive on railroad tracks"
- "A rocket ship on a launch pad"

<!-- TODO: Add screenshot showcasing vehicle generation -->

### Terrain & Landscapes
Generate natural landscapes with mountains, valleys, rivers, and vegetation. Place structures on terrain and watch them integrate seamlessly with automatic foundation filling.

**Try prompts like:**
- "A mountain range with snow-capped peaks and a lake"
- "A desert oasis with palm trees and a water hole"
- "A floating island with waterfalls cascading off the edges"

<!-- TODO: Add screenshot of procedurally generated terrain -->

### Creative & Abstract
The agent can interpret artistic concepts and build abstract sculptures, pixel art, or fantastical creations.

**Try prompts like:**
- "A giant chess set on a checkered plaza"
- "A dragon wrapped around a tower"
- "A spiral staircase ascending into the clouds"

<!-- TODO: Add screenshot of creative/abstract build -->

## Quick Start

### Prerequisites

You'll need these installed on your machine:

- **Python 3.11+** — Download from [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/)
- **uv** (Python package manager) — Install from [docs.astral.sh/uv](https://docs.astral.sh/uv/)
- **API Key** — Get one from [Anthropic](https://console.anthropic.com), [OpenAI](https://platform.openai.com), or [Google](https://aistudio.google.com)

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/mattzh72/minecraft-schematic-gen
cd minecraft-schematic-gen
```

**2. Install backend dependencies**
```bash
cd backend
uv sync
cd ..
```

**3. Install frontend dependencies** (this also builds the 3D renderer)
```bash
cd frontend
npm install
cd ..
```

**4. Configure your API key**
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your API key (see [Configuration](#configuration) below for details).

**5. Launch the application**
```bash
./run.sh
```

This starts both the backend server (port 8000) and frontend (port 5173) with hot reload enabled.

**6. Open your browser**

Navigate to [localhost:5173](http://localhost:5173) and start building!

<!-- TODO: Add screenshot of the initial app interface -->

### Troubleshooting

- **Port already in use**: Stop other processes on ports 8000 or 5173, or edit `run.sh` to use different ports
- **uv not found**: Make sure you've installed uv and it's in your PATH
- **npm install fails**: Try deleting `frontend/node_modules` and running `npm install` again
- **Backend fails to start**: Check that your API key is correctly configured in `backend/.env`

## How to Use the App

MinecraftLM has a simple chat-based interface where you describe what you want to build, and the AI agent generates it in real-time.

### Starting a Session

**1. Create a new session**

Click the "New Session" button in the sidebar to start fresh. Each session maintains its own conversation history and structure.

<!-- TODO: Add screenshot showing the "New Session" button -->

**2. Select your AI model**

Choose from available models (Claude, GPT, or Gemini) using the model selector. Different models may produce different results—experiment to find what works best for your use case.

<!-- TODO: Add screenshot of model selector dropdown -->

### Building Your First Structure

**1. Describe what you want to build**

Type a description in the chat input and press Enter. Be as specific or general as you like:

- Simple: "Build a house"
- Detailed: "Build a two-story Victorian house with a wraparound porch, bay windows, and a turret"
- Complex: "Build a medieval castle with four corner towers, a drawbridge, and a courtyard garden"

<!-- TODO: Add screenshot showing the chat input with a sample prompt -->

**2. Watch the agent work**

You'll see the agent's thought process stream in real-time as it:
- Reads the current code
- Plans the structure
- Writes Python code to generate your build
- Validates the code and checks for errors

<!-- TODO: Add GIF showing the agent streaming thoughts and code execution -->

**3. See your structure render**

Once the code is valid, your structure appears instantly in the 3D viewer on the right. The viewer updates progressively as the agent refines the code.

<!-- TODO: Add screenshot showing the split view with chat on left and 3D viewer on right -->

### Iterating and Refining

The power of MinecraftLM is in the conversation—you can keep building on what you've created:

**Add to your structure:**
- "Add a garden in front with flower beds and a fountain"
- "Put a watchtower on the north wall"
- "Add furniture to the interior rooms"

**Modify existing elements:**
- "Make the roof steeper"
- "Change the walls to stone bricks"
- "Make it taller"

**Place on terrain:**
- "Put this on a mountain"
- "Surround it with a forest"
- "Place it on an island in the middle of a lake"

The agent maintains spatial context—new additions connect seamlessly to existing structures.

<!-- TODO: Add video showing a multi-turn building session from start to finish -->

### Exploring Your Creation

Use the 3D viewer to examine your structure from all angles. See [Navigation Controls](#navigation-controls) below for details.

## Features

MinecraftLM includes powerful features to help you explore and visualize your creations.

### Navigation Controls

The 3D viewer has two camera modes for exploring your structures:

#### Orbit Mode (Default)

Perfect for examining your creation from all angles:

- **Left-click + drag**: Rotate the camera around the structure
- **Right-click + drag**: Pan the camera horizontally and vertically
- **Mouse wheel**: Zoom in and out

<!-- TODO: Add GIF demonstrating orbit controls -->

#### First-Person Mode

Walk through your creation with full collision detection. Click the footprints icon in the viewer toolbar to enter first-person mode.

| Control | Action |
|---------|--------|
| `W` / `S` | Move forward / backward |
| `A` / `D` | Strafe left / right |
| `Space` | Jump |
| `Mouse` | Look around |
| `Esc` | Exit first-person mode |

You can walk through doorways, climb stairs, and explore interiors just like in Minecraft.

<!-- TODO: Add GIF of first-person exploration through a detailed interior -->

### Lighting Presets

Change the time of day to set the mood of your scene. Use the lighting selector in the viewer toolbar to switch between presets:

| Preset | Effect |
|--------|--------|
| **Day** | Bright neutral sunlight with soft shadows—perfect for showcasing architectural details |
| **Sunset** | Golden hour lighting with warm orange key light, purple shadows, and bloom effects |
| **Night** | Cool moonlight with a starfield sky. Light-emitting blocks (torches, lanterns, glowstone) cast warm, realistic point lights |

<!-- TODO: Add side-by-side comparison showing same scene in day/sunset/night lighting -->

### Multi-Turn Building

MinecraftLM maintains context across the entire conversation, allowing you to build complex scenes iteratively.

**How it works:**

1. Start with a base structure: "Build a medieval castle"
2. Add elements: "Add a moat around the castle"
3. Modify details: "Put banners on the towers"
4. Place on terrain: "Put the whole thing on a hilltop with a forest"

The agent remembers everything you've built and ensures new additions connect spatially. If you ask for a garden next to a house, it will actually be adjacent—not floating in space.

**Session management:**

- Each session saves automatically as you build
- Switch between sessions using the sidebar
- Delete sessions you no longer need
- Export your structure for use in Minecraft (coming soon)

<!-- TODO: Add screenshot of the session sidebar showing multiple saved sessions -->

## Configuration

MinecraftLM supports multiple AI providers. You only need **one** API key to get started.

### Getting an API Key

Choose any provider and get an API key:

| Provider | Where to Get Key | Environment Variable |
|----------|-----------------|---------------------|
| **Anthropic** (Claude) | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| **OpenAI** (GPT) | [platform.openai.com](https://platform.openai.com) | `OPENAI_API_KEY` |
| **Google** (Gemini) | [aistudio.google.com](https://aistudio.google.com) | `GEMINI_API_KEY` |

### Setting Up Your API Key

1. Copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Open `backend/.env` in a text editor and add your API key:
   ```bash
   # Add only one of these:
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   # OPENAI_API_KEY=sk-your-key-here
   # GEMINI_API_KEY=your-key-here
   ```

3. Save the file and restart the application if it's already running.

### Supported Models

The app will automatically detect which providers you've configured and show only those models in the selector:

| Provider | Available Models |
|----------|-----------------|
| **Anthropic** | Claude Sonnet 4.5, Claude Opus 4.5 |
| **OpenAI** | GPT-4.1, GPT-5 |
| **Google** | Gemini 3 Pro |

**Note**: Different models have different strengths. Claude models tend to be good at detailed architectural work, while GPT models may excel at creative interpretations. Experiment to find what works best for your use case.

## Technical Details

For developers interested in how MinecraftLM works under the hood:

**Architecture**: MinecraftLM uses an agentic AI system where the language model writes procedural Python code against a custom SDK (inspired by Three.js). This "code-as-interface" approach enables complex spatial reasoning that would be impossible with templates or direct voxel manipulation.

**Agent Loop**: The agent operates in an iterative refinement cycle—it writes code, validates compilation, sees errors with line numbers, and self-corrects until the structure is valid. Each turn streams results in real-time via Server-Sent Events.

**Rendering**: The frontend uses a custom fork of [deepslate](https://github.com/misode/deepslate) with WebGL-based rendering, including features like shadow mapping, emissive lighting for torches and lanterns, and post-processing effects (bloom, fog, SSAO).

**SDK**: The Python SDK provides a scene graph API (`Scene`, `Object3D`, `Block`) plus a terrain system with Perlin noise, domain warping, and procedural tree generation. The agent receives SDK documentation in its system prompt and has access to tools for reading and editing code.

For a complete technical deep-dive, see [CLAUDE.md](CLAUDE.md).

## Star History

<a href="https://star-history.com/#mattzh72/minecraft-schematic-gen">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mattzh72/minecraft-schematic-gen&type=Date" width="100%" />
  </picture>
</a>
