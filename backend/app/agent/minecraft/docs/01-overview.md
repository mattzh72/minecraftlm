# Minecraft SDK Overview

This SDK provides a small, Three.js‑style API for composing Minecraft scenes,
implemented in Python.

Instead of building a mesh scene graph, you build a graph of **blocks** and
**objects** and then export a plain Python dictionary with this shape:

```python
{
    "width": 16,
    "height": 12,
    "depth": 16,
    "blocks": [
        {
            "start": [0, 0, 0],   # inclusive
            "end":   [16, 1, 16], # exclusive
            "type": "minecraft:grass_block",
            "properties": {"snowy": "true"},
            "fill": True,         # solid cuboid
        },
    ],
}
```

The exported object is called the **structure**. Your script’s job is to
construct this structure using the SDK and assign it to a top‑level variable
named `structure`:

```python
structure = scene.to_structure(padding=0)
```

## General script structure (what you should write)

Every script using this SDK should roughly follow this pattern:

1. **Use the scaffolded imports**

   The initial script already imports the core SDK symbols for you. You can
   use these identifiers directly:

   - `Scene`
   - `Object3D`
   - `Block`
   - `Vector3`
   - `BlockCatalog`
   - Orientation helpers: `stair_properties`, `axis_properties`,
     `slab_properties`, `make_stair`, `facing_from_vector`

2. **Create a catalog and scene**

   ```python
   catalog = BlockCatalog()
   scene = Scene()
   ```

3. **Add blocks using a Three.js‑like API**

   ```python
   # Example ground plane (16×1×16 grass)
   scene.add(
   Block(
       "minecraft:grass_block",
       size=(16, 1, 16),
       properties={"snowy": "false"},  # grass_block requires snowy=true|false
       catalog=catalog,
   )
   )

   # Example wall of stone bricks
   wall = Block(
       "minecraft:stone_bricks",
       size=(10, 4, 1),
       catalog=catalog,
   )
   wall.position.set(3, 1, 5)  # x, y, z
   scene.add(wall)

   # Example stair in front of the wall
   stair = Block(
       "minecraft:stone_brick_stairs",
       catalog=catalog,
       properties=stair_properties(facing="south"),
   )
   stair.position.set(7, 1, 4)
   scene.add(stair)
   ```

4. **Export the structure**

   ```python
   structure = scene.to_structure(padding=0)
   ```

   The runtime will read the `structure` variable from your script.

   Note: `minecraft:grass_block` requires a `snowy` blockstate. Use
   `properties={"snowy": "false"}` for normal green grass.

## Core ideas

- **Three.js‑flavored API**  
  - `Scene` and `Object3D` support `position` and `add(…)` (like Three.js).
  - `Block` represents a cuboid of one Minecraft block type, with a `size`
    (in blocks) and optional blockstate `properties`.
  - `Vector3` mirrors the common Three.js vector API for positions.

- **Exported structure**  
  - `scene.to_structure()` flattens the graph into
    `{"width", "height", "depth", "blocks"}`.
  - Coordinates are 0‑indexed; `start` is inclusive and `end` is exclusive.

- **Block catalog and validation**  
  - `BlockCatalog` knows the full set of valid block ids and validates every
    `Block` on construction (including required properties).
  - Creating a `Block` with an unknown id raises an error, which helps catch
    typos early.

- **Orientation helpers**  
  - Many blocks are not simple cubes (stairs, slabs, logs, doors).
  - Helpers such as `stair_properties`, `axis_properties`, `slab_properties`,
    and `make_stair` map high‑level intent (e.g. “stair facing south,
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
  - By default `scene.to_structure(origin="min")` shifts the entire scene so
    that the minimum coordinates become `(0,0,0)`.
  - `padding` adds empty space around the exported structure.

For a deeper look at the API surface, see `02-api-scene.md`. For block ids and
configuration options (stairs, slabs, logs, doors, etc.), see
`03-blocks-reference.md`.
