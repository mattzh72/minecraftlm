# Eval: San Francisco Skyline

**Category:** real-world
**Difficulty:** hard

---

## Prompt

> Generate me the skyline of San Francisco.

---

## What This Tests

Tests the agent's ability to think big and create sprawling, detailed cityscapes. San Francisco has iconic features (hills, landmarks) that should be recognizable. The agent should not constrain itself to a small area.

**Why it's challenging:**
- Scale: Should be large/sprawling, not cramped
- Terrain: SF is famous for rolling hills
- Landmarks: Transamerica Pyramid, Salesforce Tower, etc.
- Quantity: Tens of buildings, not just a few
- Variety: Different building heights, styles, colors
- Context: Bay, bridges visible from skyline

---

## Expected Output

**Terrain:**
- [ ] **Rolling hills** (SF's signature topography)
- [ ] Sprawling footprint (not constrained to small area)
- [ ] Optional: Water/bay visible

**Buildings:**
- [ ] Many skyscrapers (10+)
- [ ] Variety in height
- [ ] Variety in style/color
- [ ] Recognizable landmarks (Transamerica Pyramid, Salesforce Tower)
- [ ] Dense downtown cluster

**Landmarks:**
- [ ] Transamerica Pyramid (distinctive pointed top)
- [ ] Salesforce Tower (tall, tapering)
- [ ] Optional: Golden Gate Bridge in distance
- [ ] Optional: Coit Tower

**Scale:**
- [ ] Feels like a city, not a few buildings
- [ ] Agent "thinks big" - not artificially constrained

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Flat terrain | No hills - SF is defined by its hills |
| Too few buildings | 5-6 buildings instead of a skyline |
| No landmarks | Generic boxes, nothing recognizable as SF |
| Small/cramped | Agent constrains to small area instead of sprawling |
| All same height | No variety in building heights |
| No context | Just buildings on flat plane, no bay/terrain |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| None yet | - | - |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | ~8 buildings with variety, but: flat terrain (no hills), small footprint, no recognizable SF landmarks, not sprawling |

---

## Session Reference

**Session ID:** (to be filled)

---

## Notes

This eval tests whether the agent can "think big." A skyline should feel expansive, not like a few buildings on a small platform. The rolling hills of SF are essential to its character.
