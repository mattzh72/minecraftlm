"""
Minecraft structure SDK (Python).

This package exposes a small, Three.js-inspired API for composing Minecraft
voxel scenes in Python. The key primitives are:

- Scene / Object3D / Block / Vector3
- BlockCatalog for block-id validation and metadata
- Orientation helpers: stair_properties, axis_properties, slab_properties,
  make_stair, facing_from_vector

The agent should usually import from this package rather than individual
modules.
"""

from app.agent.minecraft.sdk import (
    BaseEraser,
    Block,
    BlockCatalog,
    BoxEraser,
    CylinderEraser,
    Object3D,
    Scene,
    SphereEraser,
    Vector3,
    axis_properties,
    facing_from_vector,
    make_stair,
    slab_properties,
    stair_properties,
)

__all__ = [
    "BaseEraser",
    "Block",
    "BlockCatalog",
    "BoxEraser",
    "CylinderEraser",
    "Object3D",
    "Scene",
    "SphereEraser",
    "Vector3",
    "axis_properties",
    "facing_from_vector",
    "make_stair",
    "slab_properties",
    "stair_properties",
]
