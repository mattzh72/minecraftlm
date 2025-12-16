# Eval: Pentagon with 10 Flags

**Category:** counting
**Difficulty:** medium

---

## Prompt

**Turn 1:**
> Build me the Pentagon in Washington DC. There should be 10 flags on top of the Pentagon.

**Turn 2:**
> Add a waterfall in the center courtyard, flowing down from a cliff.

---

## What This Tests

Tests the agent's ability to handle exact counts and geometric shapes. The Pentagon requires 5-sided geometry, and the flags must total exactly 10 with symmetric positioning.

**Why it's challenging:**
- Pentagon geometry (5 sides, not 4 or 6)
- Exact count requirement (10 flags, not 8 or 12)
- Symmetric flag placement (should be evenly distributed)
- Concentric rings (Pentagon has inner courtyard)
- Real-world reference accuracy

---

## Expected Output

**Pentagon (Turn 1):**
- [ ] 5-sided pentagonal structure
- [ ] Concentric rings (outer walls + inner courtyard)
- [ ] Central courtyard (green/grass)
- [ ] **Exactly 10 flags**
- [ ] Flags symmetrically positioned (5 at vertices + 5 at midpoints, or similar)
- [ ] Flags visible and recognizable (pole + colored block)

**Waterfall (Turn 2):**
- [ ] Cliff structure in courtyard
- [ ] **Water blocks placed all the way down** (not just 1 source block)
- [ ] Water reaches bottom/pool
- [ ] Agent understands static renderer (no physics)

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Wrong flag count | 8, 9, 11, or 12 flags instead of exactly 10 |
| Asymmetric placement | Flags clustered on one side or unevenly spaced |
| Wrong shape | Hexagon, square, or irregular polygon instead of pentagon |
| No courtyard | Solid pentagon without the iconic inner open space |
| Single water block | Agent places 1 water source expecting physics to flow it down |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Static Renderer" section (water doesn't flow) | `03-blocks-reference.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Turn 1 Pass | Correct pentagon shape, exactly 10 flags (5 vertices + 5 midpoints) |
| 2025-12-15 | gemini-3-pro-preview | Turn 2 Fail | Only placed 1 water block - expected physics to flow |

---

## Session Reference

**Session ID:** (to be filled)
