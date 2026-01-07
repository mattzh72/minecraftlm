# LLM Model Comparison for MinecraftLM

Advanced comparison system for evaluating different LLM models on MinecraftLM build tasks with multi-angle screenshot capture.

## Quick Start

```bash
# From backend directory
cd backend
uv run python ../evaluation/compare_models.py
```

## Core Scripts

- **`compare_models.py`** - Main viral comparison script with multi-angle screenshot capture
- **`recapture_angles.py`** - Re-capture existing builds with multiple camera angles (4 angles per build)

## Features

### 🎨 Comprehensive Multi-Angle Screenshot System
- **12 Camera Angles**: Complete coverage from all perspectives
- **Professional Coverage**: Front, right, back, left (each with angled variants), top-down, elevated, and wide overview
- **Automatic Capture**: Each successful build gets 12 professional angles
- **Efficient Recapture**: Re-use existing builds without regeneration

### 🚀 Performance Optimizations
- **Full Parallelization**: ALL 16 builds run simultaneously (not just per-prompt)
- **Massive Speed Boost**: ~5-8 minutes vs 20+ minutes sequential
- **Smart Error Recovery**: Continues testing even if models fail

### 📸 Twitter-Ready Output
- **Viral Prompts**: Carefully selected for maximum engagement
- **Professional Grid**: 4x4 comparison layout with metadata
- **High-Quality Screenshots**: 1920x1080 optimized for social media

## Usage

### Run Full Comparison
```bash
# Generate new comparison with multi-angle screenshots
uv run python ../evaluation/compare_models.py
```

### Add Multiple Angles to Existing Results
```bash
# After main comparison completes, enhance with multiple angles
uv run python ../evaluation/recapture_angles.py
```

## Output Structure

Results saved to `backend/twitter_comparison_results/`:
```
twitter_comparison_results/
├── individual_screenshots/           # All screenshots (multiple angles)
│   ├── model_prompt_front.png       # Front view
│   ├── model_prompt_diagonal.png    # Diagonal view
│   ├── model_prompt_side.png        # Side view
│   └── model_prompt_elevated.png    # Elevated view
├── comparison_results_TIMESTAMP.json # Detailed results with session data
└── twitter_comparison_grid_TIMESTAMP.png # Twitter-ready grid
```

## Models Tested

- **Claude Opus 4.5** - Anthropic's flagship model
- **GPT-5.2** - OpenAI's latest model
- **Gemini 3 Pro Preview** - Google's powerful multimodal model
- **Gemini 3 Flash Preview** - Google's fast model

## Viral Prompts

Optimized for Twitter engagement and visual appeal:

1. **Cyberpunk Tokyo** - "Build a cyberpunk Tokyo street with neon signs and flying cars overhead"
2. **Space Station** - "Build a massive space station orbiting Earth with solar panels and docking bays"
3. **Dragon's Lair** - "Create an ancient dragon's lair inside a volcanic mountain with treasure chambers"
4. **Pirate Ship Storm** - "Make a pirate ship sailing through a storm with dramatic waves and lightning"

## Camera Angles

Each successful build captures 12 comprehensive angles:

**🎯 Cardinal Views:**
- Front, Right, Back, Left sides
- Each with angled variant for depth

**🏔️ Elevated Views:**
- Top-down overview
- Top-angled perspective
- Elevated diagonal view
- Wide overview shot

## Requirements

- MinecraftLM backend running (`./run.sh`)
- Python dependencies in `backend/pyproject.toml` testing group:
  - `playwright>=1.50.0`
  - `aiohttp>=3.10.0`
  - `pillow>=10.0.0`
- Playwright browser: `playwright install chromium`

## Performance

- **Runtime**: ~5-8 minutes (full parallel) vs 20+ minutes (sequential)
- **Success Rate**: ~85-95% depending on model/prompt complexity
- **Output**: 4-16 builds × 12 angles = 48-192 total screenshots per run