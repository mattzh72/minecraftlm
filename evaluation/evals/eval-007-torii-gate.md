# Eval: Japanese Torii Gate

**Category:** real-world
**Difficulty:** easy

---

## Prompt

> Build a Japanese torii gate with surrounding terrain.

---

## What This Tests

Tests the agent's ability to build a simple but iconic structure with appropriate terrain integration. Torii gates are traditionally placed in natural settings (paths, water, forests) so terrain matters.

**Why it's challenging:**
- Specific architectural form (two uprights, two crossbars with curved top)
- Terrain integration is essential (not floating in void)
- Material choice matters (traditionally red/vermillion)
- Setting/context affects the feel (path leading to it, water, trees)

---

## Expected Output

**Structure:**
- [ ] Two vertical pillars
- [ ] Two horizontal crossbars (kasagi on top, nuki below)
- [ ] Top crossbar extends past pillars
- [ ] Red/vermillion color (red concrete, red wool, etc.)

**Terrain:**
- [ ] Ground beneath and around the gate
- [ ] Path leading through the gate
- [ ] Contextual elements (water, trees, stone lanterns, etc.)
- [ ] Not floating in void

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| No terrain | Gate floating in empty space |
| Minimal terrain | Terrain only under pillars, doesn't extend around gate to create setting |
| Wrong proportions | Crossbars too short, pillars too thin |
| Missing top curve | Top crossbar is flat instead of slightly curved upward at ends |
| No context | Gate exists but no path, setting, or environmental elements |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Spatial Coherence" section | `system_prompt.txt` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Structure good (red, black top, path), but terrain only under pillars - doesn't extend around gate |

---

## Session Reference

**Session ID:** (to be filled after run)
