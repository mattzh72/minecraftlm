# Eval: Pyramids of Giza

**Category:** real-world
**Difficulty:** hard

---

## Prompt

**Turn 1:**
> Build the Pyramids of Giza.

**Turn 2:**
> Add King Kong at the top of one of the pyramids. And add a plane flying above.

---

## What This Tests

Tests multi-turn scene building with increasingly creative elements. Starts with realistic landmark, then adds fantastical elements that must be properly positioned in 3D space.

**Why it's challenging:**
- Multiple pyramids with correct relative sizes (Great Pyramid largest)
- Desert terrain (sand)
- King Kong must look like King Kong (not lazy cube)
- Plane must be HIGH in the sky (correct z-axis), not near ground level
- Each addition must integrate spatially with existing scene

---

## Expected Output

**Pyramids (Turn 1):**
- [ ] 3 pyramids (Great Pyramid, Khafre, Menkaure)
- [ ] Correct relative sizes (one largest, one medium, one smallest)
- [ ] Pyramid shape (tapered, pointed top)
- [ ] Sand/desert terrain
- [ ] Sandstone or sand-colored material

**King Kong (Turn 2):**
- [ ] Recognizable gorilla figure (not a lazy box)
- [ ] Positioned ON TOP of a pyramid
- [ ] Proportional size (large, but not bigger than pyramid)
- [ ] Dark colored (black/brown wool or concrete)

**Plane (Turn 3):**
- [ ] Airplane shape (fuselage, wings)
- [ ] **Flying HIGH above the scene** (Y-axis significantly above pyramids)
- [ ] Not sitting on ground or at pyramid height
- [ ] Oriented horizontally (flying, not crashed)

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Single pyramid | Only builds one pyramid instead of the three |
| Lazy King Kong | King Kong is just a brown box instead of gorilla-shaped |
| Low plane | Plane placed at or near ground level instead of high in sky |
| Floating elements | King Kong or plane not spatially connected to scene |
| Wrong pyramid sizes | All pyramids same size instead of varied |

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
