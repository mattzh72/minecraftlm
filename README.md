# MinecraftLM

### Build 3D Minecraft Worlds from Text

Project Team: [Matt Zhou](https://x.com/Mattzh1314), [Johnathan Chiu](https://x.com/johnathanchewy), [Preston Bourne](https://x.com/prestonb0urne), [Avinash Jain](https://x.com/avinashj_)

[![GPLv3 License](https://img.shields.io/badge/License-gplv3-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/mattzh72/minecraft-schematic-gen?style=flat&logo=github)](https://github.com/mattzh72/minecraft-schematic-gen)
[![Discord](https://img.shields.io/discord/1451023766153855081?logo=discord&label=Discord&color=5865F2)](https://discord.gg/UNfAA4bte2)



https://github.com/user-attachments/assets/cbb5d430-2e33-4704-89e9-fba45e2197e5



## Table of Contents

- [What is MinecraftLM?](#what-is-minecraftlm)
- [What You Can Build](#what-you-can-build)
- [Quick Start](#quick-start)
- [Configuration](#configuration)

## What is MinecraftLM?

MinecraftLM lets you create 3D structures in Minecraft just by describing them. Type "build me a medieval castle with towers" and watch as an AI agent writes code, validates it, and generates your structure in real-time. Keep the conversation going to add gardens, modify interiors, or place your castle on terrain—the agent maintains context across turns and ensures everything connects spatially.

**No templates, no limits**—the AI writes code to understand spatial relationships, materials, and architectural concepts, giving you the freedom to build anything you can imagine.

## What You Can Build

MinecraftLM can create a wide range of structures—from realistic landmarks to fantasy worlds to functional objects.

### Buildings & Architecture
Build anything from a cozy cottage to a Gothic cathedral. The agent understands architectural concepts like walls, roofs, windows, doors, and can create multi-story structures with furnished interiors.

<table>
  <tr>
    <td><img height="300" alt="PNG image" src="https://github.com/user-attachments/assets/f31ba390-1819-44d9-a19a-9b75e909de6a" />
</td>
    <td><img height="300" alt="Screenshot 2025-12-18 at 1 46 24 PM" src="https://github.com/user-attachments/assets/a9ed58fe-ad08-447f-8eaa-91a0e2c00797" />
</td>
  </tr>
</table>

### Vehicles & Objects
Create vehicles with realistic proportions and details—aircraft with proper wing geometry, ships with deck structures, or cars with wheels and windows.

<table>
  <tr>
    <td><img height="300" alt="CleanShot 2025-12-18 at 01 55 18@2x" src="https://github.com/user-attachments/assets/1acf4c89-d083-4a0d-be47-7017b3e951d1" /></td>
    <td><img height="300" alt="Screenshot 2025-12-18 at 1 23 12 PM" src="https://github.com/user-attachments/assets/222a6e40-bf83-4c42-b911-52fd02ed3544" />
</td>
  </tr>
</table>

### Terrain & Landscapes
Generate natural landscapes with mountains, valleys, rivers, and vegetation. Place structures on terrain and watch them integrate seamlessly with automatic foundation filling.

<table>
  <tr>
    <td><img height="300" alt="CleanShot 2025-12-18 at 03 48 57@2x" src="https://github.com/user-attachments/assets/62d40912-b6b0-4bbe-acc5-41ba083019f1" /></td>
    <td><img height="300" alt="CleanShot 2025-12-18 at 03 30 31@2x" src="https://github.com/user-attachments/assets/e594e537-f49a-440c-ab68-aef093b598e3" /></td>
  </tr>
</table>


### Creative & Abstract
The agent can interpret artistic concepts and build abstract sculptures, pixel art, or fantastical creations.

<table>
  <tr>
    <td><img height="300" alt="Screenshot 2025-12-18 at 12 54 16 PM" src="https://github.com/user-attachments/assets/cbc3c09b-64c5-47f6-ad32-53d9283c9637" /></td>
    <td><img height="300" alt="Screenshot 2025-12-18 at 1 33 40 PM" src="https://github.com/user-attachments/assets/d47654ba-86f0-4bf6-9139-df855096d2dd" />
</td>
  </tr>
</table>

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
git clone https://github.com/mattzh72/minecraftlm.git
cd minecraftlm
```

**2. Install backend dependencies**
```bash
cd backend && uv sync && cd ..
```

**3. Install frontend dependencies** (this also builds the 3D renderer)
```bash
cd frontend && npm install && cd ..
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
(OR in development mode `./run.sh --reload`)

This starts both the backend server (port 8000) and frontend (port 5173) with hot reload enabled.

**6. Open your browser**

Navigate to [localhost:5173](http://localhost:5173) and start building!

<!-- TODO: Add screenshot of the initial app interface -->

### Troubleshooting

- **Port already in use**: Stop other processes on ports 8000 or 5173, or edit `run.sh` to use different ports
- **uv not found**: Make sure you've installed uv and it's in your PATH
- **npm install fails**: Try deleting `frontend/node_modules` and running `npm install` again
- **Backend fails to start**: Check that your API key is correctly configured in `backend/.env`

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
|----------|------------------|
| **Anthropic** | Claude Opus 4.5  |
| **OpenAI** | GPT-5.2          |
| **Google** | Gemini 3 Pro     |


---

Made with 💜 in San Francisco and New York City
