# Eval: Golden Gate Bridge

**Category:** real-world
**Difficulty:** hard

## Prompt

> The golden gate bridge with the ocean

## Tests

Famous landmark with terrain integration. Tests catenary cable math, water placement, and recognizable proportions.

## Pass Criteria

- [ ] Two main towers with cross-bracing
- [ ] Suspension cables with catenary curves
- [ ] Road deck spanning between towers
- [ ] Iconic red/orange color
- [ ] Water/ocean beneath bridge
- [ ] Land/terrain on both ends
- [ ] Recognizable as Golden Gate Bridge

## Failure Modes

| Mode | Description |
|------|-------------|
| No terrain | Bridge floating in void without water or land |
| Straight cables | Suspension cables are diagonal lines, not curves |
| Missing cross-bracing | Towers are solid blocks, not lattice |
| Wrong color | Gray/white instead of red |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Pass | Catenary cables, cross-braced towers, water, terrain both ends |
