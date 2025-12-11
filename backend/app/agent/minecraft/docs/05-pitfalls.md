# Common Pitfalls

- Stair-based roofs built from hollow rings of stairs can leave visible gaps and a “floating” feel. When the user wants everything connected, add solid `Block` volumes or slabs under each ring (and at the corners) so every visible stair has face-adjacent support.
- Do not rely on diagonal contact for structural support. Lanterns, finials, horns, and other ornaments should attach via full blocks, stairs, slabs, or fences so they are clearly connected rather than hovering or only touching at corners.
- Stair corner shapes are not inferred automatically from neighbors. If you want turned stair corners instead of straight seams with tiny gaps, set an appropriate `shape` in the stair properties.
- For symmetric builds, compute true centers from the structure dimensions (for example `cx = width // 2`, `cz = depth // 2`) when placing “centered” details like a roof finial. Reusing loop indices such as `current_min` often points at the last ring’s corner instead of the actual center, which visibly misaligns decorations.
