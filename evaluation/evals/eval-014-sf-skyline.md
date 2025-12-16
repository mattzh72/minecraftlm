# Eval: San Francisco Skyline

**Category:** real-world
**Difficulty:** hard

## Prompt

> Generate me the skyline of San Francisco.

## Tests

Scale and ambition. Agent should "think big"—sprawling cityscape, not cramped. SF's rolling hills are essential.

## Pass Criteria

- [ ] **Rolling hills** (SF's signature)
- [ ] Sprawling footprint (not cramped)
- [ ] Many buildings (10+)
- [ ] Variety in height
- [ ] Variety in style/color
- [ ] Transamerica Pyramid (pointed top)
- [ ] Salesforce Tower (tall, tapering)

## Failure Modes

| Mode | Description |
|------|-------------|
| Flat terrain | No hills—SF is defined by hills |
| Too few buildings | 5-6 instead of a skyline |
| No landmarks | Generic boxes, nothing SF-specific |
| Small/cramped | Artificially constrained |
| All same height | No variety |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | ~8 buildings but: flat, small footprint, no landmarks, not sprawling |
