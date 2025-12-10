"""
Structure placement helpers for terrain.

Provides simple utilities to place structures on terrain surfaces
with optional gap filling.

Example:
    terrain = create_terrain(128, 128)
    terrain.generate()

    house = build_my_house()

    # Drop house onto terrain surface at (64, 64)
    dropped = drop_to_surface(house, terrain, 64, 64)

    scene = Scene()
    scene.add(terrain)
    scene.add(dropped)
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from app.agent.minecraft.sdk import Block, BlockCatalog, Object3D, Vector3


def drop_to_surface(
    structure: Object3D,
    terrain: "Terrain",
    x: int,
    z: int,
    fill_bottom: bool = False,
    fill_material: str = "minecraft:cobblestone",
    catalog: Optional[BlockCatalog] = None,
) -> Object3D:
    """Drop a structure onto the terrain surface.

    Positions the structure so its bottom sits on the terrain at (x, z).
    Optionally fills gaps between the structure and terrain.

    Args:
        structure: Structure to place (Object3D with Block children).
        terrain: Terrain to place on (must be generated).
        x: X position for structure placement.
        z: Z position for structure placement.
        fill_bottom: If True, fill gaps between structure bottom and terrain.
        fill_material: Block type for fill (default: cobblestone).
        catalog: Block catalog for validation.

    Returns:
        Object3D containing the positioned structure (and fill blocks if enabled).

    Example:
        # Simple drop
        dropped = drop_to_surface(house, terrain, 64, 64)

        # With gap filling
        dropped = drop_to_surface(house, terrain, 64, 64,
                                  fill_bottom=True,
                                  fill_material="minecraft:stone_bricks")

        scene = Scene()
        scene.add(terrain)
        scene.add(dropped)
    """
    catalog = catalog or BlockCatalog()

    # Calculate structure footprint and bounds
    footprint = _calculate_footprint(structure)
    struct_min_x, struct_min_z, struct_max_x, struct_max_z = footprint
    struct_min_y = _calculate_min_y(structure)

    struct_width = struct_max_x - struct_min_x
    struct_depth = struct_max_z - struct_min_z

    # Get terrain height at placement location
    # Use average height under footprint for stability
    total_height = 0
    count = 0
    for dz in range(int(struct_depth)):
        for dx in range(int(struct_width)):
            h = terrain.get_height_at(x + dx, z + dz)
            total_height += h
            count += 1

    surface_height = total_height // count if count > 0 else terrain.get_height_at(x, z)

    # Calculate Y offset to place structure bottom on surface
    # Structure's local min_y should align with surface_height
    y_offset = surface_height - struct_min_y

    # Create result container
    result = Object3D()

    # Clone and reposition structure
    positioned_structure = _clone_structure(structure)
    positioned_structure.position.set(
        x - struct_min_x,  # Align structure origin to placement x
        y_offset,
        z - struct_min_z,  # Align structure origin to placement z
    )
    result.add(positioned_structure)

    # Fill gaps if requested
    if fill_bottom:
        fill_blocks = _generate_fill(
            x, z,
            int(struct_width), int(struct_depth),
            surface_height,
            terrain,
            fill_material,
            catalog,
        )
        for block in fill_blocks:
            result.add(block)

    return result


def _calculate_footprint(structure: Object3D) -> Tuple[float, float, float, float]:
    """Calculate structure footprint (min_x, min_z, max_x, max_z) in local coords."""
    min_x = float("inf")
    min_z = float("inf")
    max_x = float("-inf")
    max_z = float("-inf")

    def traverse(obj: Object3D, offset: Vector3) -> None:
        nonlocal min_x, min_z, max_x, max_z

        world_pos = Vector3(
            offset.x + obj.position.x,
            offset.y + obj.position.y,
            offset.z + obj.position.z,
        )

        if isinstance(obj, Block):
            x1 = world_pos.x
            z1 = world_pos.z
            x2 = x1 + obj.size[0]
            z2 = z1 + obj.size[2]

            min_x = min(min_x, x1)
            min_z = min(min_z, z1)
            max_x = max(max_x, x2)
            max_z = max(max_z, z2)

        for child in obj.children:
            traverse(child, world_pos)

    traverse(structure, Vector3())

    if min_x == float("inf"):
        return (0, 0, 0, 0)

    return (min_x, min_z, max_x, max_z)


def _calculate_min_y(structure: Object3D) -> float:
    """Calculate minimum Y coordinate of structure."""
    min_y = float("inf")

    def traverse(obj: Object3D, offset: Vector3) -> None:
        nonlocal min_y

        world_pos = Vector3(
            offset.x + obj.position.x,
            offset.y + obj.position.y,
            offset.z + obj.position.z,
        )

        if isinstance(obj, Block):
            min_y = min(min_y, world_pos.y)

        for child in obj.children:
            traverse(child, world_pos)

    traverse(structure, Vector3())

    return min_y if min_y != float("inf") else 0


def _clone_structure(structure: Object3D) -> Object3D:
    """Create a shallow clone of structure for repositioning."""
    clone = Object3D()
    clone.position = structure.position.clone()
    clone.children = list(structure.children)  # Shallow copy children
    return clone


def _generate_fill(
    x: int,
    z: int,
    width: int,
    depth: int,
    surface_height: int,
    terrain: "Terrain",
    fill_material: str,
    catalog: BlockCatalog,
) -> List[Block]:
    """Generate fill blocks between structure bottom and terrain."""
    blocks = []

    for dz in range(depth):
        for dx in range(width):
            fill_x = x + dx
            fill_z = z + dz

            terrain_height = terrain.get_height_at(fill_x, fill_z)

            # Fill from terrain surface up to structure bottom (surface_height)
            if terrain_height < surface_height:
                fill_height = surface_height - terrain_height

                block = Block(
                    fill_material,
                    size=(1, fill_height, 1),
                    catalog=catalog,
                )
                block.position.set(fill_x, terrain_height, fill_z)
                blocks.append(block)

    return blocks


# Type hint import (avoid circular import)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.agent.minecraft.terrain.terrain import Terrain
