# Eval: Taj Mahal

**Category:** real-world
**Difficulty:** hard

## Prompt

**Turn 1:**
> Build me the Taj Mahal.

**Turn 2:**
> Add the gardens in front of the Taj Mahal.

## Tests

Iconic landmark with specific architecture. Tests dome geometry, symmetry, and multi-turn coherence (gardens must connect to structure).

## Pass Criteria

**Turn 1:**
- [ ] Central onion-shaped dome
- [ ] 4 minarets at corners
- [ ] Arched entrance portals
- [ ] Raised platform/base
- [ ] White material
- [ ] Symmetrical design

**Turn 2:**
- [ ] Charbagh layout (4 quadrants)
- [ ] Central reflecting pool
- [ ] Pathways
- [ ] **Gardens connected to platform** (not floating)

## Failure Modes

| Mode | Description |
|------|-------------|
| Missing minarets | Only central structure, no corner towers |
| Flat dome | Box or poorly approximated curve |
| Floating gardens | Gardens as disconnected island |
| No water feature | Missing reflecting pool |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-17 | gemini-3-pro-preview | Pass | Onion dome, 4 minarets, arched entrance, white marble, charbagh gardens with water channels, pathways, trees, flowers—all connected to platform |
