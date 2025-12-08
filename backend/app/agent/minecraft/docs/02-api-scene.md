# Scene & Object API (Three.js‑style)

This document focuses on the high‑level scene graph classes you use most often:
`Scene`, `Object3D`, `Block`, `Vector3`, and `BlockCatalog`.

In your script you can use these identifiers directly; the scaffolded imports
already bring them into scope.

## `BlockCatalog`

Catalog of all known block ids.

```python
catalog = BlockCatalog()
```

- **Key properties/methods**
  - `catalog.block_ids: set[str]` – all valid block ids
    (namespaced as `minecraft:…`).
  - `catalog.assets` – raw decoded `assets` object (blockstates, models,
    textures).
  - `catalog.block_properties: dict[str, dict[str, tuple[str, ...]]]` –
    per‑block mapping of property name to allowed values.
  - `catalog.required_properties: dict[str, tuple[str, ...]]` – per‑block
    tuple of property names that are inferred to be required (e.g. `axis` for
    logs, `facing`/`half`/`shape` for stairs).
  - `catalog.assert_valid(id: str) -> str` – normalizes and verifies:
    - Adds `minecraft:` prefix if missing.
    - Raises `ValueError` if the block is unknown.
  - `catalog.assert_properties(id: str, properties: Mapping[str, str])` –
    validates property names/values and required properties for a block.

Use `BlockCatalog` whenever you construct a `Block` to catch typos early.

## `Vector3`

Minimal 3D vector implementation used for positions, inspired by Three.js.

```python
v = Vector3(1, 2, 3)
v.add(Vector3(0, 1, 0))  # (1, 3, 3)
arr = v.to_tuple()       # (1, 3, 3)
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

```python
obj = Object3D()
obj.position = Vector3(5, 1, 0)

child = Object3D()
child.position = Vector3(0, 2, 0)

obj.add(child)
```

- Properties:
  - `position: Vector3` – world position (relative to parent).
  - `children: Object3D[]` – list of children.
- Methods:
  - `add(...objects: Object3D[])` – append children, returns `this`.

`Scene` and `Block` both extend `Object3D`.

## `Block`

Represents a cuboid of a single Minecraft block type. This is the main primitive you instantiate and position, analogous to a mesh in Three.js.

```python
block = Block(
    "minecraft:stone",
    size=(2, 1, 2),      # width, height, depth in blocks
    fill=True,           # solid cuboid
    properties={},       # blockstate props (optional)
    catalog=catalog,     # BlockCatalog instance
)

block.position = Vector3(4, 1, 4)
```

- Constructor:

  ```python
  Block(
      block_id,
      size=(1, 1, 1),
      properties=None,
      fill=True,
      catalog=None,
  )
  ```

  - `block_id` – logical block type; normalized/validated via `catalog.assert_valid`.
  - `size` – `(width, height, depth)` in blocks; use values >1 for larger cuboids.
  - `properties` – blockstate properties (orientation, variants, etc.).
  - `fill`
    - `True` – solid cuboid: every block within the volume is placed.
    - `False` – hollow shell: only faces are placed (like a hollow box).

- Methods:
  - `setProperties(props: Record<string, string>)` – replace properties.
  - `mergeProperties(extra: Record<string, string>)` – shallow merge.

Example: a 10‑wide, 3‑high wall of `stone_bricks`:

```python
wall = Block(
    "minecraft:stone_bricks",
    size=(10, 3, 1),
    fill=True,
    catalog=catalog,
)
wall.position = Vector3(3, 1, 5)
scene.add(wall)
```

## `Scene`

Root node that holds your graph of `Object3D` and `Block` instances. Responsible for flattening the graph into the JSON format consumed by the legacy viewer.

```python
scene = Scene()
# add blocks and child objects

structure = scene.to_structure()  # {"width", "height", "depth", "blocks"}
```

- Inherits:
  - `position: Vector3`
  - `children: Object3D[]`
  - `add(...objects)`

- Methods:
  - `flattenBlocks(parentOffset?: Vector3)` – internal; walks children and returns a flat list of `{ block, position }` with world coordinates.
  - `toStructure(options?)` – public API for exporting.

### `scene.toStructure(options)`

```python
structure = scene.to_structure(
    origin="min",      # "min" or any other value
    padding=0,         # integer padding (blocks) around structure
    dimensions={
        "width": 32,   # optional override
        "height": 16,
        "depth": 32,
    },
)
```

- `origin`:
  - `"min"` (default) – subtracts the minimum `x,y,z` from all placements so the smallest block coordinate becomes `(0,0,0)`, then applies `padding`.
  - Any other value – treats current world positions as absolute and only applies `padding`.

- `padding`:
  - Adds empty space around the structure: final width/height/depth are increased by `2*padding` if you use the default dimension calculation.

- `dimensions`:
  - Optional explicit `{ width, height, depth }` if you want to override the automatically computed size.

Returns:

```python
{
    "width": int,
    "height": int,
    "depth": int,
    "blocks": [
        {
            "start": [int, int, int],
            "end": [int, int, int],
            "type": "minecraft:oak_planks",
            "properties": {"key": "value"},  # optional
            "fill": bool,
        },
        # ...
    ],
}
```

If the scene contains no blocks, `toStructure` throws.

## Putting it together: simple house

```python
catalog = BlockCatalog()
scene = Scene()

# Ground
scene.add(
    Block(
        "minecraft:grass_block",
        size=(16, 1, 16),
        properties={"snowy": "false"},  # grass needs explicit snowy state
        catalog=catalog,
    )
)

# Walls (hollow oak shell)
walls = Block(
    "minecraft:oak_planks",
    size=(12, 5, 12),
    fill=False,
    catalog=catalog,
)
walls.position = Vector3(2, 1, 2)
scene.add(walls)

# Glass inset
glass = Block(
    "minecraft:glass",
    size=(10, 4, 10),
    catalog=catalog,
)
glass.position = Vector3(3, 2, 3)
scene.add(glass)

# Single stair in front of the door
stair = Block(
    "minecraft:oak_stairs",
    catalog=catalog,
    properties=stair_properties(facing="south"),
)
stair.position = Vector3(8, 1, 1)
scene.add(stair)

# Export and assign to top-level variable
structure = scene.to_structure(padding=0)
```

Note: `minecraft:grass_block` has only `snowy=true|false` variants in the assets;
set `snowy` explicitly (usually `"false"`) or the renderer may drop the block.

For block‑specific configuration (stairs, slabs, logs, doors, etc.) see `03-blocks-reference.md`.
