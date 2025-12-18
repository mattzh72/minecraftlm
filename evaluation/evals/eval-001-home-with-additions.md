# Eval: Home with Additions

**Category:** spatial-coherence
**Difficulty:** medium

## Prompt

**Turn 1:**
> Build me a home with a bed inside.

**Turn 2:**
> Add a garden. Build me a road. Build me a car in my driveway.

## Tests

Multi-turn spatial coherence. When adding elements to an existing scene, they must connect via continuous terrain—not float as separate islands.

## Pass Criteria

- [ ] House with bed inside
- [ ] Garden near house
- [ ] Road connected to property
- [ ] Car in driveway
- [ ] **All elements on continuous terrain** (no floating islands)
- [ ] Driveway connects car → road → house

## Failure Modes

| Mode | Description |
|------|-------------|
| Floating additions | Garden, road, car placed as disconnected islands in void |
| No shared ground | Each element on its own tiny ground patch |
| No driveway | Car exists but doesn't connect to road |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Additions floated as disconnected islands |
| 2025-12-17 | gemini-3-pro-preview | Pass | Continuous terrain, house with chimney, road with lane markings, car with wheels/taillights, driveway connects all elements |
