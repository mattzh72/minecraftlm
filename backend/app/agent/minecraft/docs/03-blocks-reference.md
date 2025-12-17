# Blocks & Configuration Reference

This document explains:

- Which block ids are valid with this SDK.
- How to reason about configuration properties for common block families (stairs, slabs, logs, doors, etc.).

The goal is to give you a “just enough” mental model so you can reliably generate structures using the SDK and the legacy viewer, without memorizing every variant.

## Where do valid blocks come from?

The SDK includes a `BlockCatalog` that knows the list of valid Minecraft block
ids and their blockstate variants. You do not need to load any files yourself.

```python
catalog = BlockCatalog()

# Example: check membership
ok = "minecraft:oak_planks" in catalog.block_ids
```

**Rule:** any id present in `catalog.block_ids` is valid. They are exposed as
`minecraft:<name>` (e.g. `minecraft:acacia_log`, `minecraft:stone_brick_stairs`).

`BlockCatalog.assert_valid(id)` is used internally by `Block` to normalize and validate ids:

```python
stone = Block("stone", catalog=catalog)                         # ok, normalized
stairs = Block("minecraft:oak_stairs", catalog=catalog)         # ok
bad = Block("minecraft:oook_stairs", catalog=catalog)           # raises ValueError
```

### Validation rules to remember

- Property values are **strings**, e.g. `"true"`, `"bottom"`, `"south"`.
- If a block has required properties (e.g. slabs with `type`, stairs with `facing`/`half`), omitting them raises a `ValueError` during compilation.
- Required properties must be provided in the `Block(..., properties={...})` constructor; this SDK validates at construction time.
- For “connecting” blocks (fences, panes, bars, walls) the catalog accepts both `"true"` and `"false"` for directional flags; the block list may only show `"true"` because that’s what appears in the assets, but you can explicitly set `"false"` or omit a direction to leave a post unconnected.

## Full blocks (simple cubes)

Many blocks are simple cubes that look the same from all directions (planks, stone, dirt, glass, etc.). These usually have **no orientation properties** and you can use them with default properties:

- Examples:
  - `minecraft:stone`
  - `minecraft:cobblestone`
  - `minecraft:oak_planks`
  - `minecraft:glass`
  - `minecraft:bricks`
  - `minecraft:grass_block` (requires a `snowy` property)

Use them directly:

```python
Block("minecraft:stone", size=(4, 1, 4), catalog=catalog)
```

Some “simple” blocks still expose minor properties. `minecraft:grass_block`
has only the `snowy=true|false` variants in the assets, so you **must** set it
explicitly—use `snowy="false"` for normal green grass:

```python
Block(
    "minecraft:grass_block",
    size=(16, 1, 16),
    properties={"snowy": "false"},
    catalog=catalog,
)
```

## Logs and pillars (`axis` property)

Many blocks that represent columns use an `axis` property:

- Typical ids:
  - `minecraft:oak_log`, `minecraft:spruce_log`, `minecraft:birch_log`, …
  - `minecraft:acacia_wood` and other “wood” blocks
  - `minecraft:quartz_pillar`, some stone pillar variants

- Relevant properties:
  - `axis`: `"x" | "y" | "z"`

Set axis directly:

```python
vertical_log = Block(
    "minecraft:oak_log",
    catalog=catalog,
    properties={"axis": "y"},  # default
)

horizontal_log = Block(
    "minecraft:oak_log",
    catalog=catalog,
    properties={"axis": "x"},
)
```

## Slabs (`type` property)

Slabs occupy half a block vertically, or a full block when doubled.

- Example ids:
  - `minecraft:stone_slab`, `minecraft:cobblestone_slab`
  - `minecraft:oak_slab`, `minecraft:spruce_slab`, …

- Properties:
  - `type`: `"bottom" | "top" | "double"`

Set `type` explicitly:

```python
bottom_slab = Block(
    "minecraft:stone_slab",
    catalog=catalog,
    properties={"type": "bottom"},
)

top_slab = Block(
    "minecraft:stone_slab",
    catalog=catalog,
    properties={"type": "top"},
)

double_slab = Block(
    "minecraft:stone_slab",
    catalog=catalog,
    properties={"type": "double"},
)
```

If you omit `type` on any slab (quartz slabs, copper slabs, etc.), the SDK will raise `ValueError: ... missing required properties: type`. Always set `{"type": "bottom"|"top"|"double"}`.

## Stairs (`facing`, `half`, `shape`)

Stairs are among the most configuration‑heavy blocks:

- Example ids:
  - `minecraft:oak_stairs`, `minecraft:stone_stairs`, `minecraft:stone_brick_stairs`, …

- Properties:
  - `facing`: `"north" | "south" | "east" | "west"`
  - `half`: `"top" | "bottom"` (upside‑down stairs live on the “top” half)
  - `shape`: `"straight" | "inner_left" | "inner_right" | "outer_left" | "outer_right"`

Provide all stair properties explicitly:

```python
# Explicit use via properties
south_stair = Block(
    "minecraft:oak_stairs",
    catalog=catalog,
    properties={"facing": "south", "half": "bottom", "shape": "straight"},
)

upside_down_corner = Block(
    "minecraft:stone_brick_stairs",
    catalog=catalog,
    properties={"facing": "east", "half": "top", "shape": "inner_left"},
)
```

When in doubt:

- Use `shape: "straight"` for linear stairs.
- Use inner/outer shapes when building corners; you can experiment visually in the viewer.

## Connecting blocks (fences, panes, bars, walls)

These blocks expose directional properties that control which sides connect. Even if the block list shows only `"true"` for a direction, the SDK accepts both `"true"` and `"false"`. Defaults are effectively `"false"` (a standalone post). Set flags to `"true"` for each side you want connected:

```python
# Single post
Block("minecraft:oak_fence", catalog=catalog)  # no properties = all false

# Bar spanning east-west
Block(
    "minecraft:iron_bars",
    catalog=catalog,
    properties={"east": "true", "west": "true", "north": "false", "south": "false"},
)
```

## Doors (`facing`, `half`, `hinge`, `open`)

Doors span two blocks vertically and have several properties. This SDK does **not** automatically link top/bottom halves; you typically model the lower half and let the viewer render both, or choose whichever looks correct for your use case.

- Example ids:
  - `minecraft:oak_door`, `minecraft:spruce_door`, `minecraft:iron_door`, …

- Properties:
  - `facing`: `"north" | "south" | "east" | "west"`
  - `half`: `"upper" | "lower"`
  - `hinge`: `"left" | "right"`
  - `open`: `"true" | "false"`

Example:

```python
door_lower = Block(
    "minecraft:oak_door",
    catalog=catalog,
    properties={
        "facing": "south",
        "half": "lower",
        "hinge": "left",
        "open": "false",
    },
)

door_lower.position = Vector3(8, 1, 2)
scene.add(door_lower)
```

If you want to explicitly place the upper half, add a second block one unit higher with `half: "upper"`.

## Trapdoors (`facing`, `half`, `open`)

Trapdoors are similar to doors but usually inhabit half the block thickness and are often used on hinges.

- Example ids:
  - `minecraft:oak_trapdoor`, `minecraft:iron_trapdoor`, …

- Properties:
  - `facing`: `"north" | "south" | "east" | "west"`
  - `half`: `"top" | "bottom"`
  - `open`: `"true" | "false"`

Example:

```python
trapdoor = Block(
    "minecraft:oak_trapdoor",
    catalog=catalog,
    properties={
        "facing": "north",
        "half": "top",
        "open": "false",
    },
)
```

## Connecting blocks (`north/east/south/west` booleans)

Many blocks have directional connection properties that control how they render. **You must set these properties explicitly for correct rendering** - the renderer does not auto-connect based on neighbors.

### Iron bars, glass panes, and similar

These blocks **require** directional properties to render correctly:

- Example ids:
  - `minecraft:iron_bars`, `minecraft:glass_pane`
  - `minecraft:black_stained_glass_pane`, `minecraft:white_stained_glass_pane`, …

- Properties:
  - `north`, `south`, `east`, `west`: `"true"` | `"false"`

**Important:** Without these properties, connecting blocks may render as a small cross/post shape instead of extending to connect. Always specify which directions should connect:

```python
# A wall of iron bars (portcullis) - connects horizontally
Block(
    "minecraft:iron_bars",
    catalog=catalog,
    properties={"east": "true", "west": "true", "north": "false", "south": "false"},
).with_size(4, 5, 1).at(10, 1, 5)

# A glass pane window connecting north-south
Block(
    "minecraft:glass_pane",
    catalog=catalog,
    properties={"north": "true", "south": "true", "east": "false", "west": "false"},
).with_size(1, 3, 5).at(5, 2, 0)
```

### Fences and walls

Fences and walls also use directional connection properties:

- Example ids:
  - `minecraft:oak_fence`, `minecraft:stone_brick_wall`, …

- Properties:
  - `north`, `south`, `east`, `west`: `"true"` | `"false"` (fences)
  - `north`, `south`, `east`, `west`: `"low"` | `"tall"` (walls)
  - `up`: `"true"` (walls - for the center post)

```python
# Fence section running east-west
Block(
    "minecraft:oak_fence",
    catalog=catalog,
    properties={"east": "true", "west": "true", "north": "false", "south": "false"},
).with_size(5, 1, 1).at(0, 1, 0)

# Stone wall with connections and center post
Block(
    "minecraft:stone_brick_wall",
    catalog=catalog,
    properties={"east": "low", "west": "low", "north": "low", "south": "low", "up": "true"},
).at(5, 1, 5)
```

## How to discover additional properties

If you need detailed properties for a specific block that is not covered above:

1. **Inspect `catalog.assets["blockstates"]`**

   ```python
   catalog = BlockCatalog()
   blockstates = catalog.assets["blockstates"]
   example = blockstates["acacia_stairs"]
   ```

   This object shows all variant keys and their corresponding models (e.g. property strings like `facing=east,half=top,shape=outer_left`).

2. **Derive property names**

   - Split the variant keys on commas (`facing=east,half=top,shape=outer_left`).
   - Property names (left side) are the allowed config keys.
   - Values (right side) are the allowed options.

3. **Use those keys/values as `properties` when constructing a `Block`.**

```python
custom_stairs = Block(
    "minecraft:acacia_stairs",
    catalog=catalog,
    properties={
        "facing": "west",
        "half": "top",
        "shape": "outer_right",
    },
)
```

This pattern is generic and works for any block present in
`catalog.assets["blockstates"]`.

---

In summary:

- Use **simple blocks** (stone, planks, glass) with no properties or minimal ones.
- For **logs**, set `axis`.
- For **slabs**, set `type`.
- For **stairs**, set `facing`/`half`/`shape`.
- For **doors/trapdoors**, set `facing`, `half`, `hinge` (doors), and `open`.
- For **connecting blocks** (iron_bars, glass_pane, fences, walls), **always set directional properties** (`north`/`south`/`east`/`west`) explicitly - the renderer won't auto-connect.
- See `04-block-list.md` for the complete list of blocks and their properties - pass them directly as `properties={"name": "value"}`.
- When in doubt, inspect `BlockCatalog.assets["blockstates"]` and mirror the properties shown there.
