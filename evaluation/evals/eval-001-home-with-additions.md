# Eval: Home with Additions

**Category:** spatial-coherence
**Difficulty:** medium

---

## Prompt

**Turn 1:**
> Build me a home with a bed inside.

**Turn 2:**
> Add a garden. Build me a road. Build me a car in my driveway.

---

## What This Tests

Tests whether the agent maintains spatial coherence when adding multiple elements to an existing structure. The additions must connect to the house via continuous terrain, not float as separate islands.

**Why it's challenging:**
- Multiple simultaneous additions (garden + road + car)
- Must integrate with existing structure's position
- Requires filling terrain between elements
- Driveway must logically connect car → road → house

---

## Expected Output

- [ ] House with bed inside
- [ ] Garden with white picket fence
- [ ] Road
- [ ] Car in driveway
- [ ] **All elements connected by continuous terrain (no floating islands)**
- [ ] Driveway connecting car to road

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Floating additions | Garden, road, and car placed as disconnected islands in void |
| No shared ground | Each element has its own tiny ground patch instead of continuous terrain |
| Missing driveway | Car placed but no driveway connecting to road |
| No spatial relationship | Elements placed at random coordinates with no logical layout |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Spatial Coherence" section to system prompt | `system_prompt.txt` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Additions floated as disconnected islands |

---

## Session Reference

**Session ID:** `c72dde7f-437e-4529-9b6b-4e55f0e285b1`
