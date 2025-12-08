"""
Example: build a simple oak tree structure using the Python Minecraft SDK.

This script defines a trunk of oak logs and a canopy of oak leaves, then
exports a structure dictionary via the top-level `structure` variable.
"""

import json
from pathlib import Path

from app.agent.minecraft import Scene, Block, BlockCatalog, axis_properties


def build_structure() -> dict:
    """Build and return a simple tree structure."""
    catalog = BlockCatalog()
    scene = Scene()

    # Choose a rough center for the tree
    base_x, base_y, base_z = 8, 0, 8

    # Trunk: vertical column of oak logs
    trunk_height = 5
    trunk = Block(
        "minecraft:oak_log",
        size=(1, trunk_height, 1),
        properties=axis_properties("y"),
        catalog=catalog,
    )
    trunk.position.set(base_x, base_y, base_z)
    scene.add(trunk)

    # Canopy: blob of oak leaves around the top of the trunk
    # Use a 5x3x5 volume, centered on the trunk top
    canopy_width = 5
    canopy_height = 3
    canopy_depth = 5

    canopy = Block(
        "minecraft:oak_leaves",
        size=(canopy_width, canopy_height, canopy_depth),
        fill=True,
        catalog=catalog,
    )

    # Position canopy so that the middle layer sits on top of the trunk
    canopy_origin_x = base_x - canopy_width // 2
    canopy_origin_y = base_y + trunk_height - 1
    canopy_origin_z = base_z - canopy_depth // 2
    canopy.position.set(
        canopy_origin_x,
        canopy_origin_y,
        canopy_origin_z,
    )
    scene.add(canopy)

    # Export to structure dict
    structure = scene.to_structure(padding=1)
    return structure


structure = build_structure()


if __name__ == "__main__":
    out_path = Path(__file__).with_suffix(".json")
    out_path.write_text(json.dumps(structure, indent=2))
    print(f"Wrote tree structure JSON to {out_path}")
