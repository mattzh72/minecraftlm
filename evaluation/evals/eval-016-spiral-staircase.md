# Eval: Spiral Staircase

**Category:** geometry
**Difficulty:** medium

---

## Prompt

> Build a spiral staircase.

---

## What This Tests

Tests geometric reasoning (helical math) AND design quality. A spiral staircase should not just be functional - it should feel grand and architectural by default, without needing to ask for it.

**Why it's challenging:**
- Helix geometry (stair rotation per step)
- Stair block orientation at each position
- Grandness should come by default
- Continuous, connected stairs (no gaps)
- Decorative elements expected

---

## Expected Output

**Geometry:**
- [ ] Correct spiral/helix shape
- [ ] Stairs connected continuously (no gaps)
- [ ] Stair blocks oriented correctly per step
- [ ] Reasonable height

**Grandness (should be default):**
- [ ] Wider platforms/landings at intervals
- [ ] Decorative elements (railings, posts)
- [ ] Lighting (torches, lanterns)
- [ ] Material variety (not single block type)
- [ ] Central column or open center

**Context:**
- [ ] Not floating in void
- [ ] Base/ground connection
- [ ] Optional: surrounding structure

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Minimal spiral | Just bare stairs spiraling up - no grandness |
| No landings | Continuous stairs without wider platforms |
| No lighting | Dark staircase without torches/lanterns |
| Single material | All one block type, no variety |
| Floating | No ground or context, just spiral in void |
| No railings | Missing safety/decorative railings |
| Gaps in stairs | Stairs not continuously connected |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Design Quality Guidelines" | `06-implementation-guidelines.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Geometric spiral correct, but: minimal design, no platforms, no lighting, no decoration, single material, floating in void |

---

## Session Reference

**Session ID:** (to be filled)

---

## Notes

Compare to earlier 100-block spiral staircase test where user explicitly asked for "grand" - that one had platforms, torches, material variety. This eval tests whether grandness comes **by default** without prompting.
