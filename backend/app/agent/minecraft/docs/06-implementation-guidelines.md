# Implementation Guidelines & Tips

Use these guidelines to get clean, grounded builds and avoid common errors.

- **Always set directional properties for connecting blocks** (iron_bars, glass_pane, fences, walls). The renderer does not auto-connect based on neighbors. Without properties like `{"east": "true", "west": "true", "north": "false", "south": "false"}`, these blocks will render as small posts instead of connected bars/panes.
- Support stair roofs with backing `Block` volumes or slabs under each ring and at corners when the user wants everything connected and non‑floating.
- Attach ornaments (lanterns, finials, horns) via face‑adjacent blocks, stairs, slabs, or fences; don’t rely on diagonal contact.
- Set stair corner `shape` explicitly when you want turned corners; Minecraft won’t infer corner shapes from neighbors.
- For symmetric builds, compute true centers from dimensions (for example `cx = width // 2`, `cz = depth // 2`) before placing “centered” details like finials.
- **Terrain placement uses corner coordinates, not centers.** `Terrain.flatten_for_structure(x, z, width, depth, ...)` takes `x,z` as the **min/corner** of the flat area. `drop_to_surface(structure, terrain, x, z, ...)` also treats `x,z` as the **min/corner of the structure footprint**. To center on `(cx, cz)`, compute `place_x = cx - struct_width//2` and `place_z = cz - struct_depth//2` first.
- When users ask for “randomly scattered” landscape features, sample positions randomly or with noise and seed randomness for reproducibility; avoid circles/grids unless requested.
- Anchor terrain decorations to the surface using `terrain.get_height_at(x, z)` per placement (after flattening) or `drop_to_surface` for multi‑block objects to prevent floating/sunken trees.
- Derive roof/gate ornament `x,z` centers and `y` heights from the same parameters used to build the roof, and ensure vertical attachment so there’s no visible gap.
