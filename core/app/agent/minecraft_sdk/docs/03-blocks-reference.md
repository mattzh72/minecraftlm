# Blocks & Configuration Reference

This document explains:

- Which block ids are valid with this SDK.
- How to reason about configuration properties for common block families (stairs, slabs, logs, doors, etc.).

The goal is to give you a “just enough” mental model so you can reliably generate structures using the SDK and the legacy viewer, without memorizing every variant.

## Where do valid blocks come from?

The SDK includes a `BlockCatalog` that knows the list of valid Minecraft block
ids and their blockstate variants. You do not need to load any files yourself.

```js
const catalog = new BlockCatalog();

// Example: check membership
const ok = catalog.blockIds.has("minecraft:oak_planks");
```

**Rule:** any id present in `catalog.blockIds` is valid. They are exposed as
`minecraft:<name>` (e.g. `minecraft:acacia_log`, `minecraft:stone_brick_stairs`).

`BlockCatalog.assertValid(id)` is used internally by `Block` to normalize and validate ids:

```js
const stone = new Block("stone", { catalog });          // ok, normalized
const stairs = new Block("minecraft:oak_stairs", { catalog }); // ok
const bad = new Block("minecraft:oook_stairs", { catalog });   // throws
```

## Full blocks (simple cubes)

Many blocks are simple cubes that look the same from all directions (planks, stone, dirt, glass, etc.). These usually have **no orientation properties** and you can use them with default properties:

- Examples:
  - `minecraft:stone`
  - `minecraft:cobblestone`
  - `minecraft:oak_planks`
  - `minecraft:glass`
  - `minecraft:bricks`
  - `minecraft:grass_block` (may have a `snowy` property)

Use them directly:

```js
new Block("minecraft:stone", { size: [4, 1, 4], catalog });
```

Some “simple” blocks still expose minor properties (e.g. `grass_block` has `snowy=true|false`). In most cases you can ignore these unless you specifically want a variant.

## Logs and pillars (`axis` property)

Many blocks that represent columns use an `axis` property:

- Typical ids:
  - `minecraft:oak_log`, `minecraft:spruce_log`, `minecraft:birch_log`, …
  - `minecraft:acacia_wood` and other “wood” blocks
  - `minecraft:quartz_pillar`, some stone pillar variants

- Relevant properties:
  - `axis`: `"x" | "y" | "z"`

Use the helper:

```js
const verticalLog = new Block("minecraft:oak_log", {
  catalog,
  properties: axisProperties("y"),  // default
});

const horizontalLog = new Block("minecraft:oak_log", {
  catalog,
  properties: axisProperties("x"),
});
```

## Slabs (`type` property)

Slabs occupy half a block vertically, or a full block when doubled.

- Example ids:
  - `minecraft:stone_slab`, `minecraft:cobblestone_slab`
  - `minecraft:oak_slab`, `minecraft:spruce_slab`, …

- Properties:
  - `type`: `"bottom" | "top" | "double"`

Use the helper:

```js
const bottomSlab = new Block("minecraft:stone_slab", {
  catalog,
  properties: slabProperties(), // bottom
});

const topSlab = new Block("minecraft:stone_slab", {
  catalog,
  properties: slabProperties({ top: true }),
});

const doubleSlab = new Block("minecraft:stone_slab", {
  catalog,
  properties: slabProperties({ double: true }),
});
```

## Stairs (`facing`, `half`, `shape`)

Stairs are among the most configuration‑heavy blocks:

- Example ids:
  - `minecraft:oak_stairs`, `minecraft:stone_stairs`, `minecraft:stone_brick_stairs`, …

- Properties:
  - `facing`: `"north" | "south" | "east" | "west"`
  - `half`: `"top" | "bottom"` (upside‑down stairs live on the “top” half)
  - `shape`: `"straight" | "inner_left" | "inner_right" | "outer_left" | "outer_right"`

Use provided helpers:

```js
// Explicit use via properties
const southStair = new Block("minecraft:oak_stairs", {
  catalog,
  properties: stairProperties({ facing: "south" }),
});

const upsideDownCorner = new Block("minecraft:stone_brick_stairs", {
  catalog,
  properties: stairProperties({
    facing: "east",
    upsideDown: true,
    shape: "inner_left",
  }),
});

// Convenience factory
const quickStair = makeStair("minecraft:oak_stairs", {
  direction: "west",
  upsideDown: false,
  catalog,
});
```

When in doubt:

- Use `shape: "straight"` for linear stairs.
- Use inner/outer shapes when building corners; you can experiment visually in the viewer.

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

```js
const doorLower = new Block("minecraft:oak_door", {
  catalog,
  properties: {
    facing: "south",
    half: "lower",
    hinge: "left",
    open: "false",
  },
});

doorLower.position = new Vector3(8, 1, 2);
scene.add(doorLower);
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

```js
const trapdoor = new Block("minecraft:oak_trapdoor", {
  catalog,
  properties: {
    facing: "north",
    half: "top",
    open: "false",
  },
});
```

## Fences and walls (`north/east/south/west` booleans)

Fences and walls auto‑connect in Minecraft; in the blockstate they expose booleans per direction.

- Example ids:
  - `minecraft:oak_fence`, `minecraft:stone_brick_wall`, …

- Properties (simplified):
  - `north`, `south`, `east`, `west`: `"true" | "false"`

For most schematic use cases, you can place fence blocks as simple cubes and let the model handle details. If you want precise control over individual post/connection elements, you can specify these properties explicitly, but that’s rarely necessary.

## “Facing” from direction vectors

Sometimes you want a block to face “toward” something (e.g. stair facing toward a door). Use the helper:

```js
const dir = { x: 1, z: 0 };          // positive X
const facing = facingFromVector(dir); // "east"

const stair = new Block("minecraft:oak_stairs", {
  catalog,
  properties: stairProperties({ facing }),
});
```

The helper:

- Ignores `y`.
- Chooses the dominant axis: if `|x| >= |z|`, uses `east`/`west`, otherwise `south`/`north`.

## How to discover additional properties

If you need detailed properties for a specific block that is not covered above:

1. **Inspect `catalog.assets.blockstates`**

   ```js
   const catalog = new BlockCatalog();
   const blockstates = catalog.assets.blockstates;
   console.log(blockstates["acacia_stairs"]);
   ```

   This object shows all variant keys and their corresponding models (e.g. property strings like `facing=east,half=top,shape=outer_left`).

2. **Derive property names**

   - Split the variant keys on commas (`facing=east,half=top,shape=outer_left`).
   - Property names (left side) are the allowed config keys.
   - Values (right side) are the allowed options.

3. **Use those keys/values as `properties` when constructing a `Block`.**

```js
const customStairs = new Block("minecraft:acacia_stairs", {
  catalog,
  properties: {
    facing: "west",
    half: "top",
    shape: "outer_right",
  },
});
```

This pattern is generic and works for any block present in
`catalog.assets.blockstates`.

---

In summary:

- Use **simple blocks** (stone, planks, glass) with no properties or minimal ones.
- For **logs**, use `axisProperties`.
- For **slabs**, use `slabProperties`.
- For **stairs**, use `stairProperties`/`makeStair` and be mindful of `facing`/`half`/`shape`.
- For **doors/trapdoors**, set `facing`, `half`, `hinge` (doors), and `open`.
- When in doubt, inspect `BlockCatalog.assets.blockstates` and mirror the properties shown there.
