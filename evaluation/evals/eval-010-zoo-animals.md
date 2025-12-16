# Eval: Zoo Animals

**Category:** aesthetics
**Difficulty:** hard

## Prompt

> We're making a zoo. Please add a lion, a giraffe, a zebra and a tiger.

## Tests

Multi-component detail work. Each animal has distinctive features—prevents lazy "generic quadruped" outputs. Tests holding multiple designs in memory.

## Pass Criteria

**Lion:**
- [ ] Mane (fluffy head)
- [ ] Tail with tuft
- [ ] Tan/yellow color
- [ ] Face (eyes, ears)

**Tiger:**
- [ ] Orange with black stripes
- [ ] Stripes flush (not protruding)
- [ ] Face (eyes, ears)

**Zebra:**
- [ ] Black and white stripes
- [ ] Stripes flush (not protruding)
- [ ] Face (eyes, ears)

**Giraffe:**
- [ ] Spots (not stripes)
- [ ] Long neck
- [ ] Yellow/tan with brown spots
- [ ] Face (eyes, ears)

## Failure Modes

| Mode | Description |
|------|-------------|
| Generic animals | All look the same—just quadruped shapes |
| Missing patterns | Tiger/zebra without stripes, giraffe without spots |
| Protruding patterns | Stripes/spots stick out as 3D bumps |
| No mane | Lion looks like any big cat |
| No faces | Animals without eyes/ears |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| | | | |
