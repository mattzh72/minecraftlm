# Eval: Pentagon with Flags

**Category:** counting
**Difficulty:** medium

## Prompt

**Turn 1:**
> Build me the Pentagon in Washington DC. There should be 10 flags on top of the Pentagon.

**Turn 2:**
> Add a waterfall in the center courtyard, flowing down from a cliff.

## Tests

Exact counting (10 flags) and pentagon geometry. Turn 2 tests static renderer awareness—water must be placed manually at each level.

## Pass Criteria

**Turn 1:**
- [ ] 5-sided pentagonal structure
- [ ] Inner courtyard
- [ ] **Exactly 10 flags**
- [ ] Flags symmetrically placed
- [ ] Flags visible (pole + colored block)

**Turn 2:**
- [ ] Cliff structure in courtyard
- [ ] **Water blocks all the way down** (not 1 source block)
- [ ] Water reaches bottom/pool

## Failure Modes

| Mode | Description |
|------|-------------|
| Wrong count | 8, 9, 11 flags instead of exactly 10 |
| Asymmetric flags | Clustered or unevenly spaced |
| Wrong shape | Hexagon or square instead of pentagon |
| Single water block | Expects physics to flow water down |

## Results

| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | T1: Pass, T2: Fail | Correct pentagon + 10 flags. Only 1 water block |
| 2025-12-17 | gemini-3-pro-preview | T1: Pass, T2: Partial | Pentagon with flags, good terrain/landscaping. Waterfall has pool but lacks visible flow down cliff |
