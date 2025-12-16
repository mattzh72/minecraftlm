# Eval: Sydney Opera House

**Category:** real-world
**Difficulty:** very-hard

---

## Prompt

> Build the Sydney Opera House.

---

## What This Tests

Tests the agent's ability to approximate extremely curved, organic architecture in voxels. The Sydney Opera House's sail-shaped shells are nearly impossible to recreate accurately in a blocky medium.

**Why it's challenging:**
- Curved shell roofs (signature sail shapes)
- Multiple overlapping shell structures
- Organic, non-rectilinear geometry
- Voxel approximation of curves is inherently limited
- Recognizability depends on getting the shells right

---

## Expected Output

- [ ] Multiple shell/sail roof structures
- [ ] Shells have curved profile (not flat triangles)
- [ ] Waterfront platform/base
- [ ] White material for shells
- [ ] Recognizable as Sydney Opera House (even if simplified)
- [ ] Shells arranged in characteristic grouping

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Flat triangles | Shells are simple triangular prisms instead of curved |
| Single shell | Only one roof structure instead of the characteristic multiple shells |
| Wrong arrangement | Shells not grouped in the iconic pattern |
| No platform | Missing the waterfront base/podium |
| Unrecognizable | Output doesn't read as Sydney Opera House |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add voxel curve approximation guidance | `06-implementation-guidelines.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| | | | |

---

## Session Reference

**Session ID:** (to be filled after run)

---

## Notes

This is intentionally a near-impossible eval. Success is defined as "recognizable attempt" rather than "accurate recreation." The curved shells of the Opera House push the limits of what voxels can represent.
