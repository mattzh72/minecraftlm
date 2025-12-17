# Eval: 747 Airplane

**Category:** geometry
**Difficulty:** hard

## Prompt

> Build me a 747 airplane.

## Tests

Complex vehicle with many interconnected parts. All components (fuselage, wings, engines, landing gear) must physically connect—no floating elements.

## Pass Criteria

- [ ] Fuselage (main body)
- [ ] Wings attached to fuselage
- [ ] Engines mounted on wings
- [ ] Tail with vertical stabilizer
- [ ] **Landing gear connected via struts** (not floating)
- [ ] Nose cone with smooth taper
- [ ] Windows along fuselage
- [ ] Recognizable as 747

## Failure Modes

| Mode | Description |
|------|-------------|
| Disconnected wheels | Landing gear floats without connecting struts |
| Bad nose cone | Artifacts from poor voxel curve approximation |
| Missing connections | Components near but not attached |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Wheels disconnected, nose cone artifacts |
| 2025-12-17 | gemini-3-pro-preview | Pass | Engines on wings, tail with red stripe detail, windows along fuselage |
