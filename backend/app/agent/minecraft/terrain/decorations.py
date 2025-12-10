"""
Decoration generators for terrain.

Provides procedural generation of natural decorations for plains biome:
oak trees, flowers, and tall grass.

Example:
    tree = generate_oak_tree(50, 64, 50, catalog=catalog, seed=42)
    scene.add(tree)
"""

from __future__ import annotations

from typing import Optional

from app.agent.minecraft.sdk import Block, BlockCatalog, Object3D, axis_properties


def generate_oak_tree(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a procedural oak tree.

    Creates a tree with trunk and leaf canopy at the specified position.
    Tree height and canopy size vary based on seed for natural variety.

    Args:
        x: X position (tree base).
        y: Y position (ground level).
        z: Z position (tree base).
        catalog: Block catalog for validation.
        seed: Random seed for variety (uses position if None).

    Returns:
        Object3D containing trunk and canopy blocks.
    """
    catalog = catalog or BlockCatalog()

    # Use seed to vary tree size
    if seed is None:
        seed = x * 1000 + z

    # Simple deterministic variation based on seed
    seed_val = (seed * 1103515245 + 12345) & 0x7FFFFFFF

    # Trunk height varies from 4-7
    trunk_height = 4 + (seed_val % 4)

    # Canopy size varies
    canopy_radius = 2 + (seed_val % 2)
    canopy_height = 2 + ((seed_val >> 4) % 2)

    tree = Object3D()
    tree.position.set(x, y, z)

    # Trunk
    trunk = Block(
        "minecraft:oak_log",
        size=(1, trunk_height, 1),
        properties=axis_properties("y"),
        catalog=catalog,
    )
    trunk.position.set(0, 0, 0)
    tree.add(trunk)

    # Canopy (leaves)
    canopy_width = canopy_radius * 2 + 1
    canopy_depth = canopy_radius * 2 + 1

    # Main canopy blob
    canopy = Block(
        "minecraft:oak_leaves",
        size=(canopy_width, canopy_height, canopy_depth),
        fill=True,
        catalog=catalog,
    )
    canopy.position.set(-canopy_radius, trunk_height - 1, -canopy_radius)
    tree.add(canopy)

    # Top layer (smaller)
    if canopy_height >= 2:
        top_radius = max(1, canopy_radius - 1)
        top_width = top_radius * 2 + 1
        top = Block(
            "minecraft:oak_leaves",
            size=(top_width, 1, top_width),
            fill=True,
            catalog=catalog,
        )
        top.position.set(-top_radius, trunk_height - 1 + canopy_height, -top_radius)
        tree.add(top)

    return tree


def generate_flowers(
    x: int,
    y: int,
    z: int,
    flower_type: Optional[str] = None,
    catalog: Optional[BlockCatalog] = None,
) -> Block:
    """Generate a flower block.

    Args:
        x: X position.
        y: Y position (ground level, flower placed at y+1).
        z: Z position.
        flower_type: Type of flower (random if None).
            Options: "poppy", "dandelion", "cornflower", "oxeye_daisy"
        catalog: Block catalog for validation.

    Returns:
        Block representing the flower.
    """
    catalog = catalog or BlockCatalog()

    # Available flower types
    flowers = [
        "minecraft:poppy",
        "minecraft:dandelion",
        "minecraft:cornflower",
        "minecraft:oxeye_daisy",
        "minecraft:azure_bluet",
    ]

    if flower_type:
        block_id = f"minecraft:{flower_type}"
        if block_id not in flowers:
            block_id = flowers[0]
    else:
        # Select based on position for deterministic variety
        index = (x * 7 + z * 13) % len(flowers)
        block_id = flowers[index]

    flower = Block(
        block_id,
        size=(1, 1, 1),
        catalog=catalog,
    )
    flower.position.set(x, y + 1, z)  # Place on top of ground
    return flower


def generate_tall_grass(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
) -> Block:
    """Generate a tall grass block.

    Args:
        x: X position.
        y: Y position (ground level, grass placed at y+1).
        z: Z position.
        catalog: Block catalog for validation.

    Returns:
        Block representing tall grass.
    """
    catalog = catalog or BlockCatalog()

    # Use short grass (tall grass is 2-block and more complex)
    grass = Block(
        "minecraft:short_grass",
        size=(1, 1, 1),
        catalog=catalog,
    )
    grass.position.set(x, y + 1, z)
    return grass
