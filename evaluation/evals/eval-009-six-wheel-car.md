# Eval: Six Wheel Car

**Category:** geometry
**Difficulty:** medium

---

## Prompt

> Build me a car with 6 wheels.

---

## What This Tests

Tests the agent's creativity and attention to detail. A 6-wheel car is unusual, requiring creative interpretation (truck? limo? custom vehicle?). Also tests whether the agent puts effort into details or takes lazy shortcuts.

**Why it's challenging:**
- Creative interpretation required (what does a 6-wheel car look like?)
- Detail work (wheels, mirrors, windshield) - no lazy single-block components
- Symmetry requirements (vehicle should be balanced)
- Proper wheel placement for 6 wheels (2-2-2? 2-4? other?)

---

## Expected Output

**Structure:**
- [ ] Recognizable car/vehicle shape
- [ ] **Exactly 6 wheels**
- [ ] Wheels are multi-block (not single black cubes)
- [ ] Windshield/windows
- [ ] Side mirrors
- [ ] Headlights and taillights
- [ ] Symmetric design (left matches right)

**Creativity:**
- [ ] Interesting interpretation of 6-wheel vehicle (truck, limo, military, custom)
- [ ] Proportions make sense for wheel configuration

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Lazy wheels | Wheels are single blocks instead of multi-block circles/cylinders |
| Missing details | No mirrors, no windshield, no lights |
| Asymmetric | Left and right sides don't match |
| Wrong wheel count | 4 or 8 wheels instead of exactly 6 |
| Boring interpretation | Generic box car instead of creative 6-wheel design |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Design Quality Guidelines" | `06-implementation-guidelines.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Partial | Good shape (pickup truck), 6 wheels, headlights, windows. But wheels are single blocks (lazy), no visible side mirrors |

---

## Session Reference

**Session ID:** (to be filled)
