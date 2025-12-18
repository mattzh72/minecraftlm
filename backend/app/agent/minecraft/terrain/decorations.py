"""
Decoration generators for terrain.

Provides procedural generation of natural decorations for terrain biomes:
trees, plants, and small props.

Example:
    tree = generate_oak_tree(50, 64, 50, catalog=catalog, seed=42)
    scene.add(tree)
"""

from __future__ import annotations

from typing import Optional

from app.agent.minecraft.sdk import Block, BlockCatalog, Object3D


def _seeded_int(seed: int) -> int:
    return (seed * 1103515245 + 12345) & 0x7FFFFFFF


def _make_trunk(
    x: int,
    y: int,
    z: int,
    block_id: str,
    height: int,
    catalog: BlockCatalog,
    radius_x: int = 0,
    radius_z: int = 0,
) -> Block:
    """Create a trunk column (optionally wider than 1x1)."""
    trunk = Block(
        block_id,
        size=(radius_x * 2 + 1, height, radius_z * 2 + 1),
        properties={"axis": "y"},
        catalog=catalog,
    )
    trunk.position.set(x - radius_x, y, z - radius_z)
    return trunk


def _make_blob_leaves(
    x: int,
    y: int,
    z: int,
    block_id: str,
    radius_x: int,
    radius_y: int,
    radius_z: int,
    catalog: BlockCatalog,
) -> Block:
    """Create a filled rectangular blob of leaves."""
    size = (radius_x * 2 + 1, radius_y * 2 + 1, radius_z * 2 + 1)
    blob = Block(block_id, size=size, fill=True, catalog=catalog)
    blob.position.set(x - radius_x, y - radius_y, z - radius_z)
    return blob


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

    seed_val = _seeded_int(seed)

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
        properties={"axis": "y"},
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


def generate_birch_tree(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a procedural birch tree."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 17

    seed_val = _seeded_int(seed)
    trunk_height = 5 + (seed_val % 3)  # 5-7
    canopy_radius = 2

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = Block(
        "minecraft:birch_log",
        size=(1, trunk_height, 1),
        properties={"axis": "y"},
        catalog=catalog,
    )
    trunk.position.set(0, 0, 0)
    tree.add(trunk)

    canopy = Block(
        "minecraft:birch_leaves",
        size=(canopy_radius * 2 + 1, 3, canopy_radius * 2 + 1),
        fill=True,
        catalog=catalog,
    )
    canopy.position.set(-canopy_radius, trunk_height - 2, -canopy_radius)
    tree.add(canopy)

    return tree


def generate_tall_birch(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a taller birch with slender canopy."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 23

    seed_val = _seeded_int(seed)
    trunk_height = 8 + (seed_val % 4)  # 8-11
    canopy_radius = 2

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:birch_log", trunk_height, catalog)
    tree.add(trunk)

    canopy = _make_blob_leaves(
        0,
        trunk_height - 1,
        0,
        "minecraft:birch_leaves",
        canopy_radius,
        1,
        canopy_radius + 1,
        catalog,
    )
    tree.add(canopy)

    return tree


def generate_big_oak(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a broader oak with 2x2 trunk and wide canopy."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 41

    seed_val = _seeded_int(seed)
    trunk_height = 5 + (seed_val % 3)  # 5-7
    canopy_radius = 3 + ((seed_val // 7) % 2)  # 3-4

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:oak_log", trunk_height, catalog, radius_x=1, radius_z=1)
    tree.add(trunk)

    canopy = _make_blob_leaves(
        0,
        trunk_height,
        0,
        "minecraft:oak_leaves",
        canopy_radius,
        2,
        canopy_radius,
        catalog,
    )
    tree.add(canopy)

    # Denser bottom layer
    bottom = _make_blob_leaves(
        0,
        trunk_height - 1,
        0,
        "minecraft:oak_leaves",
        canopy_radius,
        0,
        canopy_radius,
        catalog,
    )
    tree.add(bottom)

    return tree


def generate_stumpy_oak(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a short oak with flat canopy."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 53

    seed_val = _seeded_int(seed)
    trunk_height = 3 + (seed_val % 2)  # 3-4
    canopy_radius = 2

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:oak_log", trunk_height, catalog)
    tree.add(trunk)

    canopy = _make_blob_leaves(
        0,
        trunk_height,
        0,
        "minecraft:oak_leaves",
        canopy_radius + 1,
        0,
        canopy_radius + 1,
        catalog,
    )
    tree.add(canopy)

    return tree


def generate_spruce_tree(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
    snow_cap: bool = False,
) -> Object3D:
    """Generate a procedural spruce tree."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 31

    seed_val = _seeded_int(seed)
    trunk_height = 6 + (seed_val % 4)  # 6-9

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = Block(
        "minecraft:spruce_log",
        size=(1, trunk_height, 1),
        properties={"axis": "y"},
        catalog=catalog,
    )
    trunk.position.set(0, 0, 0)
    tree.add(trunk)

    # Simple conical-ish canopy (stacked blobs)
    for i, radius in enumerate([2, 2, 1]):
        layer_height = trunk_height - 2 + i
        footprint = radius * 2 + 1

        layer = Block(
            "minecraft:spruce_leaves",
            size=(footprint, 1, footprint),
            fill=True,
            catalog=catalog,
        )
        layer.position.set(-radius, layer_height, -radius)
        tree.add(layer)

        if snow_cap:
            snow = Block(
                "minecraft:snow",
                size=(footprint, 1, footprint),
                properties={"layers": "1"},
                catalog=catalog,
            )
            snow.position.set(-radius, layer_height + 1, -radius)
            tree.add(snow)

    return tree


def generate_tall_spruce(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
    snow_cap: bool = False,
) -> Object3D:
    """Generate a taller spruce with more taper."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 37

    seed_val = _seeded_int(seed)
    trunk_height = 10 + (seed_val % 4)  # 10-13

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:spruce_log", trunk_height, catalog)
    tree.add(trunk)

    canopy_radii = [3, 2, 2, 1]
    for i, radius in enumerate(canopy_radii):
        layer_height = trunk_height - 3 + i
        footprint = radius * 2 + 1
        layer = Block(
            "minecraft:spruce_leaves",
            size=(footprint, 1, footprint),
            fill=True,
            catalog=catalog,
        )
        layer.position.set(-radius, layer_height, -radius)
        tree.add(layer)

        if snow_cap:
            snow = Block(
                "minecraft:snow",
                size=(footprint, 1, footprint),
                properties={"layers": "1"},
                catalog=catalog,
            )
            snow.position.set(-radius, layer_height + 1, -radius)
            tree.add(snow)

    return tree


def generate_layered_spruce(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
    snow_cap: bool = False,
) -> Object3D:
    """Generate a multi-level spruce with heavier canopy."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 43

    seed_val = _seeded_int(seed)
    trunk_height = 9 + (seed_val % 3)  # 9-11

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:spruce_log", trunk_height, catalog)
    tree.add(trunk)

    canopy_radii = [3, 3, 2, 2, 1]
    for i, radius in enumerate(canopy_radii):
        layer_height = trunk_height - 4 + i
        footprint = radius * 2 + 1
        layer = Block(
            "minecraft:spruce_leaves",
            size=(footprint, 1, footprint),
            fill=True,
            catalog=catalog,
        )
        layer.position.set(-radius, layer_height, -radius)
        tree.add(layer)

        if snow_cap:
            snow = Block(
                "minecraft:snow",
                size=(footprint, 1, footprint),
                properties={"layers": "1"},
                catalog=catalog,
            )
            snow.position.set(-radius, layer_height + 1, -radius)
            tree.add(snow)

    return tree


def generate_pine(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
    snow_cap: bool = False,
) -> Object3D:
    """Generate a sparse pine: tall trunk with a small crown."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 61

    seed_val = _seeded_int(seed)
    trunk_height = 7 + (seed_val % 4)  # 7-10

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:spruce_log", trunk_height, catalog)
    tree.add(trunk)

    crown_radius = 1
    crown = _make_blob_leaves(
        0,
        trunk_height,
        0,
        "minecraft:spruce_leaves",
        crown_radius,
        1,
        crown_radius,
        catalog,
    )
    tree.add(crown)

    if snow_cap:
        snow = Block(
            "minecraft:snow",
            size=(crown_radius * 2 + 1, 1, crown_radius * 2 + 1),
            properties={"layers": "1"},
            catalog=catalog,
        )
        snow.position.set(-crown_radius, trunk_height + 1, -crown_radius)
        tree.add(snow)

    return tree


def generate_acacia_tree(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a simple acacia with a flat, offset canopy."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 73

    seed_val = _seeded_int(seed)
    trunk_height = 5 + (seed_val % 2)  # 5-6

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:acacia_log", trunk_height, catalog)
    tree.add(trunk)

    # Offset canopy
    offset_x = (seed_val % 3) - 1  # -1, 0, or 1
    offset_z = ((seed_val // 3) % 3) - 1
    canopy = _make_blob_leaves(
        offset_x,
        trunk_height,
        offset_z,
        "minecraft:acacia_leaves",
        3,
        0,
        2,
        catalog,
    )
    tree.add(canopy)

    return tree


def generate_dead_tree(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Object3D:
    """Generate a leafless dead tree with small branches."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 81

    seed_val = _seeded_int(seed)
    trunk_height = 3 + (seed_val % 3)  # 3-5

    tree = Object3D()
    tree.position.set(x, y, z)

    trunk = _make_trunk(0, 0, 0, "minecraft:oak_log", trunk_height, catalog)
    tree.add(trunk)

    # Simple branches
    branches = [
        (1, trunk_height - 1, 0),
        (-1, trunk_height - 2, 0),
        (0, trunk_height - 1, 1),
    ]
    for bx, by, bz in branches:
        branch = Block(
            "minecraft:oak_log",
            size=(1, 1, 2),
            properties={"axis": "z"} if bz != 0 else {"axis": "x"},
            catalog=catalog,
        )
        branch.position.set(bx, by, bz)
        tree.add(branch)

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
        y: Y position (surface height; flower placed at y).
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
    flower.position.set(x, y, z)
    return flower


def generate_dead_bush(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
) -> Block:
    """Generate a dead bush block (placed at y)."""
    catalog = catalog or BlockCatalog()
    bush = Block(
        "minecraft:dead_bush",
        size=(1, 1, 1),
        catalog=catalog,
    )
    bush.position.set(x, y, z)
    return bush


def generate_cactus(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
    seed: Optional[int] = None,
) -> Block:
    """Generate a cactus column (base placed at y)."""
    catalog = catalog or BlockCatalog()
    if seed is None:
        seed = x * 1000 + z + 101

    height = 2 + (_seeded_int(seed) % 3)  # 2-4
    cactus = Block(
        "minecraft:cactus",
        size=(1, height, 1),
        fill=True,
        catalog=catalog,
    )
    cactus.position.set(x, y, z)
    return cactus


def generate_tall_grass(
    x: int,
    y: int,
    z: int,
    catalog: Optional[BlockCatalog] = None,
) -> Block:
    """Generate a tall grass block.

    Args:
        x: X position.
        y: Y position (surface height; grass placed at y).
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
    grass.position.set(x, y, z)
    return grass
