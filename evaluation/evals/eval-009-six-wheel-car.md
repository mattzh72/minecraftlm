# Eval: Six Wheel Car

**Category:** geometry
**Difficulty:** medium

## Prompt

> Build me a car with 6 wheels.

## Tests

Creativity and counting. A 6-wheel car requires creative interpretation (truck? limo?) and attention to detail (multi-block wheels, mirrors, symmetry).

## Pass Criteria

- [ ] Recognizable vehicle shape
- [ ] **Exactly 6 wheels**
- [ ] Wheels are multi-block (not single cubes)
- [ ] Windshield/windows
- [ ] Side mirrors
- [ ] Headlights and taillights
- [ ] Symmetric (left matches right)

## Failure Modes

| Mode | Description |
|------|-------------|
| Lazy wheels | Single blocks instead of multi-block circles |
| Missing details | No mirrors, windshield, or lights |
| Asymmetric | Left and right don't match |
| Wrong count | 4 or 8 wheels instead of 6 |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Partial | Good shape, 6 wheels, windows. Wheels are single blocks, no mirrors |
| 2025-12-17 | gemini-3-pro-preview | Pass | Truck with 6 multi-block wheels, windshield, headlights, taillight, antenna, symmetric design |
