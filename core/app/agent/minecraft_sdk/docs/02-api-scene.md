# Scene & Object API (Three.js‑style)

This document focuses on the high‑level scene graph classes you use most often:
`Scene`, `Object3D`, `Block`, `Vector3`, and `BlockCatalog`.

In your script you can use these identifiers directly; assume they are
available in scope (no imports needed).

## `BlockCatalog`

Catalog of all known block ids.

```js
const catalog = new BlockCatalog();
```

- **Key methods**
  - `catalog.blockIds: Set<string>` – all valid block ids (namespaced as `minecraft:…`).
  - `catalog.assets` – raw decoded `assets` object (blockstates, models, textures).
  - `catalog.opaqueBlocks: Set<string>` – block ids treated as opaque.
  - `catalog.assertValid(id: string): string` – normalizes and verifies.
    - Adds `minecraft:` prefix if missing.
    - Throws if the block is unknown.

Use `BlockCatalog` whenever you construct a `Block` to catch typos early.

## `Vector3`

Minimal 3D vector implementation used for positions, inspired by Three.js.

```js
const v = new Vector3(1, 2, 3);
v.add(new Vector3(0, 1, 0));  // (1,3,3)
const arr = v.toArray();      // [1,3,3]
```

- Constructor: `new Vector3(x = 0, y = 0, z = 0)`
- Methods:
  - `clone()` – returns a copy.
  - `add(v: Vector3)` – mutating add, returns `this`.
  - `added(v: Vector3)` – non‑mutating, returns a new vector.
  - `toArray()` – returns `[x, y, z]`.

`Vector3` is primarily used as the type of `Object3D.position`.

## `Object3D`

Base class for scene graph nodes. Mirrors a tiny subset of Three.js’s `Object3D`.

```js
const obj = new Object3D();
obj.position = new Vector3(5, 1, 0);

const child = new Object3D();
child.position = new Vector3(0, 2, 0);

obj.add(child);
```

- Properties:
  - `position: Vector3` – world position (relative to parent).
  - `children: Object3D[]` – list of children.
- Methods:
  - `add(...objects: Object3D[])` – append children, returns `this`.

`Scene` and `Block` both extend `Object3D`.

## `Block`

Represents a cuboid of a single Minecraft block type. This is the main primitive you instantiate and position, analogous to a mesh in Three.js.

```js
const block = new Block("minecraft:stone", {
  size: [2, 1, 2],      // width, height, depth in blocks
  fill: true,           // solid cuboid
  properties: {},       // blockstate props (optional)
  catalog,              // BlockCatalog instance
});

block.position = new Vector3(4, 1, 4);
```

- Constructor:

  ```js
  new Block(blockId: string, {
    size = [1, 1, 1],
    properties = {},
    fill = true,
    catalog = new BlockCatalog(),
  } = {})
  ```

  - `blockId` – logical block type; normalized/validated via `catalog.assertValid`.
  - `size` – `[width, height, depth]` in blocks; use values >1 for larger cuboids.
  - `properties` – blockstate properties (orientation, variants, etc.).
  - `fill`
    - `true` – solid cuboid: every block within the volume is placed.
    - `false` – hollow shell: only faces are placed (like a hollow box).

- Methods:
  - `setProperties(props: Record<string, string>)` – replace properties.
  - `mergeProperties(extra: Record<string, string>)` – shallow merge.

Example: a 10‑wide, 3‑high wall of `stone_bricks`:

```js
const wall = new Block("minecraft:stone_bricks", {
  size: [10, 3, 1],
  fill: true,
  catalog,
});
wall.position = new Vector3(3, 1, 5);
scene.add(wall);
```

## `Scene`

Root node that holds your graph of `Object3D` and `Block` instances. Responsible for flattening the graph into the JSON format consumed by the legacy viewer.

```js
const scene = new Scene();
// add blocks and child objects

const structure = scene.toStructure(); // { width, height, depth, blocks }
```

- Inherits:
  - `position: Vector3`
  - `children: Object3D[]`
  - `add(...objects)`

- Methods:
  - `flattenBlocks(parentOffset?: Vector3)` – internal; walks children and returns a flat list of `{ block, position }` with world coordinates.
  - `toStructure(options?)` – public API for exporting.

### `scene.toStructure(options)`

```js
const structure = scene.toStructure({
  origin: "min",      // "min" or any other value
  padding: 0,         // integer padding (blocks) around structure
  dimensions: {
    width: 32,        // optional override
    height: 16,
    depth: 32,
  },
});
```

- `origin`:
  - `"min"` (default) – subtracts the minimum `x,y,z` from all placements so the smallest block coordinate becomes `(0,0,0)`, then applies `padding`.
  - Any other value – treats current world positions as absolute and only applies `padding`.

- `padding`:
  - Adds empty space around the structure: final width/height/depth are increased by `2*padding` if you use the default dimension calculation.

- `dimensions`:
  - Optional explicit `{ width, height, depth }` if you want to override the automatically computed size.

Returns:

```ts
{
  width: number,
  height: number,
  depth: number,
  blocks: Array<{
    start: [number, number, number],
    end: [number, number, number],
    type: string,                       // e.g. "minecraft:oak_planks"
    properties?: Record<string, string>,
    fill: boolean,
  }>
}
```

If the scene contains no blocks, `toStructure` throws.

## Putting it together: simple house

```js
const catalog = new BlockCatalog();
const scene = new Scene();

// Ground
scene.add(
  new Block("minecraft:grass_block", {
    size: [16, 1, 16],
    catalog,
  })
);

// Walls (hollow oak shell)
const walls = new Block("minecraft:oak_planks", {
  size: [12, 5, 12],
  fill: false,
  catalog,
});
walls.position = new Vector3(2, 1, 2);
scene.add(walls);

// Glass inset
const glass = new Block("minecraft:glass", {
  size: [10, 4, 10],
  catalog,
});
glass.position = new Vector3(3, 2, 3);
scene.add(glass);

// Single stair in front of the door
const stair = new Block("minecraft:oak_stairs", {
  catalog,
  properties: stairProperties({ facing: "south" }),
});
stair.position = new Vector3(8, 1, 1);
scene.add(stair);

// Export and assign to top-level constant
const structure = scene.toStructure({ padding: 0 });
```

For block‑specific configuration (stairs, slabs, logs, doors, etc.) see `03-blocks-reference.md`.
