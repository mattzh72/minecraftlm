# Minecraft SDK Overview

This SDK provides a small, Three.js‑style API for composing Minecraft scenes.

Instead of building a mesh scene graph, you build a graph of **blocks** and
**objects** and then export a plain JavaScript object with this shape:

```js
{
  width: 16,
  height: 12,
  depth: 16,
  blocks: [
    {
      start: [0, 0, 0],   // inclusive
      end:   [16, 1, 16], // exclusive
      type: "minecraft:grass_block",
      properties: { snowy: "true" },
      fill: true,         // solid cuboid
    },
  ],
}
```

The exported object is called the **structure**. Your script’s job is to
construct this structure using the SDK and assign it to a top‑level constant
named `structure`:

```js
const structure = scene.toStructure({ padding: 0 });
```

## General script structure (what you should write)

Every script using this SDK should roughly follow this pattern:

1. **Assume core classes are available**

   You can use these identifiers directly in your script:

   - `Scene`
   - `Object3D`
   - `Block`
   - `Vector3`
   - `BlockCatalog`
   - Orientation helpers: `stairProperties`, `axisProperties`, `slabProperties`,
     `makeStair`, `facingFromVector`

   You do not need to import them or load any files.

2. **Create a catalog and scene**

   ```js
   const catalog = new BlockCatalog();
   const scene = new Scene();
   ```

3. **Add blocks using a Three.js‑like API**

   ```js
   // Example ground plane (16×1×16 grass)
   scene.add(
     new Block("minecraft:grass_block", {
       size: [16, 1, 16],
       catalog,
     })
   );

   // Example wall of stone bricks
   const wall = new Block("minecraft:stone_bricks", {
     size: [10, 4, 1],
     catalog,
   });
   wall.position.set(3, 1, 5); // x, y, z
   scene.add(wall);

   // Example stair in front of the wall
   const stair = new Block("minecraft:stone_brick_stairs", {
     catalog,
     properties: stairProperties({ facing: "south" }),
   });
   stair.position.set(7, 1, 4);
   scene.add(stair);
   ```

4. **Export the structure**

   ```js
   const structure = scene.toStructure({ padding: 0 });
   ```

   The agent runtime will read the `structure` constant from your script.

## Core ideas

- **Three.js‑flavored API**  
  - `Scene` and `Object3D` support `position` and `add(…)` (like Three.js).
  - `Block` represents a cuboid of one Minecraft block type, with a `size`
    (in blocks) and optional blockstate `properties`.
  - `Vector3` mirrors the common Three.js vector API for positions.

- **Exported structure**  
  - `scene.toStructure()` flattens the graph into `{ width, height, depth, blocks }`.
  - Coordinates are 0‑indexed; `start` is inclusive and `end` is exclusive.

- **Block catalog and validation**  
  - `BlockCatalog` knows the full set of valid block ids.
  - Creating a `Block` with an unknown id throws, which helps catch typos early.

- **Orientation helpers**  
  - Many blocks are not simple cubes (stairs, slabs, logs, doors).
  - Helpers such as `stairProperties`, `axisProperties`, `slabProperties`,
    and `makeStair` map high‑level intent (e.g. “stair facing south,
    upside‑down”) to the correct blockstate properties.

## Coordinate system & units

- **Units**  
  - All positions and sizes are in **blocks**, not meters.
  - A `Block` with `size: [1,1,1]` is a single block (voxel).

- **Axes**  
  - `x`: east (+) / west (–)  
  - `y`: up (+) / down (–)  
  - `z`: south (+) / north (–)

- **Scene origin and padding**
  - By default `scene.toStructure({ origin: "min" })` shifts the entire scene so that the minimum coordinates become `(0,0,0)`.
  - `padding` adds empty space around the exported structure.

For a deeper look at the API surface, see `02-api-scene.md`. For block ids and
configuration options (stairs, slabs, logs, doors, etc.), see
`03-blocks-reference.md`.
