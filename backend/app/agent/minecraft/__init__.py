"""
Minecraft structure SDK (Python).

This package exposes a small, Three.js-inspired API for composing Minecraft
voxel scenes in Python. The key primitives are:

- Scene / Object3D / Block / Vector3
- BlockCatalog for block-id validation and metadata
- Orientation helpers have been removed; pass explicit blockstate properties
  (e.g., facing/half/type/axis) directly as dictionaries.

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
]
