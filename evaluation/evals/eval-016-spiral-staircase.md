# Eval: Spiral Staircase

**Category:** geometry
**Difficulty:** medium

## Prompt

> Build a spiral staircase.

## Tests

Geometric reasoning AND default design quality. Should feel grand and architectural without asking—platforms, railings, lighting should come by default.

## Pass Criteria

**Geometry:**
- [ ] Correct spiral/helix shape
- [ ] Stairs continuously connected (no gaps)
- [ ] Stair blocks oriented correctly
- [ ] Reasonable height

**Grandness (should be default):**
- [ ] Wider landings at intervals
- [ ] Railings or posts
- [ ] Lighting (torches, lanterns)
- [ ] Material variety
- [ ] Central column or open center

**Context:**
- [ ] Not floating in void
- [ ] Base/ground connection

## Failure Modes

| Mode | Description |
|------|-------------|
| Minimal spiral | Bare stairs—no grandness |
| No landings | Continuous without platforms |
| No lighting | Dark staircase |
| Single material | All one block type |
| Floating | No ground or context |
| Gaps | Stairs not connected |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Geometry correct but: minimal, no platforms, no lighting, single material, floating |
| 2025-12-17 | gemini-3-pro-preview | Partial | Spiral geometry, central column, material variety (chiseled copper), decorative posts, base platform. Missing: lighting, defined landings |
