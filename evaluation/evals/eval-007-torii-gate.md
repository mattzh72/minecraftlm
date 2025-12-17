# Eval: Japanese Torii Gate

**Category:** real-world
**Difficulty:** easy

## Prompt

> Build a Japanese torii gate with surrounding terrain.

## Tests

Simple structure with terrain integration. Prompt explicitly asks for terrain—tests whether ground extends around the gate.

## Pass Criteria

- [ ] Two vertical pillars
- [ ] Two horizontal crossbars
- [ ] Top crossbar extends past pillars
- [ ] Red/vermillion color
- [ ] Ground beneath and around gate
- [ ] **Terrain extends beyond just the base**
- [ ] Path or contextual elements

## Failure Modes

| Mode | Description |
|------|-------------|
| No terrain | Gate floating in void |
| Minimal terrain | Ground only under pillars |
| Wrong proportions | Crossbars too short, pillars too thin |
| No context | Gate without path or setting |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Good structure but terrain only under pillars |
