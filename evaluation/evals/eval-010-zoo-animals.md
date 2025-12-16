# Eval: Zoo Animals

**Category:** aesthetics
**Difficulty:** hard

---

## Prompt

> We're making a zoo. Please add a lion, a giraffe, a zebra and a tiger.

---

## What This Tests

Tests the agent's attention to detail across multiple complex components. Each animal has distinctive features that must be present - this prevents lazy "generic quadruped" outputs. Also tests the agent's ability to hold multiple distinct designs in memory and execute each one properly.

**Why it's challenging:**
- 4 distinct animals, each with unique features
- Animal-specific details (stripes, spots, mane) required
- Facial features for each (eyes, ears, nose, mouth)
- Zoo context suggests separation/enclosures
- Easy to be lazy and make generic animals

---

## Expected Output

**Lion:**
- [ ] Mane (distinctive fluffy head)
- [ ] Tail (with tuft at end)
- [ ] Tan/yellow coloring
- [ ] Eyes, ears, nose, mouth

**Tiger:**
- [ ] Stripes (orange with black stripes)
- [ ] Tail
- [ ] Orange coloring with black
- [ ] Eyes, ears, nose, mouth

**Zebra:**
- [ ] Stripes (black and white)
- [ ] Tail
- [ ] Black and white coloring
- [ ] Eyes, ears, nose, mouth

**Giraffe:**
- [ ] Spots (not stripes)
- [ ] Long neck
- [ ] Tall proportions
- [ ] Yellow/tan with brown spots
- [ ] Eyes, ears, nose, mouth

**Zoo Context (Bonus):**
- [ ] Animals in separate enclosures/areas
- [ ] Fencing or barriers between animals
- [ ] Paths for visitors
- [ ] Ground/terrain for the zoo

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Generic animals | All animals look the same - just generic quadrupeds |
| Missing patterns | Tiger without stripes, zebra without stripes, giraffe without spots |
| Protruding patterns | Stripes/spots stick out from body instead of being flush (texture, not 3D bumps) |
| No mane on lion | Lion looks like any other big cat |
| No facial features | Animals are just body shapes without eyes, ears, nose |
| No tails | Animals missing tails |
| Animals mixed together | No zoo separation, all animals in same space |
| Lazy coloring | All animals same color instead of distinctive |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add "Design Quality Guidelines" | `06-implementation-guidelines.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| | | | |

---

## Session Reference

**Session ID:** (to be filled after run)

---

## Scoring Guide

For manual evaluation, check each animal:

| Animal | Pattern | Tail | Face | Color | Score |
|--------|---------|------|------|-------|-------|
| Lion | Mane? | ✓/✗ | Eyes/ears? | Tan? | /4 |
| Tiger | Stripes? | ✓/✗ | Eyes/ears? | Orange+black? | /4 |
| Zebra | Stripes? | ✓/✗ | Eyes/ears? | B&W? | /4 |
| Giraffe | Spots? | ✓/✗ | Eyes/ears? | Yellow+brown? | /4 |
| **Zoo** | Enclosures? | Paths? | Terrain? | Separation? | /4 |
