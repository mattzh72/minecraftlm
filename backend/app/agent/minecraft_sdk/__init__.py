"""
Minecraft structure SDK (Python).

This package exposes a small, Three.js-inspired API for composing Minecraft
voxel scenes in Python. The key primitives are:

- Scene / Group / Object3D / Block / Vector3
- BlockCatalog for block-id validation and metadata
- Orientation helpers: stair_properties, axis_properties, slab_properties,
  make_stair, facing_from_vector
- Composition helpers: instantiate, box/hollow_box/column/platform, stair_run

The agent should usually import from this package rather than individual
modules.
"""

from app.agent.minecraft_sdk.sdk import (
    Block,
    BlockCatalog,
    Group,
    Object3D,
    Scene,
    Vector3,
    axis_properties,
    box,
    column,
    facing_from_vector,
    hollow_box,
    instantiate,
    make_stair,
    platform,
    slab_properties,
    stair_run,
    stair_properties,
)

__all__ = [
    "Block",
    "BlockCatalog",
    "Group",
    "Object3D",
    "Scene",
    "Vector3",
    "axis_properties",
    "box",
    "column",
    "facing_from_vector",
    "hollow_box",
    "instantiate",
    "make_stair",
    "platform",
    "slab_properties",
    "stair_run",
    "stair_properties",
]
