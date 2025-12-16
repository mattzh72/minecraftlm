# Eval: Fruit Orchard

**Category:** aesthetics
**Difficulty:** easy

---

## Prompt

> Build me a fruit orchard.

---

## What This Tests

Tests the agent's ability to create natural, organic environments with proper grounding. Trees and plants must be connected to terrain, not floating. Also tests creativity in layout and variety.

**Why it's challenging:**
- Natural/organic placement (not rigid grid)
- All vegetation must connect to ground
- Variety in tree types and arrangement
- Terrain should extend appropriately
- Farm/orchard context elements (paths, fencing, buildings)

---

## Expected Output

**Vegetation:**
- [ ] Multiple fruit trees
- [ ] **All trees connected to ground** (not floating)
- [ ] Variety in tree types (different fruits, colors)
- [ ] Reasonable spacing between trees

**Terrain:**
- [ ] Ground/grass terrain
- [ ] Terrain extends to edges (not cut off)
- [ ] Optional: varying elevation/hills

**Context/Creativity:**
- [ ] Organized rows or natural arrangement
- [ ] Optional: paths between trees
- [ ] Optional: fencing around perimeter
- [ ] Optional: barn/shed/building
- [ ] Optional: crops/additional plants

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Floating trees | Trees hovering above ground, not connected |
| No terrain | Trees on tiny patches or floating in void |
| Single tree type | All trees identical, no variety |
| Rigid grid | Perfectly uniform spacing feels unnatural |
| No context | Just trees, no paths/fencing/farm elements |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Spatial Coherence" section | `system_prompt.txt` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Pass | Excellent - terrain with hills, cherry + oak trees, crop rows, path, fencing, barn. All grounded. |

---

## Session Reference

**Session ID:** (to be filled)
