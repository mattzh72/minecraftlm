# Eval: 747 Airplane

**Category:** geometry
**Difficulty:** hard

---

## Prompt

> "Design the most detailed 747 airplane you possibly can. Make it HIGH FIDELITY. I'm expecting over 50+ components that comprise of this airplane spanning over 1000 blocks. Make sure everything connects, and the plane looks like a plane."

---

## What This Tests

Tests the agent's ability to build a complex vehicle with many interconnected components. All parts (fuselage, wings, engines, landing gear) must be physically connected - no floating elements.

**Why it's challenging:**
- High component count (50+)
- All parts must physically connect (no floating wheels)
- Curved geometry (nose cone, fuselage)
- Proper proportions for recognizable 747 shape
- Scale requirement (1000+ blocks)

---

## Expected Output

- [ ] Fuselage (main body)
- [ ] Wings attached to fuselage
- [ ] Engines mounted on wings
- [ ] Tail section with vertical stabilizer
- [ ] **Landing gear connected to fuselage via struts**
- [ ] Nose cone with smooth taper
- [ ] Windows along fuselage
- [ ] Recognizable as 747

---

## Common Mistakes

| Mistake | Description |
|---------|-------------|
| Disconnected wheels | Landing gear wheels float below plane without connecting struts |
| Bad nose cone | Conical front has artifacts/jutting pieces from poor voxel curve approximation |
| Missing connections | Components placed near each other but not physically attached |
| Proportions off | Wings too small, fuselage too short, etc. |

---

## Fixes Applied

| Fix | File | Status |
|-----|------|--------|
| Add guidance on connected vehicle components | `system_prompt.txt` | pending |
| Add voxel curve approximation tips | `06-implementation-guidelines.md` | pending |

---

## Results

| Date | Model | Pass/Fail | Notes |
|------|-------|-----------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Wheels disconnected, nose cone had artifacts |

---

## Session Reference

**Session ID:** `c9342aea-1eb2-460c-be5b-ebe02af96eda`
