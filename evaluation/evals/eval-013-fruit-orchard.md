# Eval: Fruit Orchard

**Category:** aesthetics
**Difficulty:** easy

## Prompt

> Build me a fruit orchard.

## Tests

Natural environment with proper grounding. All vegetation must connect to terrain. Tests layout variety and farm context.

## Pass Criteria

- [ ] Multiple fruit trees
- [ ] **All trees connected to ground** (not floating)
- [ ] Variety in tree types
- [ ] Reasonable spacing
- [ ] Terrain extends to edges
- [ ] Optional: paths, fencing, barn

## Failure Modes

| Mode | Description |
|------|-------------|
| Floating trees | Trees hover above ground |
| No terrain | Trees on tiny patches or void |
| Single tree type | All identical |
| Rigid grid | Perfectly uniform feels unnatural |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Pass | Terrain with hills, mixed trees, crops, path, fencing, barn. All grounded |
