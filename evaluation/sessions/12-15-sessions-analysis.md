# LLM Thinking Pattern Analysis

## Executive Summary

Analysis of **34 sessions** with **242 thinking blocks** and **51 compilation errors** reveals consistent patterns in how the LLM reasons (and fails to reason) when building Minecraft structures.

**Key Finding:** The model makes **7 core thinking mistakes** that account for the majority of errors.

---

## Error Distribution

| Attempts to Fix | Count |
|-----------------|-------|
| 1 attempt (fixed quickly) | 13 |
| 2 attempts | 10 |
| 3 attempts | 3 |
| 4+ attempts | 2 |

**10 sessions had zero errors** - showing the model CAN succeed when it thinks carefully.

---

## Most Common Errors (by frequency)

| Error Type | Count | Example |
|------------|-------|---------|
| Missing `axis` on quartz_pillar | 6 | Block needs `axis: "y"` |
| Missing `facing` on end_rod | 4 | Block needs `facing: "up"` |
| Missing `snowy` on grass_block | 4 | Block needs `snowy: "false"` |
| Missing `type` on slabs | 6+ | Slab needs `type: "bottom"` |
| Missing stair properties | 5+ | Stairs need `facing, half, shape` |
| Wrong kwarg in helpers | 7 | Using `facing` instead of `direction` |

---

## The 7 Core Thinking Mistakes

### 1. ❌ SHALLOW API KNOWLEDGE
**What happens:** Model doesn't understand which blocks require properties.

**Example thinking:**
> "I'll use end_rod for the antenna"

**Problem:** No consideration that `end_rod` requires a `facing` property. The model treats complex blocks like simple ones.

**Evidence:** In session `067050d0`, the model wrote about using various blocks for a skyline without ever mentioning their required properties.

---

### 2. ❌ PATTERN MATCHING WITHOUT UNDERSTANDING
**What happens:** Model sees parameter names in one function and assumes all similar functions use the same names.

**Example:** 
- `stair_properties(facing="north")` ✓
- `make_stair(facing="north")` ✗ (should be `direction`)

**Evidence from session 08cd78d3:**
> "I'm now implementing the necessary edits to ensure proper hopper functionality..."

Then immediately uses `make_stair(facing=...)` which fails.

---

### 3. ❌ INCOMPLETE ERROR PARSING
**What happens:** Error says "missing: facing, half, shape" but model only fixes ONE property.

**Example from session 75c551d8:**
```
Error: Block "minecraft:stone_brick_stairs" is missing required properties: facing, half, shape
```
Model's fix only adds `facing`, forgets `half` and `shape`.

**Thinking pattern:** The model sees the first property mentioned and stops reading.

---

### 4. ❌ POST-HOC PROPERTY ASSUMPTION
**What happens:** Model thinks `.set_properties()` can fix validation errors after block creation.

**Example thinking from session 42c4f71e:**
> "I'm wondering if I edited the correct section. The Block constructor validates properties, but I used `.set_properties(...)` afterward, so that might be..."

**Problem:** Validation happens in constructor. By the time `.set_properties()` is called, it's too late.

---

### 5. ❌ OPTIMISTIC BLOCK USAGE
**What happens:** Model uses blocks without considering their requirements.

**Anti-pattern in thinking:**
- "I'll use quartz_pillar for columns" (no thought about `axis`)
- "Adding hoppers for the baskets" (no thought about `facing`)
- "Grass blocks for the ground" (no thought about `snowy`)

**Evidence:** In 5 out of 6 high-error sessions, the model mentioned blocks like stairs/pillars/slabs without any mention of properties in the same thought block.

---

### 6. ❌ FIXATION ON FIRST SOLUTION
**What happens:** Model tries same failing approach repeatedly.

**Example from session a41fe3da (5 errors):**
1. Error: smooth_stone_slab missing `type`
2. Tries: `slab_properties(type=...)` - Wrong! (slab_properties doesn't take `type`)
3. Error: blast_furnace missing `facing, lit`
4. Tries: adds properties but misses some
5. Error: stone_brick_stairs missing properties
6. Still struggling...

**Pattern:** Doesn't step back and re-read documentation.

---

### 7. ❌ DOESN'T GENERALIZE FROM ERRORS
**What happens:** Fixes issue for one block, doesn't apply lesson to similar blocks.

**Example from session 42c4f71e:**
- Error 1: end_rod missing `facing` - fixes it
- Error 2: end_rod missing `facing` (different location) - makes same mistake again

**Pattern:** Treats each error as isolated rather than learning a general rule.

---

## Successful Thinking Patterns (What Works)

Sessions with **0 errors** showed these thinking characteristics:

1. **Pre-planning materials:** "I'll use stone_bricks for the base" (simpler blocks)
2. **Considering geometry first:** Focus on shapes/coordinates before block details
3. **Using full-block materials:** Prefer blocks like `stone`, `quartz_block`, `concrete` that don't need properties
4. **Simpler helper usage:** Used `make_block()` more than complex property helpers

**Common thought sections in successful sessions:**
- "Planning Pyramid Construction"
- "Defining the Features"  
- "Verifying Geometry"
- "Building the Foundation"

**Common in problematic sessions:**
- "Fixing Placement Error"
- "Adjusting Block Properties"
- "Resolving Validation Errors"
- "Diagnosing Buggy Code"

---

## Problematic Blocks (Avoid or Use Carefully)

| Block | Required Properties | Error Count |
|-------|-------------------|-------------|
| `quartz_pillar` | axis | 6 |
| `end_rod` | facing | 4 |
| `grass_block` | snowy | 4 |
| `*_slab` | type | 6+ |
| `*_stairs` | facing, half, shape | 5+ |
| `hopper` | facing | 1 |
| `*_button` | powered, face | 3 |
| `*_door` | hinge, half, open, facing, powered | 1 |

---

## Recommended Improvements

### For the SDK/System:

1. **Better Error Messages**
   ```
   Current: Block "minecraft:end_rod" is missing required properties: facing
   Better:  Block "minecraft:end_rod" requires properties: facing
            Valid values for 'facing': up, down, north, south, east, west
            Example: Block("minecraft:end_rod", properties={"facing": "up"})
   ```

2. **Convenience Constructors**
   ```python
   # Instead of requiring:
   Block("minecraft:end_rod", properties={"facing": "up"})
   
   # Provide:
   make_end_rod(facing="up")  # Like make_stair exists
   ```

3. **Consistent Parameter Names**
   - `make_stair(direction=...)` should also accept `facing=...` for consistency
   - Or rename to be explicit: `make_stair(stair_direction=...)`

4. **Property Defaults Where Sensible**
   - `grass_block` default `snowy=false`
   - `quartz_pillar` default `axis=y`
   - Slabs default `type=bottom`

### For the Prompts/Training:

1. **Block Category Warnings**
   Add to system prompt:
   ```
   BLOCKS REQUIRING PROPERTIES:
   - Pillars: need axis (x/y/z)
   - Slabs: need type (top/bottom/double)
   - Stairs: need facing, half, shape
   - Directional: end_rod, hopper need facing
   - Grass blocks: need snowy property
   ```

2. **Encourage Property Checking**
   Add thinking prompt:
   ```
   Before using any block, ask: Does this block need properties?
   ```

3. **Error Recovery Protocol**
   Add instruction:
   ```
   When fixing a "missing properties" error:
   1. Read ALL properties listed in the error
   2. Add ALL of them, not just the first one
   3. Check if same block is used elsewhere
   ```

### For the Agent Loop:

1. **Pre-flight Check**
   Before compiling, scan code for known problematic blocks and warn.

2. **Error Pattern Detection**
   If same error type occurs twice, surface documentation automatically.

3. **Learning Memory**
   Track which blocks caused errors in session, remind model on re-use.

---

## Session-Level Analysis

### Worst Sessions (Most Errors)

| Session | Errors | Key Problem |
|---------|--------|-------------|
| a41fe3da | 5 | Wrong helper function parameters |
| c570188d | 4 | Multiple property-required blocks |
| 067050d0 | 3 | end_rod + slab properties |
| 90f288eb | 3 | Invalid block ID + properties |
| a647aa31 | 3 | grass_block + slab properties |

### Best Sessions (Zero Errors)

| Session | Key Success Factor |
|---------|-------------------|
| 3fce89b6 | Used simple full blocks |
| 5df1cde3 | Focused on geometry/math |
| 62ddcff1 | Careful about materials |
| 6b7ef2b0 | Pyramids = simple shapes |
| 8c325708 | Terrain-focused |

---

## Conclusion

The LLM's thinking failures are **systematic and predictable**. The core issue is a gap between:
- What the model **assumes** about the API (blocks are simple)
- What the API **actually requires** (many blocks need specific properties)

Fixing this requires:
1. **Better documentation** in prompts about block requirements
2. **Improved error messages** with examples
3. **SDK helpers** for common problematic blocks
4. **Validation warnings** before compilation

The model can succeed - 29% of sessions had zero errors. The key is guiding it to think about block properties BEFORE writing code.
