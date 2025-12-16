# Eval: Hedge Maze

**Category:** geometry
**Difficulty:** medium

---

## Prompt

> Create a hedge maze.

---

## What This Tests

Tests the agent's creativity and algorithmic thinking. A maze requires planning - it should be solvable with a clear path from entrance to exit. Also tests whether the agent creates context around the maze (terrain, surroundings).

**Why it's challenging:**
- Maze must be solvable (not just random walls)
- Requires entrance and exit points
- Creative layout (not boring grid)
- Terrain should extend beyond the maze
- Aesthetic choices (hedge material, path material, decorations)

---

## Expected Output

**Structure:**
- [ ] Recognizable maze layout
- [ ] Walls made of hedge blocks (leaves, hedges)
- [ ] Clear entrance point
- [ ] Clear exit point
- [ ] **Maze is solvable** (path exists from entrance to exit)
- [ ] Paths are walkable (1-2 blocks wide minimum)

**Terrain:**
- [ ] Ground/floor inside maze (grass, gravel, stone)
- [ ] **Terrain extends beyond maze** (not floating in void)
- [ ] Context around maze (garden, lawn, etc.)

**Aesthetics:**
- [ ] Interesting/creative layout (not boring grid)
- [ ] Consistent hedge height
- [ ] Optional: decorations (flowers, fountains, benches)
- [ ] Optional: center destination (fountain, statue, gazebo)

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Unsolvable maze | Dead ends everywhere, no actual path from entrance to exit |
| No entrance/exit | Fully enclosed with no way in or out |
| Floating maze | No terrain around or under the maze |
| Boring grid | Simple grid pattern instead of interesting winding paths |
| Wrong material | Using stone or wood instead of hedge/leaf blocks |
| Too simple | Just a few walls, not a real maze |

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

## Evaluation Criteria

| Aspect | Question | Weight |
|--------|----------|--------|
| Solvability | Can you trace a path from entrance to exit? | High |
| Terrain | Does ground extend beyond the maze? | Medium |
| Creativity | Is the layout interesting or just a grid? | Medium |
| Materials | Are hedges made of leaves/hedge blocks? | Low |
| Extras | Center feature, decorations, context? | Bonus |
