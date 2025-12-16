# Eval: Basketball Court

**Category:** real-world
**Difficulty:** medium

---

## Prompt

> Generate me a basketball court.

---

## What This Tests

Tests the agent's understanding of real-world sports infrastructure with strict symmetry requirements. Basketball courts have specific proportions, markings, and equipment that must all be present and correctly sized relative to each other.

**Why it's challenging:**
- Perfect symmetry required (mirrored on both ends)
- Multiple court markings (3-point line, key, center circle)
- Equipment on both ends (hoops, backboards, poles)
- Proportions matter (court dimensions, line distances)
- Terrain/surroundings for context

---

## Expected Output

**Hoops (both ends):**
- [ ] Backboard (rectangular, elevated)
- [ ] Rim/hoop attached to backboard
- [ ] Net hanging from rim
- [ ] Support pillar/pole

**Court Markings:**
- [ ] 3-point line (arc) on both ends
- [ ] Key/paint area (rectangle near hoop)
- [ ] Free throw line
- [ ] Center circle
- [ ] Court boundaries (sidelines, baselines)

**Symmetry & Proportions:**
- [ ] Both ends are mirror images
- [ ] Court feels properly proportioned (not too wide/narrow)
- [ ] Hoops at correct height relative to court
- [ ] 3-point line at realistic distance from hoop

**Terrain:**
- [ ] Court surface (hardwood, concrete)
- [ ] Terrain extends beyond court boundaries
- [ ] Optional: bleachers, benches, fencing

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| One hoop only | Only builds one end, forgetting the other |
| No net | Backboard and rim but missing the net |
| Missing 3-point line | Court without the arc |
| Asymmetric | Both ends don't match |
| Bad proportions | Court too square, 3-point line too close/far |
| No pole/pillar | Backboard floating without support structure |
| Floating court | No terrain around or under the court |

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

---

## Reference Proportions

For realism, approximate these ratios:
- Court: ~94 ft long × 50 ft wide (roughly 2:1 ratio)
- 3-point line: ~24 ft from hoop center
- Key width: ~16 ft
- Hoop height: 10 ft from ground

In Minecraft blocks, a reasonable scale:
- Court: ~47 × 25 blocks (or scaled version)
- Hoop height: ~5 blocks above court
