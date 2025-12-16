# Eval: Taj Mahal

**Category:** real-world
**Difficulty:** hard

---

## Prompt

**Turn 1:**
> Build me the Taj Mahal.

**Turn 2:**
> Add the gardens in front of the Taj Mahal.

---

## What This Tests

Tests the agent's ability to recreate an iconic real-world landmark with architectural accuracy. The Taj Mahal has specific features that must be present for it to be recognizable.

**Why it's challenging:**
- Specific architectural elements (4 minarets, central dome, arched entrances)
- Symmetry requirements
- Dome/curved geometry in voxels
- Multi-turn: gardens must integrate with existing structure (spatial coherence)
- Scale and proportions matter for realism

---

## Expected Output

**Architecture (Turn 1):**
- [ ] Central dome (onion-shaped)
- [ ] 4 minarets at corners
- [ ] Arched entrance portals
- [ ] Raised platform/base
- [ ] White material (quartz, white concrete)
- [ ] Symmetrical design

**Gardens (Turn 2):**
- [ ] Charbagh layout (4 quadrants)
- [ ] Central water channel/reflecting pool
- [ ] Pathways
- [ ] Vegetation (trees, grass)
- [ ] Gardens connected to Taj Mahal platform (not floating)

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Missing minarets | Only builds central structure without the 4 corner towers |
| Flat dome | Dome is a box or poorly approximated curve |
| Floating gardens | Gardens placed as disconnected island from main structure |
| Wrong proportions | Minarets too short, dome too small, etc. |
| No water feature | Missing the iconic reflecting pool/channels |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Spatial Coherence" section | `system_prompt.txt` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| | | | |

---

## Session Reference

**Session ID:** (to be filled after run)
