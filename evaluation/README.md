# Evaluation Suite

This directory contains our eval suite for stress-testing the Minecraft schematic agent. These evals are designed to systematically probe agent capabilities and catch failure modes before users do.

## Philosophy

**Evals are not just tests—they're a feedback loop.**

Each eval targets a specific capability. When an eval fails, we:
1. Document the failure mode
2. Identify what harness change would fix it
3. Apply the fix
4. Re-run the eval

This creates a tight loop between evaluation and improvement.

## How We Built This Suite

1. **Ran exploratory sessions** with the agent to find natural failure modes
2. **Prioritized** cases that revealed systemic issues (not one-off bugs)
3. **Formalized** each into a structured eval with pass criteria
4. **Linked fixes** back to harness files (system prompt, SDK docs)

The evals below represent cases where we found interesting failures worth tracking.

---

## Eval Categories

### Spatial Coherence
*Do elements connect? Does terrain extend naturally?*

This was our most common failure mode. Agents place elements at correct relative positions but forget to fill terrain between them, creating "floating islands."

| Eval | Prompt | Key Test |
|------|--------|----------|
| [001](evals/eval-001-home-with-additions.md) | Home + garden + road + car | Multi-element terrain continuity |
| [007](evals/eval-007-torii-gate.md) | Japanese torii gate | Terrain extends around structure |
| [013](evals/eval-013-fruit-orchard.md) | Fruit orchard | Trees grounded, terrain fills space |

**Common failure:** Elements exist but float in void without connecting ground.

---

### Geometric Reasoning
*Can the agent do spatial math? Curves? Helixes?*

Voxel geometry is hard. Circles become octagonal, curves need manual approximation, and helixes require per-step rotation math.

| Eval | Prompt | Key Test |
|------|--------|----------|
| [002](evals/eval-002-747-airplane.md) | 747 airplane (high fidelity) | Complex curved geometry, connected parts |
| [006](evals/eval-006-sydney-opera-house.md) | Sydney Opera House | Curved shells (intentionally near-impossible) |
| [011](evals/eval-011-hedge-maze.md) | Hedge maze | Algorithmic layout, solvability |
| [016](evals/eval-016-spiral-staircase.md) | Spiral staircase | Helix math, stair orientation per step |

**Common failure:** Curves rendered as jagged steps, components disconnected.

---

### Counting & Precision
*Can the agent follow exact numeric requirements?*

"10 flags" means 10, not 8 or 12. Surprisingly hard for LLMs.

| Eval | Prompt | Key Test |
|------|--------|----------|
| [005](evals/eval-005-pentagon-with-flags.md) | Pentagon with 10 flags | Exact count, symmetric placement |
| [009](evals/eval-009-six-wheel-car.md) | Car with 6 wheels | Exact count, creative interpretation |
| [012](evals/eval-012-basketball-court.md) | Basketball court | Symmetry (2 hoops, mirrored lines) |

**Common failure:** Off-by-one errors, asymmetric placement, forgetting to count.

---

### Real-World Landmarks
*Can the agent recreate recognizable structures?*

These test both world knowledge and architectural accuracy. The structure should be identifiable without being told what it is.

| Eval | Prompt | Key Test |
|------|--------|----------|
| [003](evals/eval-003-golden-gate-bridge.md) | Golden Gate Bridge | Catenary cables, towers, water |
| [004](evals/eval-004-taj-mahal.md) | Taj Mahal + gardens | 4 minarets, dome, reflecting pool |
| [008](evals/eval-008-pyramids-of-giza.md) | Pyramids + King Kong + plane | Multi-turn, creative additions |
| [014](evals/eval-014-sf-skyline.md) | San Francisco skyline | Scale (sprawling), hills, many buildings |

**Common failure:** Missing signature features, wrong proportions, no terrain context.

---

### Design Quality
*Does the agent build things that look good by default?*

A "spiral staircase" prompt shouldn't produce a minimal bare-bones spiral. It should feel grand—with platforms, railings, lighting—without being asked.

| Eval | Prompt | Key Test |
|------|--------|----------|
| [010](evals/eval-010-zoo-animals.md) | Zoo with lion, giraffe, zebra, tiger | Distinctive features per animal |
| [015](evals/eval-015-windmill.md) | Windmill | Blade design, tower detail, terrain |
| [016](evals/eval-016-spiral-staircase.md) | Spiral staircase | Grandness by default (platforms, lighting) |

**Common failure:** Technically correct but aesthetically minimal output.

---

### Static Renderer Awareness
*Does the agent understand there's no physics?*

Water doesn't flow. Sand doesn't fall. Redstone doesn't work. The agent must build effects manually.

| Eval | Prompt | Key Test |
|------|--------|----------|
| [005](evals/eval-005-pentagon-with-flags.md) | Pentagon + waterfall (turn 2) | Water blocks placed all the way down |

**Common failure:** Single water source block expecting Minecraft physics.

---

## Coverage Gaps

Areas we haven't yet covered:

| Category | Missing Tests | Priority |
|----------|---------------|----------|
| **Block Properties** | Log cabin (axis), roof corners (stair shape) | High |
| **Modification** | "Remove the roof", "Make it 2x bigger" | High |
| **Error Recovery** | Typo handling, invalid blocks, physics explanation | Medium |
| **Procedural** | Random forest, terrain generation | Medium |
| **Ambiguity** | "Build something cozy", "surprise me" | Low |
| **Exact Dimensions** | "Build exactly 15x10x20" | Medium |

---

## Running an Eval

1. **Start a fresh session** in the UI
2. **Enter the prompt** exactly as written in the eval
3. **Wait for completion** (don't interrupt)
4. **Evaluate against pass criteria** (checkboxes in eval file)
5. **Record result** in the Results table with date, model, pass/fail, notes
6. **Screenshot** if useful → `screenshots/eval-XXX/`

For multi-turn evals, complete each turn before proceeding to the next.

## Recording Results

In the eval file's Results table:

```markdown
| Date | Model | Result | Notes |
|------|-------|--------|-------|
| 2025-12-15 | gemini-3-pro-preview | Fail | Terrain didn't extend around gate |
```

Use:
- **Pass** - All pass criteria met
- **Partial** - Some criteria met, notable issues
- **Fail** - Key criteria not met

## Adding a New Eval

1. Copy [`evals/TEMPLATE.md`](evals/TEMPLATE.md)
2. Write a clean prompt (no debug artifacts)
3. Define concrete pass criteria (checkboxes)
4. List anticipated failure modes
5. Save as `eval-XXX-short-name.md`
6. Add to appropriate category section above

---

## Directory Structure

```
evaluation/
├── README.md           # This file
├── evals/
│   ├── TEMPLATE.md     # Copy this to create new evals
│   ├── eval-001-*.md
│   ├── eval-002-*.md
│   └── ...
├── screenshots/        # Visual results
│   ├── eval-001/
│   └── ...
├── sessions/           # Raw session logs
└── bugs/               # Bug reports from testing
```

---

## Summary Stats

| Category | Count | Pass Rate |
|----------|-------|-----------|
| Spatial Coherence | 3 | 1/3 |
| Geometric Reasoning | 4 | 1/4 |
| Counting & Precision | 3 | 1/3 |
| Real-World Landmarks | 4 | 1/4 |
| Design Quality | 3 | 1/3 |
| Static Renderer | 1 | 0/1 |
| **Total** | **16** | **~30%** |

*Stats based on gemini-3-pro-preview runs as of 2025-12-15. Results vary by model.*
